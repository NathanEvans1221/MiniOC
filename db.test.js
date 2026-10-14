const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test_conversation.db');

describe('db.js - Database Operations', () => {
    let db;
    let dbModule;

    beforeAll(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        jest.resetModules();
        jest.doMock('better-sqlite3', () => {
            return jest.fn().mockImplementation(() => {
                const instance = new Database(TEST_DB_PATH);
                return instance;
            });
        });
        dbModule = require('./src/db');
    });

    afterAll(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    test('initDatabase should create database and tables', () => {
        db = dbModule.initDatabase();
        expect(db).toBeDefined();
        
        const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'");
        const table = stmt.get();
        expect(table).toBeDefined();
    });

    test('addMessage should insert message into database', () => {
        dbModule.addMessage(123, 'user', 'Hello AI');
        dbModule.addMessage(123, 'assistant', 'Hello User');
        
        const history = dbModule.getChatHistory(123);
        expect(history.length).toBe(2);
        expect(history[0].role).toBe('user');
        expect(history[0].content).toBe('Hello AI');
    });

    test('getChatHistory should return correct messages', () => {
        const history = dbModule.getChatHistory(123, 1);
        expect(history.length).toBe(1);
    });

    test('getChatHistory should return the most recent messages, oldest first', () => {
        const userId = 777;
        for (let i = 1; i <= 25; i++) {
            dbModule.addMessage(userId, 'user', `msg-${i}`);
        }

        const history = dbModule.getChatHistory(userId, 20);

        expect(history.length).toBe(20);
        // 應為第 6~25 筆（最近 20 筆），而非第 1~20 筆
        expect(history[0].content).toBe('msg-6');
        expect(history[history.length - 1].content).toBe('msg-25');
    });

    test('clearChatHistory should delete user messages', () => {
        dbModule.clearChatHistory(123);
        const history = dbModule.getChatHistory(123);
        expect(history.length).toBe(0);
    });

    test('clearAllConversations should delete all messages', () => {
        dbModule.addMessage(1, 'user', 'Test 1');
        dbModule.addMessage(2, 'user', 'Test 2');
        dbModule.clearAllConversations();
        
        const history1 = dbModule.getChatHistory(1);
        const history2 = dbModule.getChatHistory(2);
        expect(history1.length).toBe(0);
        expect(history2.length).toBe(0);
    });

    test('closeDatabase should close database connection', () => {
        dbModule.closeDatabase();
        const closedDb = dbModule.getDatabase();
        expect(closedDb.open).toBe(false);
    });

    test('closeDatabase should handle error when database is already closed', () => {
        expect(() => dbModule.closeDatabase()).not.toThrow();
    });

    test('operations on a closed database should fail with a clear message', () => {
        expect(() => dbModule.addMessage(1, 'user', 'x')).toThrow('Database is not initialized or already closed');
        expect(() => dbModule.getChatHistory(1)).toThrow('Database is not initialized or already closed');
        expect(() => dbModule.clearAllConversations()).toThrow('Database is not initialized or already closed');
    });
});
