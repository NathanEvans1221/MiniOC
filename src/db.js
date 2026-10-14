const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const DB_PATH = path.join(process.cwd(), 'data', 'conversation.db');
const DEFAULT_HISTORY_LIMIT = 20;
let db;

function initDatabase() {
    try {
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            logger.info(`Created database directory: ${dbDir}`);
        }

        db = new Database(DB_PATH);
        logger.info(`Database opened: ${DB_PATH}`);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_id ON conversations(user_id);
            CREATE INDEX IF NOT EXISTS idx_timestamp ON conversations(timestamp);
        `);
        logger.info('Database tables initialized');

        return db;
    } catch (error) {
        logger.error('Failed to initialize database', error);
        throw error;
    }
}

function getDatabase() {
    return db;
}

/**
 * 取得可用連線。若資料庫尚未初始化或已關閉，給出明確錯誤，
 * 而不是讓 better-sqlite3 拋出難以理解的內部訊息。
 */
function requireDatabase() {
    if (!db || !db.open) {
        throw new Error('Database is not initialized or already closed');
    }
    return db;
}

function addMessage(userId, role, content) {
    try {
        const stmt = requireDatabase().prepare('INSERT INTO conversations (user_id, role, content) VALUES (?, ?, ?)');
        const result = stmt.run(userId, role, content);
        logger.debug(`Message added: userId=${userId}, role=${role}, id=${result.lastInsertRowid}`);
    } catch (error) {
        logger.error(`Failed to add message for user ${userId}`, error);
        throw error;
    }
}

/**
 * 取得該使用者「最近」N 筆訊息，並依時間由舊到新回傳。
 * 先以子查詢取最新的 N 筆，再於外層反轉排序。
 * 排序使用 id 而非 timestamp，因為 CURRENT_TIMESTAMP 僅有秒級解析度，
 * 同一秒內的多筆訊息排序不穩定。
 */
function getChatHistory(userId, limit = DEFAULT_HISTORY_LIMIT) {
    try {
        const stmt = requireDatabase().prepare(`
            SELECT role, content FROM (
                SELECT id, role, content
                FROM conversations
                WHERE user_id = ?
                ORDER BY id DESC
                LIMIT ?
            )
            ORDER BY id ASC
        `);
        const history = stmt.all(userId, limit);
        logger.debug(`Retrieved ${history.length} messages for user ${userId}`);
        return history;
    } catch (error) {
        logger.error(`Failed to get chat history for user ${userId}`, error);
        throw error;
    }
}

function clearChatHistory(userId) {
    try {
        const stmt = requireDatabase().prepare('DELETE FROM conversations WHERE user_id = ?');
        const result = stmt.run(userId);
        logger.info(`Cleared ${result.changes} messages for user ${userId}`);
    } catch (error) {
        logger.error(`Failed to clear chat history for user ${userId}`, error);
        throw error;
    }
}

function clearAllConversations() {
    try {
        const stmt = requireDatabase().prepare('DELETE FROM conversations');
        const result = stmt.run();
        logger.info(`Cleared all conversations: ${result.changes} rows deleted`);
    } catch (error) {
        logger.error('Failed to clear all conversations', error);
        throw error;
    }
}

function closeDatabase() {
    try {
        if (db) {
            db.close();
            logger.info('Database connection closed');
        }
    } catch (error) {
        logger.error('Failed to close database', error);
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    addMessage,
    getChatHistory,
    clearChatHistory,
    clearAllConversations,
    closeDatabase
};
