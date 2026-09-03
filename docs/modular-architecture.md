# 模块化架构方案

> meow-starter 从「预置功能的模板」演进为「可插拔能力模块的底座」。
> 核心诉求：**使用者的灵活性 + 脚手架整体的稳定性 + 集成化**三者平衡。
>
> **成熟度说明**：模块契约、依赖排序、运行时能力过滤和装配属于 Stable；Web IndexedDB 属于 Beta，sync 接缝属于 Preview。只有使用原生 Rust 插件的模块需要与 Cargo feature 对应，纯 Web 模块没有 Cargo feature。

---

## 0. 设计目标

当前脚手架是「一次性预置」的：SQLite、托盘、更新、主题、Agent 全部默认装好、默认启用。这带来两个问题：

1. **灵活性不足**：用户想做一个「纯计算器」或「纯笔记」，却被迫带着托盘、更新、Agent 的代码与依赖。
2. **集成化不够**：功能散落在 `lib.rs`、`App.vue`、各 `lib/*.ts` 里，没有统一的「模块」概念，用户看不出「哪些是一块、怎么关掉」。

模块化改造要达成的效果：

```
用户视角：     我要托盘 → 开托盘模块；我要 Agent → 开 Agent 模块。
              不要的模块不进入默认运行时加载路径，边界清晰、心智负担低。
脚手架视角：   每个模块有清晰的边界、独立的开关、独立的文档。
```

---

## 1. 四层门控机制

一个「能力模块」最多经过四层控制；纯 Web 模块不需要第四层：

```
┌─────────────────────────────────────────────────────────┐
│ ① 配置层（模块清单）                                       │
│    src/modules/config.ts —— 声明启用了哪些模块             │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│ ② 前端层（按需加载）                                       │
│    src/modules/<name>/index.ts —— 动态 import 入口        │
│    启用的模块才被 Vite 打进 bundle                         │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│ ③ 运行时层（platform + capabilities）                       │
│    Web / Desktop / Mobile —— 不支持的平台不执行 setup       │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│ ④ Rust 层（仅原生模块的 feature 门控）                      │
│    Cargo.toml [features] —— 启用的 feature 才编译插件     │
└─────────────────────────────────────────────────────────┘
```

**为什么四层**：

| 层 | 解决的问题 | 关闭时的效果 |
|---|---|---|
| 配置层 | 统一声明「用哪些模块」，是唯一入口 | 用户只需改一处 |
| 前端层 | 避免模块进入首屏执行路径 | 未启用模块不执行；Vite 仍可能输出独立 lazy chunk |
| 运行时层 | 同一配置适配 Web、桌面与移动端 | 不满足平台/能力的模块跳过 `setup()` |
| Rust 层 | 避免原生插件/依赖进二进制 | 不 feature 就不编译、不占体积 |

### 1.1 可执行兼容性契约

四层门控中，运行时选择与原生构建是两个独立平面，不能把前端布尔开关误解为完整的原生安装配置。

| 平面 | 单一事实来源 | 执行时机 | 负责什么 |
| --- | --- | --- | --- |
| 运行时选择 | `src/modules/contract.ts` + `src/modules/config.ts` | 应用启动前 | 用平台、能力和依赖筛选模块；不兼容模块不会被动态导入 |
| 原生构建 | `src-tauri/Cargo.toml` + `src-tauri/capabilities/default.json` | Rust 编译与应用权限授予前 | 声明 Cargo feature 与 Tauri permission；不会由前端自动修改 |

每个契约条目都包含模块 id、依赖、支持平台、运行时能力与原生构建要求。loader 在导入前以它筛选，并在导入后比较模块声明；二者不同会在 `setup()` 前失败，避免“文档说不能用、代码却先加载”的漂移。

修改 `defaultModuleConfig` 中的原生可选模块后，运行：

```bash
npm run check:modules          # 桌面目标（默认）
npm run check:modules -- web   # Web 目标
npm run check:modules -- mobile
```

检查会报告缺少的 Cargo feature 或 Tauri permission，但不会替开发者添加 feature、修改权限、初始化移动工程或证明插件在真实设备可用。它是源配置一致性门禁，不是打包或发布证明。

---

## 2. 目标目录结构

