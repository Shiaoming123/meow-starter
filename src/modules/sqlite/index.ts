import type { Module } from '../types'
import { createTauriSqliteTodoStore } from '../../storage/todos/tauri-sqlite'
import { registerTodoStore } from '../../storage/todos/registry'

/**
 * sqlite 模块 —— 数据层。
 * 复用 TodoStore 领域接口；只在支持 native-sql 的 Tauri 运行时装配。
 * Web 端由 indexedDb 模块提供同一领域接口的实现。
 */
const sqlite: Module = {
  id: 'sqlite',
  name: 'SQLite 数据层',
  dependencies: ['storage'],
  platforms: ['desktop', 'mobile'],
  requiredCapabilities: ['native-sql'],
  setup() {
    registerTodoStore(createTauriSqliteTodoStore())
  },
}

export default sqlite
