import assert from 'node:assert/strict'
import test from 'node:test'
import { createOutboxSyncEngine } from '../src/sync/engine.ts'
import { createInMemorySyncStateStore } from '../src/sync/in-memory-store.ts'
import { createAllowlistSyncPolicy } from '../src/sync/policy.ts'
import type {
  PendingSyncMutation,
  SyncMutation,
  SyncTransport,
} from '../src/sync/types.ts'

const pendingMutation = (
  overrides: Partial<PendingSyncMutation> = {},
): PendingSyncMutation => ({
  operationId: 'op-1',
  collection: 'notes',
  recordId: 'note-1',
  kind: 'upsert',
  payload: { title: 'hello' },
  baseRevision: null,
  deviceId: 'device-a',
  occurredAt: '2026-09-02T00:00:00.000Z',
  ...overrides,
})

const mutation = (overrides: Partial<SyncMutation> = {}): SyncMutation => ({
  operationId: 'op-1',
  collection: 'notes',
  recordId: 'note-1',
  kind: 'upsert',
  payload: { title: 'hello' },
  revision: '1',
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
  const store = createInMemorySyncStateStore([pendingMutation()])
  await store.enqueue(pendingMutation({ operationId: 'op-2', recordId: 'note-2' }))
  await store.enqueue(
    pendingMutation({ operationId: 'op-2', recordId: 'note-2', payload: { title: 'latest' } }),
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

test('sync uploads accepted changes, applies pulled changes and advances checkpoint', async () => {
  const local = pendingMutation()
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
      return { accepted: [mutation()], conflicts: [] }
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

  assert.deepEqual(result, {
    uploaded: 1,
    downloaded: 1,
    checkpoint: 'cursor-1',
    conflicts: [],
  })
  assert.deepEqual(await store.listPending(100), [])
  assert.deepEqual(applied, [remote])
  assert.equal(await store.getCheckpoint(), 'cursor-1')
})

test('push failure keeps pending outbox changes', async () => {
  const local = pendingMutation()
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
      return { accepted: [], conflicts: [] }
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
  const store = createInMemorySyncStateStore([
    pendingMutation({ collection: 'secrets' }),
  ])
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
      return { accepted: [], conflicts: [] }
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

test('push conflicts remain pending, apply canonical remote state, and are recorded', async () => {
  const local = pendingMutation({ baseRevision: '1' })
  const current = mutation({ operationId: 'remote-2', revision: '2' })
  const store = createInMemorySyncStateStore([local], 'cursor-0')
  const applied: SyncMutation[] = []
  const transport: SyncTransport = {
    async push(changes) {
      assert.deepEqual(changes, [local])
      return {
        accepted: [],
        conflicts: [{ operationId: local.operationId, current }],
      }
    },
    async pull() {
      return { changes: [], checkpoint: 'cursor-1' }
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

  assert.equal(result.uploaded, 0)
  assert.deepEqual(result.conflicts, [{ operationId: local.operationId, current }])
  assert.deepEqual(await store.listPending(100), [local])
  assert.deepEqual(applied, [current])
  assert.deepEqual(await store.listConflicts(), [{ operationId: local.operationId, current }])
})

test('disallowed conflict changes fail before applying any conflict or acknowledging pending work', async () => {
  const local = pendingMutation({ baseRevision: '1' })
  const allowedCurrent = mutation({ operationId: 'remote-allowed', revision: '2' })
  const deniedCurrent = mutation({
    operationId: 'remote-denied',
    collection: 'secrets',
    revision: '2',
  })
  const store = createInMemorySyncStateStore([local], 'cursor-0')
  const applied: SyncMutation[] = []
  const transport: SyncTransport = {
    async push() {
      return {
        accepted: [mutation()],
        conflicts: [
          { operationId: 'op-allowed', current: allowedCurrent },
          { operationId: local.operationId, current: deniedCurrent },
        ],
      }
    },
    async pull() {
      throw new Error('pull must not run')
    },
  }

  await assert.rejects(
    createOutboxSyncEngine({
      store,
      transport,
      policy: createAllowlistSyncPolicy(['notes']),
      async applyRemote(change) {
        applied.push(change)
      },
    }).syncOnce(),
    /collection "secrets" is not allowed/,
  )

  assert.deepEqual(applied, [])
  assert.deepEqual(await store.listPending(100), [local])
  assert.deepEqual(await store.listConflicts(), [])
  assert.equal(await store.getCheckpoint(), 'cursor-0')
})

test('a conflict canonical operation is not reapplied when it appears in a later pull', async () => {
  const local = pendingMutation({ baseRevision: '1' })
  const current = mutation({ operationId: 'remote-2', revision: '2' })
  const store = createInMemorySyncStateStore([local], 'cursor-0')
  const applied: SyncMutation[] = []
  const transport: SyncTransport = {
    async push() {
      return {
        accepted: [],
        conflicts: [{ operationId: local.operationId, current }],
      }
    },
    async pull() {
      return { changes: [current], checkpoint: 'cursor-1' }
    },
  }

  await createOutboxSyncEngine({
    store,
    transport,
    policy: createAllowlistSyncPolicy(['notes']),
    async applyRemote(change) {
      applied.push(change)
    },
  }).syncOnce()

  assert.deepEqual(applied, [current])
  assert.equal(await store.getCheckpoint(), 'cursor-1')
})

test('an unresolved conflict does not reapply its canonical operation on a later sync run', async () => {
  const local = pendingMutation({ baseRevision: '1' })
  const current = mutation({ operationId: 'remote-2', revision: '2' })
  const store = createInMemorySyncStateStore([local], 'cursor-0')
  const applied: SyncMutation[] = []
  const transport: SyncTransport = {
    async push() {
      return {
        accepted: [],
        conflicts: [{ operationId: local.operationId, current }],
      }
    },
    async pull() {
      return { changes: [], checkpoint: 'cursor-1' }
    },
  }
  const provider = createOutboxSyncEngine({
    store,
    transport,
    policy: createAllowlistSyncPolicy(['notes']),
    async applyRemote(change) {
      applied.push(change)
    },
  })

  await provider.syncOnce()
  await provider.syncOnce()

  assert.deepEqual(applied, [current])
  assert.deepEqual(await store.listPending(100), [local])
})

test('conflict recording failure keeps accepted pending work and the checkpoint', async () => {
  const local = pendingMutation({ baseRevision: '1' })
  const current = mutation({ operationId: 'remote-2', revision: '2' })
  const baseStore = createInMemorySyncStateStore([local], 'cursor-0')
  const store = {
    ...baseStore,
    async recordConflict() {
      throw new Error('cannot record conflict')
    },
  }
  const transport: SyncTransport = {
    async push() {
      return {
        accepted: [mutation()],
        conflicts: [{ operationId: local.operationId, current }],
      }
    },
    async pull() {
      throw new Error('pull must not run')
    },
  }

  await assert.rejects(
    createOutboxSyncEngine({
      store,
      transport,
      policy: createAllowlistSyncPolicy(['notes']),
      async applyRemote() {},
    }).syncOnce(),
    /cannot record conflict/,
  )

  assert.deepEqual(await baseStore.listPending(100), [local])
  assert.equal(await baseStore.getCheckpoint(), 'cursor-0')
})

test('remote operations are applied at most once by operation ID', async () => {
  const remote = mutation({ operationId: 'remote-1', revision: '2' })
  const store = createInMemorySyncStateStore()
  const applied: SyncMutation[] = []
  const transport: SyncTransport = {
    async push() {
      return { accepted: [], conflicts: [] }
    },
    async pull() {
      return { changes: [remote] }
    },
  }
  const provider = createOutboxSyncEngine({
    store,
    transport,
    policy: createAllowlistSyncPolicy(['notes']),
    async applyRemote(change) {
      applied.push(change)
    },
  })

  await provider.syncOnce()
  await provider.syncOnce()

  assert.deepEqual(applied, [remote])
})
