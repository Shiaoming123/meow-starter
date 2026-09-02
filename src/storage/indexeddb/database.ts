import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export const DEFAULT_WEB_DATABASE_NAME = 'meow-starter'

export interface IndexedDbTodoRecord {
  id?: number
  title: string
  done: 0 | 1
  created_at: string
}

interface MeowDatabaseSchema extends DBSchema {
  todos: {
    key: number
    value: IndexedDbTodoRecord
    indexes: { 'by-created-at': string }
  }
}

const connections = new Map<string, Promise<IDBPDatabase<MeowDatabaseSchema>>>()

export function openMeowDatabase(
  databaseName = DEFAULT_WEB_DATABASE_NAME,
): Promise<IDBPDatabase<MeowDatabaseSchema>> {
  let connection = connections.get(databaseName)
  if (!connection) {
    connection = openDB<MeowDatabaseSchema>(databaseName, 1, {
      upgrade(database) {
        const todos = database.createObjectStore('todos', {
          keyPath: 'id',
          autoIncrement: true,
        })
        todos.createIndex('by-created-at', 'created_at')
      },
    })
    connections.set(databaseName, connection)
  }
  return connection
}
