# AI Native 能力模块清单

> 面向 `meow-starter` 的能力扩展规划。
> 调研基准日：**2026-09-01**，参考对象：Off Grid AI Desktop、QClaw、ai-spotlight-panel、LM Studio、Locally Uncensored 等真实 AI 桌面产品，以及 Tauri 官方/社区插件生态。
>
> **成熟度说明**：本页是能力地图，不是已实现清单。Stable/Beta/Preview/Roadmap 的当前状态以本节表格和 [文档中心](./README.md) 为准。

---

## 0. 判断标准

每个能力模块用四维评估，决定「是否内置 / 可选 / 不纳入」：

| 维度 | 说明 |
|---|---|
| **需求热度** | 多少 AI 桌面产品在做，用户是否真的需要 |
| **接入成本** | 依赖体积、三端兼容、维护复杂度 |
| **与 Tauri 契合度** | 是否有官方/成熟社区插件，还是需要自研 Rust |
| **安全敏感度** | 涉及系统权限/用户数据的风险等级 |

> 核心原则延续既有决策：**核心轻量、能力可选、按需引入**。任何模块默认不打包，需要时通过开关启用。

---

## 1. 能力模块全景

### A. 已具备（当前脚手架）

| 模块 | 状态 | 说明 |
|---|---|---|
| 本地数据层 | ✅ 内置 | Tauri SQLite + Web IndexedDB + 领域 Store 接口 |
| 系统托盘 | ✅ 内置 | `tauri-plugin-single-instance` + 自研 tray.rs |
| 自动更新 | 🟡 Beta | 插件与配置守卫已内置；需下游项目完成签名发布验证 |
| 4 套主题 + 设计系统 | ✅ 内置 | CSS 变量驱动，见 `docs/design-system.md` |
| Agent 运行时（P0/P1） | 🧪 Preview | inline 骨架已存在，默认关闭；真实 Provider 闭环仍需验证 |

### B. 强烈建议补齐（AI Native 标配）

| 模块 | 需求热度 | 接入成本 | Tauri 契合 | 建议 |
|---|---|---|---|---|
| **全局快捷键唤起** | ⭐⭐⭐⭐⭐ | 低（官方插件） | 官方 `global-shortcut` | **P1 内置** |
| **剪贴板读写** | ⭐⭐⭐⭐⭐ | 低（官方插件） | 官方 `clipboard-manager` | **P1 内置** |
| **系统通知** | ⭐⭐⭐⭐ | 低（官方插件） | 官方 `notification` | **P1 内置** |
| **开机自启动** | ⭐⭐⭐⭐ | 低（官方插件） | 官方 `autostart` | **P1 内置** |
| **本地推理（Ollama 接入）** | ⭐⭐⭐⭐⭐ | 中 | OpenAI 兼容预设，Preview | **P2 可选** |
| **文件系统访问** | ⭐⭐⭐⭐⭐ | 低（官方插件） | 官方 `fs` + `dialog` | **P1 内置** |
| **HTTP 客户端（代理）** | ⭐⭐⭐⭐ | 中 | 官方 `http` 或 Rust reqwest | **P2 可选** |
| **日志** | ⭐⭐⭐ | 低（官方插件） | 官方 `log` | **P1 内置** |

### C. 进阶能力（有明确场景再上）

| 模块 | 需求热度 | 接入成本 | Tauri 契合 | 建议 |
|---|---|---|---|---|
| **RAG / 本地向量检索** | ⭐⭐⭐⭐ | 高 | 需自研（sqlite-vss / tantivy / 嵌入模型） | **P3 可选** |
| **语音输入（STT）** | ⭐⭐⭐ | 高 | whisper.cpp 集成，体积大 | **P3 可选** |
| **语音输出（TTS）** | ⭐⭐⭐ | 高 | 本地 TTS 引擎 | **P3 可选** |
| **截图 OCR / 屏幕理解** | ⭐⭐⭐⭐ | 高 | 需系统截图权限 + OCR 引擎 | **P3 可选** |
| **MCP 协议接入** | ⭐⭐⭐⭐ | 中 | `@ai-sdk/mcp` HTTP/SSE adapter，Preview | **P3 可选** |
| **图像生成（本地 SD）** | ⭐⭐ | 极高 | stable-diffusion.cpp，体积巨大 | **观察** |
| **文件去重 / 智能整理** | ⭐⭐⭐ | 中 | Rust 侧实现 | **P3 可选** |
| **多语言 i18n** | ⭐⭐⭐ | 中 | vue-i18n | **P2 可选** |

