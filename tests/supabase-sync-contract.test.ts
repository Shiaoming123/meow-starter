import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSyncRequestHandler,
  type PendingSyncMutation,
  type SyncBackend,
  type SyncMutation,
  type SyncPushResult,
} from '../supabase/functions/sync/contract.ts'

const pendingMutation = (
  overrides: Partial<PendingSyncMutation> = {},
): PendingSyncMutation => ({
  operationId: 'operation-1',
  collection: 'agent_preferences',
  recordId: 'profile-1',
  kind: 'upsert',
  payload: {
    providerId: 'openai',
    modelSlots: { default: 'gpt-5.6', fast: null, advanced: null },
    modelCapabilities: { 'gpt-5.6': { toolCalling: true, vision: false } },
    fallbackPreferences: { enabled: false, order: null },
  },
  baseRevision: null,
  deviceId: 'device-a',
  occurredAt: '2026-09-03T00:00:00.000Z',
  ...overrides,
})

function createMemoryBackend() {
  const records = new Map<string, SyncMutation>()
  const operations = new Map<string, { accepted?: SyncMutation; conflict?: SyncMutation }>()
  const changeLog: SyncMutation[] = []
  let revision = 0

  const backend: SyncBackend = {
    async push(changes): Promise<SyncPushResult> {
      const result: SyncPushResult = { accepted: [], conflicts: [] }

      for (const change of changes) {
        const duplicate = operations.get(change.operationId)
        if (duplicate?.accepted) {
          result.accepted.push(duplicate.accepted)
          continue
        }
        if (duplicate?.conflict) {
          result.conflicts.push({
            operationId: change.operationId,
            current: duplicate.conflict,
          })
          continue
        }

        const current = records.get(`${change.collection}:${change.recordId}`)
        if ((current?.revision ?? null) !== change.baseRevision) {
          assert.ok(current, 'a stale write must have a canonical current record')
          operations.set(change.operationId, { conflict: current })
          result.conflicts.push({ operationId: change.operationId, current })
          continue
        }

        const accepted: SyncMutation = {
          operationId: change.operationId,
          collection: change.collection,
          recordId: change.recordId,
          kind: change.kind,
          ...(change.payload === undefined ? {} : { payload: change.payload }),
          revision: String(++revision),
          deviceId: change.deviceId,
          occurredAt: change.occurredAt,
        }
        records.set(`${change.collection}:${change.recordId}`, accepted)
        operations.set(change.operationId, { accepted })
        changeLog.push(accepted)
        result.accepted.push(accepted)
      }

      return result
    },
    async pull(checkpoint) {
      const after = Number(checkpoint ?? 0)
      const changes = changeLog.filter((change) => Number(change.revision) > after)
      return {
        changes,
        checkpoint: changes.at(-1)?.revision ?? checkpoint,
      }
    },
  }

  return { backend, changeLog }
}

async function postPush(
  handler: (request: Request) => Promise<Response>,
  changes: PendingSyncMutation[],
) {
  const response = await handler(
    new Request('http://localhost/functions/v1/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes }),
    }),
  )
  assert.equal(response.status, 200)
  return response.json()
}

test('push accepts a first write with a null base revision', async () => {
  const { backend, changeLog } = createMemoryBackend()
  const handler = createSyncRequestHandler(backend)

  assert.deepEqual(await postPush(handler, [pendingMutation()]), {
    accepted: [
      {
        operationId: 'operation-1',
        collection: 'agent_preferences',
        recordId: 'profile-1',
        kind: 'upsert',
        payload: {
          providerId: 'openai',
          modelSlots: { default: 'gpt-5.6', fast: null, advanced: null },
          modelCapabilities: { 'gpt-5.6': { toolCalling: true, vision: false } },
          fallbackPreferences: { enabled: false, order: null },
        },
        revision: '1',
        deviceId: 'device-a',
        occurredAt: '2026-09-03T00:00:00.000Z',
      },
    ],
    conflicts: [],
  })
  assert.equal(changeLog.length, 1)
})

