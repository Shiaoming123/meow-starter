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

export interface SyncTransport {
  push(
    changes: readonly SyncMutation[],
  ): Promise<{ acceptedOperationIds: string[] }>
  pull(
    checkpoint?: string,
  ): Promise<{ changes: SyncMutation[]; checkpoint?: string }>
}

export interface SyncStateStore {
  enqueue(change: SyncMutation): Promise<void>
  listPending(limit: number): Promise<SyncMutation[]>
  acknowledge(operationIds: readonly string[]): Promise<void>
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
}

export interface SyncProvider {
  syncOnce(): Promise<SyncResult>
}
