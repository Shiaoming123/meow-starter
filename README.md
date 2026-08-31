# Tauri 2 + Vue 3 桌面应用模板

三端（macOS / Windows / Linux）桌面应用脚手架。SQLite、系统托盘、自动更新、CI 打包均已预置，
开新项目时从「改名字」开始，不需要再从头搭一遍工程。

## 已内置

| 层 | 预置内容 |
| --- | --- |
| 前端层 | Vue 3.5 + TypeScript + Vite 6，深色模式跟随系统 |
| 数据层 | SQLite（`tauri-plugin-sql`），启动时自动跑迁移，含索引示例 |
| 桥接层 | Rust `#[tauri::command]` + 前端 `invoke` 的类型化调用 |
| 系统层 | 系统托盘（左键切换窗口 / 右键菜单）、单实例、关闭窗口隐藏而非退出 |
| 工程层 | 自动更新（签名 → 下载 → 安装 → 重启）、GitHub Actions 三端打包 |

## 前置依赖

- Node.js 22+、npm 10+
- Rust 1.77.2+：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- 平台相关：
  - macOS：Xcode Command Line Tools
  - Windows：MSVC 生成工具 + WebView2
  - Linux：`sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

## 快速开始

```bash
npm install
npm run tauri dev
```

## 用它开新项目

```bash
npx degit <your-org>/tauri-vue-desktop-template my-app
cd my-app
npm install
```

然后逐项改名字（漏掉任何一项都会构建失败或安装后覆盖别人的 App）：

1. `package.json` 的 `name`
2. `src-tauri/Cargo.toml` 的 `name` 与 `[lib] name`（lib 名必须是包名的下划线形式 + `_lib`）
3. `src-tauri/tauri.conf.json` 的 `productName` 与 `identifier`
   —— identifier 用反向域名，**发布之后不能改**，改了会导致用户无法收到更新
4. `src-tauri/icons/` 换成你自己的图标
5. 重新生成更新签名密钥（见下）

## 自动更新

### 首次配置

```bash
npm run tauri:signer
```

会生成 `~/.tauri/tauri-vue-desktop-template.key`（私钥）和同名 `.pub`（公钥）。
把 `.pub` 的内容填进 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`，
并把 `endpoints` 里的 `OWNER/REPO` 换成你的 GitHub 仓库。

> 私钥丢了就再也发不出新版本，已安装的用户会永远卡在旧版。务必备份。

### 发布流程

1. 同步改三处版本号：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`
2. 在仓库 Settings → Secrets 里配置 `TAURI_SIGNING_PRIVATE_KEY`（私钥文件内容），
   有密码再加 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. 打 tag 推送：`git tag v0.2.0 && git push origin v0.2.0`
4. CI 三端打包、生成 `latest.json`、创建 draft release，确认后发布即可

macOS 未签名时用户需要执行 `xattr -c /Applications/YourApp.app` 才能打开。
要签名就额外配置 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、
`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID` 六个 secrets（未配置时构建照常，仅不签名）。

## 目录结构

```
src/                  前端
  lib/db.ts           SQLite 封装（Todo CRUD + 类型）
  lib/updater.ts      检查 / 下载 / 安装 / 重启
  App.vue             演示页
src-tauri/
  src/lib.rs          应用装配：插件注册、单实例、窗口事件
  src/tray.rs         托盘图标与菜单
  src/db.rs           SQLite 迁移定义
  capabilities/       前端可调用的权限白名单
  tauri.conf.json     应用配置（窗口、更新端点、打包）
```

## 几个需要注意的默认行为

- **关闭窗口不会退出进程**，只隐藏到托盘；从托盘菜单选「退出」才真正结束。
  不需要这个行为就删掉 `src/lib.rs` 里监听 `CloseRequested` 的那段。
- **每条迁移只写一条 SQL 语句**。底层 sqlx 的 `execute` 不支持多语句，
  把 `CREATE TABLE` 和 `CREATE INDEX` 塞进同一条迁移会运行时报错。
- **新插件要同步三处**：`Cargo.toml`、`lib.rs` 的 `.plugin(...)`、以及
  `capabilities/default.json` 的权限，缺权限会在调用时静默失败。
- 生产环境上线前把 `tauri.conf.json` 里的 `app.security.csp` 从 `null` 改成具体的 CSP 策略。
