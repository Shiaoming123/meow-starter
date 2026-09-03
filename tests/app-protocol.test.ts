import assert from 'node:assert/strict'
import test from 'node:test'
import { validateApplicationProtocol } from '../scripts/check-app-protocol.mjs'
import { moduleContracts, moduleIds } from '../src/modules/contract.ts'
import { defaultModuleConfig } from '../src/modules/config.ts'
import { TODO_EXPORT_FORMAT, TODO_EXPORT_VERSION } from '../src/storage/todos/data-port.ts'

const packageJson = {
  name: 'meow-starter',
  scripts: {
    test: 'node scripts/run-tests.mjs',
    typecheck: 'vue-tsc --noEmit',
    build: 'vite build',
    'build:web': 'vite build --mode web',
    'check:modules': 'node scripts/check-module-contract.mjs',
    'check:csp': 'node scripts/check-tauri-csp.mjs',
    'check:docs': 'node scripts/check-doc-links.mjs',
    'check:protocol': 'node scripts/check-app-protocol.mjs',
    'rust:verify': 'node scripts/rust-verify.mjs',
    'smoke:web-persistence': 'node scripts/smoke-web-persistence.mjs',
    'smoke:windows-package': 'node scripts/smoke-windows-package.mjs',
    'check:android-artifact': 'node scripts/check-android-artifact.mjs',
  },
}

function validProtocol() {
  return {
    schemaVersion: 1,
    product: {
      name: 'meow-starter',
      goal: 'Build a local-first cross-platform application.',
      nonGoals: ['No hosted sync by default.'],
    },
    targets: {
      primary: ['desktop'],
      maturity: { desktop: 'stable', web: 'beta', mobile: 'beta' },
      degradation: {
        web: ['Skip desktop-only modules.'],
        mobile: ['Skip desktop-only modules.'],
      },
    },
    modulePolicy: {
      enabled: moduleIds.filter((id) => defaultModuleConfig[id]),
      disabled: moduleIds.filter((id) => !defaultModuleConfig[id]),
    },
    data: {
      defaultMode: 'local-first',
      ports: [{ id: 'todos', format: TODO_EXPORT_FORMAT, version: TODO_EXPORT_VERSION }],
      sync: { enabled: false, provider: 'none' },
      exclusions: ['secrets', 'sync state'],
    },
    delivery: {
      desktopPackage: 'local-smoke',
      signing: 'unverified',
      updater: 'template-only',
      webDeployment: 'unverified',
      mobileNative: 'local-debug',
    },
    acceptance: {
      required: ['test', 'check:protocol', 'check:csp', 'typecheck', 'build', 'build:web', 'check:modules', 'check:docs'],
      conditional: ['rust:verify', 'smoke:web-persistence', 'smoke:windows-package', 'check:android-artifact'],
    },
    evolution: {
      additive: 'Add fields in a new schema version.',
      breaking: 'Document migrations for removed promises.',
    },
  }
}

function validate(protocol: ReturnType<typeof validProtocol>) {
  return validateApplicationProtocol({
    protocol,
    packageJson,
    config: defaultModuleConfig,
    contracts: moduleContracts,
    moduleIds,
    dataPort: { format: TODO_EXPORT_FORMAT, version: TODO_EXPORT_VERSION },
  })
}

test('accepts a protocol that matches the product sources of truth', () => {
  assert.deepEqual(validate(validProtocol()).errors, [])
})

test('rejects missing module policy coverage before runtime loading can drift', () => {
  const protocol = validProtocol()
  protocol.modulePolicy.enabled = ['core']
  protocol.modulePolicy.disabled = []

  assert.match(validate(protocol).errors.join('\n'), /modulePolicy must cover every module exactly once/)
})

test('rejects a data-port version that would misstate the import boundary', () => {
  const protocol = validProtocol()
  protocol.data.ports[0].version = 2

  assert.match(validate(protocol).errors.join('\n'), /data\.ports\[todos\] must match the Todo data-port format and version/)
})

test('rejects a declared acceptance command that is not executable', () => {
  const protocol = validProtocol()
  protocol.acceptance.required.push('missing:command')

  assert.match(validate(protocol).errors.join('\n'), /acceptance\.required references missing package script "missing:command"/)
})

test('rejects a mobile delivery claim that does not match recorded local evidence', () => {
  const protocol = validProtocol()
  protocol.delivery.mobileNative = 'unverified'

  assert.match(validate(protocol).errors.join('\n'), /delivery must retain the currently evidenced release boundary/)
})
