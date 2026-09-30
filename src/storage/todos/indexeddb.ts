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
      if (records.length === 0) return
      const database = await openMeowDatabase(databaseName)
      const transaction = database.transaction('todos', 'readwrite')
      // Observe rejection immediately, even if a request fails before we await
      // completion. A rejected request and an aborted transaction both reject.
      void transaction.done.catch(() => {})
      // idb's done promise can reject on an error event before abort finishes.
      const finished = new Promise<void>((resolve) => {
        const finish = () => {
          transaction.removeEventListener('complete', finish)
          transaction.removeEventListener('abort', finish)
          resolve()
        }
        transaction.addEventListener('complete', finish)
        transaction.addEventListener('abort', finish)
      })
      try {
        for (const record of records) {
          await transaction.store.add({
            title: record.title,
            done: record.done,
            created_at: record.createdAt,
          })
        }
        await transaction.done
      } catch (error) {
        try {
          transaction.abort()
        } catch {
          // Request failures may already have aborted the transaction.
        }
        await finished
        throw error
      }
    },
  }
}
