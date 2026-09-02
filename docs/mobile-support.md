# 移动端适配方案（Android / iOS）

> 让 meow-starter 从「桌面三端」扩展为「桌面 + 移动端」全平台脚手架。
> 基于 Tauri 2 的移动端能力（框架原生支持 iOS/Android，这是当初选 Tauri 而非 Electron 的关键理由之一）。

---

## 0. 现状与目标

| 维度 | 现状 | 目标 |
|---|---|---|
| 桌面端 | ✅ macOS / Windows / Linux 已落地 | 保持 |
| 移动端 | ❌ 仅预留 `mobile_entry_point` 入口 | 补 Android / iOS 完整适配 |
| 前端 | 桌面侧边栏布局（1000×680 设计） | 响应式（移动端底部 tab / 抽屉） |
| 桌面专属能力 | tray / single-instance / updater | 移动端安全降级 |

**核心理念延续**：跨端复用的能力（SQLite、Agent、主题、设计系统、MCP）保持不变，桌面专属能力按平台降级。

---

## 1. 前置依赖

### Android（需要 Android Studio）

```bash
# 1. 装 Android Studio + SDK Manager 里装：SDK Platform / Platform-Tools / NDK / Build-Tools / Command-line Tools
# 2. 环境变量
export JAVA_HOME=/opt/android-studio/jbr
export ANDROID_HOME="$HOME/Android/Sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)"
# 3. rustup 加 Android target
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### iOS（仅 macOS，需要完整 Xcode 而非 CLT）

```bash
# 1. 装 Xcode（App Store / Apple Developer）
# 2. rustup 加 iOS target
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
# 3. 装 Cocoapods
brew install cocoapods
```

> ⚠️ **前置依赖较重**：Android Studio + NDK 约几十 GB，iOS 需完整 Xcode。这是「移动端适配」最真实的成本，非代码层面能省略。

---

## 2. 初始化步骤

```bash
# Android
npm run tauri android init

# iOS（仅 macOS）
npm run tauri ios init
```

会生成：

```
src-tauri/
├── gen/
│   ├── android/          # Android 工程（Gradle）
│   │   ├── app/
│   │   └── ...
│   └── apple/            # iOS 工程（Xcode）
│       ├── Project/
│       └── ...
```

---

## 3. 移动端 capabilities

Tauri 移动端用独立的 capability 文件（`src-tauri/capabilities/` 下，或 `gen/` 里），需要声明移动端权限：

| 能力 | Android 权限 | iOS 权限 | 说明 |
|---|---|---|---|
| 网络（Agent/更新/MCP） | `INTERNET` | 默认 | 访问云端模型 / MCP server |
| SQLite 存储 | 默认 | 默认 | 数据落沙盒 |
| 通知 | `POST_NOTIFICATIONS` | 用户授权 | P1 notification 模块 |
| 剪贴板 | 默认 | 默认 | P1 clipboard 模块 |
| 文件访问 | `READ/WRITE_EXTERNAL_STORAGE` | 用户授权 | fs 模块 |

---

## 4. 桌面专属能力降级

以下能力在移动端**无对应概念**，需编译期排除 + 前端运行时检测：

| 能力 | 移动端处理 |
|---|---|
| 系统托盘 `tray` | ❌ 移动端无托盘，`#[cfg(desktop)]` 排除 |
| 单实例 `single-instance` | ⚠️ 已用 `cfg(not(android/ios))` 排除 |
| 自动更新 `updater` | ⚠️ 移动端走应用商店更新，updater 插件需降级 |
| 全局快捷键 `shortcut` | ❌ 移动端无概念，feature 关闭 |

**实现**：Cargo.toml 已有 `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` 处理 single-instance；`tray` 模块已 `#[cfg(desktop)]`；前端用 `isTauri()` + 平台检测决定是否渲染托盘相关 UI。

---

## 5. 前端响应式改造

当前布局是桌面侧边栏（200px）+ 主区，移动端需改为：

```
桌面端（≥ 768px）：侧边栏导航 + 主区        ← 现状
移动端（< 768px）：底部 tab bar + 内容区     ← 新增
```

具体改造：

1. `index.html` 加 `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
2. `App.vue` 的侧边栏在窄屏隐藏，改为底部 tab bar
3. 设计系统的 `--space-*` / 字号在移动端适度缩小（可选，用 media query）

---

## 6. 分阶段实施

| 阶段 | 内容 | 前置 | 可独立验证 |
|---|---|---|---|
| **M1** | 前端响应式（viewport + 底部 tab） | 无 | 浏览器 DevTools 手机模拟 |
| **M2** | 桌面能力降级（cfg 排除 + 前端检测） | 无 | 桌面三端 CI 仍绿 |
| **M3** | `tauri android init` 生成 Android 工程 | Android Studio + NDK | `tauri android dev` 真机/模拟器 |
| **M4** | `tauri ios init` 生成 iOS 工程 | Xcode + Cocoapods | `tauri ios dev` 模拟器 |
| **M5** | 移动端 capabilities + 签名打包 | 开发者账号 | `tauri android build` / `ios build` |

**建议停手点**：M1-M2 是纯代码层，无需重前置依赖，可立即做并保持 CI 绿。M3-M5 依赖 Android Studio / Xcode，属于「环境就绪后」的工作，且需要真机/模拟器验证，不适合在无移动端环境的本机空做。

---

## 7. 关键风险与取舍

| 风险 | 应对 |
|---|---|
| 前置依赖重（几十 GB） | 文档写清；M1-M2 与 M3-M5 解耦，前者可先行 |
| 桌面专属插件移动端崩溃 | 编译期 cfg 排除，杜绝运行时报错 |
| 前端小屏布局溢出 | viewport + 底部 tab，浏览器模拟先行验证 |
| 移动端签名/上架复杂 | 属于「发布」而非「脚手架」范畴，文档指引即可 |
| iOS 仅 macOS 可构建 | 文档注明；CI 可加 macOS runner 跑 iOS 构建 |

---

## 8. 结论

1. **框架层面**：Tauri 2 原生支持移动端，脚手架只需补「初始化 + 降级 + 响应式」三步。
2. **代码层面（M1-M2）**：可立即做，无需重环境，保持 CI 绿。
3. **工程层面（M3-M5）**：依赖 Android Studio / Xcode，需真实移动端环境，建议按需执行。
4. **建议先做 M1-M2**，把「代码就绪」状态落地；M3-M5 由使用者按需在自己机器上执行（README 给出明确命令）。
