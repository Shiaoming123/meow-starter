import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  PendingSyncMutation,
  SyncConflict,
  SyncStateStore,
} from './types'

const DEFAULT_SYNC_DATABASE_NAME = 'meow-starter-sync'
const CHECKPOINT_KEY = 'checkpoint'
const PENDING_SEQUENCE_KEY = 'pending-sequence'

type SyncMetadataKey = typeof CHECKPOINT_KEY | typeof PENDING_SEQUENCE_KEY

interface SyncMetadataRecord {
  key: SyncMetadataKey
  value: string
}

interface SyncAppliedOperationRecord {
  operationId: string
}

interface PendingSyncMutationRecord extends PendingSyncMutation {
  enqueueSequence: number
}

interface SyncStateDatabaseSchema extends DBSchema {
  pending: {
    key: string
    value: PendingSyncMutationRecord
    indexes: { 'by-enqueue-sequence': number }
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
  return openDB<SyncStateDatabaseSchema>(databaseName, 2, {
    upgrade(database, _oldVersion, _newVersion, transaction) {
      const pending = database.objectStoreNames.contains('pending')
        ? transaction.objectStore('pending')
        : database.createObjectStore('pending', { keyPath: 'operationId' })
      if (!pending.indexNames.contains('by-enqueue-sequence')) {
        pending.createIndex('by-enqueue-sequence', 'enqueueSequence')
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

function nextSequence(value: string | undefined, minimum: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : minimum
}

function toPendingMutation({
  enqueueSequence: _enqueueSequence,
  ...mutation
}: PendingSyncMutationRecord): PendingSyncMutation {
  return mutation
}

async function ensurePendingSequences(
  database: IDBPDatabase<SyncStateDatabaseSchema>,
): Promise<void> {
  const transaction = database.transaction(['pending', 'metadata'], 'readwrite')
  const pending = transaction.objectStore('pending')
  const metadata = transaction.objectStore('metadata')
  const records = await pending.getAll()
  const assignedSequences = records
    .map(({ enqueueSequence }) => enqueueSequence)
    .filter((sequence) => Number.isSafeInteger(sequence) && sequence > 0)
  let sequence = nextSequence(
    (await metadata.get(PENDING_SEQUENCE_KEY))?.value,
    Math.max(1, ...assignedSequences.map((value) => value + 1)),
  )

  for (const record of records) {
    if (Number.isSafeInteger(record.enqueueSequence) && record.enqueueSequence > 0) continue
    await pending.put({ ...record, enqueueSequence: sequence++ })
  }

  if (sequence !== nextSequence((await metadata.get(PENDING_SEQUENCE_KEY))?.value, 1)) {
    await metadata.put({ key: PENDING_SEQUENCE_KEY, value: String(sequence) })
  }
  await transaction.done
}

async function withSyncStateDatabase<T>(
  databaseName: string,
  operation: (database: IDBPDatabase<SyncStateDatabaseSchema>) => Promise<T>,
): Promise<T> {
  const database = await openSyncStateDatabase(databaseName)
  try {
    await ensurePendingSequences(database)
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
      await withSyncStateDatabase(databaseName, async (database) => {
        const transaction = database.transaction(['pending', 'metadata'], 'readwrite')
        const pending = transaction.objectStore('pending')
        const current = await pending.get(change.operationId)
        if (current) {
          await pending.put({ ...change, enqueueSequence: current.enqueueSequence })
        } else {
          const metadata = transaction.objectStore('metadata')
          const sequence = nextSequence(
            (await metadata.get(PENDING_SEQUENCE_KEY))?.value,
            1,
          )
          await pending.put({ ...change, enqueueSequence: sequence })
          await metadata.put({ key: PENDING_SEQUENCE_KEY, value: String(sequence + 1) })
        }
        await transaction.done
      })
    },
    async listPending(limit) {
      return withSyncStateDatabase(databaseName, async (database) =>
        (await database.getAllFromIndex('pending', 'by-enqueue-sequence'))
          .slice(0, limit)
          .map(toPendingMutation),
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
