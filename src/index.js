require('dotenv').config();
const path = require('path');
const logger = require('./logger');
const { acquireLock, releaseLock } = require('./lockfile');
const { initBot, stopBot } = require('./bot');
const { initDatabase, clearAllConversations, closeDatabase } = require('./db');

const LOCK_FILE = path.join(process.cwd(), 'data', 'bot.lock');

let shuttingDown = false;

/**
 * 唯一的關閉流程：停止 polling → 關閉資料庫 → 釋放鎖檔。
 * 順序固定，避免在資料庫已關閉後仍有訊息處理正在寫入。
 */
async function shutdown(signal) {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;

    logger.info(`${signal} received, shutting down...`);

    await stopBot();
    closeDatabase();
    releaseLock(LOCK_FILE);

    process.exit(0);
}

async function main() {
    logger.info('========================================');
    logger.info('Starting Telegram AI Agent...');
    logger.info('========================================');
    
    if (!acquireLock(LOCK_FILE)) {
        logger.error('Could not acquire lock, exiting');
        process.exit(1);
    }
    
    process.on('exit', () => {
        releaseLock(LOCK_FILE);
    });
    process.on('SIGINT', () => {
        shutdown('SIGINT').catch((e) => {
            logger.error('Shutdown failed', e);
            process.exit(1);
        });
    });
    process.on('SIGTERM', () => {
        shutdown('SIGTERM').catch((e) => {
            logger.error('Shutdown failed', e);
            process.exit(1);
        });
    });

    try {
        initDatabase();
    } catch (error) {
        logger.error('Failed to initialize database', error);
        logger.error('Possible causes: SQLite not installed, data folder permission issue, or disk full');
        logger.error('Solution: Check data folder permissions and reinstall dependencies');
        releaseLock(LOCK_FILE);
        process.exit(1);
    }

    // 預設保留既有對話；僅在明確設定時才清空
    if (process.env.CLEAR_HISTORY_ON_START === 'true') {
        logger.warn('CLEAR_HISTORY_ON_START=true，正在清空所有既有對話');
        try {
            clearAllConversations();
        } catch (error) {
            logger.error('Failed to clear conversations', error);
        }
    }

    try {
        await initBot();
    } catch (error) {
        logger.error('Failed to initialize bot', error);
        releaseLock(LOCK_FILE);
        closeDatabase();
        process.exit(1);
    }
    
    logger.success('Bot started and listening for messages');
}

main();
