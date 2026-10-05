import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import test, { after, before, mock } from 'node:test'
import Database from '@tauri-apps/plugin-sql'
import { initAgentTables, sqliteMemoryStore } from '../src/agent/memory/store.ts'

// Exercise the production adapter and SQL against SQLite. Only native IPC is
// substituted; this process has no WebView, user database, or provider access.
const database = new DatabaseSync(':memory:')
const values = (bindings: unknown[] = []) => Object.fromEntries(
  bindings.map((value, index) => [`$${index + 1}`, value]),
)
const load = mock.method(Database, 'load', async () => ({
  async execute(sql: string, bindings?: unknown[]) {
    return database.prepare(sql).run(values(bindings))
  },
  async select(sql: string, bindings?: unknown[]) {
    return database.prepare(sql).all(values(bindings))
  },
}))

before(async () => {
  globalThis.window = { __TAURI_INTERNALS__: {} } as any
  await initAgentTables()
})
after(() => {
  load.mock.restore()
  delete globalThis.window
  database.close()
})

async function append(sessionId: string, contents: string[]) {
  for (const content of contents) {
    await sqliteMemoryStore.append({ sessionId, role: 'user', content })
  }
}

test('SQLite Agent memory returns the most recent window in chronological order', async () => {
  await append('recent-window', ['one', 'two', 'three', 'four', 'five'])

  const messages = await sqliteMemoryStore.list('recent-window', 2)

  assert.deepEqual(messages.map(({ content }) => content), ['four', 'five'])
  assert.ok(Number(messages[0].id) < Number(messages[1].id))
})

test('SQLite Agent memory selects recent history independently for each session', async () => {
  await append('isolated-a', ['a1'])
  await append('isolated-b', ['b1'])
  await append('isolated-a', ['a2'])
  await append('isolated-b', ['b2'])
  await append('isolated-a', ['a3'])

  const messages = await sqliteMemoryStore.list('isolated-a', 2)

  assert.deepEqual(messages.map(({ content, sessionId }) => ({ content, sessionId })), [
    { content: 'a2', sessionId: 'isolated-a' },
    { content: 'a3', sessionId: 'isolated-a' },
  ])
  assert.deepEqual((await sqliteMemoryStore.list('isolated-b', 1)).map(({ content }) => content), ['b2'])
})

test('SQLite Agent memory keeps its default 200-message limit on the newest messages', async () => {
  await append('default-window', Array.from({ length: 205 }, (_, index) => `message-${index + 1}`))

  const messages = await sqliteMemoryStore.list('default-window')

  assert.equal(messages.length, 200)
  assert.equal(messages[0].content, 'message-6')
  assert.equal(messages.at(-1)?.content, 'message-205')
})

test('limited SQLite Agent reads leave persisted history unchanged', async () => {
  await append('read-only-window', ['old', 'middle', 'new'])
  await sqliteMemoryStore.list('read-only-window', 1)

  assert.deepEqual((await sqliteMemoryStore.list('read-only-window', 10)).map(({ content }) => content), [
    'old', 'middle', 'new',
  ])
})

test('SQLite Agent memory preserves empty and zero-limit reads', async () => {
  await append('zero-window', ['keep'])
  assert.deepEqual(await sqliteMemoryStore.list('zero-window', 0), [])
  assert.deepEqual(await sqliteMemoryStore.list('missing-session', 2), [])
})
