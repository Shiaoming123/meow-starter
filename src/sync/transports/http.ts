import type { SyncMutation, SyncTransport } from '../types'

export interface HttpSyncTransportOptions {
  baseUrl: string
  getAccessToken?: () => Promise<string | undefined>
  fetch?: typeof globalThis.fetch
}

function normalizeBaseUrl(value: string): URL {
  const url = new URL(value.endsWith('/') ? value : `${value}/`)
  if (url.username || url.password) {
    throw new Error('Sync HTTP base URL must not contain credentials')
  }

  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('Sync HTTP transport requires HTTPS outside loopback')
  }
  return url
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSyncMutation(value: unknown): value is SyncMutation {
  if (!isObject(value)) return false
  return (
    typeof value.operationId === 'string' &&
    typeof value.collection === 'string' &&
    typeof value.recordId === 'string' &&
    (value.kind === 'upsert' || value.kind === 'delete') &&
    (value.payload === undefined || isObject(value.payload)) &&
    typeof value.revision === 'string' &&
    typeof value.deviceId === 'string' &&
    typeof value.occurredAt === 'string'
  )
}

export function createHttpSyncTransport(
  options: HttpSyncTransportOptions,
): SyncTransport {
  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const fetchRequest = options.fetch ?? globalThis.fetch

  async function request(path: string, init: RequestInit): Promise<unknown> {
    const accessToken = await options.getAccessToken?.()
    const headers = new Headers({ 'Content-Type': 'application/json' })
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

    const response = await fetchRequest(new URL(path, baseUrl), {
      ...init,
      headers,
    })
    if (!response.ok) {
      throw new Error(`Sync HTTP ${response.status}`)
    }

    try {
      return await response.json()
    } catch {
      throw new Error('Invalid JSON sync response')
    }
  }

  return {
    async push(changes) {
      const value = await request('push', {
        method: 'POST',
        body: JSON.stringify({ changes }),
      })
      if (
        !isObject(value) ||
        !Array.isArray(value.acceptedOperationIds) ||
        !value.acceptedOperationIds.every((item) => typeof item === 'string')
      ) {
        throw new Error('Invalid sync push response')
      }
      return { acceptedOperationIds: value.acceptedOperationIds }
    },
    async pull(checkpoint) {
      const url = new URL('pull', baseUrl)
      if (checkpoint !== undefined) url.searchParams.set('checkpoint', checkpoint)
      const value = await request(url.href, { method: 'GET' })
      if (
        !isObject(value) ||
        !Array.isArray(value.changes) ||
        !value.changes.every(isSyncMutation) ||
        (value.checkpoint !== undefined && typeof value.checkpoint !== 'string')
      ) {
        throw new Error('Invalid sync pull response')
      }
      return {
        changes: value.changes,
        checkpoint: value.checkpoint as string | undefined,
      }
    },
  }
}
