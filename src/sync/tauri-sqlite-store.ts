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
  loadDatabase: LoadSqlDatabase = loadTauriDatabase,
): SyncStateStore {
  return {
    async enqueue(change) {
      const database = await loadDatabase()
      await database.execute(
        `INSERT INTO sync_outbox (operation_id, mutation) VALUES ($1, $2)
         ON CONFLICT(operation_id) DO UPDATE SET mutation = excluded.mutation`,
        [change.operationId, serialize(change)],
      )
    },
    async listPending(limit) {
      const database = await loadDatabase()
      const rows = await database.select<Array<{ mutation: string }>>(
        'SELECT mutation FROM sync_outbox ORDER BY rowid ASC LIMIT $1',
        [limit],
      )
      return rows.map(({ mutation }) => parsePendingMutation(mutation))
    },
    async acknowledge(operationIds) {
      const database = await loadDatabase()
      for (const operationId of operationIds) {
        await database.execute('DELETE FROM sync_outbox WHERE operation_id = $1', [
          operationId,
        ])
      }
    },
    async recordConflict(conflict) {
      const database = await loadDatabase()
      await database.execute(
        `INSERT INTO sync_conflicts (operation_id, conflict) VALUES ($1, $2)
         ON CONFLICT(operation_id) DO UPDATE SET conflict = excluded.conflict`,
        [conflict.operationId, serialize(conflict)],
      )
    },
    async listConflicts() {
      const database = await loadDatabase()
      const rows = await database.select<Array<{ conflict: string }>>(
        'SELECT conflict FROM sync_conflicts ORDER BY rowid ASC',
      )
      return rows.map(({ conflict }) => parseConflict(conflict))
    },
    async hasAppliedOperation(operationId) {
      const database = await loadDatabase()
      const rows = await database.select<Array<{ operation_id: string }>>(
        'SELECT operation_id FROM sync_applied_operations WHERE operation_id = $1 LIMIT 1',
        [operationId],
      )
      return rows.length > 0
    },
    async markAppliedOperation(operationId) {
      const database = await loadDatabase()
      await database.execute(
        'INSERT OR IGNORE INTO sync_applied_operations (operation_id) VALUES ($1)',
        [operationId],
      )
    },
    async getCheckpoint() {
      const database = await loadDatabase()
      const rows = await database.select<Array<{ value: string }>>(
        'SELECT value FROM sync_metadata WHERE key = $1 LIMIT 1',
        [CHECKPOINT_KEY],
      )
      return rows[0]?.value
    },
    async setCheckpoint(checkpoint) {
      const database = await loadDatabase()
      await database.execute(
        `INSERT INTO sync_metadata (key, value) VALUES ($1, $2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [CHECKPOINT_KEY, checkpoint],
      )
    },
  }
}
