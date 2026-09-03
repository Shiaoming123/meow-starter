import { DEFAULT_WEB_DATABASE_NAME, openMeowDatabase } from '../indexeddb/database.ts'
import type { Todo, TodoStore } from './types'
import { sortTodosNewestFirst } from './types.ts'

export interface IndexedDbTodoStoreOptions {
  databaseName?: string
}

export function createIndexedDbTodoStore(
  options: IndexedDbTodoStoreOptions = {},
): TodoStore {
  const databaseName = options.databaseName ?? DEFAULT_WEB_DATABASE_NAME

  return {
    async list() {
      const database = await openMeowDatabase(databaseName)
      const records = await database.getAll('todos')
      const todos = records.filter(
        (record): record is Todo => typeof record.id === 'number',
      )
      return sortTodosNewestFirst(todos)
    },
    async add(title) {
      const database = await openMeowDatabase(databaseName)
      await database.add('todos', {
        title,
        done: 0,
        created_at: new Date().toISOString(),
      })
    },
    async toggle(id, done) {
      const database = await openMeowDatabase(databaseName)
      const todo = await database.get('todos', id)
      if (!todo) return
      await database.put('todos', { ...todo, done: done ? 1 : 0 })
    },
    async remove(id) {
      const database = await openMeowDatabase(databaseName)
      await database.delete('todos', id)
    },
    async appendImported(records) {
      const database = await openMeowDatabase(databaseName)
      for (const record of records) {
        await database.add('todos', {
          title: record.title,
          done: record.done,
          created_at: record.createdAt,
        })
      }
    },
  }
}
