import type {
  PendingSyncMutation,
  SyncConflict,
  SyncStateStore,
} from './types'

const DB_URL = 'sqlite:app.db'
const CHECKPOINT_KEY = 'checkpoint'

interface SqlDatabasePort {
  select<T>(sql: string, bindValues?: unknown[]): Promise<T>
  execute(sql: string, bindValues?: unknown[]): Promise<unknown>
}

type LoadSqlDatabase = () => Promise<SqlDatabasePort>

export interface TauriSqliteSyncStateStoreOptions {
  ownerId: string
  /** Test seam; production callers use the lazily loaded Tauri SQL database. */
  loadDatabase?: LoadSqlDatabase
}

let connection: Promise<SqlDatabasePort> | undefined

async function loadTauriDatabase(): Promise<SqlDatabasePort> {
  if (!connection) {
    connection = import('@tauri-apps/plugin-sql').then(({ default: Database }) =>
      Database.load(DB_URL),
    )
  }
  return connection
}

function serialize(value: PendingSyncMutation | SyncConflict): string {
  return JSON.stringify(value)
}

function parsePendingMutation(value: string): PendingSyncMutation {
  return JSON.parse(value) as PendingSyncMutation
}

function parseConflict(value: string): SyncConflict {
  return JSON.parse(value) as SyncConflict
}

export function createTauriSqliteSyncStateStore(
  options: TauriSqliteSyncStateStoreOptions,
): SyncStateStore {
  if (!options.ownerId.trim()) throw new Error('Sync state owner ID is required')
  const { ownerId, loadDatabase = loadTauriDatabase } = options

  return {
    ownerId,
    async enqueue(change) {
      const database = await loadDatabase()
      await database.execute(
        `INSERT INTO sync_outbox (owner_id, operation_id, mutation) VALUES ($1, $2, $3)
         ON CONFLICT(owner_id, operation_id) DO UPDATE SET mutation = excluded.mutation`,
        [ownerId, change.operationId, serialize(change)],
      )
    },
    async listPending(limit) {
      const database = await loadDatabase()
      const rows = await database.select<Array<{ mutation: string }>>(
        'SELECT mutation FROM sync_outbox WHERE owner_id = $1 ORDER BY rowid ASC LIMIT $2',
        [ownerId, limit],
      )
      return rows.map(({ mutation }) => parsePendingMutation(mutation))
    },
    async acknowledge(operationIds) {
      const database = await loadDatabase()
      for (const operationId of operationIds) {
        await database.execute(
          'DELETE FROM sync_outbox WHERE owner_id = $1 AND operation_id = $2',
          [ownerId, operationId],
        )
      }
    },
    async recordConflict(conflict) {
      const database = await loadDatabase()
      await database.execute(
        `INSERT INTO sync_conflicts (owner_id, operation_id, conflict) VALUES ($1, $2, $3)
         ON CONFLICT(owner_id, operation_id) DO UPDATE SET conflict = excluded.conflict`,
        [ownerId, conflict.operationId, serialize(conflict)],
      )
    },
    async listConflicts() {
      const database = await loadDatabase()
      const rows = await database.select<Array<{ conflict: string }>>(
        'SELECT conflict FROM sync_conflicts WHERE owner_id = $1 ORDER BY rowid ASC',
        [ownerId],
      )
      return rows.map(({ conflict }) => parseConflict(conflict))
    },
    async hasAppliedOperation(operationId) {
      const database = await loadDatabase()
      const rows = await database.select<Array<{ operation_id: string }>>(
        `SELECT operation_id FROM sync_applied_operations
         WHERE owner_id = $1 AND operation_id = $2 LIMIT 1`,
        [ownerId, operationId],
      )
      return rows.length > 0
    },
    async markAppliedOperation(operationId) {
      const database = await loadDatabase()
      await database.execute(
        `INSERT OR IGNORE INTO sync_applied_operations (owner_id, operation_id)
         VALUES ($1, $2)`,
        [ownerId, operationId],
      )
    },
    async getCheckpoint() {
      const database = await loadDatabase()
      const rows = await database.select<Array<{ value: string }>>(
        'SELECT value FROM sync_metadata WHERE owner_id = $1 AND key = $2 LIMIT 1',
        [ownerId, CHECKPOINT_KEY],
      )
      return rows[0]?.value
    },
    async setCheckpoint(checkpoint) {
      const database = await loadDatabase()
      await database.execute(
        `INSERT INTO sync_metadata (owner_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT(owner_id, key) DO UPDATE SET value = excluded.value`,
        [ownerId, CHECKPOINT_KEY, checkpoint],
      )
    },
  }
}
