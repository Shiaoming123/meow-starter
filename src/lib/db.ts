import Database from '@tauri-apps/plugin-sql'

/**
 * 与 src-tauri/src/db.rs 中的迁移保持一致。
 * SQLite 的 INTEGER 落到 JS 侧是 number，布尔用 0 / 1 表示。
 */
export interface Todo {
  id: number
  title: string
  done: 0 | 1
  created_at: string
}

const DB_URL = 'sqlite:app.db'

let connection: Promise<Database> | null = null

/** 惰性建立连接并复用。preload 已在应用启动时跑过迁移。 */
export function getDb(): Promise<Database> {
  if (!connection) {
    connection = Database.load(DB_URL)
  }
  return connection
}

export async function listTodos(): Promise<Todo[]> {
  const db = await getDb()
  return db.select<Todo[]>(
    'SELECT id, title, done, created_at FROM todos ORDER BY created_at DESC, id DESC',
  )
}

export async function addTodo(title: string): Promise<void> {
  const db = await getDb()
  await db.execute('INSERT INTO todos (title) VALUES ($1)', [title])
}

export async function toggleTodo(id: number, done: boolean): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE todos SET done = $1 WHERE id = $2', [done ? 1 : 0, id])
}

export async function removeTodo(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM todos WHERE id = $1', [id])
}
