const { buildMessages, resolveEndpoint } = require('./src/ai');

describe('ai.js - buildMessages', () => {
    test('應將單一使用者訊息組成 messages 陣列', () => {
        const messages = buildMessages('Hello', []);
        expect(messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    test('應將歷史訊息置於當前訊息之前，且維持原順序', () => {
        const history = [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' }
        ];
        const messages = buildMessages('How are you?', history);

        expect(messages).toEqual([
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
            { role: 'user', content: 'How are you?' }
        ]);
    });

    test('歷史內容必須實際出現在送給模型的訊息中', () => {
        const history = [
            { role: 'user', content: '我的名字是 CS' },
            { role: 'assistant', content: '你好 CS' }
        ];
        const messages = buildMessages('我叫什麼名字？', history);

        const joined = messages.map((m) => m.content).join('\n');
        expect(joined).toContain('我的名字是 CS');
        expect(joined).toContain('你好 CS');
        expect(messages[messages.length - 1].content).toBe('我叫什麼名字？');
    });

    test('應略過 role 不合法的歷史項目', () => {
        const history = [
            { role: 'system', content: '不該被送出' },
            { role: 'tool', content: '也不該被送出' },
            { role: 'user', content: '合法' }
        ];
        const messages = buildMessages('current', history);

        expect(messages).toEqual([
            { role: 'user', content: '合法' },
            { role: 'user', content: 'current' }
        ]);
    });

    test('應略過內容為空或非字串的歷史項目', () => {
        const history = [
            { role: 'user', content: '' },
            { role: 'assistant', content: null },
            { role: 'user', content: '保留' },
            null
        ];
        const messages = buildMessages('current', history);

        expect(messages).toEqual([
            { role: 'user', content: '保留' },
            { role: 'user', content: 'current' }
        ]);
    });

    test('history 為 undefined 或非陣列時仍可運作', () => {
        expect(buildMessages('Hi', undefined)).toEqual([{ role: 'user', content: 'Hi' }]);
        expect(buildMessages('Hi', null)).toEqual([{ role: 'user', content: 'Hi' }]);
        expect(buildMessages('Hi', 'not-an-array')).toEqual([{ role: 'user', content: 'Hi' }]);
    });

    test('應保留訊息中的特殊字元與換行', () => {
        const messages = buildMessages('Hello <world> & "test"', []);
        expect(messages[0].content).toBe('Hello <world> & "test"');

        const multiline = buildMessages('Line 1\nLine 2', []);
        expect(multiline[0].content).toContain('Line 1\nLine 2');
    });
});

describe('ai.js - resolveEndpoint', () => {
    test('僅給根網址時應附加 API 路徑', () => {
        const url = resolveEndpoint('https://api.minimax.io');
        expect(url.hostname).toBe('api.minimax.io');
        expect(url.pathname).toBe('/v1/text/chatcompletion_v2');
        expect(url.protocol).toBe('https:');
        expect(url.port).toBe('');
    });

    test('結尾帶斜線的根網址應得到相同結果', () => {
        const url = resolveEndpoint('https://api.minimax.io/');
        expect(url.hostname).toBe('api.minimax.io');
        expect(url.pathname).toBe('/v1/text/chatcompletion_v2');
    });

    test('應保留 baseURL 的路徑前綴（代理情境）', () => {
        const url = resolveEndpoint('https://proxy.example.com/minimax');
        expect(url.hostname).toBe('proxy.example.com');
        expect(url.pathname).toBe('/minimax/v1/text/chatcompletion_v2');
    });

    test('應保留非預設連接埠', () => {
        const url = resolveEndpoint('https://proxy.example.com:8443/minimax');
        expect(url.hostname).toBe('proxy.example.com');
        expect(url.port).toBe('8443');
        expect(url.pathname).toBe('/minimax/v1/text/chatcompletion_v2');
    });

    test('應保留 http 協定（本機代理／mock server）', () => {
        const url = resolveEndpoint('http://127.0.0.1:8080');
        expect(url.protocol).toBe('http:');
        expect(url.hostname).toBe('127.0.0.1');
        expect(url.port).toBe('8080');
        expect(url.pathname).toBe('/v1/text/chatcompletion_v2');
    });

    test('已是完整端點時不應重複附加路徑', () => {
        const url = resolveEndpoint('https://api.minimax.io/v1/text/chatcompletion_v2');
        expect(url.pathname).toBe('/v1/text/chatcompletion_v2');
    });

    test('baseURL 為空時應回退到預設值', () => {
        const url = resolveEndpoint('');
        expect(url.hostname).toBe('api.minimax.io');
        expect(url.pathname).toBe('/v1/text/chatcompletion_v2');
    });
});
