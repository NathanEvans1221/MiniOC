# 🚀 MiniOC

**迷你 OC（Mini OpenCode）** —— 將強大的 OpenCode 思考引擎裝進你的 Telegram！透過 Docker 容器化確保絕對安全，打造最輕巧、易用且專屬於你的 AI 助手。 🤖✨

## 💡 專案優勢

- 🛡️ **高安全性**：透過 Docker 容器化部署 OpenCode 與執行環境，完全隔離宿主機，保障系統與資料安全。
- 📱 **極致便利**：完美結合 Telegram，不論手機或電腦，隨時隨地無縫呼叫你的專屬 AI 助理。
- 🔧 **易於維護擴充**：核心程式碼簡短精煉（Mini），架構平易近人，開發者能輕鬆讀懂、維護並進行二次開發。

## ✨ 功能特色

- 🤖 **AI 對話**：使用 OpenCode/MiniMax 作為 AI 思考引擎，提供精準的邏輯推理。
- 💾 **對話歷史**：自動將對話記錄儲存至 SQLite 資料庫，隨時回顧精彩瞬間。
- 🔄 **自動復原**：內建錯誤處理機制，遇到 409 錯誤時會自動重試連線，確保服務不中斷。
- 🔒 **單一實例**：使用檔案鎖技術，防止多重執行導致的衝突與效能損耗。

## 🚀 快速開始

### 1. 📥 安裝依賴
```bash
npm install
```

### 2. ⚙️ 設定環境變數
將 `.env.example` 複製為 `.env` 並填入您的資訊：
```bash
TELEGRAM_BOT_TOKEN=你的機器人Token
MINIOC_API_KEY=你的API金鑰
MINIOC_BASE_URL=https://api.minimax.io
MINIOC_MODEL=MiniMax-M3
# 或使用模型：opencode/minimax-m3
```

### 3. 🏁 啟動機器人
```bash
npm run dev    # 開發模式（檔案變更時自動重啟）
npm start      # 生產模式
```

---

## 🐳 Docker 部署

### 📋 環境變數設定

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | - |
| `MINIOC_API_KEY` | MiniMax API 金鑰 | - |
| `MINIOC_BASE_URL` | API 端點 | `https://api.minimax.io` |
| `MINIOC_MODEL` | 模型名稱 | `MiniMax-M3` |

**🌟 可用模型建議**：
- `MiniMax-M3` - 穩定付費版（需 API Key）
- `opencode/minimax-m3` - 體驗首選（透過 OpenCode 提供）

### 🛠️ Docker 指令

```bash
# 🏗️ 構建映像
docker-compose build

# 🆙 啟動容器
docker-compose up -d

# 📝 查看日誌
docker logs minioc

# 🛑 停止容器
docker-compose down

# 🔄 重啟容器
docker-compose restart
```

### 💬 本地對話模式（不透過 Telegram）

如果您想直接在終端機測試 AI 效能：

```bash
# 🔄 互動式對話（輸入 exit 離開）
npm run chat:local

# ⚡ 單次快速對話
npm run chat:local -- "Hello"

# 📦 在 Docker 容器內直接測試
docker exec minioc npm run chat -- "Hello"
```

### ✅ 驗證 Telegram 連接

詳細步驟請參考 [TELEGRAM_VERIFY.md](./TELEGRAM_VERIFY.md) 以進行分階段驗證。

## 🤖 機器人指令

| 指令 | 說明 |
|------|------|
| `/reset` | 手動重置 Bot 連線（有效解決 409 衝突） |
| `/test409` | 觸發測試 409 錯誤，驗證自動復原機制 |

## ⚠️ 已知問題與修復

### Telegram Polling 409 Conflict ⏳ *處理中*
- **問題現狀**：Telegram Bot 有時會出現 `409 Conflict: terminated by other getUpdates request`。
- **根本原因**：Telegram 伺服器端的 polling 狀態與客戶端不同步（常見於重啟後）。
- **建議對策**：
  1. ⏳ 靜置約 30 分鐘，待 Telegram 自動釋放鎖定。
  2. 🛠️ 發送 `/reset` 指令強制重置連線。
  3. 🌐 考慮切換至 Webhook 模式以獲得更穩定的串接。

### Docker 網絡問題 ✅ *已修復*
- **問題描述**：特定環境下容器 DNS 解析失敗導致無法連線。
- **修復方案**：已在啟動指令添加 `--dns-result-order=ipv4first` 強制 IPv4 優先。

## 📂 專案結構

```text
MiniOC/
├── src/
│   ├── index.js      # 🚀 應用程式入口
│   ├── bot.js        # 🤖 Telegram 機器人核心邏輯
│   ├── ai.js         # 🧠 OpenCode AI 深度整合
│   ├── db.js         # 💾 SQLite 資料庫持久化
│   └── logger.js     # 📝 標準化日誌模組
├── data/             # 📁 資料庫檔案與執行日誌
├── docker-compose.yml # 🐳 容器編排設定
└── package.json      # 📦 專案依賴管理
```

## 🧪 測試與品質

### ⚡ 執行測試
```bash
npm test              # 執行全域單元測試
npm run test:watch    # 進入監聽模式（自動偵測變更並重測）
```

### 📊 涵蓋率報告
```bash
npx jest --coverage
```

### 📈 現階段測試數據
```text
Test Suites: 3 passed, 3 total
Tests:       16 passed, 16 total

核心模組涵蓋率：
- ai.js:     ~70% 🧠
- db.js:     ~73% 💾
- logger.js: ~60% 📝
```

### 🔍 測試檔案說明
| 檔案 | 測試目標 |
|------|----------|
| `db.test.js` | 資料庫 CRUD 操作穩定性 |
| `ai.js.test.js` | AI 引擎請求與回應處理 |
| `processMessage.test.js` | 核心訊息分發邏輯 |

## 📜 開源協議

本專案採用 [MIT License](LICENSE) 授權。

