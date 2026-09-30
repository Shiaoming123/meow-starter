import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { openDB } from 'idb'
import { createIndexedDbTodoStore } from '../src/storage/todos/indexeddb.ts'
import { openMeowDatabase } from '../src/storage/indexeddb/database.ts'

const restored = [
  { title: 'first restored', done: 1 as const, createdAt: '2026-09-02 00:00:00' },
  { title: 'second restored', done: 0 as const, createdAt: '2026-09-03 00:00:00' },
]

test('IndexedDB import rolls back earlier records when a later storage request fails', async () => {
  const databaseName = `meow-atomic-import-${randomUUID()}`
  // A storage constraint gives a genuine asynchronous request failure after
  // the first insert, without changing the application schema.
  const database = await openDB(databaseName, 1, {
    upgrade(db) {
      const todos = db.createObjectStore('todos', { keyPath: 'id', autoIncrement: true })
      todos.createIndex('unique-title', 'title', { unique: true })
    },
  })
  const store = createIndexedDbTodoStore({ databaseName })
  await store.add('existing')
  const before = await store.list()
  let aborted = false
  const connection = await openMeowDatabase(databaseName)
  connection.addEventListener('abort', () => { aborted = true })

  await assert.rejects(store.appendImported([
    restored[0],
    { ...restored[1], title: 'existing' },
  ]), { name: 'ConstraintError' })

  assert.equal(aborted, true, 'import rejection must wait for the storage abort event')
  assert.deepEqual(await store.list(), before)
  database.close()
})

test('IndexedDB import rolls back after a synchronous storage failure', async (t) => {
  const databaseName = `meow-atomic-import-sync-${randomUUID()}`
  const store = createIndexedDbTodoStore({ databaseName })
  await store.add('existing')
  const before = await store.list()
  const originalAdd = IDBObjectStore.prototype.add
  let attempted = 0
  const injected = t.mock.method(IDBObjectStore.prototype, 'add', function (...args) {
    if (++attempted === 2) throw new DOMException('Simulated storage quota failure', 'QuotaExceededError')
    return originalAdd.apply(this, args)
  })

  await assert.rejects(store.appendImported(restored), { name: 'QuotaExceededError' })
  injected.mock.restore()

  assert.deepEqual(await store.list(), before)
  await store.appendImported(restored)
  assert.deepEqual((await store.list()).map(({ title }) => title).sort(), [
    'existing', 'first restored', 'second restored',
  ])
})

test('IndexedDB import commits the entire successful batch and keeps local ids distinct', async () => {
  const databaseName = `meow-atomic-import-success-${randomUUID()}`
  const store = createIndexedDbTodoStore({ databaseName })
  await store.add('existing')
  await store.appendImported(restored)

  const reopened = createIndexedDbTodoStore({ databaseName })
  const records = await reopened.list()
  assert.equal(records.length, 3)
  assert.equal(new Set(records.map(({ id }) => id)).size, 3)
  for (const record of restored) {
    const actual = records.find(({ title }) => title === record.title)
    assert.equal(actual?.done, record.done)
    assert.equal(actual?.created_at, record.createdAt)
  }
  await store.appendImported([])
  assert.deepEqual(await store.list(), records)
})
