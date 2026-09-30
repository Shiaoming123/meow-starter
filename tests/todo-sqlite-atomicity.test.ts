import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { createTauriSqliteTodoStore } from '../src/storage/todos/tauri-sqlite.ts'
import { MAX_TODO_EXPORT_ITEMS } from '../src/storage/todos/data-port.ts'

function createSqliteFixture(t) {
  const database = new DatabaseSync(':memory:')
  t.after(() => database.close())
  database.exec(`CREATE TABLE todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
  let executions = 0
  let loads = 0
  const store = createTauriSqliteTodoStore(async () => {
    loads++
    return {
      async select(sql, bindValues = []) {
        return database.prepare(sql).all(Object.fromEntries(bindValues.map((value, i) => [`$${i + 1}`, value])))
      },
      async execute(sql, bindValues = []) {
        executions++
        return database.prepare(sql).run(Object.fromEntries(bindValues.map((value, i) => [`$${i + 1}`, value])))
      },
    }
  })
  return { database, store, executions: () => executions, loads: () => loads }
}

test('SQLite import rolls back the entire batch if a later row violates a constraint', async (t) => {
  const { database, store } = createSqliteFixture(t)
  database.exec("CREATE UNIQUE INDEX unique_title ON todos(title)")
  await store.add('existing')
  const before = await store.list()

  await assert.rejects(store.appendImported([
    { title: 'first restored', done: 0, createdAt: '2026-09-02 00:00:00' },
    { title: 'existing', done: 1, createdAt: '2026-09-03 00:00:00' },
  ]), /UNIQUE constraint failed/)

  assert.deepEqual(await store.list(), before)
  await store.appendImported([
    { title: 'recovered', done: 1, createdAt: '2026-09-03 00:00:00' },
  ])
  assert.equal((await store.list()).length, before.length + 1)
})

test('SQLite import preserves quoted and Unicode data and intentionally appends duplicates', async (t) => {
  const { store, executions } = createSqliteFixture(t)
  const records = [
    { title: "猫 🐾 '); DROP TABLE todos; --", done: 1 as const, createdAt: '2026-09-02 00:00:00' },
    { title: 'line one\nline two\t"quoted"', done: 0 as const, createdAt: '2026-09-03 00:00:00' },
  ]

  await store.appendImported(records)
  assert.equal(executions(), 1)
  await store.appendImported(records)
  const stored = await store.list()
  assert.equal(stored.length, 4)
  assert.equal(new Set(stored.map(({ id }) => id)).size, 4)
  for (const record of records) {
    const matches = stored.filter(({ title }) => title === record.title)
    assert.equal(matches.length, 2)
    assert.ok(matches.every(({ done, created_at }) => done === record.done && created_at === record.createdAt))
  }
})

test('SQLite import accepts the full data-port record limit in one statement', async (t) => {
  const { store, executions } = createSqliteFixture(t)
  const records = Array.from({ length: MAX_TODO_EXPORT_ITEMS }, (_, i) => ({
    title: `restored ${i}`, done: 0 as const, createdAt: '2026-09-02 00:00:00',
  }))

  await store.appendImported(records)

  assert.equal(executions(), 1)
  assert.equal((await store.list()).length, MAX_TODO_EXPORT_ITEMS)
})

test('an empty SQLite import never loads the native database', async () => {
  const store = createTauriSqliteTodoStore(async () => {
    throw new Error('An empty import should not load storage')
  })
  await store.appendImported([])
})

test('SQLite import rejects lone UTF-16 surrogates before loading or writing any records', async (t) => {
  for (const field of ['title', 'createdAt']) {
    for (const invalid of ['before\ud800after', 'before\udc00after']) {
      const { store, loads, executions } = createSqliteFixture(t)
      await store.add('existing')
      const before = await store.list()
      const previousLoads = loads()
      const previousExecutions = executions()
      const valid = { title: 'valid 🐾', done: 0 as const, createdAt: '2026-09-02 00:00:00' }

      await assert.rejects(store.appendImported([
        valid, { ...valid, [field]: invalid },
      ]), /well-formed Unicode/)

      assert.equal(loads(), previousLoads)
      assert.equal(executions(), previousExecutions)
      assert.deepEqual(await store.list(), before)
    }
  }
})
