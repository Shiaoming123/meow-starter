import assert from 'node:assert/strict'
import test from 'node:test'
import { isRunnableTestFile } from '../scripts/run-tests.mjs'

test('ignores AppleDouble test sidecars', () => {
  assert.equal(isRunnableTestFile('agent.test.ts'), true)
  assert.equal(isRunnableTestFile('._agent.test.ts'), false)
  assert.equal(isRunnableTestFile('tests/agent.test.ts'), true)
  assert.equal(isRunnableTestFile('tests/._agent.test.ts'), false)
})
