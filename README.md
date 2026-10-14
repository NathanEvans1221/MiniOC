# 🚀 MiniOC

輕量、極速且開箱即用的 Telegram AI 對話機器人，直接串接 **MiniMax 官方 API (v2)**，具備對話歷史持久化與智能連線容錯機制。 🤖✨

---

## ✨ 功能特色

- ⚡ **極速回應**：直連 MiniMax 官方 API（支援 `MiniMax-M3` 等最新模型），回應時間低於 1~2 秒。
- 💾 **對話歷史持久化**：使用 SQLite 儲存使用者上下文對話，自動維護上下文記憶。
- 🛡️ **智能防呆與連線容錯**：
  - 啟動時原子級清理過期連線與佇列，**0.2 秒極速開機**。
  - 內建 409 Conflict 衝突偵測，若發生多實例搶佔連線時自動提供結構化排查步驟。
- 🔒 **單一實例檔案鎖**：避免本機重複啟動多個實例造成連線衝突。
- 🧪 **完整測試保障**：具備高覆蓋率單元測試套件（Jest）。

---

## 🚀 快速開始

### 1. 📥 安裝依賴
```powershell
npm install
```

> **注意**：若在 Windows 上安裝時遇到 SQLite 原生模組錯誤，可執行 `npm rebuild better-sqlite3` 即可完成建置。

### 2. ⚙️ 設定環境變數
將 `.env.example` 複製為 `.env` 並填入您的金鑰資訊：
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

## 💬 本地終端機對話測試

若不透過 Telegram，想在命令列直接驗證 MiniMax API 連線：

```powershell
node src/chat.js "你好，請自我介紹"
```

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
│   ├── index.js      # 🚀 應用程式進入點與檔案鎖管理
│   ├── bot.js        # 🤖 Telegram 機器人連線、訊息處理與 409 容錯
│   ├── ai.js         # 🧠 MiniMax v2 API 整合與 Prompt 建構
│   ├── db.js         # 💾 SQLite 對話歷史 CRUD
│   ├── chat.js       # 💬 終端機直接測試工具
│   └── logger.js     # 📝 標準化日誌模組
├── data/             # 📁 資料庫檔案 (conversation.db) 與執行日誌
├── package.json      # 📦 專案依賴與腳本
├── CHANGELOG.md      # 📋 變更日誌
└── README.md         # 📖 專案說明文件
```

---

## 🧪 測試

執行單元測試：
```powershell
npm test
```

監聽測試模式：
```powershell
npm run test:watch
```

---

## 📜 開源協議

本專案採用 [MIT License](LICENSE) 授權。
