# 變更日誌 (Changelog)

所有本專案的重要變更皆會記錄於此文件中。

本文件格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

## [Unreleased]

### 修正 (Fixed)

- **對話歷史現在真的會被送給模型**：`buildPrompt` 收下 `history` 卻從未使用，導致模型看不到任何上下文。改以 `buildMessages` 組出 `messages` 陣列，並加入 role 白名單與內容型別檢查。
- **啟動不再清空所有對話**：移除 `main()` 中無條件呼叫的 `clearAllConversations()`，改為僅在 `CLEAR_HISTORY_ON_START=true` 時才清空。
- **`getChatHistory` 改為回傳最近 N 筆**：原先 `ORDER BY timestamp ASC LIMIT 20` 只會回傳最舊的 20 筆。改以子查詢取最新 N 筆後反轉排序，並改用 `id` 排序（`CURRENT_TIMESTAMP` 僅秒級解析度）。
- **端點建構不再丟棄路徑前綴、連接埠與協定**：`new URL()` 加上開頭斜線會覆蓋 baseURL 的路徑，且未傳遞 `port` 導致一律連線 443。現在完整保留，並依協定選用 `http`/`https` 模組。
- **不再依鎖檔 PID 強制終止行程**：作業系統會回收重用 PID，原本的 `SIGKILL` 可能誤殺無關行程。改為確認對方不存在才清除鎖檔，偵測到存活實例則拒絕啟動（fail closed）。
- **同一訊號只由一處處理**：`index.js` 與 `bot.js` 曾各自註冊 `SIGINT`/`SIGTERM`，造成關閉競態與資料庫已關閉後仍寫入的風險。生命週期統一由 `index.js` 管理。
- **模型輸出的 Markdown 解析失敗不再吃掉整則回覆**：`sendReply` 在 Telegram 回報無法解析時退回純文字重送，並依長度上限切分訊息。
- **修正 `node src/chat.js` 無法使用**：`src/chat.js` 未載入 dotenv，即使 `.env` 存在也會拋出「MINIOC_API_KEY is not set in .env」。

### 新增 (Added)

- `src/ratelimit.js`：以使用者為單位的滑動視窗速率限制，以及避免同一使用者併發的序列佇列。
- `src/lockfile.js`：單一實例鎖檔，記錄 `pid` / `startedAt` / `cwd`，相容舊版純數字格式。
- 訊息長度上限（`MAX_MESSAGE_LENGTH`）與速率限制設定（`RATE_LIMIT_WINDOW_MS`、`RATE_LIMIT_MAX_REQUESTS`）。
- `lockfile.test.js`、`ratelimit.test.js`，測試套件由 25 個測試增至 66 個。
- `db.js` 對已關閉資料庫的操作改為拋出明確錯誤。

### 變更 (Changed)

- `AGENTS.md` 全面重寫：改以 MiniMax API 直連架構為準，移除 OpenCode CLI、`IPC_DIR`、`OPENCODE_PATH` 等已不存在的說明，並補上架構要點與現行測試現況。
- `SECURITY_TODO.md` 改為狀態清單，標記已解決項目（命令注入、速率限制、輸入驗證、鎖檔安全）並保留待處理項目。
- `README.md` 更新環境變數表與專案結構。
- 移除 `buildPrompt`，改由 `buildMessages` 與 `resolveEndpoint` 取代。

### 移除 (Removed)

- `chat-local.sh` 與 `chat:local` npm script：腳本仍以已刪除的 Docker 容器執行，且在 Windows 上 `bash` 會解析到 WSL，本質不可靠。改以 `node src/chat.js` 取代。
- opencode 相關殘留檔案：`opencode.json`、`opencode_help.txt`、`opencode_run_help.txt`、`.opencode/`，以及 `package.json` 中的 `"opencode"` 關鍵字。
- 一次性除錯產物：`fix_409.ps1`、`verify_409.ps1`、`verify_409_result.txt`、`test_output.txt`。
- `.python-version`：內容為 Python 版本，與本 Node 專案無關。

## [1.0.0] - 2026-10-15

### 修正 (Fixed)

- 升級 MiniMax API 端點至 `/v1/text/chatcompletion_v2`，解決舊版端點報 1002 Rate Limit 問題。
- 支援解析 MiniMax v2 回應格式之 `choices[0].message.content`。
- 修正 Windows 環境下 SQLite 原生模組與本機推論連線問題。
- 新增 Telegram 409 Conflict 智能防呆與詳細診斷提示（列出 WSL/Docker 容器、其他行程排查指令），並加入防重複刷屏機制。
- 重構 Telegram Polling 參數（timeout: 10s, request.timeout: 30s），徹底根除每 30 秒客戶端超時造成的 409 自我衝突，並移除 35 秒啟動等待。

### 變更 (Changed)

- 專案架構全面收斂為模式 A（MiniMax 官方 API 直連），預設推論模型為 `MiniMax-M3`。
- 重寫 `README.md`，提供精確簡明的使用指引。
- 精簡 `src/ai.js` 與 `.env.example`。

### 移除 (Removed)

- 移除 Docker 配置（Dockerfile、docker-compose.yml、.dockerignore 及相關測試文件）。
- 移除 OpenCode CLI 子進程調用邏輯與冗餘前綴標籤。
