import { getTodoStore } from '../storage/todos/registry.ts'
import type { Todo } from '../storage/todos/types'
import { createTodoExport, parseTodoExport } from '../storage/todos/data-port.ts'

export type { Todo } from '../storage/todos/types'

export function listTodos(): Promise<Todo[]> {
  return getTodoStore().list()
}

export function addTodo(title: string): Promise<void> {
  return getTodoStore().add(title)
}

export function toggleTodo(id: number, done: boolean): Promise<void> {
  return getTodoStore().toggle(id, done)
}

export function removeTodo(id: number): Promise<void> {
  return getTodoStore().remove(id)
}

/** Serialize application-owned Todo data for an opt-in backup flow. */
export async function exportTodos(exportedAt?: string): Promise<string> {
  return JSON.stringify(createTodoExport(await getTodoStore().list(), exportedAt))
}

/** Append a fully validated Todo backup without replacing existing local records. */
export async function importTodos(content: string): Promise<{ imported: number }> {
  const backup = parseTodoExport(content)
  await getTodoStore().appendImported(backup.data.todos)
  return { imported: backup.data.todos.length }
}
