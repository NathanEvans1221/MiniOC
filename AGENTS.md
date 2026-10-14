# AGENTS.md - MiniOC 專案指南

> [!IMPORTANT]
> 本文件包含在此代碼庫上工作的 AI 代理的指南。若內容與程式碼不符，以程式碼為準，並請一併更新本文件。
> 最後對應架構：MiniMax API 直連（不在本專案中使用 OpenCode CLI）。

## 1. 專案概述

MiniOC 是一個 Telegram AI 對話機器人，直接呼叫 **MiniMax 官方 Chat Completion API**。使用：

- **執行環境**：Node.js v24（CommonJS 模組，**非 TypeScript**）
- **資料庫**：SQLite（better-sqlite3）
- **機器人**：node-telegram-bot-api（Long Polling）
- **設定**：dotenv

## 2. 安裝與執行

```bash
npm install
```

若在 Windows 上遇到 SQLite 原生模組建置錯誤：

```bash
npm rebuild better-sqlite3
```

### 執行

```bash
npm run dev     # 監視檔案變更自動重啟（--watch）
npm start       # 正常啟動
npm test        # 執行 Jest 測試套件
```

### 單次 API 驗證（不啟動 Telegram）

```bash
node src/chat.js "你好"
```

此指令會載入 `.env` 並實際呼叫 MiniMax API，是驗證金鑰與端點設定最快的方式。

## 3. 環境變數

| 變數 | 必填 | 預設值 | 說明 |
|------|------|--------|------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | 由 @BotFather 取得 |
| `MINIOC_API_KEY` | ✅ | — | MiniMax API 金鑰 |
| `MINIOC_BASE_URL` | | `https://api.minimax.io` | API 端點。路徑前綴、連接埠與 http/https 都會被保留 |
| `MINIOC_MODEL` | | `MiniMax-M3` | 推論模型 |
| `CLEAR_HISTORY_ON_START` | | `false` | 設為 `true` 時啟動會清空所有對話 |
| `MAX_MESSAGE_LENGTH` | | `4000` | 單則訊息長度上限（字元） |
| `RATE_LIMIT_WINDOW_MS` | | `60000` | 速率限制視窗（毫秒） |
| `RATE_LIMIT_MAX_REQUESTS` | | `10` | 單一使用者於單一視窗的訊息數上限 |

- `.env` 已列入 `.gitignore`，**絕對不要**提交。
- 新增環境變數時，必須同步更新 `.env.example`。

## 4. 專案結構

```text
MiniOC/
├── src/
│   ├── index.js      # 進入點：檔案鎖、資料庫初始化、生命週期管理
│   ├── bot.js        # Telegram 連線、訊息處理、409 容錯、速率限制
│   ├── ai.js         # MiniMax API 整合與 messages 建構
│   ├── db.js         # SQLite 對話歷史 CRUD
│   ├── ratelimit.js  # 滑動視窗速率限制與序列佇列
│   ├── lockfile.js   # 單一實例鎖檔（安全檢查）
│   ├── chat.js       # 終端機單次驗證工具
│   └── logger.js     # 標準化日誌模組
├── data/             # 資料庫、鎖檔、日誌（gitignore）
├── *.test.js         # Jest 測試（置於專案根目錄）
├── package.json
├── CHANGELOG.md
└── README.md
```

## 5. 測試

專案使用 **Jest**，測試檔以 `*.test.js` 置於專案根目錄。

```bash
npm test              # 執行全部測試（--silent --forceExit）
npm run test:watch    # 監聽模式
npx jest db.test.js           # 單一測試檔
npx jest db.test.js -t "名稱"  # 單一測試
```

撰寫測試時請注意：

- 修改函式簽名或行為時，**必須**同步更新對應測試。
- 避免「名稱暗示某行為、斷言卻不檢查該行為」的空洞測試。例如命名為「應該包含歷史」的測試，就必須斷言歷史內容是否真的出現在輸出中。
- 涉及檔案系統的測試請使用 `os.tmpdir()` 下的臨時目錄，並在 `afterEach` 清理。

