# 🚀 MiniOC

輕量、極速且開箱即用的 Telegram AI 對話機器人，直接串接 **MiniMax 官方 API**，具備對話歷史持久化與智能連線容錯機制。 🤖✨

---

## ✨ 功能特色

- ⚡ **極速回應**：直連 MiniMax 官方 API（預設 `MiniMax-M3`）。
- 💾 **對話歷史持久化**：使用 SQLite 儲存對話，並將最近 20 筆上下文一併送給模型，重啟不會遺失。
- 🛡️ **智能防呆與連線容錯**：
  - 啟動時清理過期的 webhook 與更新佇列。
  - 內建 409 Conflict 衝突偵測，多實例搶佔連線時自動嘗試復原並提供結構化排查步驟。
- 🔒 **安全單一實例鎖**：鎖檔記錄 PID 與啟動時間，偵測到既有實例時拒絕啟動，不會誤殺其他行程。
- 🚦 **速率與長度限制**：以使用者為單位的滑動視窗節流、同一使用者的請求序列化，並限制單則訊息長度。
- 🧪 **完整測試保障**：Jest 測試套件，涵蓋 API、資料庫、速率限制、鎖檔與日誌模組。

---

## 🚀 快速開始

### 1. 📥 安裝依賴

```powershell
npm install
```

> **注意**：若在 Windows 上安裝時遇到 SQLite 原生模組錯誤，可執行 `npm rebuild better-sqlite3` 即可完成建置。

### 2. ⚙️ 設定環境變數

將 `.env.example` 複製為 `.env` 並填入金鑰：

```env
TELEGRAM_BOT_TOKEN=你的Telegram機器人Token
MINIOC_API_KEY=你的MiniMax_API金鑰
MINIOC_BASE_URL=https://api.minimax.io
MINIOC_MODEL=MiniMax-M3
```

### 3. 🏁 啟動機器人

- **開發模式**（監聽檔案變更自動重啟）：
  ```powershell
  npm run dev
  ```
- **生產模式**：
  ```powershell
  npm start
  ```

---

## 🔧 環境變數

| 變數 | 必填 | 預設值 | 說明 |
|------|:----:|--------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | 由 @BotFather 取得 |
| `MINIOC_API_KEY` | ✅ | — | MiniMax API 金鑰 |
| `MINIOC_BASE_URL` | | `https://api.minimax.io` | API 端點，可指向自訂代理 |
| `MINIOC_MODEL` | | `MiniMax-M3` | 推論模型 |
| `CLEAR_HISTORY_ON_START` | | `false` | 設為 `true` 時啟動會清空所有對話 |
| `MAX_MESSAGE_LENGTH` | | `4000` | 單則訊息長度上限（字元） |
| `RATE_LIMIT_WINDOW_MS` | | `60000` | 速率限制視窗（毫秒） |
| `RATE_LIMIT_MAX_REQUESTS` | | `10` | 單一使用者於單一視窗的訊息數上限 |

> `MINIOC_BASE_URL` 的路徑前綴、連接埠與 `http`/`https` 協定都會被保留，因此可指向 `http://127.0.0.1:8080` 這類本機服務。若填入完整端點（結尾為 `/v1/text/chatcompletion_v2`），程式會原樣使用而不重複附加路徑。

---

## 💬 本地終端機對話測試

若不透過 Telegram，想在命令列直接驗證 MiniMax API 連線：

```powershell
node src/chat.js "你好，請自我介紹"
```

此指令會載入 `.env`，是驗證金鑰與端點設定最快的方式。

---

## 🤖 Telegram 機器人指令

| 指令 | 說明 |
| :--- | :--- |
| `/reset` | 手動重置 Bot 連線狀態，強制刷新 Webhook 與更新佇列 |
| `/test409` | 觸發 409 連線衝突測試，驗證自動復原機制 |

---

## 📂 專案架構

```text
MiniOC/
├── src/
│   ├── index.js      # 🚀 應用程式進入點、鎖檔與生命週期管理
│   ├── bot.js        # 🤖 Telegram 連線、訊息處理、409 容錯、速率限制
│   ├── ai.js         # 🧠 MiniMax API 整合與 messages 建構
│   ├── db.js         # 💾 SQLite 對話歷史 CRUD
│   ├── ratelimit.js  # 🚦 滑動視窗速率限制與序列佇列
│   ├── lockfile.js   # 🔒 單一實例鎖檔
│   ├── chat.js       # 💬 終端機單次驗證工具
│   └── logger.js     # 📝 標準化日誌模組
├── data/             # 📁 資料庫、鎖檔與執行日誌 (gitignore)
├── *.test.js         # 🧪 Jest 測試（置於專案根目錄）
├── package.json      # 📦 專案依賴與腳本
├── AGENTS.md         # 🤝 AI 代理工作指南
├── CHANGELOG.md      # 📋 變更日誌
└── README.md         # 📖 專案說明文件
```

---

## 🧪 測試

```powershell
npm test              # 執行全部測試
npm run test:watch    # 監聽模式
```

---

## 📜 開源協議

本專案採用 [MIT License](LICENSE) 授權。
