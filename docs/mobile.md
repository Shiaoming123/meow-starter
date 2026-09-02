# 移动端适配方案（Android / iOS）

> 让 meow-starter 从「桌面三端」扩展为「桌面 + 移动端」全平台脚手架。
> 基于 Tauri 2 的移动端能力（框架原生支持 iOS/Android，这是当初选 Tauri 而非 Electron 的关键理由之一）。

---

## 0. 现状与目标

| 维度 | 现状 | 目标 |
|---|---|---|
| 桌面端 | ✅ macOS / Windows / Linux 已落地 | 保持 |
| 移动端 | 🟡 已完成 M1–M2 代码适配，尚未经过原生工具链验证 | 补 Android / iOS 完整适配 |
| 前端 | ✅ 桌面侧边栏 + 移动端底部 tab | 保持响应式与安全区适配 |
| 桌面专属能力 | tray / single-instance / updater | 移动端安全降级 |

**核心理念延续**：跨端复用的能力（SQLite、Agent、主题、设计系统、MCP）保持不变，桌面专属能力按平台降级。

---

## 1. 前置依赖（环境配置指引）

> 移动端构建需要完整的原生工具链，请按你的目标平台逐步配置。**脚手架本身不绑定这些环境**——装好依赖后，`tauri android init` / `tauri ios init` 就能生成工程。

### 1.1 Android（约 20–30 GB，需 Android Studio）

**第一步：装 Android Studio + SDK 组件**

1. 下载安装 [Android Studio](https://developer.android.com/studio)
2. 打开后进入 **SDK Manager**（`Tools → SDK Manager`），在 **SDK Platforms** 页勾选最新 **Android SDK Platform**
3. 切到 **SDK Tools** 页，勾选并安装：
   - **Android SDK Platform-Tools**
   - **Android SDK Build-Tools**
   - **NDK（Side by side）** —— Tauri 必需
   - **Android SDK Command-line Tools**

**第二步：配置环境变量**（写入 `~/.zshrc` 或 `~/.bashrc`，持久化）

```bash
# macOS（Android Studio 默认路径）
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk | sort -V | tail -1)"

# Linux（常见路径）
# export JAVA_HOME=/opt/android-studio/jbr
# export ANDROID_HOME="$HOME/Android/Sdk"
```

> 写完后 `source ~/.zshrc` 重新加载。NDK_HOME 指向具体版本目录（不是 `ndk/` 本身）。

**第三步：添加 Rust Android target**

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

**验证就绪**：

```bash
echo $ANDROID_HOME                              # 应输出 SDK 路径
rustup target list --installed | grep android   # 应看到 4 个 android target
```

### 1.2 iOS（仅 macOS，需完整 Xcode，非 Command Line Tools）

**第一步：装完整 Xcode**

```bash
# App Store 搜索 Xcode，或从 Apple Developer 下载
# 装完启动一次，让它完成组件安装
sudo xcodebuild -license accept   # 接受许可协议
```

**第二步：添加 Rust iOS target**

```bash
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
```

**第三步：装 Cocoapods**

```bash
brew install cocoapods
pod --version   # 验证安装
```

> 若 `brew install cocoapods` 遇到 `ca-certificates` 链接冲突（`Cannot link ca-certificates`），先执行 `brew unlink ca-certificates && brew install cocoapods && brew link ca-certificates`。

**验证就绪**：

```bash
xcodebuild -version                             # 应输出完整 Xcode 版本（不是 "Command Line Tools"）
pod --version                                   # 应输出 Cocoapods 版本
rustup target list --installed | grep ios       # 应看到 3 个 ios target
```

### 1.3 一句话总结

| 平台 | 核心依赖 | 体积 | 验证命令 |
|---|---|---|---|
| Android | Android Studio + SDK + NDK | ~20–30 GB | `echo $ANDROID_HOME` |
| iOS | 完整 Xcode + Cocoapods | ~15 GB | `xcodebuild -version` + `pod --version` |

> ⚠️ **前置依赖较重**：这是「移动端适配」最真实的成本，非代码层面能省略。若只做桌面三端，可完全跳过本节。

---

## 2. 初始化与运行

前置依赖就绪后，初始化移动端工程：

```bash
# Android：生成 src-tauri/gen/android/（Gradle 工程）
npm run tauri android init

# iOS：生成 src-tauri/gen/apple/（Xcode 工程，仅 macOS）
npm run tauri ios init
```

初始化后即可开发 / 构建：

```bash
# 开发模式（热更新）
npm run tauri android dev     # 需连接 Android 设备或模拟器
npm run tauri ios dev         # 需打开 Xcode 模拟器

# 生产构建
npm run tauri android build   # 生成 APK / AAB
npm run tauri ios build       # 生成 IPA
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

> **成熟度：Beta。** M1–M2 已在浏览器构建产物中验证；M3–M5 尚未在 Android Studio / Xcode、模拟器或真机中验证。“代码已适配”不等于“移动端已可发布”。

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
2. **代码层面（M1-M2）**：已经完成，并由构建产物检查持续验证窄屏布局与底部安全区。
3. **工程层面（M3-M5）**：依赖 Android Studio / Xcode，需真实移动端环境，建议按需执行。
4. **建议先做 M1-M2**，把「代码就绪」状态落地；M3-M5 由使用者按需在自己机器上执行（README 给出明确命令）。