### D. 不纳入（明确不做）

| 模块 | 原因 |
|---|---|
| 虚拟摄像头 / 内核扩展 | 超出 Tauri 能力边界，安全风险极高 |
| 实时屏幕共享录制 | 系统权限复杂，三端差异大 |
| 云同步 / 多人协作后端 | 壳是本地优先，后端应由业务方自建 |
| 完整 IDE 级编辑器 | 与「轻量脚手架」定位冲突 |

---

## 2. 重点模块说明

### 2.1 全局快捷键唤起（P1，官方插件）

**价值**：AI 助手的「唤起」体验是刚需——Option+Space 呼出 Spotlight 式面板，是最典型的 AI 桌面交互。

```rust
// Cargo.toml
tauri-plugin-global-shortcut = "2"
```

对应真实案例：ai-spotlight-panel 用它实现 Option+Space 唤起面板。

**注意**：macOS 需要用户授予「辅助功能」权限；注册全局快捷键时要处理冲突。

### 2.2 剪贴板（P1，官方插件）

**价值**：AI 助手的「读剪贴板 → 分析 → 写回剪贴板」是高频工作流。

```rust
tauri-plugin-clipboard-manager = "2"
```

### 2.3 本地推理 Ollama（P2，可选）

**价值**：隐私优先场景的核心——模型跑在本机，数据不出设备。这已经是 P1 里 `openai-compatible` adapter 预留的通道（`baseUrl: http://localhost:11434/v1`）。

**落地方式**：不内置 llama.cpp（体积巨大），而是**适配外部 Ollama**——用户在机器上跑 `ollama serve`，脚手架通过 OpenAI 兼容协议连接。这是「轻量 + 灵活」的最优解：脚手架不背负推理引擎，用户按需装 Ollama/LM Studio/vLLM。

### 2.4 RAG 本地向量检索（P3，可选）

**价值**：本地知识库问答（"和我的文档对话"）。

**技术选型**（留待 P3 决策，避免过早绑定）：
- `sqlite-vss`：SQLite 向量扩展，与现有 sqlite 插件天然契合
- `tantivy`：Rust 全文检索，性能强
- 嵌入模型：本地小模型（如 bge-small）或调云端 embedding API

### 2.5 MCP 接入（P3，可选，观察）

**价值**：让脚手架作为 MCP host 接入外部工具，或作为 MCP server 暴露给 Cursor/Claude Code。

**现状**：社区有 `tauri-plugin-mcp`（nicolasschoonbroodt），但仍在早期。**建议观察**，待官方或成熟方案出现再集成。

---

## 3. 建议的落地节奏

| 阶段 | 内容 | 依赖增量 | 风险 |
|---|---|---|---|
| **P1（近期）** | 全局快捷键、剪贴板、通知、自启动、文件访问、日志 —— 全是官方插件，可插拔 | 每项都是独立可选 feature | 极低 |
| **P2（按需）** | 本地推理适配、HTTP 代理、i18n | 中 | 低 |
| **P3（有场景再上）** | RAG、STT/TTS、OCR、MCP | 高 | 中-高，需逐项评估 |

> 关键：**所有新增能力都做成「可选模块」**，走 Rust feature + 前端动态 import 双层门控，默认关闭、按需启用，延续「核心轻量」底线。

---

## 4. 依据来源

- Off Grid AI Desktop（AGPL-3.0，Tauri + 本地多模态栈）：https://github.com/ 相关仓库
- ai-spotlight-panel（MIT，Tauri 2 + Ollama + 全局快捷键）：https://github.com/laruss/ai-spotlight-panel
- tauri-plugin-mcp（社区）：https://github.com/nicolasschoonbroodt/tauri-plugin-mcp
- Tauri 官方插件：global-shortcut / clipboard-manager / notification / autostart / fs / dialog / http / log
- 2026 桌面 AI 应用盘点（QClaw / LM Studio / Jan.ai 等）：腾讯云开发者社区、locallyuncensored.com
