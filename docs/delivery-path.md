# 从脚手架到服务与发布

这份文档记录 `meow-starter` 当前能提供的最大通用底座，以及把它变成具体产品时必须由项目所有者作出的决定。它把“已验证”“可配置”和“需要外部权限”分开，避免把模板能力当成已上线服务。

## 当前证据链

| 链路 | 当前状态 | 已验证证据 | 仍不代表 |
| --- | --- | --- | --- |
| 默认 Web | Beta | `npm run build:web`、本地浏览器 IndexedDB smoke | 已部署站点、账号服务 |
| 默认桌面 | Stable baseline | `npm run verify`、`npm run rust:verify`、Windows 无签名安装 smoke | 签名、公证、在线更新 |
| Android | Beta | SDK/NDK/JDK/ADB doctor、模拟器 `tauri android dev`、本地 universal debug APK/AAB、干净 GitHub runner 的 x86_64 debug APK workflow | 真机、签名、Google Play、更新通道 |
| iOS | Deferred | 仅代码降级与文档 | Xcode 构建、模拟器、TestFlight、App Store |
| 同步服务 | Preview foundation | 本地优先 outbox、IndexedDB 状态、allowlist、HTTPS/loopback HTTP transport 测试 | 账号、冲突产品规则、托管 API、多设备运行 |
| 桌面更新 | Template only | 端点/公钥/CI 模板与严格 release gate | 自有端点、私钥签名、安装端更新 |

## 脚手架的服务上限

在不选择云厂商、不创建账号、不提交任何密钥的前提下，脚手架已经提供：本地领域存储、版本化数据导出边界、默认关闭的同步 outbox、持久化 Web 同步状态、collection allowlist，以及只允许 HTTPS（或 loopback 开发地址）的 HTTP transport。

这是通用代码可以安全做到的上限。一个真正的服务还必须定义数据所有者、身份来源、授权规则、删除与冲突语义、保留期限、地区与成本；这些是产品决定，不能由模板替项目猜测。同步模块因此保持关闭，也不会自行联网。实现细节和接入契约见 [sync.md](./sync.md)。

## 采用顺序

1. **固定产品身份。** 替换名称、identifier、图标、仓库元数据与版本，并执行 `npm run release:check`。identifier 一旦发布不可更改。
2. **先完成本地用户旅程。** 为领域定义小型 store 接口和迁移；用 `npm run verify`、`npm run rust:verify` 与目标平台 smoke 固定行为。
3. **选择服务模型。** 在“用户账号 + HTTPS API”“受控局域网配对”“独立协作文档”中选一个。不要把 SQLite 文件、钥匙串、token、日志或更新密钥放进通用同步层。
4. **把领域映射到同步契约。** 为每个可同步记录设计全局 id、owner/device、revision、tombstone、schema version 与幂等 operation id；先在隔离环境验证断网写入、重复上传、远端失败和冲突。
5. **配置受控交付。** 给桌面更新器配置自有 HTTPS endpoint 与匹配的签名密钥，再让 `npm run release:check -- --mode=release` 通过；仅随后才创建 tag release。
6. **完成平台发布。** Android 需要 upload keystore、别名/密码、真实设备和 Play Console；iOS 需要 macOS、Xcode、签名身份、TestFlight/App Store 权限。它们都不能写入仓库或 CI 日志。

## Android 本地链路

在配置好 JDK 21、Android SDK/NDK 和 Rust Android targets 的终端中：

```powershell
npm run mobile:doctor
npm run tauri -- android init --ci
npm run tauri -- android dev
npm run tauri -- android build --debug
npm run check:android-artifact -- --apk src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

最后一条会在忽略的 `src-tauri/gen/android/` 树中生成 debug APK/AAB。它适合本地安装和 ABI/启动验证；不能替代 release signing。Windows 还需要 Developer Mode（或创建符号链接的等效权限）。
GitHub 上也提供手动触发的 `android-debug` workflow：它在干净环境生成工程、构建 x86_64 debug APK、核验元数据并保存调试产物。该工作流已在 `cc0507d` 的首次手动运行中成功；它不是商店发布工作流。

## 发布前的人工输入

下表是刻意不能自动完成的部分；提供这些输入前，任何自动化都应停在对应 gate，而非伪造成功。

| 目标 | 必需输入 |
| --- | --- |
| 桌面更新 | 自有 HTTPS 发布地址、匹配私钥、CI secret 所有权、安装端更新验收 |
| Android 上架 | 已拥有的 application id、versionCode 规则、upload keystore 与安全存储、Play Console 账号、真机验收 |
| iOS 上架 | Apple Developer 团队、证书/provisioning、macOS/Xcode、TestFlight/设备验收 |
| 云端同步 | 身份提供方、数据模型/RLS 或等价授权、数据区域/保留、审计和成本边界 |

每次改变上述边界时，同时更新 `app.protocol.json`、相应实现文档和验证命令；协议中的交付状态只记录已有证据，不记录愿望。
