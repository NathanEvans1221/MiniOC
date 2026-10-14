# MiniOC 安全檢視清單

> 本文件記錄 MiniOC 的安全項目與目前狀態，供所有 AI Agent 執行任務時參考。
> 最後校對：commit 對應架構全面收斂為 MiniMax API 直連之後。

---

## 嚴重性分類

| 等級 | 說明 |
|------|------|
| 🔴 Critical | 立即修復，可能導致資料外洩或系統被入侵 |
| 🟠 High | 應儘速修復，存在安全風險 |
| 🟡 Medium | 建議修復，提升整體安全性 |
| 🟢 Low | 優化項目，非緊急 |

---

## 狀態總表

| # | 等級 | 項目 | 狀態 |
|---|------|------|------|
| 1 | 🔴 | 敏感資訊洩漏 - `.env` | ✅ 已確認無外洩 |
| 2 | 🔴 | 命令注入漏洞 | ✅ 已隨架構收斂移除 |
| 3 | 🟠 | `user_id` 型別驗證 | ⬜ 待處理 |
| 4 | 🟠 | 速率限制 | ✅ 已實作 |
| 5 | 🟡 | 輸入驗證與過濾 | ✅ 已實作 |
| 6 | 🟡 | HTTPS 憑證驗證 | ⬜ 待處理 |
| 7 | 🟡 | 錯誤處理資訊洩漏 | ⬜ 待處理 |
| 8 | 🟢 | 日誌安全 | ⬜ 待處理 |
| 9 | 🟢 | 鎖定檔案安全 | ✅ 已實作 |

---

## 已解決項目

### 1. 🔴 敏感資訊洩漏 - `.env`（已確認無外洩）

曾假設 `.env` 可能已進入 Git 歷史。實際檢查：

```bash
git log --all -- .env     # 無輸出
git ls-files | grep env   # 僅 .env.example
```

`.env` 從未被追蹤，`.gitignore` 已正確列出。因此**不需要** BFG 之類的歷史清除工具。

仍建議定期輪換 `TELEGRAM_BOT_TOKEN` 與 `MINIOC_API_KEY`，但這是例行衛生，並非已知外洩的補救。

### 2. 🔴 命令注入漏洞（已隨架構收斂移除）

舊版 `src/ai.js` 曾以 `sh -c` 執行 opencode 子進程並拼接未過濾的 prompt。架構收斂後已完全移除該路徑，`src/ai.js` 現在只透過 `http`/`https` 模組直呼 MiniMax API，專案中不存在任何 shell 執行路徑。

### 4. 🟠 速率限制（已實作）

`src/ratelimit.js` 提供以 `userId` 為單位的滑動視窗計數器，`src/bot.js` 在處理訊息前檢查，超限時回覆等待秒數並記錄日誌。

可由環境變數調整：`RATE_LIMIT_WINDOW_MS`（預設 60000）、`RATE_LIMIT_MAX_REQUESTS`（預設 10）。

同一使用者的請求另以序列佇列排隊，避免同時打滿 API 併發。

### 5. 🟡 輸入驗證與過濾（已實作）

- `MAX_MESSAGE_LENGTH`（預設 4000 字元）在 `src/bot.js` 檢查，超長訊息直接拒絕並告知使用者。
- `src/ai.js` 的 `buildMessages` 對歷史項目做 role 白名單（僅 `user` / `assistant`）與內容型別檢查，不合法的項目不會進入送給模型的請求。
- 模型輸出中的 ANSI escape 序列會被剝除，且 `sendReply` 在 Telegram 無法解析 Markdown 時退回純文字重送。

### 9. 🟢 鎖定檔案安全（已實作）

`src/lockfile.js` 的鎖檔改為 JSON，記錄 `pid`、`startedAt`、`cwd`，並相容舊版純數字格式。

**已移除依 PID 強制終止的行為**：作業系統會回收重用 PID，原本的 `process.kill(pid, 'SIGKILL')` 可能誤殺無關行程。現在只在確認對方已不存在時才清除鎖檔；若偵測到存活實例則拒絕啟動（fail closed）並提示使用者手動處理。

`releaseLock` 只移除自己持有的鎖檔，不會刪除其他實例的鎖檔。

---

## 待處理項目

### 3. 🟠 `user_id` 型別驗證

`src/db.js` 雖然全程使用 prepared statements（無 SQL 注入風險），但 `userId` 未做型別驗證。建議在 `addMessage` / `getChatHistory` 等進入點檢查 `Number.isInteger(userId)`，避免非預期型別寫入。

**參考檔案：** `src/db.js`

### 6. 🟡 HTTPS 憑證驗證

`src/ai.js` 使用 Node.js 內建的 `https` 模組，預設即會驗證 TLS 憑證，但未針對特定 CA 做固定（pinning）。若部署環境需要防禦中間人攻擊，可考慮加上憑證 pinning。

**參考檔案：** `src/ai.js`

### 7. 🟡 錯誤處理資訊洩漏

`src/bot.js` 對外只回傳通用錯誤訊息，詳細錯誤寫入日誌，此部分已符合要求。但 `src/index.js` 在啟動失敗時會將 `data` 目錄路徑等內部資訊輸出到主控台，若日後有對外暴露日誌的管道需重新評估。

**參考檔案：** `src/bot.js`, `src/index.js`

### 8. 🟢 日誌安全

`src/logger.js` 目前沒有日誌級別控制（`debug` 一律寫入），且 `console.log` 輸出未帶等級前綴。建議：

1. 以環境變數控管日誌級別（例如 `LOG_LEVEL`）。
2. 為 `console` 輸出加上等級前綴，便於辨識與過濾。
3. 檢查是否有任何路徑會把金鑰寫入日誌（目前 `src/ai.js` 只記錄 `BASE_URL` 與 `MODEL`，不含金鑰）。

**參考檔案：** `src/logger.js`

---

## 驗證清單

- [x] `.env` 未進入版控（僅 `.env.example`）
- [x] 專案中不存在 shell 執行使用者輸入的路徑
- [x] SQL 查詢全程使用參數化語句
- [x] 已實作速率限制
- [x] 已實作輸入長度與 role 白名單驗證
- [x] 對外錯誤訊息不暴露內部細節
- [x] 鎖檔不再依 PID 強制終止行程
- [ ] `user_id` 型別驗證
- [ ] 日誌級別控制
