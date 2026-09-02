import { getTodoStore } from '../storage/todos/registry.ts'
import type { Todo } from '../storage/todos/types'

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
