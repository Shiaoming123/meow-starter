# Agent 能力集成方案

> 面向 `meow-starter`（Tauri 2 + Vue 3 桌面脚手架）的 AI Native 演进设计
> 调研基准日：**2026-09-01**（所有 star 数、版本号、体积均为该日实测）
> 结论均标注依据（仓库 / 版本 / 文档链接），便于后续复核
>
> **成熟度：Preview。** 当前仓库提供 inline runtime、Provider/Memory/Tool/Hook 接口和 Rust 侧安全能力骨架，默认关闭。本文同时记录目标架构；只有经过测试覆盖的路径才应视为已实现，sidecar 仍是 Roadmap。

---

## 0. 背景与设计约束

本脚手架定位 **AI Native 桌面应用底座**。当前默认路径提供 SQLite、托盘、更新等通用能力，Agent 骨架作为默认关闭的 Preview 模块存在；后续工作是在**不牺牲核心轻量**的前提下补齐可验证的安全闭环。

设计前先明确本项目的硬性约束，它们直接决定了候选方案的取舍：

| 约束 | 说明 | 对选型的影响 |
|---|---|---|
| 运行环境 | Tauri 2 = Rust 后端 + 系统 WebView 前端 | 能否跑在 WebView（浏览器）里是分水岭 |
| 核心必须轻量 | 不需要 Agent 的项目不应付出任何体积代价 | 必须支持 tree-shaking / 按需引入 |
| 密钥安全 | 桌面 App 的 API Key 不能裸放在前端 JS | 需要 Rust 侧代理或 OS 钥匙串 |
| 已有 SQLite | 脚手架已内置 `tauri-plugin-sql` | 记忆/会话持久化应复用，而非另起一套 |
| 前端是 Vue 3 | 非 React | 框架的 Vue 一等公民支持程度是关键 |
| 三端打包 | macOS / Windows / Linux | 任何 sidecar / 原生依赖都要三端可用 |

---

## 1. 候选项目横向对比

### 1.1 参与对比的项目

| 项目 | 仓库 | 本次是否重点评估 |
|---|---|---|
| **Pi** | https://github.com/earendil-works/pi | ✅ 用户指定 |
| **DeepSeek Harness (dsh)** | https://github.com/deepseek-ai/deepseek-harness | ✅ 用户指定 |
| **Vercel AI SDK** | https://github.com/vercel/ai | ✅ 补充候选（体积/接入成本最优） |
| **Mastra** | https://github.com/mastra-ai/mastra | ✅ 补充候选（TS 全栈框架代表） |
| LangChain.js | https://github.com/langchain-ai/langchainjs | ⚠️ 对照组（老牌重型） |
| Claude Agent SDK (TS) | https://github.com/anthropics/claude-agent-sdk-typescript | ⚠️ 对照组（厂商绑定） |
| OpenAI Agents JS | https://github.com/openai/openai-agents-js | ⚠️ 对照组（轻量多 agent） |

### 1.2 核心指标对比表

数据均为 2026-09-01 实测（`gh api repos/...` + `npm view` + 本地 `npm install` 实测 `node_modules` 体积）。

