# MCP 接入指南

> P3 阶段：让脚手架的 Agent 通过 MCP（Model Context Protocol）连接外部工具。
> 把任意 MCP server 暴露的工具，一键接入 Agent 的工具集。
>
> **成熟度：Preview。** 仓库目前提供 HTTP/SSE client adapter 和模块开关；尚未把远端工具完整接入默认 Agent 对话与审批闭环，不应视为生产级 MCP host。

## 1. 什么是 MCP 接入

MCP 是一个开放协议，标准化「LLM 应用如何接入外部数据源与工具」。通过 MCP，你的脚手架 Agent 可以：

- 连接文件系统 server → 读写本地文件
- 连接数据库 server → 查询数据
- 连接浏览器 server → 操控网页
- 连接任意第三方工具（GitHub、飞书、Slack…）

**角色**：脚手架作为 **MCP client**，消费外部 MCP server 的工具。

## 2. 技术方案

用官方 **`@ai-sdk/mcp`**（AI SDK 的 MCP client 适配器），把 MCP server 暴露的工具转换成 AI SDK 的 `tool()` 格式，无缝并入脚手架的 `ToolLoopAgent`。

```
外部 MCP server ──(MCP 协议)──> @ai-sdk/mcp client ──> AI SDK tool ──> ToolLoopAgent
```

**关键约束**：Tauri WebView 内没有 Node 子进程能力，所以**只支持 HTTP 系传输**（`http` 流式 / `sse`），不支持 `stdio`（那是 Node/CLI 环境专用）。

## 3. 快速开始

### 第一步：安装依赖

```bash
npm run add:mcp   # 即 npm i -D @ai-sdk/mcp
```

### 第二步：启用模块

在 `src/modules/config.ts` 里打开：

```ts
export default {
  // ...
  agent: true,   // MCP 依赖 agent
  mcp: true,     // 开启 MCP
}
```

### 第三步：连接 MCP server（接入 Agent 工具仍需业务装配）

```ts
import { connectMcpServer } from './modules/mcp'
import { createInlineRuntime } from './agent/runtime/inline'

// 连接一个 MCP server（例如官方 filesystem server，跑在本机 8000 端口）
const mcpTools = await connectMcpServer({
  id: 'filesystem',
  transport: 'http',
  url: 'http://localhost:8000/mcp',
})

// mcpTools 是 { 工具名: AI SDK tool }。
// Preview 阶段需在业务 runtime 创建处显式合并，并补充审批策略。
```

## 4. 常见 MCP server 示例

| Server | 用途 | 启动方式 |
|---|---|---|
| `@modelcontextprotocol/server-filesystem` | 文件读写 | `npx -y @modelcontextprotocol/server-filesystem /path` |
| `@modelcontextprotocol/server-fetch` | 网页抓取 | `npx -y @modelcontextprotocol/server-fetch` |
| `@modelcontextprotocol/server-memory` | 知识图谱记忆 | `npx -y @modelcontextprotocol/server-memory` |
| GitHub MCP | 仓库操作 | 远程服务，走 OAuth |

> 官方维护的 server 列表见 https://github.com/modelcontextprotocol/servers（89k+ stars）。

## 5. 安全注意事项

1. **HTTP 传输默认拒绝重定向**（`@ai-sdk/mcp` 的 `redirect` 默认 `error`），防止 SSRF。
2. **工具越权**：MCP 工具同样受脚手架的 `needsApproval` 审批门约束，危险操作仍需人工确认。
3. **信任边界**：只连接你信任的 MCP server——它会在你的权限下执行操作。
4. **鉴权**：远程 server 通过 `headers` 传 token，勿把密钥硬编码进前端。

## 6. 依据

- MCP 官方 SDK：https://github.com/modelcontextprotocol/typescript-sdk（13k+ stars，MIT）
- AI SDK MCP client：`@ai-sdk/mcp`（2.0.41）
- MCP 规范：https://modelcontextprotocol.io
