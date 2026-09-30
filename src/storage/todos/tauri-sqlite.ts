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
      if (records.length === 0) return
      const content = JSON.stringify(records.map(({ title, done, createdAt }) => {
        // JSON can escape lone surrogates that direct IPC string binding rejects.
        // SQLite JSON extraction must never persist them as invalid UTF-8 text.
        // In Unicode mode, this range matches only unpaired surrogate code units.
        if (/[\uD800-\uDFFF]/u.test(title) || /[\uD800-\uDFFF]/u.test(createdAt)) {
          throw new Error('SQLite Todo imports require well-formed Unicode text.')
        }
        return { title, done, createdAt }
      }))
      const database = await loadDatabase()
      // One statement is atomic and stays on one pooled connection. Binding a
      // JSON array also avoids a parameter per field at the 10,000-record limit.
      await database.execute(
        `INSERT INTO todos (title, done, created_at)
         SELECT json_extract(value, '$.title'),
                json_extract(value, '$.done'),
                json_extract(value, '$.createdAt')
         FROM json_each($1)`,
        [content],
      )
    },
  }
}
