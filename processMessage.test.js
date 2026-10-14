const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');
const { processMessage } = require('./src/ai');

jest.mock('https');
jest.mock('http');

describe('ai.js - processMessage with MiniMax API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.MINIOC_API_KEY = 'test-key';
        process.env.MINIOC_BASE_URL = 'https://api.minimax.io';
        process.env.MINIOC_MODEL = 'MiniMax-M3';
    });

    function createMockRequest(transport, statusCode, responseBody, triggerError = null) {
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        req.destroy = jest.fn();

        transport.request.mockImplementation((options, callback) => {
            if (triggerError) {
                process.nextTick(() => req.emit('error', triggerError));
                return req;
            }

            const res = new EventEmitter();
            res.statusCode = statusCode;

            process.nextTick(() => {
                callback(res);
                res.emit('data', JSON.stringify(responseBody));
                res.emit('end');
            });

            return req;
        });

        return req;
    }

    test('processMessage should successfully return assistant response from choices', async () => {
        const responseData = {
            choices: [{
                message: {
                    content: '你好！我是 MiniMax AI。'
                }
            }],
            base_resp: { status_code: 0 }
        };

        createMockRequest(https, 200, responseData);

        const result = await processMessage(123, '你好', []);
        expect(result).toBe('你好！我是 MiniMax AI。');
        expect(https.request).toHaveBeenCalledTimes(1);

        const callArgs = https.request.mock.calls[0][0];
        expect(callArgs.hostname).toBe('api.minimax.io');
        expect(callArgs.path).toBe('/v1/text/chatcompletion_v2');
        expect(callArgs.headers['Authorization']).toBe('Bearer test-key');
    });

    test('processMessage should send conversation history to the model', async () => {
        const responseData = {
            choices: [{ message: { content: '你叫 CS' } }],
            base_resp: { status_code: 0 }
        };

        const req = createMockRequest(https, 200, responseData);
        const history = [
            { role: 'user', content: '我的名字是 CS' },
            { role: 'assistant', content: '你好 CS' }
        ];

        await processMessage(123, '我叫什麼名字？', history);

        const body = JSON.parse(req.write.mock.calls[0][0]);
        expect(body.messages).toEqual([
            { role: 'user', content: '我的名字是 CS' },
            { role: 'assistant', content: '你好 CS' },
            { role: 'user', content: '我叫什麼名字？' }
        ]);
        expect(body.model).toBe('MiniMax-M3');
    });

    test('processMessage should honour a custom port in MINIOC_BASE_URL', async () => {
        process.env.MINIOC_BASE_URL = 'https://proxy.example.com:8443/minimax';

        createMockRequest(https, 200, { reply: 'ok', base_resp: { status_code: 0 } });

        await processMessage(123, '測試', []);

        const callArgs = https.request.mock.calls[0][0];
        expect(callArgs.hostname).toBe('proxy.example.com');
        expect(callArgs.port).toBe('8443');
        expect(callArgs.path).toBe('/minimax/v1/text/chatcompletion_v2');
    });

    test('processMessage should use the http module for http endpoints', async () => {
        process.env.MINIOC_BASE_URL = 'http://127.0.0.1:8080';

        createMockRequest(http, 200, { reply: 'local mock', base_resp: { status_code: 0 } });

        const result = await processMessage(123, '測試', []);

        expect(result).toBe('local mock');
        expect(http.request).toHaveBeenCalledTimes(1);
        expect(https.request).not.toHaveBeenCalled();
    });

    test('processMessage should omit port for default endpoints', async () => {
        createMockRequest(https, 200, { reply: 'ok', base_resp: { status_code: 0 } });

        await processMessage(123, '測試', []);

        const callArgs = https.request.mock.calls[0][0];
        expect(callArgs.port).toBeUndefined();
    });

    test('processMessage should reject on invalid MINIOC_BASE_URL', async () => {
        process.env.MINIOC_BASE_URL = 'not a url';

        await expect(processMessage(123, '測試', [])).rejects.toThrow('Invalid MINIOC_BASE_URL');
    });

    test('processMessage should fallback to reply if choices is missing', async () => {
        const responseData = {
            reply: '這是回覆文字',
            base_resp: { status_code: 0 }
        };

        createMockRequest(https, 200, responseData);

        const result = await processMessage(123, '測試', []);
        expect(result).toBe('這是回覆文字');
    });

    test('processMessage should reject on MiniMax API business error', async () => {
        const responseData = {
            base_resp: { status_code: 1002, status_msg: 'rate limit exceeded' }
        };

        createMockRequest(https, 200, responseData);

        await expect(processMessage(123, '測試', [])).rejects.toThrow('MiniMax API error: rate limit exceeded');
    });

    test('processMessage should reject when MINIOC_API_KEY is missing', async () => {
        delete process.env.MINIOC_API_KEY;

        await expect(processMessage(123, '測試', [])).rejects.toThrow('MINIOC_API_KEY is not set in .env');
    });

    test('processMessage should reject on network error', async () => {
        createMockRequest(https, 500, null, new Error('Network connection error'));

        await expect(processMessage(123, '測試', [])).rejects.toThrow('Network connection error');
    });
});
