import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSecureProxyRequest,
  resolveProviderTransport,
} from '../src/agent/providers/proxy-policy.ts'
import type { ProviderInstance } from '../src/agent/providers/types.ts'

const provider = (overrides: Partial<ProviderInstance> = {}): ProviderInstance => ({
  id: 'openai',
  type: 'openai',
  apiKeyRef: { kind: 'keychain', service: 'openai', account: 'default' },
  models: [],
  ...overrides,
})

test('creates body-only proxy requests for fixed cloud provider origins', async () => {
  assert.deepEqual(
    await createSecureProxyRequest(
      provider(),
      'https://api.openai.com/v1/responses',
      { method: 'POST', body: JSON.stringify({ model: 'gpt-5', stream: true }) },
    ),
    {
      provider: 'openai',
      service: 'openai',
      account: 'default',
      url: 'https://api.openai.com/v1/responses',
      body: { model: 'gpt-5', stream: true },
    },
  )

  assert.equal(
    (
      await createSecureProxyRequest(
        provider({
          id: 'anthropic',
          type: 'anthropic',
          apiKeyRef: { kind: 'keychain', service: 'anthropic' },
        }),
        'https://api.anthropic.com/v1/messages',
        { method: 'POST', body: '{}' },
      )
    ).provider,
    'anthropic',
  )
})

test('rejects unexpected hosts, schemes, credentials and paths', async () => {
  for (const url of [
    'http://api.openai.com/v1/responses',
    'https://api.openai.com.evil.test/v1/responses',
    'https://user:pass@api.openai.com/v1/responses',
    'https://api.openai.com/dashboard',
  ]) {
    await assert.rejects(
      createSecureProxyRequest(provider(), url, { method: 'POST', body: '{}' }),
      /代理目标不在允许范围/,
    )
  }
})

test('rejects non-POST, missing, malformed and oversized JSON bodies', async () => {
  const url = 'https://api.openai.com/v1/responses'
  await assert.rejects(
    createSecureProxyRequest(provider(), url, { method: 'GET' }),
    /仅允许 POST/,
  )
  await assert.rejects(
    createSecureProxyRequest(provider(), url, { method: 'POST' }),
    /必须是 JSON 字符串/,
  )
  await assert.rejects(
    createSecureProxyRequest(provider(), url, { method: 'POST', body: '{' }),
    /不是有效 JSON/,
  )
  await assert.rejects(
    createSecureProxyRequest(provider(), url, {
      method: 'POST',
      body: JSON.stringify({ prompt: 'x'.repeat(2 * 1024 * 1024) }),
    }),
    /超过 2 MiB/,
  )
})

test('rejects providers without a keychain reference', async () => {
  await assert.rejects(
    createSecureProxyRequest(
      provider({ apiKeyRef: { kind: 'none' } }),
      'https://api.openai.com/v1/responses',
      { method: 'POST', body: '{}' },
    ),
    /需要 keychain 密钥引用/,
  )
})

test('selects direct transport only for no-key providers', () => {
  assert.equal(
    resolveProviderTransport(provider({ apiKeyRef: { kind: 'none' } }), true),
    'direct',
  )
  assert.equal(resolveProviderTransport(provider(), true), 'rust-proxy')
  assert.throws(() => resolveProviderTransport(provider(), false), /必须启用 secureProxy/)
  assert.throws(
    () =>
      resolveProviderTransport(
        provider({ type: 'openai-compatible', baseUrl: 'https://cloud.example/v1' }),
        true,
      ),
    /尚无 Rust 侧白名单/,
  )
  assert.throws(
    () =>
      resolveProviderTransport(
        provider({ apiKeyRef: { kind: 'env', name: 'OPENAI_API_KEY' } }),
        true,
      ),
    /不支持 env 密钥引用/,
  )
})
