import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultAgentConfig, resolveConfig } from '../src/agent/config.ts'
import { createInlineRuntime } from '../src/agent/runtime/inline.ts'

test('inline runtime does not advertise unimplemented compaction, session trees, or sandboxing', () => {
  const runtime = createInlineRuntime(resolveConfig({ memory: {
    ...defaultAgentConfig.memory,
    backend: 'memory',
  } }))
  assert.deepEqual(runtime.capabilities, { sessionTree: false, compaction: false, sandbox: false })
})

test('reserved compaction configuration cannot enable an unimplemented runtime capability', () => {
  const config = resolveConfig({ memory: {
    ...defaultAgentConfig.memory,
    backend: 'memory',
    compaction: { enabled: true, thresholdTokens: 1 },
  } })
  const runtime = createInlineRuntime(config)
  assert.equal(runtime.capabilities.compaction, false)
})

test('default configuration leaves the reserved compaction option disabled', () => {
  assert.equal(defaultAgentConfig.memory.compaction.enabled, false)
})
