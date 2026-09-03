import type {
  PendingSyncMutation,
  SyncConflict,
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

function assertAllowed(
  changes: readonly (PendingSyncMutation | SyncMutation)[],
  policy: SyncPolicy,
): void {
  const denied = changes.find((change) => !policy.allows(change.collection))
  if (denied) {
    throw new Error(`Sync collection "${denied.collection}" is not allowed by policy`)
  }
}

async function getTransportForSync(
  store: SyncStateStore,
  transport: SyncTransport,
): Promise<SyncTransport> {
  if (!transport.getAuthenticatedScope) return transport

  const scope = await transport.getAuthenticatedScope()
  if (scope.subject !== store.ownerId) {
    throw new Error('Authenticated sync subject does not match state owner')
  }
  return scope.transport
}

export function createOutboxSyncEngine(
  options: OutboxSyncEngineOptions,
): SyncProvider {
  const batchSize = options.batchSize ?? 100

  return {
    async syncOnce() {
      const transport = await getTransportForSync(options.store, options.transport)
      const pending = await options.store.listPending(batchSize)
      assertAllowed(pending, options.policy)

      let uploaded = 0
      let conflicts: SyncConflict[] = []
      if (pending.length > 0) {
        const pushed = await transport.push(pending)
        conflicts = pushed.conflicts
        assertAllowed(
          conflicts.map(({ current }) => current),
          options.policy,
        )

        for (const conflict of conflicts) {
          if (!(await options.store.hasAppliedOperation(conflict.current.operationId))) {
            await options.applyRemote(conflict.current)
            await options.store.markAppliedOperation(conflict.current.operationId)
          }
          await options.store.recordConflict(conflict)
        }

        await options.store.acknowledge(
          pushed.accepted.map(({ operationId }) => operationId),
        )
        uploaded = pushed.accepted.length
      }

      const previousCheckpoint = await options.store.getCheckpoint()
      const pulled = await transport.pull(previousCheckpoint)
      assertAllowed(pulled.changes, options.policy)

      for (const change of pulled.changes) {
        if (await options.store.hasAppliedOperation(change.operationId)) continue
        await options.applyRemote(change)
        await options.store.markAppliedOperation(change.operationId)
      }

      if (pulled.checkpoint !== undefined) {
        await options.store.setCheckpoint(pulled.checkpoint)
      }

      return {
        uploaded,
        downloaded: pulled.changes.length,
        checkpoint: pulled.checkpoint ?? previousCheckpoint,
        conflicts,
      }
    },
  }
}
