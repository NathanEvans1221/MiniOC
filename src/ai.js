const https = require('https');
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

async function processMessage(userId, message, history) {
    const prompt = buildPrompt(userId, message, history);
    const apiKey = process.env.MINIOC_API_KEY;
    const baseURL = process.env.MINIOC_BASE_URL || 'https://api.minimax.io';
    const model = process.env.MINIOC_MODEL || 'MiniMax-M3';

    if (!apiKey) {
        throw new Error('MINIOC_API_KEY is not set in .env');
    }

    logger.info(`Processing message for user ${userId}`);
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

module.exports = { processMessage, buildPrompt, callMiniMaxAPI };