| 维度 | Pi | DeepSeek Harness | **Vercel AI SDK** | Mastra | LangChain.js | Claude Agent SDK |
|---|---|---|---|---|---|---|
| **版本** | v0.84.4 | dsh-v0.1.2-alpha.3（npm `0.1.1-rc.2`） | **ai@7.0.87** | @mastra/core@1.63.2 | latest | 0.3.252 |
| **成熟度** | 稳定迭代（2025-08 至今） | ⚠️ **alpha，官方警告破坏性更新** | 稳定（v7 已于 2026-06-25 发布） | 稳定 | 稳定 | 稳定 |
| **Stars / Forks** | 99,986 / 12,409 | **206,451 / 23,963** | 26,512 / 5,054 | 27,598 / 2,715 | 18,154 / 3,352 | 1,723 / 218 |
| **License** | MIT ✅ | MIT ✅ | **Apache-2.0** ✅ | ⚠️ Apache-2.0 核心 + `ee/` 商业目录 | MIT ✅ | ⚠️ 非 OSI（SEE LICENSE IN README） |
| **主语言** | TypeScript | TypeScript | TypeScript | TypeScript | TypeScript | TypeScript |
| **最近提交** | 2026-09-01 | 2026-08-31 | 2026-09-01 | 2026-09-01 | 2026-08-31 | 2026-08-31 |
| **包体积（unpacked）** | agent-core 1.83MB / pi-ai 3.95MB / coding-agent **20.5MB** | launcher 0.11MB（功能在数十个 `dsh-*` 子包） | **ai 6.57MB / @ai-sdk/vue 0.15MB** | @mastra/core **63.09MB** | — | 4.63MB |
| **node_modules 实测** | 90MB（agent-core 单装） | ⚠️ **282MB**（`npx @deepseek-ai/dsh` 完整安装） | **46MB**（ai+vue+openai+anthropic+zod，22 顶层依赖） | **128MB** | — | — |
| **能否跑在 WebView** | ❌ 需 Node 运行时 | ❌ 需 Node 运行时 | ✅ **纯浏览器可用** | ❌ Node 服务端 | ⚠️ 部分可以 | ❌ 需 Node |
| **Vue 支持** | ❌（自带 TUI / web-components） | ❌（客户端是 React） | ✅ **@ai-sdk/vue 一等公民** | ❌ | ❌ | ❌ |
| **Provider 抽象** | 统一多 Provider + `registerProvider()` 动态注册 | **近 40 家**（含 `llm-pi-ai` 适配） | **20+ 官方 Provider + OpenAI-compatible 通用适配** | 多家 | 最多 | ❌ 仅 Claude |
| **工具抽象** | TypeBox schema，`registerTool()` | 插件（`tool-fs`/`tool-bash`/`tool-lsp`/`tool-subagent`） | **Zod schema，`tool()` + `ToolLoopAgent`** | Zod | 多样 | 内置 |
| **插件化 / 热插拔** | ✅ Extension + Skills + `pi install` + `/reload` 热重载 | ✅✅ **Cordis 微内核，一切皆插件** | ⚠️ 中间件洋葱模型，非插件系统 | ⚠️ 模块化非插件 | ⚠️ | ❌ |
| **生命周期钩子** | ✅✅ **约 30 个事件**（`tool_call` 可拦截、`tool_result` 可改写、`context` 可过滤） | ✅✅ 能力接缝（capability seams） | ✅ `stopWhen`/`prepareStep`/`needsApproval` | ✅ workflow | ✅ callback | ⚠️ |
| **会话 / 记忆** | ✅ 会话树（fork/branch）+ 压缩 + SQLite backend | ✅ session/compaction/storage seam（**仍在重构中**） | ⚠️ 基础，持久化需自建 | ✅✅ 原生 memory | ✅ | ✅ |
| **嵌入宿主应用** | ✅✅ **`pi --mode rpc`（JSONL over stdio）+ Extension UI Protocol** | ✅ Host `*Controller` Remote 契约 | ✅ 本就是库 | ⚠️ 服务端为主 | ⚠️ | ⚠️ |
| **人工审批（HITL）** | ✅ `tool_call` 返回 `{block:true}` | ✅ authorization seam | ✅ `needsApproval` + 策略审批 | ✅ | ⚠️ | ✅ |
| **周下载量** | — | — | **1,400万+** | — | — | — |

### 1.3 补充：体积测量说明

- **unpacked size** 取自 `npm view <pkg> dist.unpackedSize`，可复现。
- **node_modules 实测**：在 `/tmp/agent-bench` 下以 `--omit=dev` 安装后 `du -sm node_modules`。
  - Pi：`@earendil-works/pi-agent-core` 单装 → 90MB（其依赖链含完整的 provider SDK）
  - AI SDK 组合（ai + @ai-sdk/vue + @ai-sdk/openai + @ai-sdk/anthropic + zod）→ **46MB**，22 个顶层依赖
  - Mastra：`@mastra/core` 单装 → **128MB**
  - DeepSeek Harness：launcher 仅 0.11MB，但功能分散在 `dsh-base` / `dsh-goal` / `dsh-tool-fs` / `dsh-persona` 等数十个子包，**完整安装 node_modules 达 282MB，是本次对比中最重的**（远超 Mastra 的 128MB），且安装耗时约 20 分钟。仅看 launcher 的 0.11MB 会严重低估接入成本。
- 注意：`node_modules` 是**开发磁盘占用**，不等于最终进入 App 的 bundle 体积。对 Tauri 而言关键区分是**能否被打进 WebView bundle**（影响 JS 体积）与**是否需要额外运行时**（影响安装包体积）。

### 1.4 各项目关键事实（依据）

