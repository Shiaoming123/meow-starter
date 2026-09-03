import type { Todo, TodoStore } from './types'

const DB_URL = 'sqlite:app.db'

export interface SqlDatabasePort {
  select<T>(sql: string, bindValues?: unknown[]): Promise<T>
  execute(sql: string, bindValues?: unknown[]): Promise<unknown>
}

export type LoadSqlDatabase = () => Promise<SqlDatabasePort>

let connection: Promise<SqlDatabasePort> | undefined

async function loadTauriDatabase(): Promise<SqlDatabasePort> {
  if (!connection) {
    connection = import('@tauri-apps/plugin-sql').then(({ default: Database }) =>
      Database.load(DB_URL),
    )
  }
  return connection
}

export function createTauriSqliteTodoStore(
  loadDatabase: LoadSqlDatabase = loadTauriDatabase,
): TodoStore {
  return {
    async list() {
      const database = await loadDatabase()
      return database.select<Todo[]>(
        'SELECT id, title, done, created_at FROM todos ORDER BY created_at DESC, id DESC',
      )
    },
    async add(title) {
      const database = await loadDatabase()
      await database.execute('INSERT INTO todos (title) VALUES ($1)', [title])
    },
    async toggle(id, done) {
      const database = await loadDatabase()
      await database.execute('UPDATE todos SET done = $1 WHERE id = $2', [
        done ? 1 : 0,
        id,
      ])
    },
    async remove(id) {
      const database = await loadDatabase()
      await database.execute('DELETE FROM todos WHERE id = $1', [id])
    },
    async appendImported(records) {
      const database = await loadDatabase()
      for (const record of records) {
        await database.execute(
          'INSERT INTO todos (title, done, created_at) VALUES ($1, $2, $3)',
          [record.title, record.done, record.createdAt],
        )
      }
    },
  }
}