## 6. 程式碼風格

### 語言與模組

- JavaScript，使用 CommonJS `require()`
- 匯入順序：內建 → 外部 → 本地

### 格式

- 4 個空格縮排（不使用 Tab）
- 使用分號、尾隨逗號，每行最大 100 字元
- 檔案命名為小寫單詞（`bot.js`、`db.js`、`ratelimit.js`）

### 命名

- 函式：`camelCase`
- 常數：`UPPER_SNAKE_CASE`
- 類別：`PascalCase`

### 錯誤處理

- 非同步操作以 `async/await` 搭配 `try/catch`
- 使用 `logger` 模組（`logger.info` / `success` / `warn` / `error` / `debug`），不要直接使用 `console.log`
- 對外（Telegram 使用者）只回覆通用錯誤訊息，詳細錯誤寫入日誌

### 資料庫

- 一律使用 prepared statements
- 呼叫 `src/db.js` 的函式前，資料庫必須已初始化；未初始化時會拋出明確錯誤

## 7. 架構要點（修改前務必先讀）

### 生命週期只有一個擁有者

`src/index.js` 是唯一註冊 `SIGINT` / `SIGTERM` 的地方，關閉順序固定為：
**停止 polling → 關閉資料庫 → 釋放鎖檔**。

**不要在 `src/bot.js` 或其他模組註冊訊號處理器**，否則會產生重複處理與「資料庫已關閉後仍寫入」的競態。`bot.js` 只匯出 `stopBot()` 供 `index.js` 呼叫。

### 鎖檔絕不主動終止其他行程

`data/bot.lock` 為 JSON（`pid` / `startedAt` / `cwd`），由 `src/lockfile.js` 管理。

因為作業系統會回收重用 PID，**不得**改回「讀到 PID 就 `SIGKILL`」的行為——那可能殺掉無關的行程。現行策略是：確認對方已不存在才清除鎖檔，偵測到存活實例則拒絕啟動（fail closed）。

### 對話歷史

- `src/index.js` 預設**不**清空歷史，僅在 `CLEAR_HISTORY_ON_START=true` 時清空。
- `src/db.js` 的 `getChatHistory` 回傳「最近」N 筆並依由舊到新排序，內部以 `id` 排序（`CURRENT_TIMESTAMP` 僅秒級解析度，同一秒內排序不穩定）。
- `src/ai.js` 的 `buildMessages` 負責把歷史與當前訊息組成 `messages` 陣列；這是最終送給模型的內容。

### Telegram 輸出

模型輸出未經轉義，可能含不成對的 Markdown 字元。`src/bot.js` 的 `sendReply` 會先嘗試 `parse_mode: 'Markdown'`，解析失敗時退回純文字重送，並依 Telegram 長度上限切分訊息。修改輸出邏輯時請保留這些保護。

## 8. 資料庫架構

```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,        -- 'user' 或 'assistant'
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_id ON conversations(user_id);
CREATE INDEX idx_timestamp ON conversations(timestamp);
```

## 9. 新增功能

1. 在 `src/` 中建立新模組，以 `module.exports` 匯出
2. 在 `*.test.js` 中補上對應測試
3. 如需新的環境變數，同步更新 `.env.example` 與本文件的環境變數表
4. 更新 `README.md` 的專案結構與 `CHANGELOG.md`

## 10. Git 約定

- 提交訊息應清晰且有描述性
- 不要提交 `.env`、`node_modules/` 或 `data/`
- 提交前執行 `git status` 與 `npm test`

## 11. 已知限制

- 不支援 TypeScript
- 不支援 Docker（相關設定已移除）
- 未使用連接池，單一 SQLite 檔案
- 速率限制與序列佇列為純記憶體實作，行程重啟即歸零
