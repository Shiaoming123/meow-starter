import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSupabaseSyncClient,
  type SupabaseAuthFacade,
} from '../src/sync/supabase/client.ts'

function authWith(accessToken?: string): SupabaseAuthFacade {
  return {
    async getSession() {
      return {
        data: {
          session: accessToken ? { access_token: accessToken } : null,
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