**Pi（earendil-works/pi）**
- 作者 Mario Zechner（libGDX 之父），2026-04 被 Earendil Inc.（Armin Ronacher / Colin Daymond Hanna 创立）收购。
- 设计哲学 "Primitives, not features"：默认只有 4 个工具（read / write / edit / bash），系统提示 + 工具定义 < 1000 token，其余全靠扩展。
- Monorepo 包：`pi-ai`（统一 LLM API）、`pi-agent-core`（Agent 运行时）、`pi-coding-agent`（CLI）、`pi-tui`（差分渲染终端 UI）、`pi-telemetry`、`pi-session-backend-sqlite-node`、`pi-web-ui`。
- **扩展机制**（[extensions.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)）：TypeScript 模块默认导出工厂函数，通过 [jiti](https://github.com/unjs/jiti) 加载免编译；`pi.registerTool()` / `registerCommand()` / `registerProvider()` / `registerShortcut()` / `on(event)`；自动发现路径 `~/.pi/agent/extensions/`、` .pi/extensions/`；`pi install npm:` / `git:` 分发；`/reload` 热重载。
- **生命周期钩子约 30 个**：`project_trust` / `session_start|shutdown|before_switch|before_fork|before_compact|before_tree` / `input`（可 transform/handled）/ `before_agent_start`（可注入消息 + 改系统提示）/ `agent_start|end|settled` / `turn_start|end` / `context`（可过滤 messages）/ `before_provider_headers|request` / `after_provider_response` / `tool_execution_start|update|end` / **`tool_call`（可 block）** / **`tool_result`（可改写）** / `model_select` / `message_start|update|end` 等。
- **RPC 模式**（[rpc.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)）：`pi --mode rpc`，JSONL over stdin/stdout。文档原文：*"useful for embedding the agent in other applications, IDEs, or custom UIs"*；并注明 *"If you're building a Node.js application, consider using `AgentSession` directly from `@earendil-works/pi-coding-agent` instead of spawning a subprocess."*
- **Extension UI Protocol**：扩展可向宿主发出 `select` / `confirm` / `input` / `editor` / `notify` / `setStatus` 请求 —— 即宿主 UI 可实现这些交互。这是把 Pi 嵌入自定义 UI 的官方机制。
- 权限：无内建权限系统，默认以启动用户权限运行；隔离依赖 Gondolin / Docker / OpenShell（[containerization.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/containerization.md)）。

**DeepSeek Harness（deepseek-ai/deepseek-harness）**
- 2026-08-13 以 MIT 开源 v0.1 开发者预览版，口号 "Everything is a Plugin."，底层是 **Cordis 微内核**（已 vendor 4.0.2，有 arXiv 论文《A Programming Paradigm for Spatiotemporal Composability》支撑）。
- Monorepo：`apps/` `packages/` `native/` `python/` `docs/` `vendor/` `website/`。`packages/` 下有 `agent-loop` `llm` `llm-pi-ai` `llm-deepseek` `tool-fs` `tool-bash` `tool-lsp` `tool-subagent` `sandbox` `fs` `session` `session-query-sqlite` `storage-sqlite` `compaction` `hooks` `lsp` `acp` `client` `host-webserver` 等数十个包。
- **能力接缝（[capability-seams.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.md)）**：`ctx.llm`（实现：`llm-pi-ai` / `llm-deepseek` / `llm-replay`）、`ctx.fs`、`ctx.shell`、`ctx.sandbox`、`ctx.skills`、`ctx.storage`（`storage-json` / `storage-sqlite`）、`ctx.sessionQuery`（`session-query-sqlite`）、`ctx.compaction`、`ctx.permissions`、`ctx.planMode`、`ctx.goals`、`ctx.credentials`、`ctx.lsp`，以及 **Host 契约** `ctx.workspaceController` / `ctx.directoryPickerController` / `ctx.settingsController` / `ctx.sessionController`（均为 "Host ... Remote controller"）。
- 注意：`llm-pi-ai` 的存在意味着 **dsh 在 LLM 层复用了 Pi 的 `pi-ai`**，两者在该层是共底座关系。
- ⚠️ **风险信号**：当前版本 `0.1.2-alpha.3`；仓库含 `SAFETY.md` 双语实验性安全声明；官方明确告知会有破坏性更新；2026-08-31 仍在剧烈重构（提交 `refactor(session)!: remove SQLite persistence backend` 带 `!` 破坏性标记）。
- 客户端 UI 为 React（`packages/client/ui-workspace` 下为 `.tsx`），与本项目 Vue 3 不一致。

**Vercel AI SDK（vercel/ai）**
- v6（2025-12-22）引入 Agent 抽象：`ToolLoopAgent`、`needsApproval`、稳定 MCP 支持。
- v7（2026-06-25）进一步：`HarnessAgent`（统一包装 Claude Code / Codex / Deep Agents / OpenCode）、可恢复的 `WorkflowAgent`、重设计 telemetry、MCP Apps、实验性实时语音。
- 一等公民框架适配：**`@ai-sdk/vue`（Vue 3）**，另有 React / Next.js / Svelte / Nuxt / Solid / Expo。
- 核心抽象：`generateText` / `streamText` / `generateObject` / `tool()` / `ToolLoopAgent` / `stopWhen` / `prepareStep`；`InferAgentUIMessage` 可把 Agent 配置静态推导到 UI 消息类型。
- OpenAI-compatible 通用 reference 实现（`SharedV4ProviderReference`）让 DeepSeek / Moonshot / Ollama / vLLM 等共用一套适配。
- Apache-2.0，周下载 1,400万+。

**Mastra（mastra-ai/mastra）**
- Agents / Workflows / RAG / Evals / Memory 全内置，workflow 原生 suspend & resume。
- Open-core：核心 Apache-2.0，`ee/` 目录生产环境需商业许可（[mastra.ai/pricing](https://mastra.ai/pricing)）。
- 体积最重：@mastra/core unpacked 63MB，单装 node_modules 128MB。

---

## 2. 推荐结论

### 2.1 结论摘要

> **采用「双轨制 + 防腐层」：默认轨用 Vercel AI SDK（inline，可跑在 WebView），进阶轨可选 Pi RPC（sidecar，完整 harness）；DeepSeek Harness 暂不集成，只吸收其架构思想，待 1.0 后重新评估。**

| 角色 | 选型 | 理由 |
|---|---|---|
| **默认 Agent 运行时** | **Vercel AI SDK 7** | 唯一能原生跑在 WebView 且对 Vue 3 一等公民的方案；体积最轻（组合 46MB，@ai-sdk/vue 仅 0.15MB）；Provider 抽象最强且支持 OpenAI-compatible 接本地模型；Apache-2.0 无商业陷阱 |
| **进阶完整 harness（可选）** | **Pi（RPC 模式）** | 官方为嵌入场景设计 RPC + Extension UI Protocol；约 30 个生命周期钩子；会话树 / 压缩 / SQLite backend 与本项目 SQLite 契合；MIT；极高的社区热度与活跃度 |
| **架构思想参考** | **DeepSeek Harness** | "一切皆插件" + 能力接缝（capability seams）+ Host Controller 契约是本方案扩展点设计的直接参考 |
| **不采用** | Mastra / LangChain.js / Claude Agent SDK | Mastra 体积过重（128MB）且有 `ee/` 商业目录；LangChain 抽象重、与"核心轻量"冲突；Claude Agent SDK 厂商绑定且非 OSI 许可 |
| **观察名单** | DeepSeek Harness | alpha 状态 + 每周破坏性重构 + React 客户端，当前集成风险收益比不划算 |

### 2.2 为什么不直接选 DeepSeek Harness（尽管它 star 最高）

star 数（206K）确实最高，但**对本项目的四个硬伤在当下不可接受**：

1. **接入成本最重**：完整安装 `node_modules` **282MB**（实测），是本次全部候选中最大的——超过 Mastra（128MB）一倍多，是 AI SDK 组合（46MB）的 6 倍。其 launcher 包仅 0.11MB 具有误导性，真实成本在数十个 `dsh-*` 子包里。对一个以"快速起项目"为卖点的脚手架而言，这个体积直接违背核心定位。
2. **版本状态**：`0.1.2-alpha.3`，仓库自带 `SAFETY.md` 实验性声明，官方明示破坏性更新。脚手架模板引入 alpha 依赖，等于把不稳定性传染给所有下游项目 —— 这与"脚手架 = 稳定基座"的定位根本冲突。
3. **重构剧烈**：调研时点（2026-08-31）仍在 `refactor(session)!: remove SQLite persistence backend` 这类带破坏性标记的重构中。会话持久化恰恰是我们最需要复用的能力，此刻接入等于踩在流沙上。
4. **UI 栈不匹配**：客户端是 React（`packages/client/ui-workspace/*.tsx`），本项目是 Vue 3，无法直接复用其 UI 层。

但它的**架构思想必须吸收**：能力接缝（seam）化 —— 把"模型、工具、记忆、会话、存储、审批"全部定义为可替换接缝，而不是写死的实现。这正是本方案 §3 扩展点设计的蓝本。

### 2.3 为什么默认轨是 AI SDK 而不是 Pi

Pi 的能力无疑更强（会话树、压缩、30 个钩子、沙箱），但**它跑不进 WebView**：

- Pi 的 `pi-agent-core` / `pi-coding-agent` 依赖 Node 运行时（`node:fs`、`node:path`、子进程等），无法作为前端 bundle 打进 Tauri 的 WebView。
- 要用 Pi，就必须走 **sidecar**：额外打包一个 Node 运行时，安装包显著增大，且要处理进程生命周期、跨平台打包、IPC 三端一致性。
- 而桌面 AI 应用中 **80% 的需求**（流式聊天、工具调用、结构化输出、RAG 问答、本地模型对话）并不需要完整 harness，AI SDK 足够，且能直接享受 Vue 流式 UI 与最小体积。

因此：**默认轨 AI SDK（零额外运行时），需要会话树/沙箱/完整工具链的项目再单独开启 Pi sidecar 轨**。两者通过统一的 `AgentRuntime` 接口隔离（见 §3.3），业务代码不感知底层差异。

---

## 3. 集成方案设计

### 3.1 总体分层

```
┌─────────────────────────────────────────────────────────────┐
│  Vue 3 UI 层（WebView）                                      │
│  ChatPanel / ToolCallCard / ApprovalGate / ModelSwitcher     │
│  依赖：@ai-sdk/vue 流式 hook + 自建组件                       │
└────────────────────────┬────────────────────────────────────┘
                         │ 统一接口（防腐层）
┌────────────────────────┴────────────────────────────────────┐
│  src/agent/  Agent 能力层（可选模块，默认不打包）              │
│  ├─ runtime/   AgentRuntime 抽象（inline | sidecar 双实现）    │
│  ├─ providers/ 多模型 Provider 注册中心                        │
│  ├─ tools/     工具注册中心 + 审批门                          │
│  ├─ memory/    记忆与上下文（SQLite 持久化 + 压缩）            │
│  └─ hooks/     生命周期钩子总线                               │
└────────────────────────┬────────────────────────────────────┘
                         │ Tauri IPC (invoke / channel)
┌────────────────────────┴────────────────────────────────────┐
│  Rust 层（src-tauri/src/agent/）— 可选 feature                │
│  ├─ proxy.rs    LLM HTTP 代理：持有密钥、流式透传              │
│  ├─ secrets.rs  OS 钥匙串存取 API Key                         │
│  └─ sidecar.rs  Pi RPC 子进程生命周期管理（进阶轨）            │
└─────────────────────────────────────────────────────────────┘
```

**关键设计点：默认轨下，Rust 层只需要 `proxy.rs` + `secrets.rs` 两个文件即可运转**，`sidecar.rs` 属于进阶轨，由 Cargo feature `agent-sidecar` 控制。

### 3.2 目录结构

```
src/
└── agent/                          # 全部内容默认不进入主 bundle
    ├── index.ts                    # 唯一入口，动态 import 边界
    ├── config.ts                   # AgentConfig 类型与默认值
    ├── runtime/
    │   ├── types.ts                # ★ AgentRuntime 接口（防腐层核心）
    │   ├── inline.ts               # 默认轨：AI SDK ToolLoopAgent 实现
    │   ├── sidecar.ts              # 进阶轨：Pi RPC 实现
    │   └── index.ts                # 工厂：按 config.runtime 选择实现
    ├── providers/
    │   ├── registry.ts             # ★ Provider 注册中心
    │   ├── presets.ts              # openai / anthropic / google / deepseek 预设
    │   ├── openai-compatible.ts    # 通用适配：Ollama / vLLM / 任何兼容端点
    │   └── types.ts
    ├── tools/
    │   ├── registry.ts             # ★ ToolRegistry：注册 / 发现 / 执行 / 审批
    │   ├── builtins/               # 内置工具，按需单独引入
    │   │   ├── fs.ts               # 文件读写（走 Rust IPC，受目录白名单约束）
    │   │   ├── db.ts               # SQLite 查询（复用 tauri-plugin-sql）
    │   │   ├── shell.ts            # 命令执行（默认关闭，需显式开启）
    │   │   └── http.ts             # 受控 HTTP 请求
    │   └── types.ts
    ├── memory/
    │   ├── store.ts                # 会话/消息持久化（复用 SQLite）
    │   ├── context.ts              # 上下文组装与裁剪
    │   └── compaction.ts           # 压缩策略
    ├── hooks/
    │   └── bus.ts                  # ★ 生命周期钩子总线
    └── ui/
        ├── ChatPanel.vue
        ├── ToolCallCard.vue
        ├── ApprovalGate.vue        # needsApproval 的人工审批 UI
        └── ModelSwitcher.vue

src-tauri/src/
└── agent/                          # Cargo feature: agent（默认 off）
    ├── mod.rs
    ├── proxy.rs                    # LLM 请求代理 + 流式透传
    ├── secrets.rs                  # OS 钥匙串
    └── sidecar.rs                  # feature: agent-sidecar（Pi RPC）
```

### 3.3 扩展点设计（核心）

防腐层的意义：**业务代码只依赖以下 5 个扩展点，不直接依赖任何第三方 SDK**。未来 Pi / dsh / 其他框架都可作为新 adapter 接入，业务代码零改动。

#### 扩展点 1：`AgentRuntime` 接口

```ts
// src/agent/runtime/types.ts
export interface AgentRuntime {
  /** 发起一轮对话，返回流式事件 */
  stream(req: AgentRequest, hooks: HookBus): AsyncIterable<AgentEvent>;
  /** 中断当前运行 */
  abort(reason?: string): Promise<void>;
  /** 运行时能力声明，供 UI 决定是否展示某些控件 */
  capabilities: {
    sessionTree: boolean;   // Pi 支持，AI SDK 默认不支持
    compaction: boolean;
    sandbox: boolean;
  };
}
```

- `inline.ts`：AI SDK `ToolLoopAgent` + `streamText` 实现。
- `sidecar.ts`：spawn `pi --mode rpc`，按 [rpc.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md) 的 JSONL 协议收发，并把 `select/confirm/input/notify/setStatus` 等 Extension UI 请求转成 Vue 组件。

#### 扩展点 2：工具注册

```ts
// src/agent/tools/registry.ts
registerTool({
  name: 'db_query',
  description: 'Query the local SQLite database',
  inputSchema: z.object({ sql: z.string() }),
  needsApproval: (args) => /drop|delete|update/i.test(args.sql), // 危险操作需人工确认
  execute: async (args, ctx) => { /* ctx.ipc → Rust → tauri-plugin-sql */ },
});
```

- 统一 Zod schema（AI SDK 原生）；sidecar 轨下由 adapter 转成 Pi 的 TypeBox schema。
- `needsApproval` 对齐 AI SDK 的 `needsApproval` 与 Pi 的 `tool_call` 拦截（返回 `{ block: true }`）。

#### 扩展点 3：多模型 Provider 抽象

```ts
// src/agent/providers/registry.ts
registerProvider({
  id: 'local-ollama',
  type: 'openai-compatible',          // 也可 'openai' | 'anthropic' | 'google'
  baseUrl: 'http://localhost:11434/v1',
  apiKeyRef: { kind: 'none' },        // 或 { kind: 'keychain', service: '...' }
  models: [{ id: 'qwen3:8b', contextWindow: 32768 }],
});
```

- 对应 Pi 的 `pi.registerProvider()`、dsh 的 `ctx.llm` seam。
- 本地模型（Ollama / llama.cpp / vLLM）通过 `openai-compatible` 一条路径全部覆盖 —— 对桌面 App 的离线场景很关键。

#### 扩展点 4：记忆与上下文

借鉴 dsh 的 seam 思想，拆成三个可替换接缝：

| 接缝 | 职责 | 默认实现 | 可替换实现 |
|---|---|---|---|
| `MemoryStore` | 会话/消息持久化 | SQLite（复用 `tauri-plugin-sql`） | 内存 / JSONL / 远端 |
| `ContextAssembler` | 组装发给模型的 messages | 最近 N 轮 + 系统提示 | RAG 检索注入 / 自定义裁剪 |
| `Compaction` | 长会话压缩 | 摘要式压缩 | 工具结果裁剪 / 无需压缩 |

- 对应 Pi 的 `context`（可过滤 messages）与 `session_before_compact`（可自定义压缩）钩子、dsh 的 `ctx.compaction` / `ctx.toolResultPruner` seam。

#### 扩展点 5：生命周期钩子

以 Pi 的事件体系为参照，定义与框架无关的子集：

```
onBeforeRequest   —— 可改写 messages / systemPrompt
onToolCall        —— 可拦截、改写入参（对应 Pi tool_call 的 { block: true }）
onToolResult      —— 可改写结果（对应 Pi tool_result 补丁）
onStreamChunk     —— 流式增量
onApprovalRequired—— 触发 UI 审批门
onError / onComplete
onSessionPersist  —— 会话落库
```

sidecar 轨下，这些钩子 1:1 映射到 Pi 的原生事件；inline 轨下由 `prepareStep` / `stopWhen` / 中间件实现等价语义。

### 3.4 配置项

新增 `agent.config.ts`（仓库根，不改动 `tauri.conf.json` 核心区）：

```ts
export interface AgentConfig {
  /** 总开关。false 时 src/agent 完全不进入 bundle */
  enabled: boolean;
  /** 运行时选择 */
  runtime: 'inline' | 'sidecar';
  providers: ProviderConfig[];
  defaultModel: string;                    // 'provider/model' 形式
  tools: {
    builtins: Array<'fs' | 'db' | 'shell' | 'http'>;  // 显式声明，未声明不打包
    allowPaths?: string[];                 // fs 工具目录白名单
  };
  memory: {
    backend: 'sqlite' | 'memory';
    maxTurns: number;
    compaction: { enabled: boolean; thresholdTokens: number };
  };
  approval: {
    mode: 'auto' | 'confirm' | 'deny';
    rules?: Array<{ tool: string; pattern?: string; action: 'allow' | 'confirm' | 'deny' }>;
  };
  /** 密钥走 Rust 侧代理（强烈建议开启） */
  secureProxy: boolean;
  sidecar?: { binary: string; args?: string[]; nodeRuntime?: 'bundled' | 'system' };
}
```

**默认值刻意保守**：`enabled: false`、`tools.builtins: []`、`shell` 默认不开启、`secureProxy: true`、`approval.mode: 'confirm'`。

#### 3.4.1 云端代理白名单（接入第三方服务前必读）

`secureProxy` 生效时，云端请求由 Rust 侧代为发出并注入密钥。为了防止「把 OS 钥匙串里的密钥发往任意地址」，前后端各维护一份**固定白名单**，必须同时通过：

| 层 | 位置 | 当前放行 |
|---|---|---|
| 前端 | `src/agent/providers/proxy-policy.ts` → `allowedOrigins` | `https://api.openai.com`、`https://api.anthropic.com` |
| Rust | `src-tauri/src/agent/proxy.rs` → `validate_target` | 同上（枚举 `ProxyProvider`，硬编码 host） |

校验条件（任一条不满足即拒绝）：scheme 为 `https`、host 精确等于白名单值、端口 443、路径为 `/v1` 或 `/v1/*`、URL 不含 userinfo 与 fragment、请求方法为 `POST`、请求体 ≤ 2 MiB；客户端另启用 `https_only` 与**禁用重定向**，避免白名单被 302 绕过。

因此：

- **本地模型不受影响** —— Ollama / vLLM 用 `apiKeyRef: { kind: 'none' }`，走直连，不经过代理。
- **`openai-compatible` + keychain 会被拒绝** —— DeepSeek、Moonshot、Groq、OpenRouter 等兼容端点尚不在白名单内，配置后运行会抛「带密钥的 `openai-compatible` 端点尚无 Rust 侧白名单，已拒绝连接」。

**扩展白名单的步骤**（改完请同步补测试，CI 会跑 `cargo test` 与 `npm test`）：

1. Rust 侧：在 `src-tauri/src/agent/proxy.rs` 的 `ProxyProvider` 增加枚举变体，并在 `validate_target` 中给出 `expected_host` 与鉴权头拼装规则（OpenAI 用 `Authorization: Bearer`，Anthropic 用 `x-api-key` + `anthropic-version`）。
2. 前端：在 `proxy-policy.ts` 的 `allowedOrigins` 增加 `provider → origin` 映射，并把新类型加入 `isSecureProxyProvider` 的类型守卫。
3. 补测：Rust 侧沿用 `mod tests` 中「接受正确来源 / 拒绝跨站、http、带凭据、越权路径」两组断言的写法；前端在 `tests/agent-proxy-policy.test.ts` 增加对应用例。

> 为什么不做成用户可配置：放开成配置项等于允许 WebView 侧决定把钥匙串密钥发往哪个地址，等于把 SSRF 与密钥外泄的口子一起打开。扩展白名单属于**代码级改动**，需要走 review。

Rust 侧 `Cargo.toml` 增加可选 feature，避免不需要 Agent 的项目承担编译与体积成本：

```toml
[features]
default = []
agent = []              # proxy + secrets
agent-sidecar = ["agent"] # + Pi RPC 子进程管理
```

### 3.5 与现有脚手架的衔接

| 现有能力 | 衔接方式 |
|---|---|
| `tauri-plugin-sql`（SQLite） | `MemoryStore` 默认实现直接复用，新增 `agent_messages` / `agent_sessions` 两张表；迁移代码放入 `src-tauri/src/db.rs` 现有迁移逻辑 |
| `tauri-plugin-store` | 存 Agent 用户偏好（默认模型、主题、审批规则） |
| `tauri-plugin-dialog` | 文件选择 / 目录授权，复用于 `allowPaths` 授权流程 |
| 主题系统（`src/assets/themes/`） | ChatPanel 等组件直接消费 CSS 变量，自动继承 4 套主题 |
| Icon 系统（`@lucide/vue`） | Agent UI 复用现有 `Icon.vue`；新图标在 `src/assets/icons/registry.ts` 加一条静态 import 与一条映射 |
| 自动更新 | sidecar 轨下，Pi 二进制随 App 更新分发 |

---

## 4. 分阶段落地路径

| 阶段 | 目标 | 交付物 | 核心包增量 | 验收标准 |
|---|---|---|---|---|
| **P0 — 骨架（已实现）** | 落目录、类型与默认关闭配置 | `src/agent/**` 骨架 + `agent.config.ts` + Cargo feature + 文档 | 依赖已存在于 lockfile；默认运行时不加载 | `vue-tsc` 与默认构建通过 |
| **P1 — 默认轨（Preview）** | inline 适配器与最小 UI | `runtime/inline.ts` + `ChatPanel.vue` + Provider/Memory 接口 | bundle 增量以构建报告为准 | 仍需真实 Provider 端到端验证 |
| **P2 — 安全与可控（Preview）** | 收紧代理、审批和会话边界 | 固定目标 Rust proxy、无密钥读回、规则审批、受限会话记忆 | Rust feature 可选 | TypeScript 行为测试已覆盖；Rust `fmt/clippy/test` 由 CI 验证，真实 Provider smoke test 待补 |
| **P3 — 进阶轨（Roadmap）** | 接入 Pi sidecar | sidecar、钩子映射、会话树 UI | 未引入 | 尚不可运行 |
| **P4 — 观察与再评估** | 跟踪 dsh 与生态 | 评估记录，不写生产代码 | 0 | dsh 发布 1.0 稳定版后重跑本对比表 |

**建议停手点**：P0–P2 是绝大多数 AI Native 桌面应用所需；P3 仅当项目确实需要会话树 / 沙箱 / 完整编码 Agent 能力时才投入。

---

## 5. 关键风险、取舍与回滚

### 5.1 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| **AI SDK v7 迭代快，API 不稳定** | 升级需改业务代码 | 防腐层隔离：业务只依赖 `AgentRuntime` 接口，AI SDK 被封装在 `runtime/inline.ts` 内部；锁版本并跟进官方 migration guide |
| **API Key 暴露在 WebView** | 桌面 App 逆向可提取密钥 | keychain Provider 强制 `secureProxy: true`；WebView 只能写入/删除/检查存在性，云端请求由 Rust 读取密钥并代发 |
| **工具越权（文件/命令）** | Agent 执行破坏性操作 | 三层防护：① `tools.builtins` 默认空、`shell` 默认关闭；② `allowPaths` 目录白名单；③ `approval.mode: 'confirm'` + `needsApproval` 规则 |
| **sidecar 三端打包复杂度** | 某平台 Node 运行时缺失或路径异常 | P3 才引入；优先 `nodeRuntime: 'bundled'` 自带运行时；CI 三端矩阵必须验证 sidecar 启动；提供降级到 inline 轨的开关 |
| **Pi RPC 协议变更** | sidecar 轨失效 | Pi 版本锁定；`sidecar.ts` 内做协议版本握手与能力探测，不匹配时降级并告警 |
| **前端 bundle 膨胀** | 首屏变慢 | `src/agent/index.ts` 作为唯一动态 import 边界，Vite 自动代码分割；仅在用户首次打开 AI 功能时加载 |
| **上下文/记忆无限增长** | token 成本失控 | `memory.maxTurns` + `compaction.thresholdTokens` 双重限制 |
| **下游项目被强加依赖** | 违背"脚手架轻量"初衷 | AI SDK 声明为 optional peer，模板 devDependencies 用于验证；`enabled: false` 时默认运行时不加载 Agent |

设置页首次录入密钥时，用户输入和值传入 `set_api_key` 的 IPC 参数会短暂存在于 WebView 内存，这是桌面表单无法消除的边界；安全保证是“不写入前端持久化、不提供已存密钥读回命令、后续模型请求不把密钥交给 JavaScript”。

### 5.2 关键取舍

1. **能力完整度 vs 体积**：默认轨选 AI SDK（能力适中、体积较小），把 Pi 的完整能力放到 Roadmap。牺牲开箱即用的会话树/沙箱，换取更轻的默认运行时路径。
2. **前端直连 vs Rust 代理**：前端直连最简单但密钥裸奔；Rust 代理安全但要自己实现流式透传（SSE）。本方案选后者，因为桌面 App 的密钥泄露是不可接受的安全事故。
3. **自建抽象 vs 直接用 SDK 原生 API**：自建 `AgentRuntime` 有额外维护成本，但换来可替换性 —— 这正是"脚手架"应有的姿态：不把任何一家 SDK 的 API 形状强加给下游项目。
4. **dsh 现在集成 vs 等 1.0**：选择等。206K star 很有吸引力，但 alpha + 每周破坏性重构 + React 客户端，此刻集成的风险远大于收益；其架构思想（seam 化、Host Controller 契约）已被吸收进 §3 的设计。

### 5.3 回滚方案

| 场景 | 回滚动作 | 影响面 |
|---|---|---|
| Agent 功能出问题，需整体关闭 | `agent.config.ts` 设 `enabled: false` | 立即回退到无 Agent 状态，产物与 P0 前一致；已持久化的会话数据保留在 SQLite，可后续读取 |
| 只关进阶轨 | `runtime: 'inline'` + 关闭 Cargo feature `agent-sidecar` | 保留基础对话能力，移除 sidecar 打包与 Node 运行时 |
| AI SDK 升级破坏兼容 | 锁回上一个可用版本；因防腐层存在，仅需改 `runtime/inline.ts` | 业务代码零改动 |
| 某个内置工具出事 | 从 `tools.builtins` 中移除该项 | 该工具不再注册，其余功能不受影响 |
| 密钥代理异常 | 关闭云端 Provider，或切换到 `apiKeyRef: { kind: 'none' }` 的本地模型；不得回退为 WebView 读取密钥 | 云端暂停，本地能力保留，安全边界不降级 |
| SQLite 记忆表结构变更 | `src-tauri/src/db.rs` 走现有迁移机制，保留旧表 | 会话历史不丢失 |

---

## 6. 结论

1. **默认选 Vercel AI SDK 7**：唯一同时满足"能跑在 WebView + Vue 3 一等公民 + 体积最轻 + Apache-2.0"的方案。
2. **进阶选 Pi（RPC 模式）**：官方为嵌入场景设计的 RPC + Extension UI Protocol，约 30 个生命周期钩子，会话树与 SQLite 后端与本项目高度契合，MIT 协议。
3. **DeepSeek Harness 暂不集成、只借鉴**："一切皆插件"与能力接缝思想已直接体现在 §3.3 的五个扩展点设计中；待 1.0 稳定后重跑本文对比表再决策。
4. **通过防腐层保证可替换**：业务代码只依赖 `AgentRuntime` 接口，任何一家 SDK 都可作为 adapter 接入或替换。
5. **默认运行时保持轻量**：`enabled: false` 时 Agent 不进入默认运行时加载路径；安装依赖量和产物增量以 lockfile 与构建报告为准。

---

## 附录：依据来源

| 项目 | 仓库 | 版本 / 数据 | 关键文档 |
|---|---|---|---|
| Pi | https://github.com/earendil-works/pi | v0.84.4；99,986★ / 12,409 forks / MIT | [extensions.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md) · [rpc.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md) · [containerization.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/containerization.md) · https://pi.dev/docs/latest |
| DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness | dsh-v0.1.2-alpha.3（npm `@deepseek-ai/dsh@0.1.1-rc.2`）；206,451★ / 23,963 forks / MIT | [capability-seams.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/capability-seams.md) · `docs/cordis-primer.md` · `docs/config-catalog.md` · `SAFETY.md` |
| Vercel AI SDK | https://github.com/vercel/ai | `ai@7.0.87` / `@ai-sdk/vue@4.0.87`；26,512★ / Apache-2.0 | https://ai-sdk.dev · v6 Agent 抽象（2025-12-22）· v7 HarnessAgent / WorkflowAgent（2026-06-25） |
| Mastra | https://github.com/mastra-ai/mastra | `@mastra/core@1.63.2`；27,598★ / Apache-2.0 + `ee/` 商业 | https://mastra.ai/pricing |
| LangChain.js | https://github.com/langchain-ai/langchainjs | 18,154★ / MIT | — |
| Claude Agent SDK (TS) | https://github.com/anthropics/claude-agent-sdk-typescript | 0.3.252；1,723★ / 非 OSI | — |
| OpenAI Agents JS | https://github.com/openai/openai-agents-js | 3,740★ / MIT | — |

> 体积数据来源：2026-09-01 本地实测（`npm view dist.unpackedSize` + `/tmp/agent-bench` 下 `npm install --omit=dev` 后 `du -sm node_modules`）。
