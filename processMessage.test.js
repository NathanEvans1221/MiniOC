const https = require('https');
const { EventEmitter } = require('events');
const { processMessage, buildPrompt, callMiniMaxAPI } = require('./src/ai');

jest.mock('https');

describe('ai.js - processMessage with MiniMax API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.MINIOC_API_KEY = 'test-key';
        process.env.MINIOC_BASE_URL = 'https://api.minimax.io';
        process.env.MINIOC_MODEL = 'MiniMax-M3';
    });

    function createMockRequest(statusCode, responseBody, triggerError = null) {
        const req = new EventEmitter();
        req.write = jest.fn();
        req.end = jest.fn();
        req.destroy = jest.fn();

        https.request.mockImplementation((options, callback) => {
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

        createMockRequest(200, responseData);

        const result = await processMessage(123, '你好', []);
        expect(result).toBe('你好！我是 MiniMax AI。');
        expect(https.request).toHaveBeenCalledTimes(1);

        const callArgs = https.request.mock.calls[0][0];
        expect(callArgs.hostname).toBe('api.minimax.io');
        expect(callArgs.path).toBe('/v1/text/chatcompletion_v2');
        expect(callArgs.headers['Authorization']).toBe('Bearer test-key');
    });

    test('processMessage should fallback to reply if choices is missing', async () => {
        const responseData = {
            reply: '這是回覆文字',
            base_resp: { status_code: 0 }
        };

        createMockRequest(200, responseData);

        const result = await processMessage(123, '測試', []);
        expect(result).toBe('這是回覆文字');
    });

    test('processMessage should reject on MiniMax API business error', async () => {
        const responseData = {
            base_resp: { status_code: 1002, status_msg: 'rate limit exceeded' }
        };

        createMockRequest(200, responseData);

        await expect(processMessage(123, '測試', [])).rejects.toThrow('MiniMax API error: rate limit exceeded');
    });

    test('processMessage should reject when MINIOC_API_KEY is missing', async () => {
        delete process.env.MINIOC_API_KEY;

        await expect(processMessage(123, '測試', [])).rejects.toThrow('MINIOC_API_KEY is not set in .env');
    });

    test('processMessage should reject on network error', async () => {
        createMockRequest(500, null, new Error('Network connection error'));

        await expect(processMessage(123, '測試', [])).rejects.toThrow('Network connection error');
    });
});
