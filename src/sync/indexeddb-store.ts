import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  PendingSyncMutation,
  SyncConflict,
  SyncStateStore,
} from './types'

const DEFAULT_SYNC_DATABASE_NAME = 'meow-starter-sync'
const CHECKPOINT_KEY = 'checkpoint'

interface SyncMetadataRecord {
  key: typeof CHECKPOINT_KEY
  value: string
}

interface SyncAppliedOperationRecord {
  operationId: string
}

interface SyncStateDatabaseSchema extends DBSchema {
  pending: {
    key: string
    value: PendingSyncMutation
    indexes: Record<string, never>
  }
  conflicts: {
    key: string
    value: SyncConflict
    indexes: Record<string, never>
  }
  applied: {
    key: string
    value: SyncAppliedOperationRecord
    indexes: Record<string, never>
  }
  metadata: {
    key: string
    value: SyncMetadataRecord
    indexes: Record<string, never>
  }
}

export interface IndexedDbSyncStateStoreOptions {
  databaseName?: string
}

function openSyncStateDatabase(databaseName: string) {
  return openDB<SyncStateDatabaseSchema>(databaseName, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('pending')) {
        database.createObjectStore('pending', { keyPath: 'operationId' })
      }
      if (!database.objectStoreNames.contains('conflicts')) {
        database.createObjectStore('conflicts', { keyPath: 'operationId' })
      }
      if (!database.objectStoreNames.contains('applied')) {
        database.createObjectStore('applied', { keyPath: 'operationId' })
      }
      if (!database.objectStoreNames.contains('metadata')) {
        database.createObjectStore('metadata', { keyPath: 'key' })
      }
    },
  })
}

async function withSyncStateDatabase<T>(
  databaseName: string,
  operation: (database: IDBPDatabase<SyncStateDatabaseSchema>) => Promise<T>,
): Promise<T> {
  const database = await openSyncStateDatabase(databaseName)
  try {
    return await operation(database)
  } finally {
    database.close()
  }
}

export function createIndexedDbSyncStateStore(
  options: IndexedDbSyncStateStoreOptions = {},
): SyncStateStore {
  const databaseName = options.databaseName ?? DEFAULT_SYNC_DATABASE_NAME

  return {
    async enqueue(change) {
      await withSyncStateDatabase(databaseName, (database) =>
        database.put('pending', change),
      )
    },
    async listPending(limit) {
      return withSyncStateDatabase(databaseName, async (database) =>
        (await database.getAll('pending')).slice(0, limit),
      )
    },
    async acknowledge(operationIds) {
      if (operationIds.length === 0) return
      await withSyncStateDatabase(databaseName, async (database) => {
        const transaction = database.transaction('pending', 'readwrite')
        await Promise.all(operationIds.map((operationId) => transaction.store.delete(operationId)))
        await transaction.done
      })
    },
    async recordConflict(conflict) {
      await withSyncStateDatabase(databaseName, (database) =>
        database.put('conflicts', conflict),
      )
    },
    async listConflicts() {
      return withSyncStateDatabase(databaseName, (database) => database.getAll('conflicts'))
    },
    async hasAppliedOperation(operationId) {
      return withSyncStateDatabase(
        databaseName,
        async (database) => (await database.get('applied', operationId)) !== undefined,
      )
    },
    async markAppliedOperation(operationId) {
      await withSyncStateDatabase(databaseName, (database) =>
        database.put('applied', { operationId }),
      )
    },
    async getCheckpoint() {
      return withSyncStateDatabase(
        databaseName,
        async (database) => (await database.get('metadata', CHECKPOINT_KEY))?.value,
      )
    },
    async setCheckpoint(checkpoint) {
      await withSyncStateDatabase(databaseName, (database) =>
        database.put('metadata', { key: CHECKPOINT_KEY, value: checkpoint }),
      )
    },
  }
}
