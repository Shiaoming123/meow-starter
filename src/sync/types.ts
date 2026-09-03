export interface SyncMutation {
  operationId: string
  collection: string
  recordId: string
  kind: 'upsert' | 'delete'
  payload?: Record<string, unknown>
  revision: string
  deviceId: string
  occurredAt: string
}

export interface PendingSyncMutation extends Omit<SyncMutation, 'revision'> {
  baseRevision: string | null
}

export interface SyncConflict {
  operationId: string
  current: SyncMutation
}

export interface SyncPushResult {
  accepted: SyncMutation[]
  conflicts: SyncConflict[]
}

export interface AuthenticatedSyncScope {
  readonly subject: string
  readonly transport: SyncTransport
}

export interface SyncTransport {
  getAuthenticatedScope?(): Promise<AuthenticatedSyncScope>
  push(
    changes: readonly PendingSyncMutation[],
  ): Promise<SyncPushResult>
  pull(
    checkpoint?: string,
  ): Promise<{ changes: SyncMutation[]; checkpoint?: string }>
}

export interface SyncStateStoreScope {
  readonly ownerId: string
}

export interface SyncStateStore extends SyncStateStoreScope {
  enqueue(change: PendingSyncMutation): Promise<void>
  listPending(limit: number): Promise<PendingSyncMutation[]>
  acknowledge(operationIds: readonly string[]): Promise<void>
  recordConflict(conflict: SyncConflict): Promise<void>
  listConflicts(): Promise<SyncConflict[]>
  hasAppliedOperation(operationId: string): Promise<boolean>
  markAppliedOperation(operationId: string): Promise<void>
  getCheckpoint(): Promise<string | undefined>
  setCheckpoint(checkpoint: string): Promise<void>
}

export interface SyncPolicy {
  allows(collection: string): boolean
}

export interface SyncResult {
  uploaded: number
  downloaded: number
  checkpoint?: string
  conflicts: SyncConflict[]
}

export interface SyncProvider {
  syncOnce(): Promise<SyncResult>
}
