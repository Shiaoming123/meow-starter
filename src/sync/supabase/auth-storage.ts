/**
 * Storage intentionally comes from the host application. Web callers pass
 * browser localStorage; desktop callers must pass a secure storage adapter.
 */
export interface SupabaseAuthStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export function createBrowserAuthStorage(
  storage: Storage | undefined = globalThis.localStorage,
): SupabaseAuthStorage {
  if (!storage) {
    throw new Error('Browser local storage is unavailable')
  }
  return storage
}
