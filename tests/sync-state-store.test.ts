import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteDB } from 'idb'
import { createIndexedDbSyncStateStore } from '../src/sync/indexeddb-store.ts'
import { createTauriSqliteSyncStateStore } from '../src/sync/tauri-sqlite-store.ts'
import type { PendingSyncMutation, SyncConflict } from '../src/sync/types.ts'

const pendingMutation: PendingSyncMutation = {
  operationId: 'pending-1',
  collection: 'agent_preferences',
  recordId: 'profile-1',
  kind: 'upsert',
  payload: { selectedModel: 'gpt-5.6' },
  baseRevision: '4',
  deviceId: 'device-a',
  occurredAt: '2026-09-03T00:00:00.000Z',
}

const conflict: SyncConflict = {
  operationId: pendingMutation.operationId,
  current: {
    operationId: 'remote-1',
    collection: 'agent_preferences',
    recordId: 'profile-1',
    kind: 'upsert',
    payload: { selectedModel: 'gpt-5.7' },
    revision: '5',
    deviceId: 'device-b',
    occurredAt: '2026-09-03T00:01:00.000Z',
  },
}

test('IndexedDB sync state survives reopening', async () => {
  const databaseName = `meow-test-sync-${Date.now()}`
  await deleteDB(databaseName)

  try {
    const firstStore = createIndexedDbSyncStateStore({ databaseName, ownerId: 'owner-a' })
    await firstStore.enqueue(pendingMutation)
    await firstStore.recordConflict(conflict)
    await firstStore.setCheckpoint('checkpoint-5')
    await firstStore.markAppliedOperation('remote-1')

    const reopenedStore = createIndexedDbSyncStateStore({ databaseName, ownerId: 'owner-a' })
    assert.deepEqual(await reopenedStore.listPending(100), [pendingMutation])
    assert.deepEqual(await reopenedStore.listConflicts(), [conflict])
    assert.equal(await reopenedStore.getCheckpoint(), 'checkpoint-5')
    assert.equal(await reopenedStore.hasAppliedOperation('remote-1'), true)
  } finally {
    await deleteDB(databaseName)
  }
})

test('IndexedDB acknowledgement removes only requested pending operations', async () => {
  const databaseName = `meow-test-sync-ack-${Date.now()}`
  await deleteDB(databaseName)

  try {
    const store = createIndexedDbSyncStateStore({ databaseName, ownerId: 'owner-a' })
    await store.enqueue(pendingMutation)
    await store.enqueue({ ...pendingMutation, operationId: 'pending-2' })
    await store.acknowledge(['pending-1'])

    assert.deepEqual(await store.listPending(100), [
      { ...pendingMutation, operationId: 'pending-2' },
    ])
  } finally {
    await deleteDB(databaseName)
  }
})

test('IndexedDB pending mutations preserve enqueue order after reopening and replacement', async () => {
  const databaseName = `meow-test-sync-order-${Date.now()}`
  await deleteDB(databaseName)

  try {
    const firstStore = createIndexedDbSyncStateStore({ databaseName, ownerId: 'owner-a' })
    await firstStore.enqueue({ ...pendingMutation, operationId: 'z-operation' })
    await firstStore.enqueue({ ...pendingMutation, operationId: 'a-operation' })
    await firstStore.enqueue({ ...pendingMutation, operationId: 'm-operation' })

    const reopenedStore = createIndexedDbSyncStateStore({ databaseName, ownerId: 'owner-a' })
    assert.deepEqual(
      (await reopenedStore.listPending(100)).map(({ operationId }) => operationId),
      ['z-operation', 'a-operation', 'm-operation'],
    )

    await reopenedStore.enqueue({
      ...pendingMutation,
      operationId: 'a-operation',
      payload: { selectedModel: 'gpt-5.7' },
    })
    assert.deepEqual(
      (await reopenedStore.listPending(100)).map(({ operationId, payload }) => ({
        operationId,
        payload,
      })),
      [
        { operationId: 'z-operation', payload: { selectedModel: 'gpt-5.6' } },
        { operationId: 'a-operation', payload: { selectedModel: 'gpt-5.7' } },
        { operationId: 'm-operation', payload: { selectedModel: 'gpt-5.6' } },
      ],
    )
  } finally {
    await deleteDB(databaseName)
  }
})

test('IndexedDB durable sync state is isolated by owner in one database', async () => {
  const databaseName = `meow-test-sync-owner-${Date.now()}`
  await deleteDB(databaseName)

  try {
    const ownerA = createIndexedDbSyncStateStore({ databaseName, ownerId: 'owner-a' })
    await ownerA.enqueue(pendingMutation)
    await ownerA.recordConflict(conflict)
    await ownerA.setCheckpoint('checkpoint-a')
    await ownerA.markAppliedOperation('remote-1')

    const ownerB = createIndexedDbSyncStateStore({ databaseName, ownerId: 'owner-b' })
    assert.deepEqual(await ownerB.listPending(100), [])
    assert.deepEqual(await ownerB.listConflicts(), [])
    assert.equal(await ownerB.getCheckpoint(), undefined)
    assert.equal(await ownerB.hasAppliedOperation('remote-1'), false)

    const ownerBPending = {
      ...pendingMutation,
      payload: { selectedModel: 'claude-sonnet-4-6' },
    }
    await ownerB.enqueue(ownerBPending)
    await ownerB.setCheckpoint('checkpoint-b')

    assert.deepEqual(await ownerA.listPending(100), [pendingMutation])
    assert.equal(await ownerA.getCheckpoint(), 'checkpoint-a')
    assert.deepEqual(await ownerB.listPending(100), [ownerBPending])
    assert.equal(await ownerB.getCheckpoint(), 'checkpoint-b')
  } finally {
    await deleteDB(databaseName)
  }
})

test('SQLite durable sync state scopes every operation by owner', async () => {
  const statements: Array<{ sql: string; bindValues?: unknown[] }> = []
  const store = createTauriSqliteSyncStateStore({
    ownerId: 'owner-b',
    async loadDatabase() {
      return {
        async select<T>(sql: string, bindValues?: unknown[]): Promise<T> {
          statements.push({ sql, bindValues })
          return [] as T
        },
        async execute(sql: string, bindValues?: unknown[]) {
          statements.push({ sql, bindValues })
          return undefined
        },
      }
    },
  })

  await store.enqueue(pendingMutation)
  await store.listPending(10)
  await store.acknowledge(['pending-1'])
  await store.recordConflict(conflict)
  await store.listConflicts()
  await store.hasAppliedOperation('remote-1')
  await store.markAppliedOperation('remote-1')
  await store.getCheckpoint()
  await store.setCheckpoint('checkpoint-b')

  assert.equal(statements.length, 9)
  for (const { sql, bindValues } of statements) {
    assert.match(sql, /owner_id/)
    assert.equal(bindValues?.includes('owner-b'), true)
  }
})
