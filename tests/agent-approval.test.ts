import assert from 'node:assert/strict'
import test from 'node:test'
import { decideToolApproval } from '../src/agent/tools/approval.ts'
import type { AgentConfig } from '../src/agent/config.ts'

const approval = (
  mode: AgentConfig['approval']['mode'],
  rules: AgentConfig['approval']['rules'] = [],
): AgentConfig['approval'] => ({ mode, rules })

test('uses the first matching approval rule', () => {
  const policy = approval('deny', [
    { tool: 'fs', pattern: 'notes/', action: 'allow' },
    { tool: 'fs', action: 'confirm' },
  ])

  assert.equal(decideToolApproval(policy, 'fs', { path: 'notes/today.md' }), 'allow')
  assert.equal(decideToolApproval(policy, 'fs', { path: 'private/key.txt' }), 'confirm')
})

test('falls back to the configured mode and supports wildcard rules', () => {
  assert.equal(decideToolApproval(approval('auto'), 'db', { query: 'select 1' }), 'allow')
  assert.equal(
    decideToolApproval(
      approval('auto', [{ tool: '*', pattern: 'delete', action: 'deny' }]),
      'db',
      { query: 'delete from todos' },
    ),
    'deny',
  )
})

test('invalid rule patterns fail closed', () => {
  assert.equal(
    decideToolApproval(
      approval('auto', [{ tool: 'fs', pattern: '[', action: 'allow' }]),
      'fs',
      { path: 'notes/today.md' },
    ),
    'deny',
  )
})

test('a tool requirement upgrades automatic approval to confirmation', () => {
  assert.equal(decideToolApproval(approval('auto'), 'shell', {}, true), 'confirm')
  assert.equal(decideToolApproval(approval('deny'), 'shell', {}, true), 'deny')
})
