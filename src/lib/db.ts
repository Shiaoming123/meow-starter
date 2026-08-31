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

/** 是否运行在 Tauri 桌面环境（而非纯浏览器预览）。 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ---------------------------------------------------------------------------
// 浏览器预览 mock：无 Tauri 后端时回退到内存数据，便于纯前端调试与截图。
// 桌面运行时 isTauri() 为 true，仍走 SQLite，不受影响。
// ---------------------------------------------------------------------------
const mockTodos: Todo[] = [
  { id: 4, title: '打通三端打包 CI', done: 0, created_at: '2026-08-31 21:30:00' },
  { id: 3, title: '配置系统托盘与单实例', done: 1, created_at: '2026-08-31 21:20:00' },
  { id: 2, title: '接入 SQLite 数据层', done: 1, created_at: '2026-08-31 21:10:00' },
  { id: 1, title: '搭建 Tauri 2 项目骨架', done: 1, created_at: '2026-08-31 21:00:00' },
]
let mockId = 100

export async function listTodos(): Promise<Todo[]> {
  if (!isTauri()) return [...mockTodos]
  const db = await getDb()
  return db.select<Todo[]>(
    'SELECT id, title, done, created_at FROM todos ORDER BY created_at DESC, id DESC',
  )
}

export async function addTodo(title: string): Promise<void> {
  if (!isTauri()) {
    mockTodos.unshift({ id: mockId++, title, done: 0, created_at: new Date().toISOString() })
    return
  }
  const db = await getDb()
  await db.execute('INSERT INTO todos (title) VALUES ($1)', [title])
}

export async function toggleTodo(id: number, done: boolean): Promise<void> {
  if (!isTauri()) {
    const target = mockTodos.find((t) => t.id === id)
    if (target) target.done = done ? 1 : 0
    return
  }
  const db = await getDb()
  await db.execute('UPDATE todos SET done = $1 WHERE id = $2', [done ? 1 : 0, id])
}

export async function removeTodo(id: number): Promise<void> {
  if (!isTauri()) {
    const index = mockTodos.findIndex((t) => t.id === id)
    if (index >= 0) mockTodos.splice(index, 1)
    return
  }
  const db = await getDb()
  await db.execute('DELETE FROM todos WHERE id = $1', [id])
}
