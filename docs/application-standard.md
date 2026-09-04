# 应用开发与交付标准

这份文档是把 `meow-starter` 做成真实产品时的默认标准。开发者和 Agent 在改业务 UI、默认设置或交付方式前应先读本页；具体实现细节再分别查阅 [设计系统](./design-system.md)、[开发指南](./development.md) 与 [Windows 交付指南](./windows-distribution.md)。

> 本页定义派生应用应达到的产品基线，不表示模板演示页已经替每个应用完成字体安装、品牌设计、签名或发布验证。

## 一、完成定义：用户可以双击运行

`npm run tauri dev` 只用于开发。面向非开发者交付时，不能要求用户安装 Node.js、Rust、打开终端或进入源码目录。

Windows 首个可体验版本至少满足：

- 生成可双击运行的 `Portable.exe`、当前用户级 `Setup.exe` 和 `Installer.msi` 标准交付包；对外至少提供 Portable 与 Setup，需要企业部署时再公开 MSI。
- 首次启动能看到完整应用壳；可选模块失败时给出可恢复的错误状态，不能留下空白窗口。
- 新建、退出、重新打开后，核心数据与用户设置仍然存在。
- 在普通非管理员账户中，从资源管理器双击每种实际公开的 Portable 或安装器，完成首次启动、关闭重开与核心数据保留检查；浏览器页面或进程存在不能替代桌面 UI 验收。
- 明确区分未签名、Tauri updater 签名和 Authenticode，不把 SHA-256 或 updater `.sig` 写成“可信发布者”证明。

运行：

```powershell
npm ci
npm run verify
npm run release:check
npm run package:windows
npm run package:windows:audit
npm run smoke:windows-package
```

`package:windows` 的标准输出目录是 `release-artifacts/windows/<version>/`：

```text
<Ascii_App_Name>_<version>_<arch>_Setup.exe
<Ascii_App_Name>_<version>_<arch>_Installer.msi
<Ascii_App_Name>_<version>_<arch>_Portable.exe
SHA256SUMS.txt
manifest.json
README.txt
```

文件名由当前产品配置生成；常见 64 位 Intel/AMD 构建的 `<arch>` 为 `x64`。不要在脚本里写死产品名、版本、架构或绝对路径。`Portable` 仅表示应用本体无需安装；SQLite、Store 和日志默认仍位于当前用户的 AppData。公开分发前继续完成项目自己的端点、签名、干净设备与升级验证，详见 [Windows 交付指南](./windows-distribution.md)。

## 二、字体基线

派生应用默认使用：

- 中文：**Noto Sans SC Variable**。
- 英文与数字：**Manrope Variable**。
- 两者均采用 SIL Open Font License 1.1；通过 npm 自托管，不依赖运行时远程字体服务。

模板当前没有预装字体包。产品化时安装：

```bash
npm install @fontsource-variable/manrope @fontsource-variable/noto-sans-sc
```

在 `src/main.ts` 中先导入字体，再导入全局样式：

```ts
import '@fontsource-variable/manrope'
import '@fontsource-variable/noto-sans-sc'
import './assets/themes/global.css'
```

在 `src/assets/themes/global.css` 统一声明，不在组件内重复配置：

```css
:root {
  --font-sans: 'Manrope Variable', 'Noto Sans SC Variable', 'Noto Sans SC',
    'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  font-family: var(--font-sans);
}

button,
input,
select,
textarea {
  font: inherit;
}
```

Manrope 放在前面，使其优先承担英文与数字；缺失的中文字形继续由 Noto Sans SC 和系统中文字体回退。只使用当前 token 约定的 `400`、`500` 字重；正文以 `13–14px` 为主，页面主标题不超过 `20px`。字体包升级时同步 lockfile，并在应用的第三方声明中记录字体名称、版本和 `OFL-1.1`，不要打包来源不明的字体文件。字体资源随应用从同源加载，不能为了字体放宽生产 CSP 或增加运行时网络依赖。

## 三、应用视觉与交互标准

视觉参考 iOS 的磨砂亚克力质感，但不照搬平台界面。目标是清晰的层级、轻盈的材质和稳定的可读性，不是给每个容器叠加透明、圆角和阴影。

### 材质规则

- 页面背景、主面板、浮层和控件只使用语义 token；主题只改颜色与材质变量，不改变业务布局。
- 亚克力层由半透明 surface、细边框、适度 `backdrop-filter: blur(...) saturate(...)` 和轻阴影共同表达。
- 只在侧栏、浮层、工具栏等需要区分空间层级的位置使用毛玻璃；正文列表优先使用稳定的不透明或高不透明度表面。
- light、dark 都要单独校验文字、边框和焦点对比度。浏览器不支持 `backdrop-filter`，或用户选择“降低透明度”时，回退为不透明 surface，不能牺牲可读性。
- 动效只解释状态变化，使用 `--motion-*`；必须尊重 `prefers-reduced-motion`。

### 交互规则

- **简约 UI 与直观 UX 优于冗长、突兀的文字提醒。** 先用位置、形状、标准图标、状态和渐进反馈表达，再保留必要文案。
- 图标按钮使用 Lucide 静态注册，并提供 `aria-label`、可见焦点和悬浮提示；tooltip 不是无障碍名称的替代品。
- 输入框有真实 label；placeholder 只给格式示例或短提示，不能替代 label。
- 空状态保持“简短标题 + 一个主要行动”，错误状态说明发生了什么及可执行的恢复动作。
- 保存、完成、同步等反馈优先使用就地状态或短暂 toast；破坏性操作才使用确认，并提供可撤销能力时优先撤销。
- 桌面与移动端保持同一信息架构；移动端把悬浮操作改成可点击入口，触控目标不小于 `44 × 44px`。

