import assert from 'node:assert/strict'
import test from 'node:test'
import { createMcpConnectionManager } from '../src/modules/mcp/connection-manager.ts'
import * as mcp from '../src/modules/mcp/index.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const config = { id: 'local-tools', transport: 'http' as const, url: 'http://localhost:8000/mcp' }
const tools = { greet: { description: 'A harmless example' } }

test('MCP module exposes explicit disconnect without changing its optional declaration', () => {
  assert.equal(typeof mcp.disconnectMcpServer, 'function')
  assert.equal(mcp.default.id, 'mcp')
  assert.deepEqual(mcp.default.dependencies, ['agent'])
})

test('MCP connections return the original tools and close exactly once on repeated disconnect', async () => {
  let open = 0
  const manager = createMcpConnectionManager(async (received: typeof config) => {
    assert.deepEqual(received, config)
    open++
    return { tools: async () => tools, close: async () => { open-- } }
  })

  assert.equal(await manager.connect(config), tools)
  assert.equal(open, 1)
  await manager.disconnect(config.id)
  await manager.disconnect(config.id)
  await manager.disconnect('unknown')
  assert.equal(open, 0)
})

test('failed tool discovery closes the client and allows reconnect', async () => {
  const discoveryError = new Error('discovery failed')
  let attempts = 0
  let open = 0
  const manager = createMcpConnectionManager(async () => {
    const attempt = ++attempts
    open++
    return {
      tools: async () => { if (attempt === 1) throw discoveryError; return tools },
      close: async () => { open-- },
    }
  })

  await assert.rejects(manager.connect(config), (error) => error === discoveryError)
  assert.equal(open, 0)
  assert.equal(await manager.connect(config), tools)
  await manager.disconnect(config.id)
  assert.equal(open, 0)
})

test('failed client initialization releases its reserved server ID', async () => {
  const initializationError = new Error('initialization failed')
  let attempts = 0
  const manager = createMcpConnectionManager(async () => {
    if (++attempts === 1) throw initializationError
    return { tools: async () => tools, close: async () => {} }
  })

  await assert.rejects(manager.connect(config), (error) => error === initializationError)
  assert.equal(await manager.connect(config), tools)
  await manager.disconnect(config.id)
})

test('duplicate server IDs are rejected while connecting and while connected', { timeout: 1000 }, async () => {
  const discovery = deferred<typeof tools>()
  let created = 0
  const manager = createMcpConnectionManager(async () => {
    created++
    return { tools: () => discovery.promise, close: async () => {} }
  })

  const first = manager.connect(config)
  await assert.rejects(manager.connect(config), /already connecting or connected/)
  discovery.resolve(tools)
  assert.equal(await first, tools)
  await assert.rejects(manager.connect(config), /already connecting or connected/)
  assert.equal(created, 1)
  await manager.disconnect(config.id)
})

test('concurrent disconnects share one close and prevent reconnect until it finishes', { timeout: 1000 }, async () => {
  const closing = deferred<void>()
  let closes = 0
  const manager = createMcpConnectionManager(async () => ({
    tools: async () => tools,
    close: async () => { closes++; await closing.promise },
  }))
  await manager.connect(config)

  const first = manager.disconnect(config.id)
  const second = manager.disconnect(config.id)
  await assert.rejects(manager.connect(config), /already connecting or connected/)
  closing.resolve()
  await Promise.all([first, second])
  assert.equal(closes, 1)
  assert.equal(await manager.connect(config), tools)
  await manager.disconnect(config.id)
  assert.equal(closes, 2)
})

test('a failed close keeps ownership so disconnect can retry before reconnect', async () => {
  const closeError = new Error('transport close failed')
  let closes = 0
  const manager = createMcpConnectionManager(async () => ({
    tools: async () => tools,
    close: async () => { if (++closes === 1) throw closeError },
  }))
  await manager.connect(config)

  await assert.rejects(manager.disconnect(config.id), (error) => error === closeError)
  await assert.rejects(manager.connect(config), /already connecting or connected/)
  await manager.disconnect(config.id)
  assert.equal(await manager.connect(config), tools)
  await manager.disconnect(config.id)
  assert.equal(closes, 3)
})

