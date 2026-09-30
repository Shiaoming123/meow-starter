# MCP 接入指南

> P3 阶段：让脚手架的 Agent 通过 MCP（Model Context Protocol）连接外部工具。
> 提供 HTTP/SSE 工具适配；具体 Agent 的装配与审批由业务方完成。
>
> **成熟度：Preview。** 仓库目前提供 HTTP/SSE client adapter、显式连接/断开生命周期和模块开关；尚未把远端工具完整接入默认 Agent 对话与审批闭环，不应视为生产级 MCP host。

## 1. 什么是 MCP 接入

MCP 是一个开放协议，标准化「LLM 应用如何接入外部数据源与工具」。通过 MCP，你的脚手架 Agent 可以：

- 连接文件系统 server → 读写本地文件
- 连接数据库 server → 查询数据
- 连接浏览器 server → 操控网页
- 连接任意第三方工具（GitHub、飞书、Slack…）

**角色**：脚手架作为 **MCP client**，消费外部 MCP server 的工具。

## 2. 技术方案

用官方 **`@ai-sdk/mcp`**（AI SDK 的 MCP client 适配器），把 MCP server 暴露的工具转换成 AI SDK 的工具格式，再由业务方接入 `ToolLoopAgent` 与审批策略。

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
import { connectMcpServer, disconnectMcpServer } from './modules/mcp'

// 连接已由业务方启动并配置的 HTTP MCP server；此适配器不启动子进程。
const mcpTools = await connectMcpServer({
  id: 'filesystem',
  transport: 'http',
  url: 'http://localhost:8000/mcp',
})

// mcpTools 是 { 工具名: AI SDK tool }。
// Preview 阶段需在业务 runtime 创建处显式合并，并补充审批策略。
// 保持连接直到所有工具调用结束；退出该功能时显式关闭：
await disconnectMcpServer('filesystem')
```

### 连接所有权与清理

- `connectMcpServer` 保持原来的工具映射返回值；`id` 现在是非空连接标识，不会自动变成工具名前缀。业务方负责解决不同服务的工具名冲突。
- 同一 ID 正在连接、已连接或正在关闭时，再次连接会拒绝；需要先等待 `disconnectMcpServer(id)` 成功，再用该 ID 重连。不同 ID 独立管理。
- 工具发现失败会先关闭已创建的 client，再报告原始错误；初始化失败后可重试连接。若发现和关闭都失败，错误的 `cause` 与 `cleanupError` 分别保留两项原因，该 ID 仍归原连接所有。
- 重复断开或断开未知 ID 是安全的；并发断开共享同一次关闭。关闭失败会向调用者报错并保留连接，可再次调用断开重试，不会静默丢弃 client。
- 在连接尚未完成时调用断开，会等待初始化/工具发现结束再关闭，不是取消或强制超时。调用者应先等待连接成功、使用工具，最后在自己的 `finally` 或页面生命周期中断开；模块装配器不会自动关闭这些连接。
- 断开前等待工具调用结束，并停止向 Agent 提供旧工具映射；断开后旧工具不能继续使用。此封装不提供 Agent 自动装配、审批 UI、OAuth 持久化或 MCP host 会话恢复。

生命周期行为有不访问外部服务的单元测试，以及真实 SDK 对本机临时 HTTP 服务的初始化、工具发现和会话关闭集成测试；目标服务的认证、CORS、生产 CSP、断网恢复和真实 WebView 行为仍需业务方验收。

## 4. 常见 MCP server 示例

| Server | 用途 | 启动方式 |
|---|---|---|
| `@modelcontextprotocol/server-filesystem` | 文件读写 | `npx -y @modelcontextprotocol/server-filesystem /path` |
| `@modelcontextprotocol/server-fetch` | 网页抓取 | `npx -y @modelcontextprotocol/server-fetch` |
| `@modelcontextprotocol/server-memory` | 知识图谱记忆 | `npx -y @modelcontextprotocol/server-memory` |
| GitHub MCP | 仓库操作 | 远程服务，走 OAuth |

> 官方维护的 server 列表见 https://github.com/modelcontextprotocol/servers（89k+ stars）。

上表中的命令行示例通常提供 `stdio`，不能直接把它们的进程交给这个 WebView 适配器。必须选择支持 HTTP/SSE 的服务或由业务方独立配置合适的传输桥接；本模块不安装、启动或管理这些服务。

## 5. 安全注意事项

1. **HTTP 传输默认拒绝重定向**（`@ai-sdk/mcp` 的 `redirect` 默认 `error`），降低通过重定向切换目的地的风险；业务方仍须限制与验证目标 URL。
2. **工具越权**：返回的 MCP 工具不会自动进入脚手架的审批门。业务方必须在装配到 Agent 前接入等效审批策略；危险操作仍需人工确认，不能把 SDK 工具直接合并当作已具备保护。
3. **信任边界**：只连接你信任的 MCP server——它会在你的权限下执行操作。
4. **鉴权**：远程 server 通过 `headers` 传 token，勿把密钥硬编码进前端。

## 6. 依据

- MCP 官方 SDK：https://github.com/modelcontextprotocol/typescript-sdk（13k+ stars，MIT）
- AI SDK MCP client：`@ai-sdk/mcp`（2.0.41）
- MCP 规范：https://modelcontextprotocol.io
