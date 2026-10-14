# Telegram Bot 驗證檢查清單

本清單用於排查 Bot 無法連線、收不到訊息或回覆失敗的問題。所有指令都在專案根目錄、以本機 Node.js 執行，**不需要 Docker**。

---

## Phase 1: 環境與設定

- [ ] `node --version` 可用
- [ ] 已執行 `npm install`
- [ ] `.env` 存在，且 `TELEGRAM_BOT_TOKEN` / `MINIOC_API_KEY` 已填入
- [ ] 可連線至 `api.telegram.org`（DNS 與網路正常）

**驗證命令**（PowerShell）：

```powershell
node --version
Test-Path .env
Resolve-DnsName api.telegram.org
```

---

## Phase 2: Token 驗證

- [ ] `.env` 中的 `TELEGRAM_BOT_TOKEN` 已設定
- [ ] Token 有效（`getMe` 回傳 `ok: true`）

**驗證命令**：

```powershell
# 從 .env 取出 token（不印出內容）
$env:TOKEN = (Select-String -Path .env -Pattern '^TELEGRAM_BOT_TOKEN=(.*)$').Matches.Groups[1].Value

# 驗證 Token
Invoke-RestMethod "https://api.telegram.org/bot$env:TOKEN/getMe"
```

> 不要把 token 貼進聊天、issue 或提交訊息。若懷疑外洩，請以 @BotFather 重新產生。

---

## Phase 3: Telegram API 連線

- [ ] `getMe` 成功
- [ ] `getWebhookInfo` 顯示沒有殘留 webhook
- [ ] `getUpdates` 成功（若回 409 代表有另一個實例正在使用同一個 token）

**驗證命令**：

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$env:TOKEN/getWebhookInfo"
Invoke-RestMethod "https://api.telegram.org/bot$env:TOKEN/getUpdates?timeout=1"
```

### 409 Conflict 排查順序

1. 確認沒有第二個 MiniOC 實例：本專案的鎖檔會拒絕重複啟動，並在日誌印出佔用鎖檔的 PID。
2. 確認沒有其他程式使用同一個 token（其他終端機、背景 node 行程、其他機器）。
3. 若前次為非正常關閉，Telegram 伺服器端連線可能尚未超時，等待約 30 秒至數分鐘。
4. 向 Bot 發送 `/reset`，強制刷新 webhook 與更新佇列。
5. 必要時以 @BotFather 重新產生 token。

---

## Phase 4: Polling 啟動

- [ ] 日誌出現 `Bot connected: @...`
- [ ] 日誌出現 `Polling started, waiting for messages...`
- [ ] 日誌出現 `Bot started and listening for messages`
- [ ] 沒有持續重複的 `ESOCKETTIMEDOUT`

**驗證方式**：

```powershell
npm start
```

啟動日誌會同時輸出到主控台與 `data/logs/bot.log`。

---

## Phase 5: 訊息處理與對話歷史

- [ ] Bot 能接收訊息
- [ ] MiniMax API 呼叫成功
- [ ] Bot 能回覆訊息
- [ ] 對話歷史正確保存，且在**重啟後仍然存在**
- [ ] 追問前文（例如「我剛剛說了什麼？」）時模型能正確回答

**驗證方式**：

1. 對 Bot 發送幾則訊息。
2. 確認資料庫有資料：`data/conversation.db` 的 `conversations` 表。
3. `npm start` 重啟 Bot。
4. 再次查詢資料表 → 資料應仍在。
5. 追問前文 → 模型應能回答。

> 若第 4 步失敗，請檢查是否設定了 `CLEAR_HISTORY_ON_START=true`。

---

## 不透過 Telegram 的 API 驗證

想確認金鑰與端點設定時，最快的方式是直接執行：

```powershell
node src/chat.js "你好"
```

此指令會載入 `.env` 並實際呼叫 MiniMax API。

---

## 常見問題

### 409 Conflict
**原因**：同一個 Bot Token 被多個實例同時使用。

**解決**：見上方 Phase 3 的排查順序。本專案已內建自動復原機制，若日誌出現自動復原失敗，代表外部確實仍有實例持續佔用連線。

### ESOCKETTIMEDOUT
**原因**：網路連線逾時。

**解決**：
1. 檢查 DNS 設定。
2. 確認防火牆或代理沒有阻擋 `api.telegram.org`。
3. 若位於受限網路，考慮調整 `request.timeout`（`src/bot.js`）。

### 啟動時顯示「偵測到另一個 MiniOC 實例正在執行」
**原因**：`data/bot.lock` 存在，且其中的 PID 仍在執行。

**解決**：先確認該行程是否真的是 MiniOC。若確定沒有其他實例在執行，手動刪除 `data/bot.lock` 後重試。

> 程式刻意**不會**自動依 PID 終止行程，因為作業系統會回收重用 PID，強制終止可能誤殺無關的程式。

### 使用者收不到模型回覆
**原因**：模型輸出含不成對的 Markdown 字元，Telegram 拒絕解析。

**處理**：`src/bot.js` 的 `sendReply` 會自動退回純文字重送。若日誌出現 `Telegram 無法解析 Markdown`，代表已走此退路，內容仍會送達。
