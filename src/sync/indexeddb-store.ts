import { openDB, type DBSchema } from 'idb'
import type { SyncMutation, SyncStateStore } from './types'

export const DEFAULT_SYNC_DATABASE_NAME = 'meow-starter-sync'

interface SyncDatabaseSchema extends DBSchema {
  pending: {
    key: string
    value: SyncMutation
  }
  metadata: {
    key: 'checkpoint'
    value: { value: string }
  }
}

export interface IndexedDbSyncStateStoreOptions {
  databaseName?: string
}

function copyMutation(mutation: SyncMutation): SyncMutation {
  return {
    ...mutation,
    payload: mutation.payload ? { ...mutation.payload } : undefined,
  }
}

export function createIndexedDbSyncStateStore(
  { databaseName = DEFAULT_SYNC_DATABASE_NAME }: IndexedDbSyncStateStoreOptions = {},
): SyncStateStore {
  const database = openDB<SyncDatabaseSchema>(databaseName, 1, {
    upgrade(db) {
      db.createObjectStore('pending')
      db.createObjectStore('metadata')
    },
  })

  return {
    async enqueue(change) {
      await (await database).put('pending', copyMutation(change), change.operationId)
    },
    async listPending(limit) {
      return (await (await database).getAll('pending')).slice(0, limit).map(copyMutation)
    },
    async acknowledge(operationIds) {
      const transaction = (await database).transaction('pending', 'readwrite')
      await Promise.all(operationIds.map((operationId) => transaction.store.delete(operationId)))
      await transaction.done
    },
    async getCheckpoint() {
      return (await (await database).get('metadata', 'checkpoint'))?.value
    },
    async setCheckpoint(checkpoint) {
      await (await database).put('metadata', { value: checkpoint }, 'checkpoint')
    },
  }
}
