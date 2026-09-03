import type { Todo, TodoStore } from './types'
import { sortTodosNewestFirst } from './types.ts'

export function createInMemoryTodoStore(initial: readonly Todo[] = []): TodoStore {
  const todos = initial.map((todo) => ({ ...todo }))
  let nextId = todos.reduce((maximum, todo) => Math.max(maximum, todo.id), 0) + 1

  return {
    async list() {
      return sortTodosNewestFirst(todos).map((todo) => ({ ...todo }))
    },
    async add(title) {
      todos.push({
        id: nextId++,
        title,
        done: 0,
        created_at: new Date().toISOString(),
      })
    },
    async toggle(id, done) {
      const todo = todos.find((candidate) => candidate.id === id)
      if (todo) todo.done = done ? 1 : 0
    },
    async remove(id) {
      const index = todos.findIndex((candidate) => candidate.id === id)
      if (index >= 0) todos.splice(index, 1)
    },
    async appendImported(records) {
      for (const record of records) {
        todos.push({
          id: nextId++,
          title: record.title,
          done: record.done,
          created_at: record.createdAt,
        })
      }
    },
  }
}
