/**
 * MCP（Model Context Protocol）接入 —— 让脚手架 Agent 连接外部 MCP server。
 *
 * 角色：MCP client。用官方 @ai-sdk/mcp 把外部 MCP server 暴露的工具，
 * 转换成 AI SDK 的 tool() 格式，无缝并入脚手架的 ToolLoopAgent 工具集。
 *
 * 支持传输（WebView 内无 Node 子进程，故仅 HTTP 系）：
 * - http：Streamable HTTP（推荐，现代 MCP 标准）
 * - sse：Server-Sent Events（兼容旧服务）
 *
 * 依赖：需安装 @ai-sdk/mcp（可选依赖，启用本模块时再装）。
 * 详见 docs/mcp.md
 */
import type { Module } from '../types'

const mcp: Module = {
  id: 'mcp',
  name: 'MCP 接入',
  dependencies: ['agent'],
}

export default mcp

// —— MCP client API（启用本模块后可用）——

export interface McpServerConfig {
  /** 唯一标识，用于日志与工具前缀 */
  id: string
  /** 传输类型 */
  transport: 'http' | 'sse'
  /** MCP server 的 URL（如 http://localhost:8000/mcp） */
  url: string
  /** 可选：自定义请求头（如鉴权 token） */
  headers?: Record<string, string>
}

/**
 * 连接一个 MCP server，返回它的工具（已转成 AI SDK tool 格式）。
 * 需要先安装 @ai-sdk/mcp（`npm i @ai-sdk/mcp`）。
 *
 * 返回的工具可直接并入 ToolLoopAgent 的 tools 集合。
 */
export async function connectMcpServer(cfg: McpServerConfig) {
  const { createMCPClient } = await import('@ai-sdk/mcp')

  const mcpClient = await createMCPClient({
    transport: {
      type: cfg.transport,
      url: cfg.url,
      headers: cfg.headers,
    },
  })

  // 返回的工具映射：{ 工具名: AI SDK tool }
  return mcpClient.tools()
}