test('discovery and cleanup failures preserve both errors and retain retryable ownership', async () => {
  const discoveryError = new Error('discovery failed')
  const closeError = new Error('close failed')
  let closes = 0
  const manager = createMcpConnectionManager(async () => ({
    tools: async () => { throw discoveryError },
    close: async () => { if (++closes === 1) throw closeError },
  }))

  await assert.rejects(manager.connect(config), (error: any) => {
    assert.equal(error.cause, discoveryError)
    assert.equal(error.cleanupError, closeError)
    return true
  })
  await assert.rejects(manager.connect(config), /already connecting or connected/)
  await manager.disconnect(config.id)
  assert.equal(closes, 2)
  await manager.disconnect(config.id)
  assert.equal(closes, 2)
})

test('disconnect during tool discovery waits and closes the newly opened client', { timeout: 1000 }, async () => {
  const discovery = deferred<typeof tools>()
  let open = 0
  const manager = createMcpConnectionManager(async () => {
    open++
    return { tools: () => discovery.promise, close: async () => { open-- } }
  })
  const connecting = manager.connect(config)
  const disconnecting = manager.disconnect(config.id)

  discovery.resolve(tools)
  await Promise.all([connecting, disconnecting])
  assert.equal(open, 0)
})

test('MCP connections isolate different IDs and reject blank IDs before creation', async () => {
  const open = new Set<string>()
  const manager = createMcpConnectionManager(async (cfg: typeof config) => {
    open.add(cfg.id)
    return { tools: async () => tools, close: async () => { open.delete(cfg.id) } }
  })
  for (const id of ['', '   ']) {
    await assert.rejects(manager.connect({ ...config, id }), /non-empty/)
  }
  assert.equal(open.size, 0)
  await manager.connect(config)
  await manager.connect({ ...config, id: 'second' })
  await manager.disconnect(config.id)
  assert.deepEqual([...open], ['second'])
  await manager.disconnect('second')
})

test('public MCP adapter preserves SDK tools and closes its local HTTP session', { timeout: 5000 }, async (t) => {
  const { createServer } = await import('node:http')
  const requests: string[] = []
  const server = createServer(async (request, response) => {
    if (request.method === 'DELETE') {
      requests.push('DELETE')
      response.writeHead(204).end()
      return
    }
    if (request.method !== 'POST') {
      response.writeHead(405).end()
      return
    }
    let body = ''
    for await (const chunk of request) body += chunk
    const message = JSON.parse(body)
    requests.push(message.method)
    if (message.id === undefined) {
      response.writeHead(202).end()
      return
    }
    const result = message.method === 'initialize'
      ? { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'local-test', version: '1.0' } }
      : message.method === 'tools/list'
        ? { tools: [{ name: 'greet', description: 'Harmless local fixture', inputSchema: { type: 'object', properties: {} } }] }
        : undefined
    response.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'local-test-session' })
    response.end(JSON.stringify({
      jsonrpc: '2.0', id: message.id,
      ...(result ? { result } : { error: { code: -32601, message: 'Method not found' } }),
    }))
  })
  t.after(async () => {
    await mcp.disconnectMcpServer('sdk-fixture')
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')

  const remoteTools = await mcp.connectMcpServer({
    id: 'sdk-fixture', transport: 'http', url: `http://127.0.0.1:${address.port}/mcp`,
  })
  assert.equal(remoteTools.greet.description, 'Harmless local fixture')
  assert.equal(typeof remoteTools.greet.execute, 'function')
  await mcp.disconnectMcpServer('sdk-fixture')
  await mcp.disconnectMcpServer('sdk-fixture')
  assert.ok(requests.includes('initialize'))
  assert.ok(requests.includes('tools/list'))
  assert.equal(requests.filter((method) => method === 'DELETE').length, 1)
})
