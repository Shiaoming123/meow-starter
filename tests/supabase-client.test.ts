import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSupabaseSyncClient,
  type SupabaseAuthFacade,
} from '../src/sync/supabase/client.ts'
import { createOutboxSyncEngine } from '../src/sync/engine.ts'
import { createInMemorySyncStateStore } from '../src/sync/in-memory-store.ts'
import { createAllowlistSyncPolicy } from '../src/sync/policy.ts'
import type { PendingSyncMutation, SyncMutation } from '../src/sync/types.ts'

function authWith(accessToken?: string, subject = 'owner-a'): SupabaseAuthFacade {
  return {
    async getSession() {
      return {
        data: {
          session: accessToken
            ? { access_token: accessToken, user: { id: subject } }
            : null,
        },
      }
    },
  }
}

const storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

const pendingMutation: PendingSyncMutation = {
  operationId: 'owner-a-operation',
  collection: 'agent_preferences',
  recordId: 'profile-1',
  kind: 'upsert',
  payload: { providerId: 'openai' },
  baseRevision: null,
  deviceId: 'device-a',
  occurredAt: '2026-09-03T00:00:00.000Z',
}

const ownerBMutation: SyncMutation = {
  operationId: 'owner-b-operation',
  collection: 'agent_preferences',
  recordId: 'profile-1',
  kind: 'upsert',
  payload: { providerId: 'anthropic' },
  revision: '1',
  deviceId: 'device-b',
  occurredAt: '2026-09-03T00:00:00.000Z',
}

test('Supabase sync client returns undefined when Auth has no session', async () => {
  const client = createSupabaseSyncClient({
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test',
    storage,
    auth: authWith(),
  })

  assert.equal(await client.getAccessToken(), undefined)
})

test('Supabase sync client uses only the current short-lived Auth access token', async () => {
  const client = createSupabaseSyncClient({
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_test',
    storage,
    auth: authWith('short-lived-access-token'),
  })

  assert.equal(await client.getAccessToken(), 'short-lived-access-token')
})

test('Supabase sync client fixes the Edge Function transport path and authorization', async () => {
  const originalFetch = globalThis.fetch
  let request: Request | undefined
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init)
    return new Response(JSON.stringify({ changes: [], checkpoint: '2' }), { status: 200 })
  }

  try {
    const client = createSupabaseSyncClient({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
      storage,
      auth: authWith('short-lived-access-token'),
    })
    assert.deepEqual(await client.transport.pull('1'), { changes: [], checkpoint: '2' })
    assert.equal(request?.url, 'https://project.supabase.co/functions/v1/sync/pull?checkpoint=1')
    assert.equal(request?.headers.get('Authorization'), 'Bearer short-lived-access-token')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Supabase sync client rejects non-HTTPS non-local project URLs', () => {
  assert.throws(
    () =>
      createSupabaseSyncClient({
        url: 'http://project.example.com',
        publishableKey: 'sb_publishable_test',
        storage,
        auth: authWith(),
      }),
    /requires HTTPS outside loopback/,
  )
  assert.doesNotThrow(() =>
    createSupabaseSyncClient({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'sb_publishable_test',
      storage,
      auth: authWith(),
    }),
  )
})

test('Supabase sync client rejects a secret or service-role key', () => {
  for (const publishableKey of [
    'sb_secret_do_not_use',
    'sb_service_role_do_not_use',
    'eyJhbGciOiJub25lIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.',
  ]) {
    assert.throws(
      () =>
        createSupabaseSyncClient({
          url: 'https://project.supabase.co',
          publishableKey,
          storage,
          auth: authWith(),
        }),
      /service-role and secret keys are not allowed/,
    )
  }
})

test('Supabase sync client accepts only non-whitespace publishable key values', () => {
  for (const publishableKey of [
    '',
    '   ',
    ' sb_publishable_test',
    'sb_publishable_test ',
    'arbitrary-string',
    'sb_publishable_',
  ]) {
    assert.throws(
      () =>
        createSupabaseSyncClient({
          url: 'https://project.supabase.co',
          publishableKey,
          storage,
          auth: authWith(),
        }),
      /publishable key/,
    )
  }
})

