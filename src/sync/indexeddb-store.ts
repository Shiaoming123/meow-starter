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
  ownerId: string
  key: SyncMetadataKey
  value: string
}

interface SyncAppliedOperationRecord {
  ownerId: string
  operationId: string
}

interface PendingSyncMutationRecord extends PendingSyncMutation {
  ownerId: string
  enqueueSequence: number
}

interface SyncConflictRecord extends SyncConflict {
  ownerId: string
}

interface SyncStateDatabaseSchema extends DBSchema {
  pendingByOwner: {
    key: [string, string]
    value: PendingSyncMutationRecord
    indexes: {
      'by-owner': string
      'by-owner-enqueue-sequence': [string, number]
    }
  }
  conflictsByOwner: {
    key: [string, string]
    value: SyncConflictRecord
    indexes: { 'by-owner': string }
  }
  appliedByOwner: {
    key: [string, string]
    value: SyncAppliedOperationRecord
    indexes: { 'by-owner': string }
  }
  metadataByOwner: {
    key: [string, SyncMetadataKey]
    value: SyncMetadataRecord
    indexes: { 'by-owner': string }
  }
}

export interface IndexedDbSyncStateStoreOptions {
  ownerId: string
  databaseName?: string
}

function openSyncStateDatabase(databaseName: string) {
  return openDB<SyncStateDatabaseSchema>(databaseName, 3, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('pendingByOwner')) {
        const pending = database.createObjectStore('pendingByOwner', {
          keyPath: ['ownerId', 'operationId'],
        })
        pending.createIndex('by-owner', 'ownerId')
        pending.createIndex('by-owner-enqueue-sequence', [
          'ownerId',
          'enqueueSequence',
        ])
      }
      if (!database.objectStoreNames.contains('conflictsByOwner')) {
        const conflicts = database.createObjectStore('conflictsByOwner', {
          keyPath: ['ownerId', 'operationId'],
        })
        conflicts.createIndex('by-owner', 'ownerId')
      }
      if (!database.objectStoreNames.contains('appliedByOwner')) {
        const applied = database.createObjectStore('appliedByOwner', {
          keyPath: ['ownerId', 'operationId'],
        })
        applied.createIndex('by-owner', 'ownerId')
      }
      if (!database.objectStoreNames.contains('metadataByOwner')) {
        const metadata = database.createObjectStore('metadataByOwner', {
          keyPath: ['ownerId', 'key'],
        })
        metadata.createIndex('by-owner', 'ownerId')
      }
    },
  })
}

function nextSequence(value: string | undefined, minimum: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : minimum
}

function toPendingMutation({
  ownerId: _ownerId,
  enqueueSequence: _enqueueSequence,
  ...mutation
}: PendingSyncMutationRecord): PendingSyncMutation {
  return mutation
}

function toConflict({ ownerId: _ownerId, ...conflict }: SyncConflictRecord): SyncConflict {
  return conflict
}

async function ensurePendingSequences(
  database: IDBPDatabase<SyncStateDatabaseSchema>,
  ownerId: string,
): Promise<void> {
  const transaction = database.transaction(
    ['pendingByOwner', 'metadataByOwner'],
    'readwrite',
  )
  const pending = transaction.objectStore('pendingByOwner')
  const metadata = transaction.objectStore('metadataByOwner')
  const records = await pending.index('by-owner').getAll(ownerId)
  const assignedSequences = records
    .map(({ enqueueSequence }) => enqueueSequence)
    .filter((sequence) => Number.isSafeInteger(sequence) && sequence > 0)
  let sequence = nextSequence(
    (await metadata.get([ownerId, PENDING_SEQUENCE_KEY]))?.value,
    Math.max(1, ...assignedSequences.map((value) => value + 1)),
  )

  for (const record of records) {
    if (Number.isSafeInteger(record.enqueueSequence) && record.enqueueSequence > 0) continue
    await pending.put({ ...record, ownerId, enqueueSequence: sequence++ })
  }

  if (
    sequence !==
    nextSequence((await metadata.get([ownerId, PENDING_SEQUENCE_KEY]))?.value, 1)
  ) {
    await metadata.put({ ownerId, key: PENDING_SEQUENCE_KEY, value: String(sequence) })
  }
  await transaction.done
}

