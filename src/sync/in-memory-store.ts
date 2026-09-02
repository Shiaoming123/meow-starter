import type { SyncMutation, SyncStateStore } from './types'

function copyMutation(mutation: SyncMutation): SyncMutation {
  return {
    ...mutation,
    payload: mutation.payload ? { ...mutation.payload } : undefined,
  }
}

export function createInMemorySyncStateStore(
  initial: readonly SyncMutation[] = [],
  initialCheckpoint?: string,
): SyncStateStore {
  const pending = new Map(
    initial.map((mutation) => [mutation.operationId, copyMutation(mutation)]),
  )
  let checkpoint = initialCheckpoint

  return {
    async enqueue(change) {
      pending.set(change.operationId, copyMutation(change))
    },
    async listPending(limit) {
      return [...pending.values()].slice(0, limit).map(copyMutation)
    },
    async acknowledge(operationIds) {
      for (const operationId of operationIds) pending.delete(operationId)
    },
    async getCheckpoint() {
      return checkpoint
    },
    async setCheckpoint(nextCheckpoint) {
      checkpoint = nextCheckpoint
    },
  }
}
