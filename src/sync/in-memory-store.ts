import type {
  PendingSyncMutation,
  SyncConflict,
  SyncMutation,
  SyncStateStore,
} from './types'

function copyMutation(mutation: SyncMutation): SyncMutation {
  return {
    ...mutation,
    payload: mutation.payload ? { ...mutation.payload } : undefined,
  }
}

function copyPendingMutation(mutation: PendingSyncMutation): PendingSyncMutation {
  return {
    ...mutation,
    payload: mutation.payload ? { ...mutation.payload } : undefined,
  }
}

function copyConflict(conflict: SyncConflict): SyncConflict {
  return {
    ...conflict,
    current: copyMutation(conflict.current),
  }
}

export function createInMemorySyncStateStore(
  initial: readonly PendingSyncMutation[] = [],
  initialCheckpoint?: string,
): SyncStateStore {
  const pending = new Map(
    initial.map((mutation) => [mutation.operationId, copyPendingMutation(mutation)]),
  )
  const conflicts: SyncConflict[] = []
  const appliedOperationIds = new Set<string>()
  let checkpoint = initialCheckpoint

  return {
    async enqueue(change) {
      pending.set(change.operationId, copyPendingMutation(change))
    },
    async listPending(limit) {
      return [...pending.values()].slice(0, limit).map(copyPendingMutation)
    },
    async acknowledge(operationIds) {
      for (const operationId of operationIds) pending.delete(operationId)
    },
    async recordConflict(conflict) {
      conflicts.push(copyConflict(conflict))
    },
    async listConflicts() {
      return conflicts.map(copyConflict)
    },
    async hasAppliedOperation(operationId) {
      return appliedOperationIds.has(operationId)
    },
    async markAppliedOperation(operationId) {
      appliedOperationIds.add(operationId)
    },
    async getCheckpoint() {
      return checkpoint
    },
    async setCheckpoint(nextCheckpoint) {
      checkpoint = nextCheckpoint
    },
  }
}
