const { splitMessage, stripAnsi, readPositiveInt } = require('./src/bot');

const TELEGRAM_LIMIT = 4096;

describe('bot.js - splitMessage', () => {
    test('未超過長度上限時應原樣回傳單一區塊', () => {
        expect(splitMessage('hello')).toEqual(['hello']);
    });

    test('超過長度上限時應切成多個區塊，且每塊都不超過上限', () => {
        const text = 'a'.repeat(10000);
        const chunks = splitMessage(text);

        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_LIMIT);
        }
        expect(chunks.join('')).toBe(text);
    });

    test('應優先於換行處斷開', () => {
        const line = `${'x'.repeat(50)}\n`;
        const text = line.repeat(200);

        const chunks = splitMessage(text);

        for (const chunk of chunks) {
            expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_LIMIT);
            // 除了最後一塊，其餘都不應以殘缺的內容結尾
            expect(chunk.endsWith('x') || chunk.endsWith('\n')).toBe(true);
        }
        expect(chunks.join('')).toBe(text);
    });

    test('沒有換行可斷時仍應在硬上限切開', () => {
        const text = 'b'.repeat(5000);
        const chunks = splitMessage(text);

        expect(chunks).toEqual(['b'.repeat(TELEGRAM_LIMIT), 'b'.repeat(5000 - TELEGRAM_LIMIT)]);
    });

    test('可自訂長度上限', () => {
        expect(splitMessage('abcdef', 3)).toEqual(['abc', 'def']);
    });

    test('內容恰好等於上限時不應切分', () => {
        const text = 'c'.repeat(TELEGRAM_LIMIT);
        expect(splitMessage(text)).toEqual([text]);
    });
});

describe('bot.js - stripAnsi', () => {
    test('應移除 ANSI escape 序列', () => {
        expect(stripAnsi('\u001b[31mred\u001b[0m')).toBe('red');
    });

    test('應去除前後空白', () => {
        expect(stripAnsi('  hello  ')).toBe('hello');
    });

    test('一般文字不受影響', () => {
        expect(stripAnsi('普通文字 with ASCII')).toBe('普通文字 with ASCII');
    });
});

describe('bot.js - readPositiveInt', () => {
    test('合法正整數字串應轉為數字', () => {
        expect(readPositiveInt('25', 10)).toBe(25);
    });

    test('未設定或非法值應回退預設值', () => {
        expect(readPositiveInt(undefined, 10)).toBe(10);
        expect(readPositiveInt('', 10)).toBe(10);
        expect(readPositiveInt('abc', 10)).toBe(10);
        expect(readPositiveInt('0', 10)).toBe(10);
        expect(readPositiveInt('-5', 10)).toBe(10);
    });
});
