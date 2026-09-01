# Tauri 2 + Vue 3 桌面应用模板

> 一套开箱即用的跨平台桌面应用脚手架，覆盖 **macOS / Windows / Linux** 三端。
> 内置 SQLite 数据层、系统托盘、自动更新与三端打包 CI——克隆下来即可开始写业务，不必再为每个项目重复搭建工程。

![CI](https://github.com/Shiaoming123/meow-starter/actions/workflows/ci.yml/badge.svg)
![Release](https://img.shields.io/github/v/release/Shiaoming123/meow-starter)
![License](https://img.shields.io/github/license/Shiaoming123/meow-starter)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?logo=tauri&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

<p align="center">
  <img src="docs/preview.png" alt="Tauri 2 + Vue 3 模板演示" />
</p>

## ✨ 特性

- **前端**：Vue 3.5 + TypeScript + Vite 6，深色模式跟随系统
- **数据层**：SQLite（`tauri-plugin-sql`），启动自动迁移，含索引示例与类型安全的 CRUD 封装
- **桥接层**：Rust `#[tauri::command]` 与前端 `invoke` 的类型化调用
- **系统层**：系统托盘（左键切换窗口 / 右键菜单）、单实例、关闭窗口隐藏而非退出
- **自动更新**：签名 → 下载 → 安装 → 重启，全链路已打通
- **工程化**：GitHub Actions 三端打包矩阵 + CI 质量门禁（typecheck / build / cargo check）
- **图标库**：内置 [Lucide](https://lucide.dev)（ISC 协议，1700+ 图标），`<Icon>` 组件按需渲染
- **风格主题**：4 套可一键切换的主题（海洋蓝 / 森林绿 / 暖阳橙 / 极简黑白），自动适配深浅色
- **无 Electron**：安装包约 3–20 MB，远小于 Electron 的 ~300 MB

## 🎯 适合做什么项目

这个脚手架是 **「本地优先、面向真实用户、跨三端」的桌面工具发射台**。典型适配场景：

| 类型 | 典型例子 |
| --- | --- |
| 个人知识 / 生产力 | 笔记、待办、日记、习惯追踪、时间追踪 |
| 隐私 / 个人数据 | 记账、消费追踪、密码箱 |
| 开发者实用工具 | API 客户端、DB 查看器、日志查看器、格式化工具 |
| AI 桌面客户端 | 网页 Chat 套壳、本地 LLM 前端、RAG 知识库 |
| 媒体 / 文件管理 | 本地图库、电子书管理、下载管理器、去重 |
| 自托管面板 | Home Lab / NAS 控制台、自建服务面板 |

**不适合**：纯网站（用 Vite 即可）、图形密集型游戏 / 3D、从成熟 Electron 项目迁移、系统级深度集成（虚拟摄像头、内核扩展）。

> 📚 完整的项目适配说明与**分类型开发注意事项**（加密、全文搜索、流式响应、文件权限等）见 [docs/project-guide.md](./docs/project-guide.md)。

## 🏗 架构

![architecture](docs/architecture.svg)

前端通过 `@tauri-apps/api` 的 `invoke` / `listen` 与 Rust 运行时通信；Rust 侧注册各官方插件，运行于系统 WebView，数据落 SQLite，托盘常驻，更新自 GitHub Releases 拉取。

## 🧱 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Tauri 2 |
| 前端 | Vue 3.5 + TypeScript + Vite 6 |
| 语言 | Rust（后端）/ TypeScript（前端） |
| 数据 | SQLite via `tauri-plugin-sql` |
| 打包 | `tauri-build` + GitHub Actions |

## 📋 环境要求

- Node.js 22+ 与 npm 10+
- Rust 1.77.2+：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- 平台依赖：
  - macOS：Xcode Command Line Tools（`xcode-select --install`）
  - Windows：MSVC 生成工具 + WebView2
  - Linux：`sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

## 🚀 快速开始

```bash
# 克隆或直接作为 GitHub Template 使用
git clone https://github.com/Shiaoming123/meow-starter.git my-app
cd my-app
npm install
npm run tauri dev
```

## 🧩 用它创建新项目

推荐用 [`degit`](https://github.com/jacquesbh/degit) 拉取干净副本（不含 git 历史）：

```bash
npx degit Shiaoming123/meow-starter my-app
cd my-app && npm install
```

**改名清单**（漏掉任何一项都会导致构建失败或安装后覆盖别人的 App）：

1. `package.json` 的 `name`
2. `src-tauri/Cargo.toml` 的 `name` 与 `[lib] name`（lib 名须为包名下划线形式 + `_lib`）
3. `src-tauri/tauri.conf.json` 的 `productName` 与 `identifier`
   > ⚠️ `identifier` 使用反向域名，**发布之后不可更改**，否则已安装用户无法收到更新
4. `src-tauri/icons/` 换成你自己的图标
5. 重新生成更新签名密钥（见下方「自动更新」）

## 📂 项目结构

```
.
├── .github/
│   ├── workflows/
│   │   ├── ci.yml          # 质量门禁：typecheck / build / cargo check
│   │   └── release.yml     # 打 tag 触发三端打包 + 生成 latest.json
│   ├── ISSUE_TEMPLATE/     # Bug / Feature 工单模板
│   └── dependabot.yml      # 依赖自动更新
├── docs/
│   ├── architecture.svg    # 架构图
│   └── project-guide.md    # 项目适配指南（适合做什么 + 分类型注意事项）
├── src/                    # 前端（Vue 3）
│   ├── assets/
│   │   ├── icons/          # 图标：catalog.ts（Lucide 图标名目录）
│   │   └── themes/         # 主题：index.ts（4 套 token）+ apply.ts（应用/持久化）
│   ├── components/Icon.vue # 图标薄封装（<Icon name="..." />）
│   ├── lib/db.ts           # SQLite 封装（Todo CRUD + 类型）
│   ├── lib/updater.ts      # 检查 / 下载 / 安装 / 重启
│   └── App.vue             # 演示页（含主题切换 + 图标示例）
├── src-tauri/              # 后端（Rust）
│   ├── src/lib.rs          # 应用装配：插件注册、单实例、窗口事件
│   ├── src/tray.rs         # 托盘图标与菜单
│   ├── src/db.rs           # SQLite 迁移定义
│   ├── capabilities/       # 前端可调用的权限白名单
│   └── tauri.conf.json     # 应用配置（窗口、更新端点、打包）
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
└── README.md
```

## ⚙️ 核心模块

### 数据层（SQLite）
迁移定义在 `src-tauri/src/db.rs`，启动时由 `tauri-plugin-sql` 自动执行；前端通过 `src/lib/db.ts` 的 `getDb()` / `listTodos()` / `addTodo()` 等方法访问。

> 📌 每条迁移**只写一条 SQL 语句**——底层 sqlx 的 `execute` 不支持多语句，把 `CREATE TABLE` 与 `CREATE INDEX` 塞进同一条迁移会在运行时报错。

### 系统托盘
`src-tauri/src/tray.rs` 注册左键切换窗口、右键弹出菜单（显示/隐藏、检查更新、退出）。配合单实例插件，重复启动会聚焦已有窗口而非开第二个。

### 自动更新
`src/lib/updater.ts` 封装 `check()` → `downloadAndInstall()` → `relaunch()`；进度通过回调驱动 UI。签名校验由 Tauri 在下载后自动完成。

### 窗口行为
默认**关闭窗口不退出进程**，仅隐藏到托盘；从托盘菜单选「退出」才真正结束。不需要该行为可删除 `src/lib.rs` 中监听 `CloseRequested` 的段落。

### 图标（Lucide）

统一使用 [`@lucide/vue`](https://lucide.dev/guide/packages/lucide-vue-next)（ISC 协议，商用无需署名，1700+ 图标）。通过薄封装组件按需渲染：

```vue
<script setup lang="ts">
import Icon from './components/Icon.vue'
</script>

<template>
  <Icon name="settings" :size="16" />          <!-- kebab-case -->
  <Icon name="FolderOpen" :size="20" color="#2f6feb" />  <!-- PascalCase，可自定义颜色/描边 -->
</template>
```

- 图标名支持 `kebab-case` 或 `PascalCase`，完整名称见 [lucide.dev/icons](https://lucide.dev/icons)
- 常用图标按类别整理在 `src/assets/icons/catalog.ts`
- `Icon.vue` 通过 `@lucide/vue` 的 `icons` 映射表按名取组件，天然 tree-shakable，只打包用到的图标

### 风格主题

内置 4 套主题，定义在 `src/assets/themes/index.ts`，通过 CSS 变量驱动、一键切换：

| 主题 | id | 定位 |
| --- | --- | --- |
| 海洋蓝 | `ocean` | 专业冷静，适合开发者工具与效率应用 |
| 森林绿 | `forest` | 清爽柔和，适合笔记与知识管理 |
| 暖阳橙 | `amber` | 温暖有活力，适合创意与生活记录 |
| 极简黑白 | `mono` | 克制中性，适合写作与专注 |

```ts
import { setTheme } from './assets/themes/apply'
setTheme('forest')  // 一键换肤，自动持久化 + 跟随系统深浅色
```

- 主题 token（`bg` / `surface` / `text` / `accent` 等）由 `applyTheme()` 写入 `:root` 的 CSS 变量
- 组件里用 `var(--surface)` 等变量取色，换主题零改动
- 想新增主题：在 `themes` 数组加一项即可，无需改组件

## 🛠 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动前端开发服务器 |
| `npm run build` | 类型检查 + 前端构建 |
| `npm run typecheck` | 仅 TypeScript 类型检查 |
| `npm run tauri dev` | 启动桌面应用（含 Rust 热重载） |
| `npm run tauri build` | 打包当前平台应用 |
| `npm run tauri:signer` | 生成更新签名密钥对 |

## 🔐 自动更新配置

### 首次配置

```bash
npm run tauri:signer
```

生成 `~/.tauri/meow-starter.key`（私钥）与同名 `.pub`（公钥）。
将 `.pub` 内容填入 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`，
并把 `endpoints` 中的 `OWNER/REPO` 换成你的 GitHub 仓库。

> 🔑 私钥丢失即无法发布新版本，已安装用户会永久卡在旧版。务必备份，切勿提交进仓库。

### 发布流程

1. 同步三处版本号：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`
2. 在仓库 **Settings → Secrets** 配置 `TAURI_SIGNING_PRIVATE_KEY`（私钥内容）；若有密码再加 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. 打 tag 推送：`git tag v0.2.0 && git push origin v0.2.0`
4. CI 三端打包、生成 `latest.json`、创建 draft release，确认后发布即可

### macOS 签名与公证

未签名时用户需执行 `xattr -c /Applications/YourApp.app` 才能打开。
要签名，在 Secrets 额外配置 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID` 六个变量（未配置时构建照常，仅不签名）。

## 🤖 CI/CD

- **`ci.yml`**：每次 push / PR 运行，包含前端 typecheck & build 与 Rust `cargo check`，作为合入门禁。
- **`release.yml`**：推送 `v*.*.*` tag 时触发，矩阵构建 macOS（aarch64 / x86_64）、Windows、Linux，使用 `tauri-action` 打包并生成更新清单。

## 🛡 安全须知

- 上线前将 `tauri.conf.json` 的 `app.security.csp` 从 `null` 改为具体 CSP 策略。
- `identifier` 一旦随首个版本发布即不可更改。
- 新增插件需同步三处：`Cargo.toml`、`lib.rs` 的 `.plugin(...)`、`capabilities/default.json` 权限；缺权限会在调用时静默失败。

## 🤝 贡献

欢迎 Issue 与 PR。提交前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)，并遵守 [行为准则](./CODE_OF_CONDUCT.md)。安全相关请走 [SECURITY.md](./SECURITY.md) 的私下披露渠道。

- 🐛 **Bug / 功能请求**：请提交 [Issue](https://github.com/Shiaoming123/meow-starter/issues)，并选用对应的模板
- 💬 **使用问答 / 想法交流**：请到 [Discussions](https://github.com/Shiaoming123/meow-starter/discussions)
- ❤️ **支持本项目**：若它对你有帮助，欢迎通过 [GitHub Sponsors](https://github.com/sponsors/Shiaoming123) 赞助（配置见 [FUNDING.yml](./FUNDING.yml)）

## 📄 许可证

[MIT](./LICENSE) © 2026 Shiaoming123

## 🙏 致谢

- [Tauri](https://tauri.app) — 本模板的底层框架
- [Vue.js](https://vuejs.org) — 前端框架
- 演示页与工程实践参考了社区公开的最佳实践
