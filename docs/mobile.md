# 移动端适配方案（Android / iOS）

> 让 meow-starter 从「桌面三端」扩展为「桌面 + 移动端」全平台脚手架。
> 基于 Tauri 2 的移动端能力（框架原生支持 iOS/Android，这是当初选 Tauri 而非 Electron 的关键理由之一）。

---

## 0. 现状与目标

| 维度 | 现状 | 目标 |
|---|---|---|
| 桌面端 | ✅ macOS / Windows / Linux 为主要 CI 与发布目标 | 保持 |
| 移动端 | 🟡 已完成 M1–M2 代码适配，尚未经过原生工具链验证 | 补 Android / iOS 完整适配 |
| 前端 | ✅ 桌面侧边栏 + 移动端底部 tab | 保持响应式与安全区适配 |
| 桌面专属能力 | tray / single-instance / updater | 移动端安全降级 |

**核心理念延续**：SQLite、主题和设计系统跨端复用，桌面专属能力按平台降级。Agent 的原生 feature 目前仅面向桌面，MCP 又依赖 Agent；二者在移动端仍是未启用的 Preview 路径。

---

## 1. 前置依赖（环境配置指引）

> 移动端构建需要完整的原生工具链，请按你的目标平台逐步配置。**脚手架本身不绑定这些环境**——装好依赖后，`tauri android init` / `tauri ios init` 就能生成工程。

先运行不读取或打印路径/密钥内容的诊断：

```bash
npm run mobile:doctor
```

它分别报告 Android SDK/NDK/JDK、`adb`、Rust targets 和可见
Android device/emulator，以及 macOS 上的 Xcode、CocoaPods 和 iOS Rust
targets。`missing-prerequisites` 或 `unavailable` 是明确的环境状态，不是
构建或设备失败；检测到设备也不等于已运行真机 smoke。只有在所需工具链和
用户选定的设备/模拟器都就绪后，才运行下面显式的 `tauri android dev` 或
`tauri ios dev`，并把其真实输出作为设备验证证据。

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

Windows 可在用户环境变量中设置同样的三个值：`JAVA_HOME` 应指向与 Gradle
兼容的 JDK 21，`ANDROID_HOME`（以及兼容用途的
`ANDROID_SDK_ROOT`）指向 `%LOCALAPPDATA%\Android\Sdk`，`NDK_HOME` 指向
其中具体的 `ndk\<版本>` 目录。将 `platform-tools` 与
`cmdline-tools\latest\bin` 加入用户 `Path`，然后重新打开终端再运行
`adb` 或 `npm run mobile:doctor`。

Android Studio 的内置 JBR 可能比生成工程的 Gradle 支持得更早；例如 JBR
为 Java 25 而 Gradle 8.14 时，会在 `Unsupported class file major version 69`
处失败。此时安装一个独立的 JDK 21，并将 `JAVA_HOME` 指向它，而不是修改
项目的 Gradle wrapper。

> Windows 上的 `tauri android dev` 需要将 Rust `.so` 链接进生成的
> Android 工程。启用 Windows **Developer Mode**（或由管理员授予创建符号
> 链接权限）后重新打开终端；否则 Tauri 会在该链接步骤明确失败，且不应把
> 这种状态误报为 ADB 或模拟器故障。

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
| 网络（Agent/MCP，未来按需） | `INTERNET` | 默认 | 访问经产品授权的云端模型 / MCP server；移动端不装配 updater |
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

**实现**：Cargo.toml 已有 `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` 处理 single-instance 与 updater；`tray` 模块已 `#[cfg(desktop)]`；前端用运行时平台能力决定是否渲染桌面入口。

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

> **成熟度：Beta。** M1–M2 已在浏览器构建产物中验证；Android M3 已在本机 SDK、模拟器和 `tauri android dev` 上验证，且已生成本地 universal debug APK/AAB。iOS M4 未开始；M5 的签名、真机与商店部分仍未验证。“本地 debug 已通过”不等于“移动端已可发布”。

| 阶段 | 内容 | 前置 | 可独立验证 |
|---|---|---|---|
| **M1** | 前端响应式（viewport + 底部 tab） | 无 | 浏览器 DevTools 手机模拟 |
| **M2** | 桌面能力降级（cfg 排除 + 前端检测） | 无 | 桌面三端 CI 仍绿 |
| **M3** | `tauri android init` 生成 Android 工程 | Android Studio + NDK | 已完成：模拟器 `tauri android dev` |
| **M4** | `tauri ios init` 生成 iOS 工程 | Xcode + Cocoapods | 待 macOS 环境：`tauri ios dev` |
| **M5** | 移动端 capabilities + 签名打包 | 开发者账号 | 部分完成：本地 debug APK/AAB；签名/真机/商店待完成 |

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
3. **工程层面**：Android M3 与无签名 debug 打包已有本地证据；iOS 和所有商店交付仍需对应环境、账号与证书。
4. **下一步**：Android 先在真机安装/启动并配置签名；iOS 在 macOS 上单独建立同等证据链。详见 [delivery-path.md](./delivery-path.md)。
