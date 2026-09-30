/**
 * MCP（Model Context Protocol）接入 —— 让脚手架 Agent 连接外部 MCP server。
 *
 * 角色：MCP client。用官方 @ai-sdk/mcp 把外部 MCP server 暴露的工具，
 * 转换成 AI SDK 的工具格式；业务方仍需显式装配工具执行与审批。
 *
 * 支持传输（WebView 内无 Node 子进程，故仅 HTTP 系）：
 * - http：Streamable HTTP（推荐，现代 MCP 标准）
 * - sse：Server-Sent Events（兼容旧服务）
 *
 * 依赖：需安装 @ai-sdk/mcp（可选依赖，启用本模块时再装）。
 * 详见 docs/mcp.md
 */
import type { Module } from '../types'
import { createMcpConnectionManager } from './connection-manager.ts'

const mcp: Module = {
  id: 'mcp',
  name: 'MCP 接入',
  dependencies: ['agent'],
}

export default mcp

// —— MCP client API（启用本模块后可用）——

export interface McpServerConfig {
  /** 非空连接标识；同一 ID 断开后才可重连，不自动添加工具名前缀 */
  id: string
  /** 传输类型 */
  transport: 'http' | 'sse'
  /** MCP server 的 URL（如 http://localhost:8000/mcp） */
  url: string
  /** 可选：自定义请求头（如鉴权 token） */
  headers?: Record<string, string>
}

const connections = createMcpConnectionManager(async (cfg: McpServerConfig) => {
  const { createMCPClient } = await import('@ai-sdk/mcp')

  return createMCPClient({
    transport: {
      type: cfg.transport,
      url: cfg.url,
      headers: cfg.headers,
    },
  })
})

/** Keep the returned tools alive until the owning feature disconnects this ID. */
export function connectMcpServer(cfg: McpServerConfig) {
  return connections.connect(cfg)
}

/** Wait for pending discovery, then close the owned client. Safe to repeat. */
export function disconnectMcpServer(id: string): Promise<void> {
  return connections.disconnect(id)
}
