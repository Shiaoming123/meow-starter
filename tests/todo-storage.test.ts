import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteDB } from 'idb'
import { createInMemoryTodoStore } from '../src/storage/todos/in-memory.ts'
import { createIndexedDbTodoStore } from '../src/storage/todos/indexeddb.ts'
import { registerTodoStore } from '../src/storage/todos/registry.ts'
import { createTauriSqliteTodoStore } from '../src/storage/todos/tauri-sqlite.ts'
import type { TodoStore } from '../src/storage/todos/types.ts'
import { addTodo, listTodos } from '../src/lib/db.ts'

async function verifiesTodoStore(store: TodoStore) {
  await store.add('first')
  await store.add('second')
  const listed = await store.list()
  assert.deepEqual(listed.map(({ title }) => title), ['second', 'first'])
  await store.toggle(listed[0].id, true)
  assert.equal((await store.list())[0].done, 1)
  await store.remove(listed[0].id)
  assert.deepEqual((await store.list()).map(({ title }) => title), ['first'])
}

test('memory adapter implements the TodoStore contract', async () => {
  await verifiesTodoStore(createInMemoryTodoStore())
})

test('memory adapter appends imported Todos with new local ids', async () => {
  const store = createInMemoryTodoStore()
  await store.add('existing')

  await store.appendImported([
    { title: 'restored', done: 1, createdAt: '2026-09-02 00:00:00' },
  ])

  const listed = await store.list()
  const restored = listed.find((todo) => todo.title === 'restored')
  assert.deepEqual(restored, {
    id: 2,
    title: 'restored',
    done: 1,
    created_at: '2026-09-02 00:00:00',
  })
  assert.equal(listed.find((todo) => todo.title === 'existing')?.id, 1)
})

test('IndexedDB adapter implements the TodoStore contract and survives reopening', async () => {
  const databaseName = `meow-test-todos-${Date.now()}`
  await deleteDB(databaseName)
  await verifiesTodoStore(createIndexedDbTodoStore({ databaseName }))
  assert.deepEqual(
    (await createIndexedDbTodoStore({ databaseName }).list()).map(({ title }) => title),
    ['first'],
  )
})

test('IndexedDB adapter persists appended import records after reopening', async () => {
  const databaseName = `meow-test-import-${Date.now()}`
  await deleteDB(databaseName)
  const store = createIndexedDbTodoStore({ databaseName })

  await store.appendImported([
    { title: 'restored', done: 1, createdAt: '2026-09-02 00:00:00' },
  ])

  const reopened = createIndexedDbTodoStore({ databaseName })
  assert.deepEqual(await reopened.list(), [
    { id: 1, title: 'restored', done: 1, created_at: '2026-09-02 00:00:00' },
  ])
})

test('public Todo functions delegate to the registered store', async () => {
  const store = createInMemoryTodoStore()
  registerTodoStore(store)

  await addTodo('through facade')

  assert.deepEqual((await listTodos()).map(({ title }) => title), ['through facade'])
})

test('Tauri SQLite adapter preserves the existing SQL boundary', async () => {
  const calls: Array<{ sql: string; bindValues?: unknown[] }> = []
  const expected = [
    { id: 7, title: 'desktop', done: 0 as const, created_at: '2026-09-02 00:00:00' },
  ]
  const store = createTauriSqliteTodoStore(async () => ({
    async select<T>(sql: string): Promise<T> {
      calls.push({ sql })
      return expected as T
    },
    async execute(sql: string, bindValues?: unknown[]) {
      calls.push({ sql, bindValues })
      return { rowsAffected: 1 }
    },
  }))

  assert.deepEqual(await store.list(), expected)
  await store.add('new')
  await store.toggle(7, true)
  await store.remove(7)
  await store.appendImported([
    { title: 'restored', done: 1, createdAt: '2026-09-02 00:00:00' },
  ])

  assert.deepEqual(calls.slice(1).map(({ bindValues }) => bindValues), [
    ['new'],
    [1, 7],
    [7],
    ['restored', 1, '2026-09-02 00:00:00'],
  ])
})
