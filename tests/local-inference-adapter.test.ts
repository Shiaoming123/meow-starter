import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { generateText, streamText } from 'ai'
import { createLanguageModel } from '../src/agent/providers/adapter.ts'
import { anthropicPreset, ollamaPreset, openaiPreset, vllmPreset } from '../src/agent/providers/presets.ts'

// This file runs in its own Node test process. Never read or forward a real key.
delete process.env.OPENAI_API_KEY

async function createChatFixture(t) {
  const requests: Array<{ path?: string; authorization?: string; body: any }> = []
  const server = createServer(async (request, response) => {
    let content = ''
    for await (const chunk of request) content += chunk
    requests.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(content) })
    if (request.url !== '/v1/chat/completions') {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: { message: 'This fixture supports only Chat Completions' } }))
      return
    }
    if (requests.at(-1)?.body.stream) {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const [content, finish_reason] of [['local stream reply', null], ['', 'stop']]) {
        response.write(`data: ${JSON.stringify({
          id: 'chatcmpl-local-stream', object: 'chat.completion.chunk', created: 1,
          model: 'fixture-model',
          choices: [{ index: 0, delta: { content }, finish_reason }],
        })}\n\n`)
      }
      response.end('data: [DONE]\n\n')
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      id: 'chatcmpl-local-fixture', object: 'chat.completion', created: 1,
      model: 'fixture-model',
      choices: [{ index: 0, message: { role: 'assistant', content: 'local fixture reply' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    }))
  })
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  return { baseUrl: `http://127.0.0.1:${address.port}/v1`, requests }
}

test('Ollama-compatible models use Chat Completions without an environment API key', { timeout: 5000 }, async (t) => {
  const { baseUrl, requests } = await createChatFixture(t)
  const model = createLanguageModel({ ...ollamaPreset, baseUrl }, 'fixture-model', true)
  const result = await generateText({ model, prompt: 'hello fixture', maxRetries: 0 })

  assert.equal(result.text, 'local fixture reply')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].path, '/v1/chat/completions')
  assert.equal(requests[0].body.model, 'fixture-model')
  assert.equal(requests[0].body.messages.at(-1).content, 'hello fixture')
  assert.equal(requests[0].authorization, 'Bearer not-required')
})

test('vLLM-compatible requests never inherit the cloud SDK environment key', { timeout: 5000 }, async (t) => {
  process.env.OPENAI_API_KEY = 'fixture-environment-key-must-not-leak'
  t.after(() => { delete process.env.OPENAI_API_KEY })
  const { baseUrl, requests } = await createChatFixture(t)
  const model = createLanguageModel({ ...vllmPreset, baseUrl }, 'fixture-model', false)
  const result = await generateText({ model, prompt: 'hello fixture', maxRetries: 0 })

  assert.equal(result.text, 'local fixture reply')
  assert.equal(requests[0].path, '/v1/chat/completions')
  assert.equal(requests[0].authorization, 'Bearer not-required')
})

test('OpenAI-compatible providers require an explicit endpoint before SDK creation', () => {
  for (const baseUrl of [undefined, '', '  ']) {
    assert.throws(() => createLanguageModel({ ...ollamaPreset, baseUrl }, 'fixture-model', true), /baseUrl/)
  }
})

test('compatible providers stream Chat Completions deltas without credentials', { timeout: 5000 }, async (t) => {
  const { baseUrl, requests } = await createChatFixture(t)
  const model = createLanguageModel({ ...ollamaPreset, baseUrl }, 'fixture-model', true)
  const result = streamText({ model, prompt: 'hello fixture', maxRetries: 0 })
  let text = ''
  for await (const delta of result.textStream) text += delta

  assert.equal(text, 'local stream reply')
  assert.equal(requests[0].path, '/v1/chat/completions')
  assert.equal(requests[0].body.stream, true)
  assert.equal(requests[0].authorization, 'Bearer not-required')
})

test('keychain cloud providers keep their existing provider-specific models', () => {
  const openai = createLanguageModel(openaiPreset, 'fixture-model', true)
  const anthropic = createLanguageModel(anthropicPreset, 'fixture-model', true)
  assert.equal(typeof openai === 'object' && openai.provider, 'openai.responses')
  assert.equal(typeof anthropic === 'object' && anthropic.provider, 'anthropic.messages')
})

test('compatible endpoint placeholders never replace configured keychain or environment credentials', () => {
  assert.throws(() => createLanguageModel({
    ...ollamaPreset, apiKeyRef: { kind: 'keychain', service: 'fixture' },
  }, 'fixture-model', true), /白名单/)
  assert.throws(() => createLanguageModel({
    ...ollamaPreset, apiKeyRef: { kind: 'env', name: 'FIXTURE_KEY' },
  }, 'fixture-model', true), /env/)
  assert.throws(() => createLanguageModel(openaiPreset, 'fixture-model', false), /secureProxy/)
})
