<p align="center">
  <strong>中文</strong> · <a href="./README.en.md">English</a>
</p>

<h1 align="center">🐾 meow-starter</h1>

<p align="center">
  <strong>AI Native 全平台桌面 & 移动脚手架</strong><br/>
  一套开箱即用的 <b>Tauri 2 + Vue 3</b> 底座，覆盖 macOS / Windows / Linux / Android / iOS 五端。<br/>
  内置 SQLite、系统托盘、自动更新、设计系统，可插拔的 Agent / MCP / 本地推理。
</p>

<p align="center">
  <a href="https://github.com/Shiaoming123/meow-starter/actions/workflows/ci.yml"><img src="https://github.com/Shiaoming123/meow-starter/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
  <a href="https://github.com/Shiaoming123/meow-starter/releases"><img src="https://img.shields.io/github/v/release/Shiaoming123/meow-starter" alt="Release"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/Shiaoming123/meow-starter" alt="License"/></a>
  <img src="https://img.shields.io/badge/Tauri-2-24C8D8?logo=tauri&logoColor=white" alt="Tauri 2"/>
  <img src="https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux%20%7C%20iOS%20%7C%20Android-blue" alt="Platforms"/>
</p>

<p align="center">
  <img src="docs/preview.png" alt="meow-starter 桌面演示" width="640"/>
  &nbsp;&nbsp;&nbsp;
  <img src="docs/mobile-concept.png" alt="meow-starter 移动端概念图" width="280"/>
</p>

---

## 这是什么

`meow-starter` 是一个**模块化、AI Native** 的全平台应用脚手架。它把跨端开发里最烦的样板代码全部做完——数据层、托盘、更新、设计系统——同时把 AI 能力（Agent、本地推理、MCP）做成**可插拔模块**，让你按需启用。

**核心理念**：核心轻量、能力可选、按需引入。不写一行 Agent 代码，它就是干净的桌面脚手架；打开一个开关，它就变成 AI 应用。

### 五端覆盖

| 平台 | 状态 | 说明 |
| --- | --- | --- |
| macOS | ✅ 完整支持 | 主开发平台，签名 + 公证已文档化 |
| Windows | ✅ 完整支持 | MSVC + WebView2，已配三端打包 CI |
| Linux | ✅ 完整支持 | WebKitGTK，覆盖 Debian / Arch / Fedora |
| iOS | ✅ 代码就绪 | 响应式布局 + 降级已落地；`tauri ios init` 在 Xcode 环境一键启用 |
| Android | ✅ 代码就绪 | 响应式布局 + 降级已落地；`tauri android init` 在 Android Studio 环境一键启用 |

> 代码层（响应式布局、桌面专属能力降级、平台检测）已全部就绪。移动端工程初始化需要 Android Studio + NDK / Xcode + Cocoapods，详见 [docs/mobile.md](./docs/mobile.md)。

## ✨ 特性

- **前端**：Vue 3.5 + TypeScript + Vite 6，深色模式跟随系统
- **数据层**：SQLite（`tauri-plugin-sql`），启动自动迁移 + 类型安全 CRUD
- **系统层**：系统托盘、单实例、关闭窗口隐藏而非退出
- **自动更新**：签名 → 下载 → 安装 → 重启全链路
- **设计系统**：完整 design tokens + 6 个基础组件 + 4 套风格主题
- **模块化**：三层门控（配置 + 动态 import + Cargo feature），能力可插拔
- **Agent 能力**：Vercel AI SDK 默认轨 + Pi RPC 进阶轨，防腐层隔离
- **密钥安全**：API Key 存 OS 钥匙串，经 Rust 代理，不落前端
- **本地推理**：适配 Ollama，模型跑本机、数据不出设备
- **MCP 接入**：连接外部 MCP server，工具并入 Agent
- **工程化**：GitHub Actions 三端打包 + CI 质量门禁
- **无 Electron**：安装包约 3–20 MB，远小于 Electron 的 ~300 MB

## 🗺 从这里开始（全链路指引）

**第一次来？按这个顺序走：**