```
meow-starter/
├── src/modules/config.ts          # ★ 模块清单（唯一配置入口）
├── src/
│   ├── modules/                   # ★ 模块化改造的核心
│   │   ├── core/                  # 核心模块（始终启用，不可关）
│   │   │   ├── index.ts           #   设计系统 + 主题 + Icon + ui 组件库
│   │   │   └── ui/                #   Button/Card/... 基础组件
│   │   ├── sqlite/                # 数据层模块
│   │   ├── storage/               # 领域存储契约 + 内存回退
│   │   ├── indexeddb/             # Web IndexedDB 适配器
│   │   ├── sync/                  # 同步接缝（默认关闭）
│   │   │   ├── index.ts
│   │   │   └── db.ts
│   │   ├── tray/                  # 托盘模块（含 Rust 联动）
│   │   │   └── index.ts
│   │   ├── updater/               # 自动更新模块
│   │   │   ├── index.ts
│   │   │   └── updater.ts
│   │   ├── themes/                # 主题模块（可并入 core，视需要）
│   │   ├── agent/                 # Agent 模块（已存在，迁入 modules/）
│   │   ├── shortcut/              # 全局快捷键（P1 新增）
│   │   ├── clipboard/             # 剪贴板（P1 新增）
│   │   ├── notification/          # 通知（P1 新增）
│   │   ├── autostart/             # 开机自启（P1 新增）
│   │   └── rag/                   # RAG（P3 预留）
│   ├── lib/                       # 跨模块共享的纯工具函数
│   └── ...
│
├── src-tauri/
│   ├── Cargo.toml                 # [features] 与前端模块一一对应
│   └── src/
│       ├── lib.rs                 # 按 feature 装配插件
│       └── modules/               # Rust 侧模块实现（对应前端）
│           ├── sqlite.rs
│           ├── tray.rs
│           ├── updater.rs
│           └── ...
```

---

## 3. 模块契约（每个模块统一遵守）

每个模块是一个**自包含的目录**，暴露统一的接口：

```ts
// src/modules/<name>/index.ts —— 每个模块的入口
export interface Module {
  /** 模块唯一 id，对应 src/modules/config.ts 的 key */
  id: string
  /** 模块名（展示） */
  name: string
  /** 依赖的其他模块 id（如 agent 依赖 storage） */
  dependencies: string[]
  /** 支持的平台；省略表示全部平台 */
  platforms?: readonly ('web' | 'desktop' | 'mobile')[]
  /** setup 前必须具备的运行时能力 */
  requiredCapabilities?: readonly RuntimeCapability[]
  /** 模块初始化（前端侧，可选） */
  setup?: () => void | Promise<void>
  /** 模块清理（可选） */
  teardown?: () => void | Promise<void>
}

export default {
  id: 'indexedDb',
  name: 'IndexedDB 本地数据层',
  dependencies: ['storage'],
  platforms: ['web'],
  requiredCapabilities: ['web-storage'],
} satisfies Module
```

**模块的四个约束**：

1. **零隐式依赖**：模块间只能通过 `dependencies` 声明依赖，不能偷偷 import 别的模块。
2. **可独立关闭**：关掉一个模块，不影响其他模块（除非有依赖）。
3. **自文档**：每个模块目录里有自己的 README 片段或 JSDoc，说明「做什么、依赖什么、怎么配」。
4. **统一门控**：前端 `setup()` + Rust feature 同步开关。

---

## 4. 配置层设计（src/modules/config.ts）

```ts
// src/modules/config.ts
export default {
  // 核心模块，始终启用（设计系统、基础组件）
  core: true,

  // 功能模块，按需开关
  storage: true,      // 领域存储契约，始终启用
  sqlite: true,       // Tauri 数据层，原生运行时装配
  indexedDb: true,    // Web 数据层，浏览器装配
  sync: false,        // 同步接缝，默认不联网
  tray: true,         // 系统托盘
  updater: true,      // 自动更新
  agent: false,       // Agent（默认关，需装 AI SDK）
  shortcut: false,    // 全局快捷键（P1）
  clipboard: false,   // 剪贴板（P1）
  notification: false,// 通知（P1）
  autostart: false,   // 开机自启（P1）
  rag: false,         // RAG（P3）
}
```

**单一入口**：用户只改这一个文件。脚本自动做两件事：
- 前端：`vite.config.ts` 读取配置，决定哪些模块入口被 import
- Rust：生成/更新 `Cargo.toml` 的 `[features]`（或用一个 build 脚本同步）

