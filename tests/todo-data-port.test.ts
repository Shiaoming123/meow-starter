import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTodoExport,
  MAX_TODO_EXPORT_ITEMS,
  parseTodoExport,
} from '../src/storage/todos/data-port.ts'
import { exportTodos, importTodos } from '../src/lib/db.ts'
import { createInMemoryTodoStore } from '../src/storage/todos/in-memory.ts'
import { registerTodoStore } from '../src/storage/todos/registry.ts'

test('Todo export omits local ids and preserves user-owned fields', () => {
  const exported = createTodoExport(
    [
      {
        id: 42,
        title: 'keep me',
        done: 1,
        created_at: '2026-09-02 00:00:00',
      },
    ],
    '2026-09-03T00:00:00.000Z',
  )

  assert.deepEqual(parseTodoExport(JSON.stringify(exported)), {
    format: 'meow-starter/data-export',
    version: 1,
    exportedAt: '2026-09-03T00:00:00.000Z',
    data: {
      todos: [{ title: 'keep me', done: 1, createdAt: '2026-09-02 00:00:00' }],
    },
  })
})

test('Todo import rejects unsupported formats before storage is involved', () => {
  assert.throws(
    () => parseTodoExport('{"format":"other","version":1,"data":{"todos":[]}}'),
    /format/,
  )
})

test('Todo import rejects an oversized data set', () => {
  const todos = Array.from({ length: MAX_TODO_EXPORT_ITEMS + 1 }, () => ({
    title: 'too many',
    done: 0,
    createdAt: '2026-09-02 00:00:00',
  }))

  assert.throws(
    () =>
      parseTodoExport({
        format: 'meow-starter/data-export',
        version: 1,
        exportedAt: '2026-09-03T00:00:00.000Z',
        data: { todos },
      }),
    /10,000/,
  )
})

test('public Todo data port appends validated records and leaves data unchanged on failure', async () => {
  const store = createInMemoryTodoStore([
    { id: 1, title: 'existing', done: 0, created_at: '2026-09-01 00:00:00' },
  ])
  registerTodoStore(store)

  const result = await importTodos(
    JSON.stringify({
      format: 'meow-starter/data-export',
      version: 1,
      exportedAt: '2026-09-03T00:00:00.000Z',
      data: {
        todos: [{ title: 'restored', done: 1, createdAt: '2026-09-02 00:00:00' }],
      },
    }),
  )

  assert.deepEqual(result, { imported: 1 })
  assert.deepEqual(parseTodoExport(await exportTodos('2026-09-03T00:00:00.000Z')).data.todos, [
    { title: 'restored', done: 1, createdAt: '2026-09-02 00:00:00' },
    { title: 'existing', done: 0, createdAt: '2026-09-01 00:00:00' },
  ])

  await assert.rejects(
    importTodos('{"format":"meow-starter/data-export","version":2}'),
    /version/,
  )
  assert.equal((await store.list()).length, 2)
})
