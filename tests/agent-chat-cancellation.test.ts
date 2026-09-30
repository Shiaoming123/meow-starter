import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import ts from 'typescript'
import { compileScript, parse } from 'vue/compiler-sfc'
import { HookBus } from '../src/agent/hooks/bus.ts'
import type { AgentEvent, AgentRequest, AgentRuntime } from '../src/agent/runtime/types.ts'

// Run the real component's setup script without a DOM or additional test framework.
// Only the runtime loader is substituted: no provider, keychain, or network is used.
const filename = new URL('../src/agent/ui/ChatPanel.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
const script = compileScript(descriptor, { id: 'chat-panel-cancellation-test' })
const { outputText } = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const require = createRequire(import.meta.url)

function panel(loadAgent: () => Promise<AgentRuntime | null>) {
  const exports = { default: undefined as any }
  new Function('require', 'exports', outputText)((id: string) => {
    if (id === '../index') return { loadAgent }
    if (id === '../hooks/bus') return { HookBus }
    return require(id)
  }, exports)
  return exports.default.setup({}, { expose() {} })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function runtime(
  stream: AgentRuntime['stream'],
  abort: AgentRuntime['abort'] = async () => {},
): AgentRuntime {
  return {
    kind: 'inline',
    capabilities: { sessionTree: false, compaction: true, sandbox: false },
    stream,
    abort,
  }
}

function send(chat, prompt = 'first prompt') {
  chat.draft.value = prompt
  return chat.send()
}

test('Stop keeps Send locked until the active stream finishes', { timeout: 1000 }, async () => {
  const started = deferred<void>()
  const finish = deferred<void>()
  const prompts: string[] = []
  const chat = panel(async () => runtime(async function* (request: AgentRequest) {
    prompts.push(request.prompt)
    started.resolve()
    await finish.promise
  }))
  const first = send(chat)
  await started.promise
  await chat.stop()

  assert.equal(chat.busy.value, true)
  await send(chat, 'must not overlap')
  assert.deepEqual(prompts, ['first prompt'])
  assert.equal(chat.bubbles.value.length, 2)

  finish.resolve()
  await first
  assert.equal(chat.busy.value, false)
  await send(chat, 'next prompt')
  assert.deepEqual(prompts, ['first prompt', 'next prompt'])
})

test('Stop during initialization never starts the cancelled request', { timeout: 1000 }, async () => {
  const opening = deferred<AgentRuntime>()
  const prompts: string[] = []
  const chat = panel(() => opening.promise)
  const first = send(chat)
  await chat.stop()
  opening.resolve(runtime(async function* (request) { prompts.push(request.prompt) }))
  await first

  assert.deepEqual(prompts, [])
  assert.equal(chat.busy.value, false)
  await send(chat, 'next prompt')
  assert.deepEqual(prompts, ['next prompt'])
})

test('Stop during initialization keeps the pending loader as the only request owner', { timeout: 1000 }, async () => {
  const opening = deferred<AgentRuntime>()
  let loads = 0
  const chat = panel(() => { loads++; return opening.promise })
  const first = send(chat)
  await chat.stop()
  const second = send(chat, 'must not start a second loader')

  assert.equal(chat.busy.value, true)
  assert.equal(loads, 1)
  assert.equal(chat.bubbles.value.length, 2)
  opening.resolve(runtime(async function* () {}))
  await Promise.all([first, second])
  assert.equal(chat.busy.value, false)
})

test('stream completion waits for an in-flight abort before allowing another send', { timeout: 1000 }, async () => {
  const started = deferred<void>()
  const finish = deferred<void>()
  const abortStarted = deferred<void>()
  const abortFinished = deferred<void>()
  const chat = panel(async () => runtime(async function* () {
    started.resolve()
    await finish.promise
  }, async () => {
    abortStarted.resolve()
    await abortFinished.promise
  }))
  const first = send(chat)
  await started.promise
  const stopping = chat.stop()
  await abortStarted.promise
  finish.resolve()
  await setImmediate()

  assert.equal(chat.busy.value, true)
  await send(chat, 'must not race pending abort')
  assert.equal(chat.bubbles.value.length, 2)
  abortFinished.resolve()
  await Promise.all([first, stopping])
  assert.equal(chat.busy.value, false)
})

test('repeated Stop calls abort the owned stream only once', { timeout: 1000 }, async () => {
  const started = deferred<void>()
  const finish = deferred<void>()
  const abortFinished = deferred<void>()
  const reasons: Array<string | undefined> = []
  const chat = panel(async () => runtime(async function* () {
    started.resolve()
    await finish.promise
  }, async (reason) => { reasons.push(reason); await abortFinished.promise }))
  const first = send(chat)
  await started.promise
  const stops = [chat.stop(), chat.stop()]
  await setImmediate()

  assert.deepEqual(reasons, ['user stopped'])
  abortFinished.resolve()
  await Promise.all(stops)
  assert.equal(chat.busy.value, true)
  finish.resolve()
  await first
  await chat.stop()
  assert.deepEqual(reasons, ['user stopped'])
})

test('cancelled streams ignore late output and keep Send locked through iterator cleanup', { timeout: 1000 }, async () => {
  const waiting = deferred<void>()
  const release = deferred<void>()
  const cleaning = deferred<void>()
  const cleaned = deferred<void>()
  const chat = panel(async () => runtime(async function* () {
    try {
      yield { type: 'text-delta', text: 'before stop' } as AgentEvent
      waiting.resolve()
      await release.promise
      yield { type: 'text-delta', text: 'late text' } as AgentEvent
      yield { type: 'tool-call', toolCallId: 'late', name: 'late tool', args: {} } as AgentEvent
    } finally {
      cleaning.resolve()
      await cleaned.promise
    }
  }))
  const first = send(chat)
  await waiting.promise
  await chat.stop()
  release.resolve()
  await cleaning.promise

  assert.equal(chat.busy.value, true)
  assert.equal(chat.bubbles.value[1].content, 'before stop')
  assert.deepEqual(chat.bubbles.value[1].tools, [])
  await send(chat, 'must wait for cleanup')
  assert.equal(chat.bubbles.value.length, 2)
  cleaned.resolve()
  await first
  assert.equal(chat.busy.value, false)
})

test('failed abort is displayed without unlocking a still-running request', { timeout: 1000 }, async () => {
  const started = deferred<void>()
  const finish = deferred<void>()
  const chat = panel(async () => runtime(async function* () {
    started.resolve()
    await finish.promise
  }, async () => { throw new Error('abort failed') }))
  const first = send(chat)
  await started.promise
  await assert.doesNotReject(chat.stop())

  assert.equal(chat.error.value, 'abort failed')
  assert.equal(chat.busy.value, true)
  finish.resolve()
  await first
  assert.equal(chat.busy.value, false)
})

test('normal completion preserves text, tool, session, and error events', async () => {
  const sessions: Array<string | undefined> = []
  const chat = panel(async () => runtime(async function* (request) {
    sessions.push(request.sessionId)
    yield { type: 'text-delta', text: 'reply' }
    yield { type: 'tool-call', toolCallId: 'call', name: 'fixture tool', args: {} }
    yield { type: 'error', message: 'fixture error event' }
    yield { type: 'done', finishReason: 'stop' }
  }))
  await send(chat, '  trimmed prompt  ')

  assert.equal(chat.busy.value, false)
  assert.equal(chat.draft.value, '')
  assert.deepEqual(chat.bubbles.value, [
    { role: 'user', content: 'trimmed prompt', tools: [] },
    { role: 'assistant', content: 'reply', tools: ['fixture tool'] },
  ])
  assert.equal(chat.error.value, 'fixture error event')
  await send(chat, 'second prompt')
  assert.ok(sessions[0])
  assert.equal(sessions[0], sessions[1])
})

test('initialization and stream failures remain visible and release the request', async () => {
  for (const load of [
    async () => { throw new Error('initialization failed') },
    async () => runtime(async function* () { throw new Error('stream failed') }),
  ]) {
    const chat = panel(load)
    await send(chat)
    assert.match(chat.error.value, /failed/)
    assert.equal(chat.busy.value, false)
  }
})

test('disabled Agent and empty draft retain existing behavior', async () => {
  const chat = panel(async () => null)
  await send(chat, '   ')
  assert.equal(chat.bubbles.value.length, 0)
  await send(chat)
  assert.match(chat.error.value, /Agent 未启用/)
  assert.equal(chat.busy.value, false)
})
