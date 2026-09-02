import assert from 'node:assert/strict'
import test from 'node:test'
import {
  moduleCompatibility,
  selectCompatibleModules,
} from '../src/modules/compatibility.ts'
import {
  detectRuntimeInfo,
  hasRuntimeCapability,
  type RuntimeInfo,
} from '../src/lib/platform.ts'
import type { Module } from '../src/modules/types.ts'

const runtime = (
  platform: RuntimeInfo['platform'],
  capabilities: RuntimeInfo['capabilities'] = [],
): RuntimeInfo => ({ platform, capabilities })

const module = (overrides: Partial<Module> = {}): Module => ({
  id: 'example',
  name: 'Example',
  dependencies: [],
  ...overrides,
})

test('detects the Node test environment as Web with persistent Web storage', () => {
  assert.deepEqual(detectRuntimeInfo(), {
    platform: 'web',
    capabilities: ['web-storage'],
  })
})

test('checks runtime capabilities without platform-specific branching', () => {
  const web = runtime('web', ['web-storage'])
  assert.equal(hasRuntimeCapability(web, 'web-storage'), true)
  assert.equal(hasRuntimeCapability(web, 'native-updater'), false)
})

test('accepts a module when platform and capabilities match', () => {
  assert.deepEqual(
    moduleCompatibility(
      module({ platforms: ['web'], requiredCapabilities: ['web-storage'] }),
      runtime('web', ['web-storage']),
    ),
    { supported: true },
  )
})

test('rejects a module on an unsupported platform', () => {
  assert.match(
    moduleCompatibility(module({ platforms: ['desktop'] }), runtime('web')).reason ?? '',
    /platform web/,
  )
})

test('rejects a module when a required capability is absent', () => {
  assert.match(
    moduleCompatibility(
      module({ requiredCapabilities: ['system-tray'] }),
      runtime('desktop'),
    ).reason ?? '',
    /system-tray/,
  )
})

test('selects only modules supported by the current runtime', () => {
  const selected = selectCompatibleModules(
    [
      module({ id: 'core' }),
      module({ id: 'tray', platforms: ['desktop'] }),
      module({ id: 'indexeddb', platforms: ['web'] }),
    ],
    runtime('web', ['web-storage']),
  )

  assert.deepEqual(selected.map(({ id }) => id), ['core', 'indexeddb'])
})