### 必须避免

- 用超大字号、粗重字重或整屏口号代替信息层级。
- 用“点击这里添加”“此按钮用于删除”等说明文字弥补不清晰的控件。
- 每个区块都套 Card、毛玻璃、圆角和阴影，形成“卡片套卡片”。
- 透明度过高、低对比文字、纯装饰 blur，或在深色模式继续复用浅色参数。
- 硬编码颜色、字号、间距、圆角、阴影和 z-index；绕过现有 token 另建一套样式体系。
- 仅 hover 可见的关键操作、只有颜色差异的状态、没有键盘焦点的自制控件。
- 在首屏等待可选网络、数据库或原生模块后才挂载 Vue，导致失败时白屏。
- 用 Web 构建成功冒充桌面可运行，或把未验证的签名、更新、商店能力写成已完成。

## 四、根据产品定位选择主题

在写页面前先写一张产品定位卡：`核心用户 / 高频任务 / 使用环境 / 情绪关键词 / 信息密度 / 主主题 / 默认模式`。从现有主题选一个主基线，不要一开始新增主题。

| 产品定位 | 首选主题 | 使用建议 |
| --- | --- | --- |
| 开发者工具、效率工具、管理面板 | `ocean` | 冷静、清晰，允许较高信息密度 |
| 笔记、知识管理、学习记录 | `forest` | 柔和、长时间阅读友好 |
| 生活记录、习惯、创意工具 | `amber` | 温暖但克制，强调色只用于关键行动 |
| 写作、专注、阅读 | `mono` | 减少装饰，以内容和排版建立层级 |

若定位与四套主题都不匹配，再在 `src/assets/themes/index.ts` 添加一套完整 light/dark 语义色。先验证主旅程、对比度、空状态、错误态和移动端，再把它列为可选主题。

## 五、全局设置与默认状态

配置分为三层，禁止把默认值散落在组件中：

1. **构建期能力**：`src/modules/config.ts` 决定模块是否装配；原生模块同时对齐 contract、Cargo feature、插件注册和 capability 权限。
2. **产品默认值**：产品化时创建一个独立配置入口（建议 `src/config/app-defaults.ts`），集中维护主题、语言、首次启动页、列表排序等默认值；`app.protocol.json` 只记录会影响产品边界的默认能力与降级行为。
3. **用户偏好与会话状态**：桌面持久化设置走 `tauri-plugin-store`，Web 走对应存储适配器；搜索词、临时展开态、未提交表单等留在会话内。当前主题实现直接使用 `localStorage`，派生产品应通过一次迁移把旧键读入统一设置适配器，再移除双写，避免两个事实源。

每项设置都写清 `类型 / 默认值 / 持久化位置 / 可否重置 / 迁移策略`。解析顺序为：有效的用户显式选择优先；选择“跟随系统”或尚未设置时读取系统偏好；系统不可用时使用产品默认值。旧值无效时迁移并记录可恢复错误，不能让设置解析失败阻止应用壳挂载。

默认关闭需要账号、密钥、网络或高权限的可选能力。新增“恢复默认设置”时只清理已声明的设置键，不删除领域数据；会影响数据或账号的重置必须单独确认。

## 六、推荐落地路径

1. 固定产品目标、非目标、平台优先级和数据边界，更新 `app.protocol.json`。
2. 完成改名、identifier、图标、版本和仓库元数据；identifier 发布后不再修改。
3. 选主题并配置字体、产品默认值、light/dark 与可访问性回退。
4. 只完成一个可端到端使用的核心旅程，先验证真实数据持久化与重启恢复。
5. 在真实 Tauri 窗口验证首屏、空状态、错误态、键盘和移动布局；保留启动失败仍挂载应用壳的 fail-safe。
6. 运行质量门禁，再生成并亲自双击 Windows 安装包和 Portable；记录哈希、签名状态与尚未验证项。

Windows 上的临时 clone、构建试验和外部参考仓库应放在非系统盘的专用临时目录，例如 `D:\DevTemp\meow\`。用完后只清理已确认的具体 clone；不要把递归删除目标设为盘符根目录、用户目录或未解析的环境变量。发布产物和临时 clone 都不应提交到源仓库。

## 七、提交前验收

- [ ] 核心用户旅程无需说明书即可完成，界面没有冗长控件说明。
- [ ] 字体按 Manrope → Noto Sans SC → 系统字体顺序自托管并回退，许可证已记录。
- [ ] 主题使用现有 token，light/dark、降低动效、降低透明度和键盘操作可用。
- [ ] 默认状态集中定义，用户设置可持久化、迁移和安全重置。
- [ ] 可选能力失败不会白屏，错误可见且可恢复。
- [ ] `npm run verify` 通过；Windows 交付还通过 package audit，以及隔离 NSIS 安装与短时进程存活 smoke。
- [ ] 人工验收每种实际公开的安装包或 Portable：普通非管理员用户可从资源管理器双击，窗口可见且可交互，首次启动、关闭重开、托盘隐藏/真正退出和核心数据保留符合设计。
- [ ] 覆盖安装与卸载行为已验证，并明确卸载是否保留用户数据；不会用重置设置误删领域数据。
- [ ] 未验证的签名、更新、托管、真机或商店能力被明确标注，而不是省略。
