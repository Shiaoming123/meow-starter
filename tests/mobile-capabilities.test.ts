import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const capabilities = JSON.parse(
  readFileSync(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8'),
) as Array<{ identifier: string; permissions: string[]; platforms?: string[] }>

test('keeps updater permission desktop-only while mobile retains its core capability', () => {
  const defaultCapability = capabilities.find(({ identifier }) => identifier === 'default')
  const updaterCapability = capabilities.find(({ identifier }) => identifier === 'updater-desktop')

  assert.ok(defaultCapability)
  assert.equal(defaultCapability.permissions.includes('updater:default'), false)
  assert.deepEqual(updaterCapability?.platforms, ['linux', 'macOS', 'windows'])
  assert.deepEqual(updaterCapability?.permissions, ['updater:default'])
})
