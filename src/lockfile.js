const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * 讀取鎖檔內容。
 * 相容兩種格式：
 *   - 舊版純數字 PID 字串
 *   - 現行 JSON：{ pid, startedAt, cwd }
 * 無法解析時回傳 { pid: null, unparsable: true }，由呼叫端決定如何處理。
 */
function readLockFile(lockFile) {
    let raw;
    try {
        raw = fs.readFileSync(lockFile, 'utf8').trim();
    } catch (e) {
        return null;
    }

    if (!raw) {
        return null;
    }

    if (/^\d+$/.test(raw)) {
        return { pid: Number(raw), legacy: true };
    }

    try {
        return JSON.parse(raw);
    } catch (e) {
        return { pid: null, unparsable: true };
    }
}

/**
 * 檢查行程是否存活。
 * EPERM 代表行程存在但無權存取，保守視為存活，避免誤判為過期。
 */
function isProcessAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }

    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === 'EPERM';
    }
}

/**
 * 取得單一實例鎖。
 *
 * 鎖檔記錄 PID 與啟動時間，且不會因為鎖檔存在就強制終止該 PID——
 * 作業系統會回收並重用 PID，貿然 SIGKILL 可能殺掉無關的行程。
 * 只有在能確認對方已不存在時才清除鎖檔；確認對方仍存活則拒絕啟動（fail closed）。
 */
function acquireLock(lockFile) {
    try {
        fs.mkdirSync(path.dirname(lockFile), { recursive: true });

        if (fs.existsSync(lockFile)) {
            const lock = readLockFile(lockFile);

            if (lock && isProcessAlive(lock.pid)) {
                logger.error(`偵測到另一個 MiniOC 實例正在執行（PID ${lock.pid}${lock.startedAt ? `，啟動於 ${lock.startedAt}` : ''}）。`);
                logger.error('拒絕啟動：依 PID 強制終止行程可能誤殺無關的程式。');
                logger.error(`若確定沒有其他實例在執行，請手動刪除鎖檔後重試：${lockFile}`);
                return false;
            }

            logger.warn(`移除過期的鎖檔（PID ${lock && lock.pid ? lock.pid : '未知'} 已不存在）`);
            fs.unlinkSync(lockFile);
        }

        fs.writeFileSync(lockFile, JSON.stringify({
            pid: process.pid,
            startedAt: new Date().toISOString(),
            cwd: process.cwd()
        }, null, 2));

        logger.info(`Lock acquired, PID: ${process.pid}`);
        return true;
    } catch (e) {
        logger.error('Failed to acquire lock', e);
        logger.error('Possible causes: data folder is read-only or locked by another process');
        return false;
    }
}

/**
 * 釋放鎖。只移除自己持有的鎖，避免刪掉其他實例的鎖檔。
 */
function releaseLock(lockFile) {
    try {
        if (!fs.existsSync(lockFile)) {
            return;
        }

        const lock = readLockFile(lockFile);
        if (lock && lock.pid && lock.pid !== process.pid) {
            logger.warn(`Lock file belongs to PID ${lock.pid}, not removing it`);
            return;
        }

        fs.unlinkSync(lockFile);
        logger.info('Lock released');
    } catch (e) {
        logger.error('Failed to release lock', e);
    }
}

module.exports = { acquireLock, releaseLock, readLockFile, isProcessAlive };
