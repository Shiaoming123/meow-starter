import type {
  SyncMutation,
  SyncPolicy,
  SyncProvider,
  SyncStateStore,
  SyncTransport,
} from './types'

export interface OutboxSyncEngineOptions {
  store: SyncStateStore
  transport: SyncTransport
  policy: SyncPolicy
  applyRemote(change: SyncMutation): Promise<void>
  batchSize?: number
}

function assertAllowed(changes: readonly SyncMutation[], policy: SyncPolicy): void {
  const denied = changes.find((change) => !policy.allows(change.collection))
  if (denied) {
    throw new Error(`Sync collection "${denied.collection}" is not allowed by policy`)
  }
}

export function createOutboxSyncEngine(
  options: OutboxSyncEngineOptions,
): SyncProvider {
  const batchSize = options.batchSize ?? 100

  return {
    async syncOnce() {
      const pending = await options.store.listPending(batchSize)
      assertAllowed(pending, options.policy)

      let uploaded = 0
      if (pending.length > 0) {
        const pushed = await options.transport.push(pending)
        const submitted = new Set(pending.map((change) => change.operationId))
        const acceptedOperationIds = [
          ...new Set(pushed.acceptedOperationIds.filter((operationId) => submitted.has(operationId))),
        ]
        await options.store.acknowledge(acceptedOperationIds)
        uploaded = acceptedOperationIds.length
      }

      const previousCheckpoint = await options.store.getCheckpoint()
      const pulled = await options.transport.pull(previousCheckpoint)
      assertAllowed(pulled.changes, options.policy)

      for (const change of pulled.changes) {
        await options.applyRemote(change)
      }

      if (pulled.checkpoint !== undefined) {
        await options.store.setCheckpoint(pulled.checkpoint)
      }

      return {
        uploaded,
        downloaded: pulled.changes.length,
        checkpoint: pulled.checkpoint ?? previousCheckpoint,
      }
    },
  }
}
