import type { Module } from '../types'

/**
 * sqlite 模块 —— 数据层。
 * 复用 src/lib/db.ts 的类型化封装（迁移 + 浏览器 mock 降级）。
 * 依赖：core（不强制，但组件依赖设计系统）
 */
const sqlite: Module = {
  id: 'sqlite',
  name: 'SQLite 数据层',
  dependencies: ['core'],
}

export default sqlite
