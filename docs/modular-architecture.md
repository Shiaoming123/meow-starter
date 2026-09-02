# 模块化架构方案

> meow-starter 从「预置功能的模板」演进为「可插拔能力模块的底座」。
> 核心诉求：**使用者的灵活性 + 脚手架整体的稳定性 + 集成化**三者平衡。
>
> **成熟度说明**：模块契约、依赖排序和运行时装配属于 Stable；前端配置与 Cargo feature 仍需手动保持一致。本文中的自动生成、目录迁移和新增能力属于目标设计，不代表已经全部实现。

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

## 1. 三层门控机制

一个「能力模块」由三层协同控制，缺一不可：

```
┌─────────────────────────────────────────────────────────┐
│ ① 配置层（模块清单）                                       │
│    modules.config.ts —— 声明启用了哪些模块                 │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│ ② 前端层（按需加载）                                       │
│    src/modules/<name>/index.ts —— 动态 import 入口        │
│    启用的模块才被 Vite 打进 bundle                         │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│ ③ Rust 层（feature 门控）                                  │
│    Cargo.toml [features] —— 启用的 feature 才编译插件     │
└─────────────────────────────────────────────────────────┘
```

**为什么三层**：

| 层 | 解决的问题 | 关闭时的效果 |
|---|---|---|
| 配置层 | 统一声明「用哪些模块」，是唯一入口 | 用户只需改一处 |
| 前端层 | 避免 JS 依赖进主包 | 不 import 就不打包 |
| Rust 层 | 避免原生插件/依赖进二进制 | 不 feature 就不编译、不占体积 |

---

## 2. 目标目录结构

```
meow-starter/
├── modules.config.ts              # ★ 模块清单（唯一配置入口）
├── src/
│   ├── modules/                   # ★ 模块化改造的核心
│   │   ├── core/                  # 核心模块（始终启用，不可关）
│   │   │   ├── index.ts           #   设计系统 + 主题 + Icon + ui 组件库
│   │   │   └── ui/                #   Button/Card/... 基础组件
│   │   ├── sqlite/                # 数据层模块
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
  /** 模块唯一 id，对应 modules.config.ts 的 key 与 Cargo feature */
  id: string
  /** 模块名（展示） */
  name: string
  /** 依赖的其他模块 id（如 agent 依赖 sqlite） */
  dependencies: string[]
  /** 模块初始化（前端侧，可选） */
  setup?: () => void | Promise<void>
  /** 模块清理（可选） */
  teardown?: () => void | Promise<void>
}

export default {
  id: 'sqlite',
  name: '数据层',
  dependencies: [],
} satisfies Module
```

**模块的四个约束**：

1. **零隐式依赖**：模块间只能通过 `dependencies` 声明依赖，不能偷偷 import 别的模块。
2. **可独立关闭**：关掉一个模块，不影响其他模块（除非有依赖）。
3. **自文档**：每个模块目录里有自己的 README 片段或 JSDoc，说明「做什么、依赖什么、怎么配」。
4. **统一门控**：前端 `setup()` + Rust feature 同步开关。

---

## 4. 配置层设计（modules.config.ts）

```ts
// modules.config.ts
export default {
  // 核心模块，始终启用（设计系统、基础组件）
  core: true,

  // 功能模块，按需开关
  sqlite: true,       // 数据层
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
import modules from '../modules.config'
import { mountModules } from './modules/loader'

const app = createApp(App)

// 只装配启用的模块
await mountModules(app, modules)

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
| **灵活性** | 模块可插拔，`modules.config.ts` 一处开关；新增能力只需新增一个模块目录 + feature |
| **稳定性** | 模块拓扑由自动化测试验证；关闭模块不进入默认运行时加载路径；依赖显式声明，避免隐式耦合 |
| **集成化** | 统一 `Module` 契约 + 统一装配流程（前端 mountModules + Rust feature），用户一眼看清「有哪些模块、各自做什么」 |

**核心不变**：`core` 模块（设计系统、基础组件）始终启用，保证任何项目都有统一的设计语言与组件底座。这是「集成化」的锚点。

---

## 8. 迁移路径（从现状到模块化）

> 渐进式迁移，不破坏现有能力，每步可独立验证。

| 步骤 | 内容 | 风险 |
|---|---|---|
| **M1** | 建立 `modules.config.ts` + `Module` 契约 + `mountModules` loader | 低（纯新增） |
| **M2** | 把 `src/lib/db.ts` 迁入 `src/modules/sqlite/`，`tray`/`updater` 同理 | 低（移动文件 + 改 import） |
| **M3** | `lib.rs` 按 feature 装配插件，`Cargo.toml` 补 features | 中（需验证三端编译） |
| **M4** | 新增 P1 模块（shortcut/clipboard/notification/autostart）作为示范 | 低（官方插件） |
| **M5** | Agent 模块迁入 `modules/agent/`，统一契约 | 低（已有防腐层，迁移顺畅） |

每步完成后跑 `typecheck` + `cargo check` + CI，确保不回归。

---

## 9. 结论

1. **模块化是「三层门控」**：配置层声明 + 前端动态 import + Rust feature，三者协同，默认关闭、按需启用。
2. **能力模块清单已梳理**（见 `docs/ai-capabilities.md`），P1 补官方插件（快捷键/剪贴板/通知/自启/文件/日志），P2 补本地推理，P3 补 RAG/语音/OCR/MCP。
3. **核心锚点不变**：设计系统 + 基础组件始终启用，是集成化的底座。
4. **迁移渐进式**：M1-M5，每步独立验证，不破坏现有能力。

> 下一步建议：先落地 M1（模块契约 + 配置 + loader）作为骨架，再逐步迁入现有能力。这样「模块化」先有形状，后续新能力照葫芦画瓢即可。