test('Supabase sync client construction does not recover or refresh persisted Auth sessions', async () => {
  const originalFetch = globalThis.fetch
  let fetchCalls = 0
  globalThis.fetch = async () => {
    fetchCalls += 1
    return new Response('{}', { status: 500 })
  }

  try {
    createSupabaseSyncClient({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
      storage: {
        getItem: () =>
          JSON.stringify({
            access_token: 'expired-access-token',
            refresh_token: 'refresh-token',
            expires_at: 0,
            user: { id: 'user-1' },
          }),
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(fetchCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('account switch leaves the previous owner outbox and checkpoint untouched', async () => {
  const originalFetch = globalThis.fetch
  let fetchCalls = 0
  let currentSubject = 'owner-a'
  let applied: SyncMutation | undefined
  globalThis.fetch = async (_input, init) => {
    fetchCalls += 1
    return init?.method === 'POST'
      ? new Response(JSON.stringify({ accepted: [ownerBMutation], conflicts: [] }))
      : new Response(JSON.stringify({ changes: [ownerBMutation], checkpoint: 'cursor-b' }))
  }

  try {
    const client = createSupabaseSyncClient({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
      storage,
      auth: {
        async getSession() {
          return {
            data: {
              session: {
                access_token: `${currentSubject}-token`,
                user: { id: currentSubject },
              },
            },
          }
        },
      },
    })
    const store = createInMemorySyncStateStore(
      [pendingMutation],
      'cursor-a',
      'owner-a',
    )
    const provider = createOutboxSyncEngine({
      store,
      transport: client.transport,
      policy: createAllowlistSyncPolicy(['agent_preferences']),
      async applyRemote(change) {
        applied = change
      },
    })

    currentSubject = 'owner-b'
    await assert.rejects(
      provider.syncOnce(),
      /authenticated sync subject does not match state owner/i,
    )

    assert.equal(fetchCalls, 0)
    assert.equal(applied, undefined)
    assert.deepEqual(await store.listPending(100), [pendingMutation])
    assert.equal(await store.getCheckpoint(), 'cursor-a')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('one sync run binds push and pull to one authenticated session snapshot', async () => {
  const originalFetch = globalThis.fetch
  let sessionReads = 0
  const authorization: string[] = []
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    authorization.push(request.headers.get('Authorization') ?? '')
    return request.method === 'POST'
      ? new Response(JSON.stringify({
          accepted: [{
            ...ownerBMutation,
            operationId: pendingMutation.operationId,
            deviceId: pendingMutation.deviceId,
          }],
          conflicts: [],
        }))
      : new Response(JSON.stringify({ changes: [], checkpoint: 'cursor-a-next' }))
  }

  try {
    const client = createSupabaseSyncClient({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
      storage,
      auth: {
        async getSession() {
          sessionReads += 1
          const subject = sessionReads === 1 ? 'owner-a' : 'owner-b'
          return {
            data: {
              session: {
                access_token: `${subject}-token`,
                user: { id: subject },
              },
            },
          }
        },
      },
    })
    const store = createInMemorySyncStateStore(
      [pendingMutation],
      'cursor-a',
      'owner-a',
    )

    await createOutboxSyncEngine({
      store,
      transport: client.transport,
      policy: createAllowlistSyncPolicy(['agent_preferences']),
      async applyRemote() {},
    }).syncOnce()

    assert.equal(sessionReads, 1)
    assert.deepEqual(authorization, ['Bearer owner-a-token', 'Bearer owner-a-token'])
    assert.equal(await store.getCheckpoint(), 'cursor-a-next')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('signed-out sync fails before reading owner-scoped state or making a request', async () => {
  const originalFetch = globalThis.fetch
  let fetchCalls = 0
  globalThis.fetch = async () => {
    fetchCalls += 1
    return new Response('{}')
  }

  try {
    const client = createSupabaseSyncClient({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
      storage,
      auth: authWith(),
    })
    const store = createInMemorySyncStateStore(
      [pendingMutation],
      'cursor-a',
      'owner-a',
    )

    await assert.rejects(
      createOutboxSyncEngine({
        store,
        transport: client.transport,
        policy: createAllowlistSyncPolicy(['agent_preferences']),
        async applyRemote() {},
      }).syncOnce(),
      /authenticated Supabase sync session is required/i,
    )

    assert.equal(fetchCalls, 0)
    assert.deepEqual(await store.listPending(100), [pendingMutation])
    assert.equal(await store.getCheckpoint(), 'cursor-a')
  } finally {
    globalThis.fetch = originalFetch
  }
})