test('push returns the canonical current revision for a stale concurrent write', async () => {
  const { backend } = createMemoryBackend()
  const handler = createSyncRequestHandler(backend)
  const initial = pendingMutation()
  await postPush(handler, [initial])

  assert.deepEqual(
    await postPush(handler, [
      pendingMutation({
        operationId: 'operation-2',
        payload: {
          providerId: 'openai',
          modelSlots: { default: 'gpt-5.7' },
        },
      }),
    ]),
    {
      accepted: [],
      conflicts: [
        {
          operationId: 'operation-2',
          current: {
            operationId: 'operation-1',
            collection: 'agent_preferences',
            recordId: 'profile-1',
            kind: 'upsert',
            payload: {
              providerId: 'openai',
              modelSlots: { default: 'gpt-5.6', fast: null, advanced: null },
              modelCapabilities: { 'gpt-5.6': { toolCalling: true, vision: false } },
              fallbackPreferences: { enabled: false, order: null },
            },
            revision: '1',
            deviceId: 'device-a',
            occurredAt: '2026-09-03T00:00:00.000Z',
          },
        },
      ],
    },
  )
})

test('push replays the first canonical change for a duplicate operation ID', async () => {
  const { backend, changeLog } = createMemoryBackend()
  const handler = createSyncRequestHandler(backend)
  const change = pendingMutation()

  const first = await postPush(handler, [change])
  const repeated = await postPush(handler, [change])

  assert.deepEqual(repeated, first)
  assert.equal(changeLog.length, 1)
})

test('push rejects unknown and recursively sensitive agent preference keys', async () => {
  let pushCalls = 0
  const { backend } = createMemoryBackend()
  const handler = createSyncRequestHandler({
    ...backend,
    async push(changes) {
      pushCalls += 1
      return backend.push(changes)
    },
  })
  const prohibitedPayloads = [
    { selectedModel: 'gpt-5.6' },
    { fallbackPreferences: { token: 'private-token' } },
    { fallbackPreferences: { apiKeyRef: { kind: 'keychain' } } },
    { fallbackPreferences: { credentialRef: { kind: 'keychain' } } },
    { fallbackPreferences: { endpoint: 'https://untrusted.example/v1' } },
    { fallbackPreferences: { baseUrl: 'https://untrusted.example/v1' } },
    { fallbackPreferences: { localPath: '/private/data' } },
    { fallbackPreferences: { systemPrompt: 'private prompt' } },
    { fallbackPreferences: { rawUsage: { inputTokens: 10 } } },
    { fallbackPreferences: { rawError: { body: 'provider response' } } },
  ]

  for (const payload of prohibitedPayloads) {
    const response = await handler(
      new Request('http://localhost/functions/v1/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: [pendingMutation({ payload })] }),
      }),
    )
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid sync request' })
  }
  assert.equal(pushCalls, 0)
})

test('nested null preferences survive accepted, conflict, retry, and pull JSON', async () => {
  const { backend } = createMemoryBackend()
  const handler = createSyncRequestHandler(backend)
  const change = pendingMutation()
  const first = await postPush(handler, [change])
  const repeated = await postPush(handler, [change])
  const conflict = await postPush(handler, [
    pendingMutation({
      operationId: 'operation-2',
      payload: { providerId: 'openai', modelSlots: { default: 'gpt-5.7' } },
    }),
  ])
  const pullResponse = await handler(
    new Request('http://localhost/functions/v1/sync/pull', { method: 'GET' }),
  )
  assert.equal(pullResponse.status, 200)
  const pulled = await pullResponse.json()

  const expectedPayload = {
    providerId: 'openai',
    modelSlots: { default: 'gpt-5.6', fast: null, advanced: null },
    modelCapabilities: { 'gpt-5.6': { toolCalling: true, vision: false } },
    fallbackPreferences: { enabled: false, order: null },
  }
  assert.deepEqual(first.accepted[0].payload, expectedPayload)
  assert.deepEqual(repeated.accepted[0].payload, expectedPayload)
  assert.deepEqual(conflict.conflicts[0].current.payload, expectedPayload)
  assert.deepEqual(pulled.changes[0].payload, expectedPayload)
})