---

## 5. 前端装配（main.ts 改造）

```ts
// main.ts
import { createApp } from 'vue'
import { mountModules } from './modules/loader'

const app = createApp(App)

// 只装配启用的模块
await mountModules(app)

app.mount('#app')
```

`mountModules` 内部按配置动态 import 各模块的 `setup()`，未启用的模块完全不加载。

---

## 6. Rust 装配（lib.rs 改造）

```rust
// lib.rs
pub fn run() {
  let mut builder = tauri::Builder::default();

  // 核心：始终装配
  builder = builder.plugin(tauri_plugin_opener::init());

  // 各模块按 feature 装配
  #[cfg(feature = "sqlite")]
  { builder = builder.plugin(tauri_plugin_sql::Builder::default()
      .add_migrations(db::DB_URL, db::migrations()).build()); }

  #[cfg(feature = "tray")]
  { /* 托盘装配 */ }

  #[cfg(feature = "updater")]
  { builder = builder.plugin(tauri_plugin_updater::Builder::new().build()); }

  #[cfg(feature = "shortcut")]
  { builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build()); }

  // ...
}
```

Cargo.toml 的 features 与前端模块一一对应：

```toml
[features]
default = ["sqlite", "tray", "updater"]   # 默认保留现有体验
sqlite = ["dep:tauri-plugin-sql"]
tray = []
updater = ["dep:tauri-plugin-updater"]
shortcut = ["dep:tauri-plugin-global-shortcut"]
clipboard = ["dep:tauri-plugin-clipboard-manager"]
notification = ["dep:tauri-plugin-notification"]
autostart = ["dep:tauri-plugin-autostart"]
agent = []                 # 前端为主，Rust 侧只有 proxy/secrets
agent-sidecar = ["agent"]
```

---

## 7. 灵活性 / 稳定性 / 集成化的平衡

| 目标 | 如何达成 |
|---|---|
| **灵活性** | 模块可插拔，`src/modules/config.ts` 一处开关；纯前端模块不需要 Cargo feature |
| **稳定性** | 模块拓扑由自动化测试验证；关闭模块不进入默认运行时加载路径；依赖显式声明，避免隐式耦合 |
| **集成化** | 统一 `Module` 契约 + 统一装配流程（前端 mountModules + Rust feature），用户一眼看清「有哪些模块、各自做什么」 |

**核心不变**：`core` 模块（设计系统、基础组件）始终启用，保证任何项目都有统一的设计语言与组件底座。这是「集成化」的锚点。

---

## 8. 迁移路径（从现状到模块化）

> 渐进式迁移，不破坏现有能力，每步可独立验证。

| 步骤 | 内容 | 风险 |
|---|---|---|
| **M1** | 建立 `src/modules/config.ts` + `Module` 契约 + `mountModules` loader | 已完成 |
| **M2** | 把 `src/lib/db.ts` 迁入 `src/modules/sqlite/`，`tray`/`updater` 同理 | 低（移动文件 + 改 import） |
| **M3** | `lib.rs` 按 feature 装配插件，`Cargo.toml` 补 features | 中（需验证三端编译） |
| **M4** | 新增 P1 模块（shortcut/clipboard/notification/autostart）作为示范 | 低（官方插件） |
| **M5** | Agent 模块迁入 `modules/agent/`，统一契约 | 低（已有防腐层，迁移顺畅） |

每步完成后跑 `typecheck` + `cargo check` + CI，确保不回归。

---

## 9. 结论

1. **模块化是「四层门控」**：配置声明 + 前端动态 import + 运行时能力 + 原生 Cargo feature；纯 Web 模块使用前三层。
2. **能力模块清单已梳理**（见 `docs/ai-capabilities.md`），P1 补官方插件（快捷键/剪贴板/通知/自启/文件/日志），P2 补本地推理，P3 补 RAG/语音/OCR/MCP。
3. **核心锚点不变**：设计系统 + 基础组件始终启用，是集成化的底座。
4. **迁移渐进式**：M1-M5，每步独立验证，不破坏现有能力。

> 下一步建议：先落地 M1（模块契约 + 配置 + loader）作为骨架，再逐步迁入现有能力。这样「模块化」先有形状，后续新能力照葫芦画瓢即可。
