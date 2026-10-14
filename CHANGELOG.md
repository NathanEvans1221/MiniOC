# 變更日誌 (Changelog)

所有本專案的重要變更皆會記錄於此文件中。

本文件格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

## [Unreleased]

### 修正 (Fixed)
- 升級 MiniMax API 端點至 `/v1/text/chatcompletion_v2`，解決舊版端點報 1002 Rate Limit 問題。
- 支援解析 MiniMax v2 回應格式之 `choices[0].message.content`。
- 修正 Windows 環境下 SQLite 原生模組與本機推論連線問題。
- 新增 Telegram 409 Conflict 智能防呆與詳細診斷提示（列出 WSL/Docker 容器、其他行程排查指令），並加入防重複刷屏機制。

### 變更 (Changed)
- 預設推論模型更新為 `MiniMax-M3`。
- 同步更新 `.env.example`、`docker-compose.yml` 與 `README.md` 中的模型設定。
