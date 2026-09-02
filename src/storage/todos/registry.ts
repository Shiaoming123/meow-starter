import { createInMemoryTodoStore } from './in-memory.ts'
import type { TodoStore } from './types'

let current: TodoStore = createInMemoryTodoStore()

export function registerTodoStore(store: TodoStore): void {
  current = store
}

export function getTodoStore(): TodoStore {
  return current
}
