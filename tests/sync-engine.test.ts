import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteDB } from 'idb'
import { createOutboxSyncEngine } from '../src/sync/engine.ts'
import { createInMemorySyncStateStore } from '../src/sync/in-memory-store.ts'
import { createIndexedDbSyncStateStore } from '../src/sync/indexeddb-store.ts'
import { createAllowlistSyncPolicy } from '../src/sync/policy.ts'
import type { SyncMutation, SyncTransport } from '../src/sync/types.ts'

const mutation = (overrides: Partial<SyncMutation> = {}): SyncMutation => ({
  operationId: 'op-1',
  collection: 'notes',
  recordId: 'note-1',
  kind: 'upsert',
  payload: { title: 'hello' },
  revision: 'device-a:1',
  deviceId: 'device-a',
  occurredAt: '2026-09-02T00:00:00.000Z',
  ...overrides,
})

test('empty allowlist rejects all collections and explicit entries are exact', () => {
  assert.equal(createAllowlistSyncPolicy().allows('notes'), false)
  const policy = createAllowlistSyncPolicy(['notes'])
  assert.equal(policy.allows('notes'), true)
  assert.equal(policy.allows('note'), false)
  assert.equal(policy.allows('secrets'), false)
})

test('in-memory sync store enqueues by id and replaces duplicate operations', async () => {
  const store = createInMemorySyncStateStore([mutation()])
  await store.enqueue(mutation({ operationId: 'op-2', recordId: 'note-2' }))
  await store.enqueue(
    mutation({ operationId: 'op-2', recordId: 'note-2', payload: { title: 'latest' } }),
  )

  assert.deepEqual(
    (await store.listPending(100)).map(({ operationId, payload }) => ({
      operationId,
      payload,
    })),
    [
      { operationId: 'op-1', payload: { title: 'hello' } },
      { operationId: 'op-2', payload: { title: 'latest' } },
    ],
  )
})

test('IndexedDB sync store preserves pending changes and checkpoint after reopening', async () => {
  const databaseName = `meow-test-sync-${Date.now()}`
  await deleteDB(databaseName)
  const store = createIndexedDbSyncStateStore({ databaseName })

  await store.enqueue(mutation())
  await store.enqueue(mutation({ operationId: 'op-2', recordId: 'note-2' }))
  await store.setCheckpoint('cursor-1')
  await store.acknowledge(['op-1'])

  const reopened = createIndexedDbSyncStateStore({ databaseName })
  assert.deepEqual(await reopened.listPending(100), [
    mutation({ operationId: 'op-2', recordId: 'note-2' }),
  ])
  assert.equal(await reopened.getCheckpoint(), 'cursor-1')
})

test('sync uploads accepted changes, applies pulled changes and advances checkpoint', async () => {
  const local = mutation()
  const remote = mutation({
    operationId: 'op-2',
    recordId: 'note-2',
    deviceId: 'device-b',
    revision: 'device-b:1',
  })
  const store = createInMemorySyncStateStore([local], 'cursor-0')
  const applied: SyncMutation[] = []
  const transport: SyncTransport = {
    async push(changes) {
      assert.deepEqual(changes, [local])
      return { acceptedOperationIds: ['op-1'] }
    },
    async pull(checkpoint) {
      assert.equal(checkpoint, 'cursor-0')
      return { changes: [remote], checkpoint: 'cursor-1' }
    },
  }

  const result = await createOutboxSyncEngine({
    store,
    transport,
    policy: createAllowlistSyncPolicy(['notes']),
    async applyRemote(change) {
      applied.push(change)
    },
  }).syncOnce()

  assert.deepEqual(result, { uploaded: 1, downloaded: 1, checkpoint: 'cursor-1' })
  assert.deepEqual(await store.listPending(100), [])
  assert.deepEqual(applied, [remote])
  assert.equal(await store.getCheckpoint(), 'cursor-1')
})

test('sync acknowledges only unique operation ids from the submitted batch', async () => {
  const local = mutation()
  const store = createInMemorySyncStateStore([local])
  const acknowledgements: string[][] = []
  const acknowledge = store.acknowledge
  store.acknowledge = async (operationIds) => {
    acknowledgements.push([...operationIds])
    await acknowledge(operationIds)
  }
  const transport: SyncTransport = {
    async push() {
      return { acceptedOperationIds: ['op-1', 'unknown', 'op-1'] }
    },
    async pull() {
      return { changes: [] }
    },
  }

  const result = await createOutboxSyncEngine({
    store,
    transport,
    policy: createAllowlistSyncPolicy(['notes']),
    async applyRemote() {},
  }).syncOnce()

  assert.equal(result.uploaded, 1)
  assert.deepEqual(acknowledgements, [['op-1']])
  assert.deepEqual(await store.listPending(100), [])
})

test('push failure keeps pending outbox changes', async () => {
  const local = mutation()
  const store = createInMemorySyncStateStore([local])
  const transport: SyncTransport = {
    async push() {
      throw new Error('offline')
    },
    async pull() {
      return { changes: [] }
    },
  }

  await assert.rejects(
    createOutboxSyncEngine({
      store,
      transport,
      policy: createAllowlistSyncPolicy(['notes']),
      async applyRemote() {},
    }).syncOnce(),
    /offline/,
  )
  assert.deepEqual(await store.listPending(100), [local])
})

test('remote apply failure does not advance the checkpoint', async () => {
  const store = createInMemorySyncStateStore([], 'cursor-0')
  const transport: SyncTransport = {
    async push() {
      return { acceptedOperationIds: [] }
    },
    async pull() {
      return { changes: [mutation({ operationId: 'remote-1' })], checkpoint: 'cursor-1' }
    },
  }

  await assert.rejects(
    createOutboxSyncEngine({
      store,
      transport,
      policy: createAllowlistSyncPolicy(['notes']),
      async applyRemote() {
        throw new Error('conflict')
      },
    }).syncOnce(),
    /conflict/,
  )
  assert.equal(await store.getCheckpoint(), 'cursor-0')
})

test('disallowed local collection fails before transport', async () => {
  const store = createInMemorySyncStateStore([mutation({ collection: 'secrets' })])
  const transport: SyncTransport = {
    async push() {
      throw new Error('transport must not run')
    },
    async pull() {
      throw new Error('transport must not run')
    },
  }

  await assert.rejects(
    createOutboxSyncEngine({
      store,
      transport,
      policy: createAllowlistSyncPolicy(['notes']),
      async applyRemote() {},
    }).syncOnce(),
    /collection "secrets" is not allowed/,
  )
})

test('disallowed remote collection fails before applying or advancing checkpoint', async () => {
  const store = createInMemorySyncStateStore([], 'cursor-0')
  let applied = false
  const transport: SyncTransport = {
    async push() {
      return { acceptedOperationIds: [] }
    },
    async pull() {
      return {
        changes: [mutation({ collection: 'secrets' })],
        checkpoint: 'cursor-1',
      }
    },
  }

  await assert.rejects(
    createOutboxSyncEngine({
      store,
      transport,
      policy: createAllowlistSyncPolicy(['notes']),
      async applyRemote() {
        applied = true
      },
    }).syncOnce(),
    /collection "secrets" is not allowed/,
  )
  assert.equal(applied, false)
  assert.equal(await store.getCheckpoint(), 'cursor-0')
})
