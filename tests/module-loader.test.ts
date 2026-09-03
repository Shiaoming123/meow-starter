import assert from 'node:assert/strict'
import test from 'node:test'
import type { App } from 'vue'
import { moduleContracts, type ModuleId } from '../src/modules/contract.ts'
import { moduleRegistry, type ModuleConfig } from '../src/modules/config.ts'
import { mountModules } from '../src/modules/loader.ts'

const webRuntime = {
  platform: 'web' as const,
  capabilities: ['web-storage'] as const,
}

function testModule(id: ModuleId): Module {
  const contract = moduleContracts[id]
  return {
    id: contract.id,
    name: contract.name,
    dependencies: [...contract.dependencies],
    platforms: contract.platforms ? [...contract.platforms] : undefined,
    requiredCapabilities: contract.requiredCapabilities
      ? [...contract.requiredCapabilities]
      : undefined,
  }
}

test('Web never invokes a desktop-only module loader', async () => {
  const originalRegistry = { ...moduleRegistry }
  const loaded: string[] = []
  const moduleKeys = Object.keys(moduleRegistry) as (keyof ModuleConfig)[]

  try {
    for (const key of moduleKeys) {
      moduleRegistry[key] = async () => {
        loaded.push(key)
        return { default: testModule(key) }
      }
    }

    await mountModules({} as App, undefined, webRuntime)
  } finally {
    Object.assign(moduleRegistry, originalRegistry)
  }

  assert.equal(loaded.includes('tray'), false)
})

test('loader rejects a dynamic module that differs from its static contract', async () => {
  const originalRegistry = { ...moduleRegistry }
  const moduleKeys = Object.keys(moduleRegistry) as (keyof ModuleConfig)[]

  try {
    for (const key of moduleKeys) {
      moduleRegistry[key] = async () => ({ default: testModule(key) })
    }
    moduleRegistry.core = async () => ({
      default: { ...testModule('core'), id: 'wrong-core' },
    })

    await assert.rejects(
      mountModules({} as App, undefined, webRuntime),
      /does not match its compatibility contract/,
    )
  } finally {
    Object.assign(moduleRegistry, originalRegistry)
  }
})
