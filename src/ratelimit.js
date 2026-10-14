const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MAX_REQUESTS = 10;

/**
 * 以 key（此專案為 userId）為單位的滑動視窗計數器。
 * 純記憶體實作，無外部依賴；行程重啟即歸零。
 */
function createRateLimiter({
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    now = Date.now
} = {}) {
    const history = new Map();

    function check(key) {
        const timestamp = now();
        const hits = (history.get(key) || []).filter((ts) => timestamp - ts < windowMs);

        if (hits.length >= maxRequests) {
            history.set(key, hits);
            return {
                allowed: false,
                retryAfterMs: Math.max(windowMs - (timestamp - hits[0]), 0)
            };
        }

        hits.push(timestamp);
        history.set(key, hits);
        return { allowed: true, remaining: maxRequests - hits.length };
    }

    function reset(key) {
        if (key === undefined) {
            history.clear();
        } else {
            history.delete(key);
        }
    }

    return { check, reset, windowMs, maxRequests };
}

/**
 * 以 key 為單位的序列佇列：同一 key 的工作會依序執行，不同 key 互不阻塞。
 * 用於避免同一使用者的多則訊息同時打滿 API 併發。
 */
function createSerialQueue() {
    const chains = new Map();

    function run(key, task) {
        const previous = chains.get(key) || Promise.resolve();
        const result = previous.then(task, task);

        // 記錄「已吞掉錯誤」的鏈尾，避免未處理的 rejection
        const settled = result.then(() => {}, () => {});
        chains.set(key, settled);
        settled.then(() => {
            if (chains.get(key) === settled) {
                chains.delete(key);
            }
        });

        return result;
    }

    function size() {
        return chains.size;
    }

    return { run, size };
}

module.exports = { createRateLimiter, createSerialQueue };