| 我想… | 去哪看 |
| --- | --- |
| 🚀 快速跑起来 | [快速开始](#-快速开始) → [改名清单](#-用它创建新项目) |
| 🎯 判断适不适合我的项目 | [docs/project-guide.md](./docs/project-guide.md) |
| 🏗 理解架构 | [架构图](#-架构) + [模块化架构](./docs/modular-architecture.md) |
| 🎨 用设计系统/组件 | [docs/design-system.md](./docs/design-system.md) |
| 🤖 接入 Agent（对话/工具） | [docs/agent-integration.md](./docs/agent-integration.md) |
| 🔌 接本地模型（Ollama） | [docs/local-inference.md](./docs/local-inference.md) |
| 🧩 接 MCP 外部工具 | [docs/mcp.md](./docs/mcp.md) |
| 📱 移动端适配（Android / iOS） | [docs/mobile.md](./docs/mobile.md) |
| 🧠 了解全部 AI 能力规划 | [docs/ai-capabilities.md](./docs/ai-capabilities.md) |
| 🤝 贡献 / 反馈 | [CONTRIBUTING.md](./CONTRIBUTING.md) · [Discussions](https://github.com/Shiaoming123/meow-starter/discussions) |

**给 AI agent 的提示**：这个项目有清晰的模块边界与文档体系。改功能前先读对应的 docs 文档，能少走很多弯路。

## 🚀 快速开始

```bash
# 方式一：直接克隆
git clone https://github.com/Shiaoming123/meow-starter.git my-app
cd my-app && npm install && npm run tauri dev

# 方式二：用 degit 拉干净副本（不含 git 历史，推荐）
npx degit Shiaoming123/meow-starter my-app
cd my-app && npm install && npm run tauri dev
```

**环境要求**：Node.js 22+ / Rust 1.77.2+ / 平台依赖（macOS 需 Xcode CLT，Windows 需 MSVC + WebView2，Linux 需 webkit2gtk 等，详见 [Tauri 官方文档](https://tauri.app/start/prerequisites/)）。

## 🧩 用它创建新项目（改名清单）

漏掉任何一项会导致构建失败或覆盖别人的 App：

1. `package.json` 的 `name`
2. `src-tauri/Cargo.toml` 的 `name` 与 `[lib] name`（lib 名 = 包名下划线 + `_lib`）
3. `src-tauri/tauri.conf.json` 的 `productName` 与 `identifier`（⚠️ identifier 发布后不可改）
4. `src-tauri/icons/` 换成自己的图标
5. 重新生成更新签名密钥（`npm run tauri:signer`）
6. 将 `plugins.updater.endpoints` 中的 `OWNER/REPO` 替换为自己的仓库

## 🧱 模块化能力一览

每个能力都是一个**可插拔模块**，在 `src/modules/config.ts` 里开关：

| 模块 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `core` | 核心 | 始终 | 设计系统 + 组件库 + 主题 + 图标 |
| `sqlite` | 核心 | 开 | SQLite 数据层 |
| `tray` | 核心 | 开 | 系统托盘 |
| `updater` | 核心 | 开 | 自动更新 |
| `themes` | 核心 | 开 | 4 套风格主题 |
| `agent` | 可选 | 关 | Agent 运行时（需 `npm run add:agent`） |
| `mcp` | 可选 | 关 | MCP 接入（需 `npm run add:mcp`） |
| `shortcut` | 可选 | 关 | 全局快捷键（P1） |
| `clipboard` | 可选 | 关 | 剪贴板（P1） |
| `notification` | 可选 | 关 | 系统通知（P1） |
| `autostart` | 可选 | 关 | 开机自启（P1） |

> 完整设计见 [docs/modular-architecture.md](./docs/modular-architecture.md)。关闭的模块 = 零依赖、零体积。

## 🏗 架构

![architecture](docs/architecture.svg)

前端（Vue 3）通过 `invoke` / `listen` 与 Rust 运行时通信；模块化 loader 按需加载能力模块；Agent 密钥经 Rust 代理（keyring 钥匙串）；可连接 Ollama / 云端模型 / MCP server 等外部服务。

### 五端覆盖

![跨端覆盖](docs/cross-platform.png)

同一份代码，同一套模块化能力，覆盖 **macOS / Windows / Linux / Android / iOS** 五大平台。桌面专属能力（托盘 / 单实例 / 自动更新）在移动端安全降级，移动端采用响应式布局。

## 📂 项目结构

```
.
├── .github/               # CI（ci.yml 门禁 + release.yml 三端打包）
├── docs/                  # 📚 文档中心
│   ├── architecture.svg        # 架构图
│   ├── design-system.md        # 设计系统（token/组件/主题/性能）
│   ├── project-guide.md        # 项目适配指南（适合做什么+分类型注意事项）
│   ├── modular-architecture.md # 模块化架构（三层门控+Module契约）
│   ├── ai-capabilities.md      # AI Native 能力清单（P1-P3 节奏）
│   ├── agent-integration.md    # Agent 集成方案（框架对比+双轨设计）
│   ├── local-inference.md      # 本地推理（Ollama）
│   └── mcp.md                  # MCP 接入指南
├── src/
│   ├── assets/themes/     # 主题 token + 全局样式
│   ├── components/        # Icon.vue + ui/（Button/Card/Input/Badge/Progress/EmptyState）
│   ├── modules/           # ★ 模块化：config（开关）+ loader（装配）+ 各能力模块
│   ├── agent/             # Agent 能力（runtime/providers/tools/memory/hooks/ui）
│   ├── lib/               # db.ts / updater.ts
│   └── App.vue            # 演示页（侧边栏 + 主题 + 数据 + 更新）
├── src-tauri/
│   ├── src/lib.rs         # 应用装配（核心 + feature 门控）
│   ├── src/tray.rs        # 托盘
│   ├── src/db.rs          # SQLite 迁移
│   ├── src/agent/         # 密钥代理（secrets.rs + proxy.rs）
│   ├── capabilities/      # 权限白名单
│   └── tauri.conf.json    # 应用配置
├── agent.config.ts        # Agent 配置（模型/Provider/工具）
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE
```

## ⚙️ 核心模块说明

### 数据层（SQLite）

迁移定义在 `src-tauri/src/db.rs`，启动时自动执行；前端经 `src/lib/db.ts` 访问。

> 📌 每条迁移**只写一条 SQL 语句**——底层 sqlx 的 `execute` 不支持多语句。

### 系统托盘

`src-tauri/src/tray.rs` 注册左键切换窗口、右键菜单（显示/隐藏、检查更新、退出）。配合单实例，重复启动聚焦已有窗口。

### 自动更新

`src/lib/updater.ts` 封装 `check()` → `downloadAndInstall()` → `relaunch()`。签名校验由 Tauri 自动完成。首次配置：

```bash
npm run tauri:signer   # 生成密钥对
# 公钥填入 tauri.conf.json 的 plugins.updater.pubkey
# 私钥存入 GitHub Secrets 的 TAURI_SIGNING_PRIVATE_KEY
# 将 plugins.updater.endpoints 中的 OWNER/REPO 替换为你的仓库
```

> 🔑 私钥丢失 = 无法发布新版本，已装用户永久卡旧版。务必备份、勿提交。
> 模板占位端点会在构建期被识别为“未配置”，应用不会发起无效更新请求。

### Agent 能力

默认关闭。启用：

```bash
npm run add:agent   # 装 ai + @ai-sdk/vue + provider 包
# 在 agent.config.ts 设 enabled: true，配 provider + defaultModel
```

支持云端模型（OpenAI/Anthropic）与本地模型（Ollama）。密钥走 keychain 类型存 OS 钥匙串。详见 [docs/agent-integration.md](./docs/agent-integration.md) 与 [docs/local-inference.md](./docs/local-inference.md)。

### MCP 接入

默认关闭。让 Agent 连接外部 MCP server：

```bash
npm run add:mcp     # 装 @ai-sdk/mcp
# 在 modules/config.ts 开 mcp: true，用 connectMcpServer 连接
```

详见 [docs/mcp.md](./docs/mcp.md)。

## 🎨 设计系统

完整 design tokens（间距/圆角/字号/阴影/动效/层级）+ 6 个基础组件 + 4 套主题。所有组件走 CSS 变量，换主题零改动。详见 [docs/design-system.md](./docs/design-system.md)。

## 🛠 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动前端开发服务器 |
| `npm run build` | 类型检查 + 前端构建 |
| `npm run typecheck` | 仅类型检查 |
| `npm run tauri dev` | 启动桌面应用（含 Rust 热重载） |
| `npm run tauri build` | 打包当前平台 |
| `npm run tauri:signer` | 生成更新签名密钥 |
| `npm run add:agent` | 安装 Agent 依赖 |
| `npm run add:mcp` | 安装 MCP 依赖 |

## 🛡 安全须知

- 上线前将 `tauri.conf.json` 的 `app.security.csp` 从 `null` 改为具体 CSP。
- `identifier` 发布后不可更改。
- API Key 存 OS 钥匙串（keyring），不硬编码、不存 localStorage。
- 新增插件需同步三处：`Cargo.toml`、`lib.rs`、`capabilities/default.json`。

## 🤝 贡献

欢迎 Issue 与 PR。详见 [CONTRIBUTING.md](./CONTRIBUTING.md) 与 [行为准则](./CODE_OF_CONDUCT.md)。安全漏洞走 [SECURITY.md](./SECURITY.md)。

- 🐛 Bug / 功能请求 → [Issue](https://github.com/Shiaoming123/meow-starter/issues)
- 💬 使用问答 / 想法交流 → [Discussions](https://github.com/Shiaoming123/meow-starter/discussions)
- ❤️ 支持本项目 → [GitHub Sponsors](https://github.com/sponsors/Shiaoming123)

## 📄 许可证

[MIT](./LICENSE) © 2026 Shiaoming123

## 🙏 致谢

[Tauri](https://tauri.app) · [Vue.js](https://vuejs.org) · [Lucide](https://lucide.dev) · [Vercel AI SDK](https://ai-sdk.dev) · [Model Context Protocol](https://modelcontextprotocol.io)
