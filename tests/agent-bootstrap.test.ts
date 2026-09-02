import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bootstrapProviders,
  resolveAgentConfiguration,
} from '../src/agent/bootstrap.ts'
import { resolveConfig } from '../src/agent/config.ts'
import {
  clearProviders,
  getProvider,
  registerProvider,
} from '../src/agent/providers/registry.ts'

test('bootstraps configured providers and replaces stale registry state', () => {
  clearProviders()
  registerProvider({ id: 'stale', type: 'openai', apiKeyRef: { kind: 'none' } })

  bootstrapProviders(
    resolveConfig({
      enabled: true,
      providers: [{ id: 'ollama', type: 'openai-compatible', apiKeyRef: { kind: 'none' } }],
      defaultModel: 'ollama/qwen3:8b',
    }),
  )

  assert.equal(getProvider('stale'), undefined)
  assert.equal(getProvider('ollama')?.type, 'openai-compatible')
})

test('rejects duplicate configured provider ids without mutating the registry', () => {
  clearProviders()
  registerProvider({ id: 'existing', type: 'openai', apiKeyRef: { kind: 'none' } })

  assert.throws(
    () =>
      bootstrapProviders(
        resolveConfig({
          enabled: true,
          providers: [
            { id: 'duplicate', type: 'openai', apiKeyRef: { kind: 'none' } },
            { id: 'duplicate', type: 'anthropic', apiKeyRef: { kind: 'none' } },
          ],
          defaultModel: 'duplicate/model',
        }),
      ),
    /重复的 provider id: "duplicate"/,
  )
  assert.ok(getProvider('existing'))
})

test('rejects a default model whose provider is not configured', () => {
  assert.throws(
    () =>
      bootstrapProviders(
        resolveConfig({
          enabled: true,
          providers: [{ id: 'ollama', type: 'openai-compatible' }],
          defaultModel: 'missing/model',
        }),
      ),
    /defaultModel 引用了未配置的 provider: "missing"/,
  )
})

test('loads the root agent config only when no explicit config is supplied', async () => {
  let loads = 0
  const loadDefault = async () => {
    loads += 1
    return {
      enabled: true,
      providers: [{ id: 'ollama', type: 'openai-compatible' as const }],
      defaultModel: 'ollama/qwen3:8b',
    }
  }

  const fromFile = await resolveAgentConfiguration(undefined, loadDefault)
  assert.equal(fromFile.enabled, true)
  assert.equal(loads, 1)

  const explicit = await resolveAgentConfiguration({ enabled: false }, loadDefault)
  assert.equal(explicit.enabled, false)
  assert.equal(loads, 1)
})
