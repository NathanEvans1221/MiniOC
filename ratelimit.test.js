const { createRateLimiter, createSerialQueue } = require('./src/ratelimit');

describe('ratelimit.js - createRateLimiter', () => {
    test('在視窗內未超過上限時應允許請求', () => {
        const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 3, now: () => 0 });

        expect(limiter.check('u1').allowed).toBe(true);
        expect(limiter.check('u1').allowed).toBe(true);
        expect(limiter.check('u1').allowed).toBe(true);
    });

    test('超過上限時應拒絕並提供重試等待時間', () => {
        let clock = 0;
        const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2, now: () => clock });

        limiter.check('u1');
        clock = 30000;
        limiter.check('u1');

        const result = limiter.check('u1');
        expect(result.allowed).toBe(false);
        // 最早的一筆在 t=0，視窗到 t=60000 為止
        expect(result.retryAfterMs).toBe(30000);
    });

    test('視窗滑過後應重新允許請求', () => {
        let clock = 0;
        const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1, now: () => clock });

        expect(limiter.check('u1').allowed).toBe(true);
        expect(limiter.check('u1').allowed).toBe(false);

        clock = 60001;
        expect(limiter.check('u1').allowed).toBe(true);
    });

    test('不同 key 之間應互不影響', () => {
        const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1, now: () => 0 });

        expect(limiter.check('u1').allowed).toBe(true);
        expect(limiter.check('u1').allowed).toBe(false);
        expect(limiter.check('u2').allowed).toBe(true);
    });

    test('reset 應清除指定 key 或全部紀錄', () => {
        const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1, now: () => 0 });

        limiter.check('u1');
        expect(limiter.check('u1').allowed).toBe(false);

        limiter.reset('u1');
        expect(limiter.check('u1').allowed).toBe(true);

        limiter.reset();
        expect(limiter.check('u2').allowed).toBe(true);
    });
});

describe('ratelimit.js - createSerialQueue', () => {
    test('同一 key 的工作應依序執行', async () => {
        const queue = createSerialQueue();
        const order = [];

        const first = queue.run('u1', async () => {
            await new Promise((r) => setTimeout(r, 20));
            order.push('first');
        });
        const second = queue.run('u1', async () => {
            order.push('second');
        });

        await Promise.all([first, second]);
        expect(order).toEqual(['first', 'second']);
    });

    test('不同 key 的工作不應互相阻塞', async () => {
        const queue = createSerialQueue();
        const order = [];

        const slow = queue.run('u1', async () => {
            await new Promise((r) => setTimeout(r, 30));
            order.push('slow');
        });
        const fast = queue.run('u2', async () => {
            order.push('fast');
        });

        await Promise.all([slow, fast]);
        expect(order).toEqual(['fast', 'slow']);
    });

    test('任務失敗不應中斷同一 key 的後續任務', async () => {
        const queue = createSerialQueue();
        const order = [];

        const failing = queue.run('u1', async () => {
            throw new Error('boom');
        });
        const following = queue.run('u1', async () => {
            order.push('following');
        });

        await expect(failing).rejects.toThrow('boom');
        await following;
        expect(order).toEqual(['following']);
    });

    test('任務完成後應回收 key，避免無上限成長', async () => {
        const queue = createSerialQueue();

        await queue.run('u1', async () => {});
        await new Promise((r) => setTimeout(r, 0));

        expect(queue.size()).toBe(0);
    });
});
