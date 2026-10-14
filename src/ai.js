const http = require('http');
const https = require('https');
const logger = require('./logger');

const API_PATH = 'v1/text/chatcompletion_v2';
const DEFAULT_BASE_URL = 'https://api.minimax.io';
const DEFAULT_MODEL = 'MiniMax-M3';
const REQUEST_TIMEOUT_MS = 60000;
const ALLOWED_ROLES = new Set(['user', 'assistant']);

/**
 * 將對話歷史與當前訊息組成 MiniMax `messages` 陣列。
 * 歷史若含不合法的 role 或空內容會被略過，避免送出無效的請求主體。
 */
function buildMessages(message, history) {
    const messages = [];

    if (Array.isArray(history)) {
        for (const entry of history) {
            if (!entry) continue;
            if (!ALLOWED_ROLES.has(entry.role)) continue;
            if (typeof entry.content !== 'string' || entry.content.length === 0) continue;
            messages.push({ role: entry.role, content: entry.content });
        }
    }

    messages.push({ role: 'user', content: message });
    return messages;
}

/**
 * 解析 API 端點。保留 MINIOC_BASE_URL 的路徑前綴、連接埠與協定。
 * 允許兩種設定慣例：
 *   1. 只給服務根網址（或帶代理前綴），由本函式附加 API_PATH。
 *   2. 直接給完整端點（結尾即為 API_PATH），此時原樣使用。
 */
function resolveEndpoint(baseURL) {
    const value = (baseURL || DEFAULT_BASE_URL).trim();
    const withoutTrailingSlash = value.replace(/\/+$/, '');

    if (withoutTrailingSlash.endsWith(API_PATH)) {
        return new URL(withoutTrailingSlash);
    }

    return new URL(API_PATH, `${withoutTrailingSlash}/`);
}

function buildRequestOptions(url, apiKey, body) {
    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        },
        timeout: REQUEST_TIMEOUT_MS
    };

    if (url.port) {
        options.port = url.port;
    }

    return options;
}

function callMiniMaxAPI(apiKey, baseURL, model, messages) {
    return new Promise((resolve, reject) => {
        let url;
        try {
            url = resolveEndpoint(baseURL);
        } catch (e) {
            reject(new Error(`Invalid MINIOC_BASE_URL: ${baseURL}`));
            return;
        }

        // 依協定選擇傳輸模組，讓 http:// 端點（本機代理、mock server）也能運作
        const transport = url.protocol === 'http:' ? http : https;
        const postData = JSON.stringify({ model, messages });

        const req = transport.request(buildRequestOptions(url, apiKey, postData), (res) => {
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
    const apiKey = process.env.MINIOC_API_KEY;
    const baseURL = process.env.MINIOC_BASE_URL || DEFAULT_BASE_URL;
    const model = process.env.MINIOC_MODEL || DEFAULT_MODEL;

    if (!apiKey) {
        throw new Error('MINIOC_API_KEY is not set in .env');
    }

    const messages = buildMessages(message, history);

    logger.info(`Processing message for user ${userId} (${messages.length} message(s) in context)`);
    logger.debug(`API - BASE_URL: ${baseURL}`);
    logger.debug(`API - MODEL: ${model}`);

    try {
        const response = await callMiniMaxAPI(apiKey, baseURL, model, messages);
        logger.success(`AI response received for user ${userId}`);
        return response;
    } catch (error) {
        logger.error(`AI API error: ${error.message}`);
        throw error;
    }
}

module.exports = { processMessage, buildMessages, resolveEndpoint, callMiniMaxAPI };
