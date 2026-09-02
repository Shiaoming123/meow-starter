import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createHttpSyncTransport } from '../src/sync/transports/http.ts'
import type { SyncMutation } from '../src/sync/types.ts'

const change: SyncMutation = {
  operationId: 'op-1',
  collection: 'notes',
  recordId: 'note-1',
  kind: 'upsert',
  payload: { title: 'hello' },
  revision: 'device-a:1',
  deviceId: 'device-a',
  occurredAt: '2026-09-02T00:00:00.000Z',
}

test('HTTP transport sends authenticated push and checkpointed pull requests', async () => {
  const requests: Array<{
    method?: string
    url?: string
    authorization?: string
    contentType?: string
    body: string
  }> = []
  const server = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers['content-type'],
        body,
      })
      response.setHeader('Content-Type', 'application/json')
      if (request.url?.startsWith('/sync/pull')) {
        response.end(JSON.stringify({ changes: [change], checkpoint: 'cursor-2' }))
      } else {
        response.end(JSON.stringify({ acceptedOperationIds: ['op-1'] }))
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const transport = createHttpSyncTransport({
      baseUrl: `http://127.0.0.1:${address.port}/sync`,
      async getAccessToken() {
        return 'test-token'
      },
    })

    assert.deepEqual(await transport.push([change]), {
      acceptedOperationIds: ['op-1'],
    })
    assert.deepEqual(await transport.pull('cursor-1'), {
      changes: [change],
      checkpoint: 'cursor-2',
    })

    assert.deepEqual(requests, [
      {
        method: 'POST',
        url: '/sync/push',
        authorization: 'Bearer test-token',
        contentType: 'application/json',
        body: JSON.stringify({ changes: [change] }),
      },
      {
        method: 'GET',
        url: '/sync/pull?checkpoint=cursor-1',
        authorization: 'Bearer test-token',
        contentType: 'application/json',
        body: '',
      },
    ])
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test('HTTP transport rejects insecure remote and credentialed base URLs', () => {
  assert.throws(
    () => createHttpSyncTransport({ baseUrl: 'http://example.com/sync' }),
    /requires HTTPS outside loopback/,
  )
  assert.throws(
    () => createHttpSyncTransport({ baseUrl: 'https://user:secret@example.com/sync' }),
    /must not contain credentials/,
  )
  assert.doesNotThrow(() =>
    createHttpSyncTransport({ baseUrl: 'https://sync.example.com/v1' }),
  )
})

test('HTTP transport reports status without leaking access tokens', async () => {
  const server = createServer((_request, response) => {
    response.statusCode = 503
    response.end('token-from-server-body')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const transport = createHttpSyncTransport({
      baseUrl: `http://127.0.0.1:${address.port}`,
      async getAccessToken() {
        return 'private-access-token'
      },
    })

    await assert.rejects(transport.pull(), (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /Sync HTTP 503/)
      assert.doesNotMatch(error.message, /private-access-token|token-from-server-body/)
      return true
    })
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test('HTTP transport rejects malformed sync responses', async () => {
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ changes: 'not-an-array' }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const transport = createHttpSyncTransport({
      baseUrl: `http://127.0.0.1:${address.port}`,
    })
    await assert.rejects(transport.pull(), /Invalid sync pull response/)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})
