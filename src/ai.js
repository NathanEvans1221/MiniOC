const https = require('https');
const { spawn } = require('child_process');
const logger = require('./logger');

function buildPrompt(userId, message, history) {
    return `User: ${message}\nPlease provide a short response:`;
}

async function callMiniMaxAPI(apiKey, baseURL, model, prompt) {
    return new Promise((resolve, reject) => {
        const url = new URL('/v1/text/chatcompletion_v2', baseURL);

        const postData = JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }]
        });

        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 60000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.base_resp?.status_code && result.base_resp.status_code !== 0) {
                        reject(new Error(`MiniMax API error: ${result.base_resp.status_msg}`));
                        return;
                    }
                    const answer = result.choices?.[0]?.message?.content || result.reply;
                    if (answer) {
                        resolve(answer);
                    } else {
                        resolve(data);
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse API response: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('API request timed out'));
        });

        req.write(postData);
        req.end();
    });
}

async function callOpenCode(model, prompt) {
    return new Promise((resolve, reject) => {
        const args = ['run', '--format', 'json'];

        if (model) {
            args.push('--model', model);
        }

        args.push('--', prompt);

        const customEnv = {
            ...process.env,
            ANTHROPIC_BASE_URL: process.env.MINIOC_BASE_URL,
            ANTHROPIC_AUTH_TOKEN: process.env.MINIOC_API_KEY
        };

        // Use 'sh -c' to pipe 'yes' into opencode to bypass interactive prompts automatically
        const command = `yes | opencode ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;
        logger.debug(`Executing: ${command}`);

        const child = spawn('sh', ['-c', command], { env: customEnv });

        let stdout = '';
        let stderr = '';
        let timeoutId;

        child.on('error', (error) => {
            clearTimeout(timeoutId);
            const errorMsg = error?.message || 'Unknown error';
            logger.error(`Failed to spawn opencode process: ${errorMsg}`, error);
            reject(new Error(`Failed to spawn opencode: ${errorMsg}`));
        });

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
            logger.debug(`opencode stderr: ${data.toString()}`);
        });

        child.on('close', (code) => {
            clearTimeout(timeoutId);

            if (code !== 0) {
                logger.error(`opencode exited with code ${code}`);
                reject(new Error(stderr || `opencode failed with exit code ${code}`));
                return;
            }

            let cleanOutput = stdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();

            try {
                const lines = cleanOutput.split('\n');
                for (const line of lines) {
                    const obj = JSON.parse(line);
                    if (obj.type === 'text' && obj.part?.text) {
                        cleanOutput = obj.part.text;
                        break;
                    }
                }
            } catch (e) {
                // Not JSON, use as-is
            }

            resolve(cleanOutput);
        });

        timeoutId = setTimeout(() => {
            child.kill();
            logger.error('opencode timed out after 60 seconds');
            reject(new Error('opencode timed out after 60 seconds'));
        }, 60000);
    });
}

async function processMessage(userId, message, history) {
    const prompt = buildPrompt(userId, message, history);
    const apiKey = process.env.MINIOC_API_KEY;
    const baseURL = process.env.MINIOC_BASE_URL || 'https://api.minimax.io';
    const model = process.env.MINIOC_MODEL || 'MiniMax-M3';

    if (!apiKey) {
        throw new Error('MINIOC_API_KEY is not set in .env');
    }

    logger.info(`Processing message for user ${userId}`);

    // Check if using opencode model
    if (model.startsWith('opencode/')) {
        logger.debug(`Using OpenCode mode`);
        try {
            const response = await callOpenCode(model, prompt);
            logger.success(`AI response received for user ${userId}`);
            return response;
        } catch (error) {
            logger.error(`OpenCode error: ${error.message}`);
            throw error;
        }
    }

    // Use MiniMax API directly
    logger.debug(`API - BASE_URL: ${baseURL}`);
    logger.debug(`API - MODEL: ${model}`);

    try {
        const response = await callMiniMaxAPI(apiKey, baseURL, model, prompt);
        logger.success(`AI response received for user ${userId}`);
        return response;
    } catch (error) {
        logger.error(`AI API error: ${error.message}`);
        throw error;
    }
}

module.exports = { processMessage, buildPrompt };
