import assert from 'node:assert/strict'
import test from 'node:test'
import { availableNavigationKeys } from '../src/lib/navigation.ts'
import type { RuntimeInfo } from '../src/lib/platform.ts'

const runtime = (
  platform: RuntimeInfo['platform'],
  capabilities: RuntimeInfo['capabilities'],
): RuntimeInfo => ({ platform, capabilities })

test('Web navigation excludes native updater while desktop includes it', () => {
  assert.deepEqual(availableNavigationKeys(runtime('web', ['web-storage'])), [
    'overview',
    'themes',
    'data',
  ])
  assert.deepEqual(
    availableNavigationKeys(runtime('desktop', ['native-sql', 'native-updater'])),
    ['overview', 'themes', 'data', 'updater'],
  )
})
