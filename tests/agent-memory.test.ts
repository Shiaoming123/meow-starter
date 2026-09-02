import assert from 'node:assert/strict'
import test from 'node:test'
import { browserMemoryStore, createMemoryStore } from '../src/agent/memory/in-memory.ts'

test('createMemoryStore keeps messages for the lifetime of one store', async () => {
  const store = createMemoryStore()
  await store.append({ sessionId: 'one', role: 'user', content: 'hello' })
  await store.append({ sessionId: 'one', role: 'assistant', content: 'hi' })
  assert.deepEqual(
    (await store.list('one')).map(({ content }) => content),
    ['hello', 'hi'],
  )
})

test('browserMemoryStore reuses the same fallback between calls', async () => {
  await browserMemoryStore.clear('shared')
  await browserMemoryStore.append({ sessionId: 'shared', role: 'user', content: 'persist' })
  assert.equal((await browserMemoryStore.list('shared')).length, 1)
})

test('memory stores isolate sessions and honor limits', async () => {
  const store = createMemoryStore()
  await store.append({ sessionId: 'a', role: 'user', content: 'one' })
  await store.append({ sessionId: 'a', role: 'user', content: 'two' })
  await store.append({ sessionId: 'b', role: 'user', content: 'other' })
  assert.deepEqual((await store.list('a', 1)).map(({ content }) => content), ['two'])
})
