# 變更日誌 (Changelog)

所有本專案的重要變更皆會記錄於此文件中。

本文件格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

## [Unreleased]

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
