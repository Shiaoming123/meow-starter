import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  auditModuleContract,
  capabilityPermissions,
} from '../scripts/check-module-contract.mjs'
import { moduleContracts, moduleIds } from '../src/modules/contract.ts'
import { selectCompatibleModules } from '../src/modules/compatibility.ts'
import { defaultModuleConfig, moduleRegistry } from '../src/modules/config.ts'
import type { RuntimeInfo } from '../src/lib/platform.ts'

const runtimeProfiles: RuntimeInfo[] = [
  { platform: 'web', capabilities: ['web-storage'] },
  {
    platform: 'desktop',
    capabilities: [
      'native-sql',
      'system-tray',
      'native-updater',
      'global-shortcut',
      'native-clipboard',
      'native-notification',
      'autostart',
      'secure-keychain-proxy',
    ],
  },
  {
    platform: 'mobile',
    capabilities: ['native-sql', 'native-clipboard', 'native-notification'],
  },
]

test('module catalog, frontend configuration, and loaders describe the same modules', () => {
  assert.deepEqual(Object.keys(moduleContracts), moduleIds)
  assert.deepEqual(Object.keys(defaultModuleConfig), moduleIds)
  assert.deepEqual(Object.keys(moduleRegistry), moduleIds)
})

test('every runtime profile retains dependencies for the modules it can select', () => {
  for (const runtime of runtimeProfiles) {
    const selected = selectCompatibleModules(Object.values(moduleContracts), runtime)
    const selectedIds = new Set(selected.map(({ id }) => id))

    for (const module of selected) {
      for (const dependency of module.dependencies) {
        assert.equal(
          selectedIds.has(dependency),
          true,
          `${runtime.platform} selects ${module.id} without ${dependency}`,
        )
      }
    }
  }
})

test('audit reports every missing native requirement for an enabled module', () => {
  const result = auditModuleContract({
    contracts: [moduleContracts.shortcut],
    config: { shortcut: true },
    platform: 'desktop',
    cargoToml: '[features]\n',
    permissions: [],
  })

  assert.deepEqual(result.errors, [
    'Module "shortcut" requires Cargo feature "shortcut".',
    'Module "shortcut" requires Tauri permission "global-shortcut:allow-register".',
    'Module "shortcut" requires Tauri permission "global-shortcut:allow-unregister".',
  ])
})

test('disabled shortcut documents concrete permissions without breaking the default Cargo build', () => {
  const shortcutPermissions = [
    'global-shortcut:allow-register',
    'global-shortcut:allow-unregister',
  ]
  const capabilities = JSON.parse(
    readFileSync(
      new URL('../src-tauri/capabilities/default.json', import.meta.url),
      'utf8',
    ),
  ) as Array<{ identifier: string; permissions: string[] }>
  const defaultCapability = capabilities.find(({ identifier }) => identifier === 'default')

  assert.deepEqual(
    moduleContracts.shortcut.nativeBuild.kind === 'cargo-feature'
      ? moduleContracts.shortcut.nativeBuild.permissions
      : undefined,
    shortcutPermissions,
  )
  assert.equal(defaultCapability?.permissions.includes('global-shortcut:default'), false)
  for (const permission of shortcutPermissions) {
    assert.equal(defaultCapability?.permissions.includes(permission), false)
  }
})

test('capability permissions apply only to the matching runtime targets', () => {
  const capabilities = [
    { permissions: ['core:default'] },
    { platforms: ['linux', 'macOS', 'windows'], permissions: ['updater:default'] },
  ]

  assert.deepEqual(capabilityPermissions(capabilities, 'desktop'), [
    'core:default',
    'updater:default',
  ])
  assert.deepEqual(capabilityPermissions(capabilities, 'mobile'), ['core:default'])
})
