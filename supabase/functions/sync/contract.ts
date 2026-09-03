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

export interface SyncPullResult {
  changes: SyncMutation[]
  checkpoint?: string
}

export interface SyncBackend {
  push(changes: readonly PendingSyncMutation[]): Promise<SyncPushResult>
  pull(checkpoint?: string): Promise<SyncPullResult>
}

const ALLOWED_COLLECTIONS = new Set(['agent_preferences'])
const ALLOWED_AGENT_PREFERENCE_KEYS = new Set([
  'providerId',
  'modelSlots',
  'modelCapabilities',
  'fallbackPreferences',
])
const MAX_PUSH_CHANGES = 100
const DECIMAL_SEQUENCE = /^(0|[1-9]\d*)$/
const POSITIVE_DECIMAL_SEQUENCE = /^[1-9]\d*$/
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

class InvalidSyncRequest extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSensitivePreferenceKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return (
    normalized === 'key' ||
    normalized.includes('apikey') ||
    normalized.includes('credential') ||
    normalized.includes('secret') ||
    normalized.includes('token') ||
    normalized.includes('authorization') ||
    normalized.includes('cookie') ||
    normalized === 'session' ||
    normalized.includes('endpoint') ||
    normalized.includes('url') ||
    normalized.includes('path') ||
    normalized.includes('prompt') ||
    normalized.includes('message') ||
    normalized.includes('response') ||
    normalized.includes('completion') ||
    normalized.includes('usage') ||
    normalized === 'error' ||
    normalized === 'errors' ||
    normalized.includes('rawerror') ||
    normalized.includes('errorbody') ||
    normalized.includes('providererror')
  )
}

function validatePreferenceKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) validatePreferenceKeys(item)
    return
  }
  if (!isObject(value)) return

  for (const [key, child] of Object.entries(value)) {
    if (isSensitivePreferenceKey(key)) {
      throw new InvalidSyncRequest('Sensitive agent preference key')
    }
    validatePreferenceKeys(child)
  }
}

function validateAgentPreferencesPayload(payload: Record<string, unknown>): void {
  if (Object.keys(payload).some((key) => !ALLOWED_AGENT_PREFERENCE_KEYS.has(key))) {
    throw new InvalidSyncRequest('Unknown agent preference key')
  }
  validatePreferenceKeys(payload)
}

function readString(
  value: Record<string, unknown>,
  key: string,
  maximumLength: number,
): string {
  const field = value[key]
  if (typeof field !== 'string' || field.length === 0 || field.length > maximumLength) {
    throw new InvalidSyncRequest(`Invalid ${key}`)
  }
  return field
}

function readPendingMutation(value: unknown): PendingSyncMutation {
  if (!isObject(value)) throw new InvalidSyncRequest('Invalid change')

  const operationId = readString(value, 'operationId', 128)
  const collection = readString(value, 'collection', 64)
  if (!ALLOWED_COLLECTIONS.has(collection)) {
    throw new InvalidSyncRequest('Collection is not allowed')
  }
  const recordId = readString(value, 'recordId', 256)
  const deviceId = readString(value, 'deviceId', 256)
  const occurredAt = readString(value, 'occurredAt', 64)
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new InvalidSyncRequest('Invalid occurredAt')
  }
  if (value.kind !== 'upsert' && value.kind !== 'delete') {
    throw new InvalidSyncRequest('Invalid kind')
  }
  if (value.kind === 'upsert' && !isObject(value.payload)) {
    throw new InvalidSyncRequest('Upserts require an object payload')
  }
  if (value.kind === 'delete' && value.payload !== undefined) {
    throw new InvalidSyncRequest('Deletes must not contain a payload')
  }
  if (
    value.baseRevision !== null &&
    (typeof value.baseRevision !== 'string' || !POSITIVE_DECIMAL_SEQUENCE.test(value.baseRevision))
  ) {
    throw new InvalidSyncRequest('Invalid baseRevision')
  }
  const payload = isObject(value.payload) ? value.payload : undefined
  if (payload !== undefined) validateAgentPreferencesPayload(payload)

  return {
    operationId,
    collection,
    recordId,
    kind: value.kind,
    ...(payload === undefined ? {} : { payload }),
    baseRevision: value.baseRevision,
    deviceId,
    occurredAt,
  }
}

function readSyncMutation(value: unknown): SyncMutation {
  if (!isObject(value)) throw new Error('Invalid backend mutation')
  const pending = readPendingMutation({ ...value, baseRevision: null })
  if (typeof value.revision !== 'string' || !POSITIVE_DECIMAL_SEQUENCE.test(value.revision)) {
    throw new Error('Invalid backend revision')
  }
  return {
    operationId: pending.operationId,
    collection: pending.collection,
    recordId: pending.recordId,
    kind: pending.kind,
    ...(pending.payload === undefined ? {} : { payload: pending.payload }),
    revision: value.revision,
    deviceId: pending.deviceId,
    occurredAt: pending.occurredAt,
  }
}

export function parsePushRequest(value: unknown): PendingSyncMutation[] {
  if (!isObject(value) || !Array.isArray(value.changes)) {
    throw new InvalidSyncRequest('Expected a changes array')
  }
  if (value.changes.length > MAX_PUSH_CHANGES) {
    throw new InvalidSyncRequest(`Push is limited to ${MAX_PUSH_CHANGES} changes`)
  }
  return value.changes.map(readPendingMutation)
}

export function parsePushResult(value: unknown): SyncPushResult {
  if (!isObject(value) || !Array.isArray(value.accepted) || !Array.isArray(value.conflicts)) {
    throw new Error('Invalid backend push result')
  }
  return {
    accepted: value.accepted.map(readSyncMutation),
    conflicts: value.conflicts.map((conflict) => {
      if (!isObject(conflict) || typeof conflict.operationId !== 'string') {
        throw new Error('Invalid backend conflict')
      }
      return {
        operationId: conflict.operationId,
        current: readSyncMutation(conflict.current),
      }
    }),
  }
}

export function parsePullResult(value: unknown): SyncPullResult {
  if (!isObject(value) || !Array.isArray(value.changes)) {
    throw new Error('Invalid backend pull result')
  }
  if (
    value.checkpoint !== undefined &&
    (typeof value.checkpoint !== 'string' || !DECIMAL_SEQUENCE.test(value.checkpoint))
  ) {
    throw new Error('Invalid backend checkpoint')
  }
  return {
    changes: value.changes.map(readSyncMutation),
    ...(value.checkpoint === undefined ? {} : { checkpoint: value.checkpoint }),
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS },
  })
}

export function createSyncRequestHandler(
  backend: SyncBackend,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const route = url.pathname.replace(/\/+$/, '').split('/').at(-1)

    try {
      if (route === 'push') {
        if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
        const changes = parsePushRequest(await request.json())
        return jsonResponse(parsePushResult(await backend.push(changes)))
      }

      if (route === 'pull') {
        if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
        const checkpoint = url.searchParams.get('checkpoint') ?? undefined
        if (checkpoint !== undefined && !DECIMAL_SEQUENCE.test(checkpoint)) {
          throw new InvalidSyncRequest('Invalid checkpoint')
        }
        return jsonResponse(parsePullResult(await backend.pull(checkpoint)))
      }

      return jsonResponse({ error: 'Not found' }, 404)
    } catch (error) {
      if (error instanceof InvalidSyncRequest || error instanceof SyntaxError) {
        return jsonResponse({ error: 'Invalid sync request' }, 400)
      }
      return jsonResponse({ error: 'Sync backend unavailable' }, 500)
    }
  }
}
