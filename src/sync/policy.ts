import type { SyncPolicy } from './types'

/** 白名单为空时拒绝所有数据，避免新集合被意外同步。 */
export function createAllowlistSyncPolicy(
  collections: readonly string[] = [],
): SyncPolicy {
  const allowed = new Set(collections)
  return {
    allows(collection) {
      return allowed.has(collection)
    },
  }
}
