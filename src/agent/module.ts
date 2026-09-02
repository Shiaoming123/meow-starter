import type { Module } from '../modules/types'

/**
 * agent 模块 —— Agent 运行时（Vercel AI SDK 默认轨）。
 *
 * 这是 agent 能力的「模块化入口」，符合 Module 契约。
 * 具体 API（loadAgent / registerTool / registerProvider 等）仍在 src/agent/index.ts 导出。
 *
 * 依赖 storage：平台存储适配器由 storage 模块统一装配。
 */
const agentModule: Module = {
  id: 'agent',
  name: 'Agent 运行时',
  dependencies: ['storage'],
}

export default agentModule
