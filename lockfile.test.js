const fs = require('fs');
const os = require('os');
const path = require('path');
const { acquireLock, releaseLock, readLockFile, isProcessAlive } = require('./src/lockfile');

describe('lockfile.js', () => {
    let dir;
    let lockFile;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'minioc-lock-'));
        lockFile = path.join(dir, 'bot.lock');
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    describe('readLockFile', () => {
        test('鎖檔不存在時回傳 null', () => {
            expect(readLockFile(lockFile)).toBeNull();
        });

        test('應解析現行 JSON 格式', () => {
            fs.writeFileSync(lockFile, JSON.stringify({ pid: 123, startedAt: '2026-01-01T00:00:00.000Z' }));
            const lock = readLockFile(lockFile);
            expect(lock.pid).toBe(123);
            expect(lock.startedAt).toBe('2026-01-01T00:00:00.000Z');
        });

        test('應相容舊版純數字 PID 格式', () => {
            fs.writeFileSync(lockFile, '4321');
            const lock = readLockFile(lockFile);
            expect(lock.pid).toBe(4321);
            expect(lock.legacy).toBe(true);
        });

        test('無法解析的內容應標示為 unparsable', () => {
            fs.writeFileSync(lockFile, '{not json');
            const lock = readLockFile(lockFile);
            expect(lock.pid).toBeNull();
            expect(lock.unparsable).toBe(true);
        });

        test('空檔案應回傳 null', () => {
            fs.writeFileSync(lockFile, '   ');
            expect(readLockFile(lockFile)).toBeNull();
        });
    });

    describe('isProcessAlive', () => {
        test('自身 PID 應視為存活', () => {
            expect(isProcessAlive(process.pid)).toBe(true);
        });

        test('不存在的 PID 應視為不存在', () => {
            expect(isProcessAlive(999999)).toBe(false);
        });

        test('無效的 PID 值應視為不存在', () => {
            expect(isProcessAlive(null)).toBe(false);
            expect(isProcessAlive(0)).toBe(false);
            expect(isProcessAlive(-1)).toBe(false);
            expect(isProcessAlive('123')).toBe(false);
            expect(isProcessAlive(NaN)).toBe(false);
        });
    });

    describe('acquireLock', () => {
        test('沒有鎖檔時應成功取得鎖並寫入 JSON', () => {
            expect(acquireLock(lockFile)).toBe(true);

            const lock = readLockFile(lockFile);
            expect(lock.pid).toBe(process.pid);
            expect(typeof lock.startedAt).toBe('string');
        });

        test('鎖檔屬於存活的行程時應拒絕啟動（fail closed）', () => {
            fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, startedAt: '2026-01-01T00:00:00.000Z' }));

            expect(acquireLock(lockFile)).toBe(false);

            // 鎖檔不得被修改或刪除
            const lock = readLockFile(lockFile);
            expect(lock.pid).toBe(process.pid);
            expect(lock.startedAt).toBe('2026-01-01T00:00:00.000Z');
        });

        test('舊版格式且行程存活時同樣應拒絕啟動', () => {
            fs.writeFileSync(lockFile, String(process.pid));
            expect(acquireLock(lockFile)).toBe(false);
        });

        test('鎖檔屬於已結束的行程時應清除並重新取得', () => {
            fs.writeFileSync(lockFile, JSON.stringify({ pid: 999999, startedAt: '2026-01-01T00:00:00.000Z' }));

            expect(acquireLock(lockFile)).toBe(true);
            expect(readLockFile(lockFile).pid).toBe(process.pid);
        });

        test('不得因為鎖檔存在就終止該 PID', () => {
            const killSpy = jest.spyOn(process, 'kill');

            // 999999 不存在，會走到「檢查存活」但不會送出具殺傷力的訊號
            fs.writeFileSync(lockFile, JSON.stringify({ pid: 999999 }));

            acquireLock(lockFile);

            for (const call of killSpy.mock.calls) {
                expect(call[1]).toBe(0);
            }

            killSpy.mockRestore();
        });
    });

    describe('releaseLock', () => {
        test('應移除自己持有的鎖檔', () => {
            acquireLock(lockFile);
            releaseLock(lockFile);
            expect(fs.existsSync(lockFile)).toBe(false);
        });

        test('不應移除其他實例持有的鎖檔', () => {
            fs.writeFileSync(lockFile, JSON.stringify({ pid: 999999, startedAt: '2026-01-01T00:00:00.000Z' }));

            releaseLock(lockFile);

            expect(fs.existsSync(lockFile)).toBe(true);
            expect(readLockFile(lockFile).pid).toBe(999999);
        });

        test('鎖檔不存在時不應拋錯', () => {
            expect(() => releaseLock(lockFile)).not.toThrow();
        });
    });
});
