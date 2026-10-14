const TelegramBot = require('node-telegram-bot-api');
const { processMessage } = require('./ai');
const { getChatHistory, addMessage } = require('./db');
const logger = require('./logger');
const fs = require('fs');

const isDocker = fs.existsSync('/.dockerenv');
const envPrefix = isDocker ? '🐳 [Docker]' : '💻 [Local]';

let bot;

async function initBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        logger.error('TELEGRAM_BOT_TOKEN is not set in .env');
        throw new Error('TELEGRAM_BOT_TOKEN is not set in .env');
    }

    logger.info('Initializing Telegram bot...');

    const botOptions = {
        polling: {
            autoStart: false,
            timeout: 30,
            limit: 100
        },
        request: {
            timeout: 30000,
            family: 4
        }
    };

    bot = new TelegramBot(token, botOptions);
    logger.info('Bot instance created');

    // 測試 Bot 連接（10秒超時）
    try {
        const me = await Promise.race([
            bot.getMe(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connecting to Telegram API')), 10000))
        ]);
        logger.success(`Bot connected: @${me.username} (${me.first_name})`);
    } catch (err) {
        logger.error('Failed to connect to Telegram bot', err);
        logger.error('Possible causes: invalid TOKEN, network issues, or Telegram API is down');
        logger.error('Solution: Check TELEGRAM_BOT_TOKEN in .env file');
        throw err;
    }

    // 啟動 polling 前先清除可能殘留的 webhook，避免 409 衝突
    try {
        await Promise.race([
            bot.setWebHook(''),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        await Promise.race([
            bot.deleteWebHook(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);

        logger.info('Waiting for Telegram to release polling lock (35s >= Long Polling timeout)...');
        await new Promise(r => setTimeout(r, 35000));

        // 嘗試獲取所有待處理的 updates 並清除
        try {
            const updates = await Promise.race([
                bot.getUpdates({ limit: 100, timeout: 30 }),
                new Promise((resolve) => setTimeout(() => resolve([]), 35000))
            ]);
            if (updates && updates.length > 0) {
                const lastUpdateId = updates[updates.length - 1].update_id;
                await bot.getUpdates({ offset: lastUpdateId + 1, limit: 1 });
                logger.info(`Cleared ${updates.length} pending updates (last offset: ${lastUpdateId + 1})`);
            } else {
                logger.info('No pending updates found');
            }
        } catch (e) {
            logger.warn('Failed to clear pending updates', e);
        }

        logger.info('Webhook cleared, starting polling...');
    } catch (err) {
        logger.warn('Failed to reset webhook', err);
    }

    // 啟動 polling
    bot.startPolling();
    logger.success('Polling started, waiting for messages...');

    // 測試命令：模擬 409 錯誤
    bot.onText(/\/test409/, async (msg) => {
        const chatId = msg.chat.id;
        logger.info('Testing 409 recovery...');

        try {
            await bot.sendMessage(chatId, '🧪 開始測試 409 錯誤處理...');

            const error = new Error('409 Conflict: terminated by other getUpdates request');
            error.code = 409;

            if (error.code === 409) {
                logger.warn('Simulating 409 error for testing...');
                try {
                    await bot.stopPolling();
                    await bot.deleteWebHook();
                    await bot.startPolling();
                    logger.success('Test successful: Polling restarted');
                    await bot.sendMessage(chatId, '✅ 409 錯誤處理測試成功！Polling 已重啟。');
                } catch (err) {
                    logger.error('Test failed to recover from 409', err);
                    await bot.sendMessage(chatId, '❌ 409 錯誤處理測試失敗: ' + err.message);
                }
                return;
            }
        } catch (err) {
            logger.error('Error in /test409 command', err);
        }
    });

    // 手動重置命令
    bot.onText(/\/reset/, async (msg) => {
        const chatId = msg.chat.id;
        logger.info('Manual reset requested by user');

        try {
            await bot.sendMessage(chatId, '🔄 正在重置 Bot...');

            await bot.stopPolling();
            await bot.deleteWebHook();

            try {
                const updates = await bot.getUpdates({ limit: 1, timeout: 1 });
                if (updates.length > 0) {
                    const lastUpdateId = updates[updates.length - 1].update_id;
                    await bot.getUpdates({ offset: lastUpdateId + 1, limit: 1 });
                }
            } catch (e) {
                logger.warn('Failed to clear pending updates during reset', e);
            }

            await bot.startPolling();
            logger.success('Manual reset completed');
            await bot.sendMessage(chatId, '✅ Bot 重置完成！');
        } catch (err) {
            logger.error('Manual reset failed', err);
            await bot.sendMessage(chatId, '❌ 重置失敗: ' + err.message);
        }
    });

    bot.on('message', async (msg) => {
        logger.debug(`Raw message: ${JSON.stringify(msg).substring(0, 200)}`);

        const chatId = msg.chat.id;
        const text = msg.text;
        const userId = msg.from.id;

        if (!text) {
            logger.debug('Ignoring message without text (photo, sticker, etc.)');
            return;
        }
        if (text.startsWith('/')) {
            logger.debug(`Ignoring command: ${text}`);
            return;
        }

        logger.info(`Received message from user ${userId}: ${text.substring(0, 50)}...`);

        try {
            await bot.sendChatAction(chatId, 'typing');

            const history = getChatHistory(userId);

            const response = await processMessage(userId, text, history);

            const cleanResponse = response.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();

            const finalResponse = `${envPrefix}\n\n${cleanResponse}`;

            addMessage(userId, 'user', text);
            addMessage(userId, 'assistant', cleanResponse);

            await bot.sendMessage(chatId, finalResponse, { parse_mode: 'Markdown' });

            logger.success(`Response sent to user ${userId}`);
        } catch (error) {
            logger.error(`Error processing message from user ${userId}`, error);

            let errorMessage = 'Sorry, something went wrong. Please try again.';

            if (error.message.includes('Authentication failed')) {
                errorMessage = 'AI service authentication failed. Please contact the administrator.';
                logger.error('AI authentication failed - check MINIOC_API_KEY');
            } else if (error.message.includes('Rate limit')) {
                errorMessage = 'Too many requests. Please wait a moment and try again.';
                logger.warn('Rate limit exceeded');
            } else if (error.message.includes('timed out')) {
                errorMessage = 'AI response timed out. Please try again.';
            }

            await bot.sendMessage(chatId, errorMessage);
        }
    });

    let isRecovering409 = false;
    let last409NoticeTime = 0;

    bot.on('polling_error', async (error) => {
        const is409 = error.code === 409 ||
            (error.response && error.response.body && error.response.body.error_code === 409);

        if (is409) {
            if (isRecovering409) return;
            isRecovering409 = true;

            const now = Date.now();
            if (now - last409NoticeTime > 20000) {
                last409NoticeTime = now;
                console.log('\n' + '='.repeat(62));
                logger.warn('⚠️  檢測到 Telegram 409 Conflict（連線衝突）！');
                logger.warn('--------------------------------------------------------------');
                logger.warn('【可能原因】');
                logger.warn('有其他實例正使用同一個 TELEGRAM_BOT_TOKEN 連線 Telegram：');
                logger.warn(' 1. Docker / WSL 容器在背景執行中（如 WSL 中的 minioc 容器）。');
                logger.warn(' 2. 其他終端機視窗、伺服器或本機背景行程正在執行此 Bot。');
                logger.warn(' 3. 前次非正常關閉，Telegram 伺服器端連線尚未超時釋放。');
                logger.warn('');
                logger.warn('【建議排查步驟】');
                logger.warn(' 1. 檢查是否有其他容器在跑：');
                logger.warn('    - Windows: docker ps');
                logger.warn('    - WSL:     wsl docker ps (停止指令: wsl docker stop <名稱>)');
                logger.warn(' 2. 檢查其他終端機或背景 node 行程並關閉。');
                logger.warn(' 3. 或向 Telegram 機器人發送 /reset 重置連線。');
                logger.warn('='.repeat(62) + '\n');
            }

            try {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    logger.info(`正在嘗試自動復原連線 (${attempt}/3)...`);
                    try {
                        await bot.stopPolling();
                        await bot.deleteWebHook({ drop_pending_updates: true });

                        await new Promise(r => setTimeout(r, 2000 * attempt));

                        await bot.startPolling();
                        logger.success('✅ 409 連線衝突已成功復原，Polling 重新啟動！');
                        return;
                    } catch (err) {
                        logger.warn(`自動復原第 ${attempt} 次失敗: ${err.message}`);
                        if (attempt < 3) {
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    }
                }
                logger.error('❌ 3 次自動復原皆失敗，外部可能仍有其他實例持續佔用連線。');
                logger.error('請先關閉其他衝突實例後重啟本程式。');
            } finally {
                isRecovering409 = false;
            }
            return;
        }

        logger.error(`Polling error: ${error.message}`, error);

        if (error.message.includes('ETIMEDOUT')) {
            logger.warn('Connection timeout - check network');
        } else if (error.message.includes('ECONNRESET')) {
            logger.warn('Connection reset - check network or Telegram API status');
        }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
        logger.info(`Received ${signal}, stopping bot...`);
        bot.stopPolling().then(() => {
            logger.success('Polling stopped, exiting');
            process.exit(0);
        }).catch((err) => {
            logger.error('Failed to stop polling gracefully', err);
            process.exit(1);
        });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    return bot;
}

function getBot() {
    return bot;
}

module.exports = { initBot, getBot };
