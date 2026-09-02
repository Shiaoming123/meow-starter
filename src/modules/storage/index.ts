import { createInMemoryTodoStore } from '../../storage/todos/in-memory'
import { registerTodoStore } from '../../storage/todos/registry'
import type { Module } from '../types'

/** 领域存储契约与安全内存回退；平台适配器会在其后覆盖实现。 */
const storage: Module = {
  id: 'storage',
  name: '本地存储契约',
  dependencies: ['core'],
  setup() {
    registerTodoStore(createInMemoryTodoStore())
  },
}

export default storage