async function withSyncStateDatabase<T>(
  databaseName: string,
  ownerId: string,
  operation: (database: IDBPDatabase<SyncStateDatabaseSchema>) => Promise<T>,
): Promise<T> {
  const database = await openSyncStateDatabase(databaseName)
  try {
    await ensurePendingSequences(database, ownerId)
    return await operation(database)
  } finally {
    database.close()
  }
}

export function createIndexedDbSyncStateStore(
  options: IndexedDbSyncStateStoreOptions,
): SyncStateStore {
  if (!options.ownerId.trim()) throw new Error('Sync state owner ID is required')
  const databaseName = options.databaseName ?? DEFAULT_SYNC_DATABASE_NAME
  const { ownerId } = options

  return {
    ownerId,
    async enqueue(change) {
      await withSyncStateDatabase(databaseName, ownerId, async (database) => {
        const transaction = database.transaction(
          ['pendingByOwner', 'metadataByOwner'],
          'readwrite',
        )
        const pending = transaction.objectStore('pendingByOwner')
        const current = await pending.get([ownerId, change.operationId])
        if (current) {
          await pending.put({
            ...change,
            ownerId,
            enqueueSequence: current.enqueueSequence,
          })
        } else {
          const metadata = transaction.objectStore('metadataByOwner')
          const sequence = nextSequence(
            (await metadata.get([ownerId, PENDING_SEQUENCE_KEY]))?.value,
            1,
          )
          await pending.put({ ...change, ownerId, enqueueSequence: sequence })
          await metadata.put({
            ownerId,
            key: PENDING_SEQUENCE_KEY,
            value: String(sequence + 1),
          })
        }
        await transaction.done
      })
    },
    async listPending(limit) {
      return withSyncStateDatabase(databaseName, ownerId, async (database) =>
        (
          await database.getAllFromIndex(
            'pendingByOwner',
            'by-owner-enqueue-sequence',
            IDBKeyRange.bound(
              [ownerId, 0],
              [ownerId, Number.MAX_SAFE_INTEGER],
            ),
            limit,
          )
        ).map(toPendingMutation),
      )
    },
    async acknowledge(operationIds) {
      if (operationIds.length === 0) return
      await withSyncStateDatabase(databaseName, ownerId, async (database) => {
        const transaction = database.transaction('pendingByOwner', 'readwrite')
        await Promise.all(
          operationIds.map((operationId) =>
            transaction.store.delete([ownerId, operationId]),
          ),
        )
        await transaction.done
      })
    },
    async recordConflict(conflict) {
      await withSyncStateDatabase(databaseName, ownerId, (database) =>
        database.put('conflictsByOwner', { ...conflict, ownerId }),
      )
    },
    async listConflicts() {
      return withSyncStateDatabase(databaseName, ownerId, async (database) =>
        (await database.getAllFromIndex('conflictsByOwner', 'by-owner', ownerId)).map(
          toConflict,
        ),
      )
    },
    async hasAppliedOperation(operationId) {
      return withSyncStateDatabase(
        databaseName,
        ownerId,
        async (database) =>
          (await database.get('appliedByOwner', [ownerId, operationId])) !== undefined,
      )
    },
    async markAppliedOperation(operationId) {
      await withSyncStateDatabase(databaseName, ownerId, (database) =>
        database.put('appliedByOwner', { ownerId, operationId }),
      )
    },
    async getCheckpoint() {
      return withSyncStateDatabase(
        databaseName,
        ownerId,
        async (database) =>
          (await database.get('metadataByOwner', [ownerId, CHECKPOINT_KEY]))?.value,
      )
    },
    async setCheckpoint(checkpoint) {
      await withSyncStateDatabase(databaseName, ownerId, (database) =>
        database.put('metadataByOwner', {
          ownerId,
          key: CHECKPOINT_KEY,
          value: checkpoint,
        }),
      )
    },
  }
}
