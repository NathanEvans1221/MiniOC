# Docker 测试待办清单

## 1. 镜像构建测试

- [x] 构建 Docker 镜像成功
- [x] 基础镜像 `node:22-alpine` 正常工作 (v22.22.0)
- [x] `curl` 命令可用 (8.17.0)
- [x] `bash` 命令可用 (5.3.3)

## 2. OpenCode 集成测试

- [x] OpenCode 安装脚本执行成功
- [x] `opencode` 命令可用 (`/usr/local/bin/opencode`)
- [x] `opencode --version` 正常运行 (1.2.10)

## 3. 应用部署测试

- [x] `npm install` 依赖安装成功 (211 packages)
- [x] 工作目录 `/app` 正确设置
- [x] 端口 3000 暴露正确
- [x] `npm start` 能正常启动应用 (数据库初始化成功)

## 4. Docker Compose 配置测试

### 环境变量
- [x] `TELEGRAM_BOT_TOKEN` 正确传递到容器
- [x] `MINIOC_API_KEY` 正确传递到容器
- [x] `MINIOC_BASE_URL` 正确传递到容器 (https://api.minimax.io/anthropic)
- [x] `MINIOC_MODEL` 正确传递到容器 (opencode/minimax-m3)

### 网络与存储
- [x] `network_mode: host` 正常工作
- [x] DNS 配置生效 (8.8.8.8, 1.1.1.1)
- [x] 卷挂载 `./data:/app/data` 正常工作

### 生命周期
- [x] `restart: unless-stopped` 重启策略正常
- [x] 容器启动后自动运行

## 5. 端到端功能测试

- [ ] Telegram Bot 能连接 Telegram 服务器 (需要解决 409 Conflict - Token 在其他设备使用)
- [ ] Bot 能接收和响应消息 (需要解决 Token 问题)
- [x] AI API (MiniMax) 调用成功 (已测试 - "Hello! How can I help you today?")
- [x] 数据库文件正确创建在 `./data` 目录 (conversation.db)
- [x] 数据库持久化（重启后数据保留）

## 6. .dockerignore 测试

- [x] `node_modules` 未打包进镜像 (通过 npm install 安装)
- [x] `.env` 未打包进镜像
- [x] `data` 目录未打包进镜像
- [x] `*.db` 文件未打包进镜像

## 7. 错误处理测试

- [x] 缺少环境变量时的错误提示 (Bot 连接失败提示正确显示)
- [ ] 网络异常时的重试机制 (需进一步测试)
- [ ] 容器健康检查 (需添加 healthcheck)

---

**测试日期**: 2026-02-25

**测试人员**: OpenCode

**备注**: 
- Telegram Bot 409 Conflict 错误：Token 在其他设备使用中，需关闭其他实例
- 已修复 ai.js：添加 --model 参数和 stdio 选项以支持 opencode JSON 输出
- .env 配置已更新：MINIOC_BASE_URL 和 MINIOC_MODEL
- docker-compose.yml version 属性已移除
