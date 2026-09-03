import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import {
  assertSmokePath,
  createNsisInstallArgs,
  removeSmokeRoot,
  resolveInstalledExecutable,
  selectNsisInstaller,
} from '../scripts/smoke-windows-package.mjs'

test('rejects cleanup outside the dedicated target subtree', () => {
  const targetRoot = resolve('D:/repo/src-tauri/target')
  assert.throws(() => assertSmokePath(targetRoot, 'D:/repo/outside'), /must stay inside/)
  assert.equal(
    assertSmokePath(targetRoot, 'D:/repo/src-tauri/target/meow-windows-package-smoke-a/install'),
    resolve('D:/repo/src-tauri/target/meow-windows-package-smoke-a/install'),
  )
})

test('keeps the NSIS destination argument last', () => {
  assert.deepEqual(
    createNsisInstallArgs(
      'D:/bundle/setup.exe',
      'D:/repo/src-tauri/target/meow-windows-package-smoke-a/install',
    ),
    ['/S', '/D=D:/repo/src-tauri/target/meow-windows-package-smoke-a/install'],
  )
})

test('selects the single installer for the configured product and version', () => {
  assert.equal(
    selectNsisInstaller(
      ['Meow Starter_0.0.9_x64-setup.exe', 'Meow Starter_0.1.0_x64-setup.exe'],
      'Meow Starter',
      '0.1.0',
    ),
    'Meow Starter_0.1.0_x64-setup.exe',
  )
  assert.throws(
    () => selectNsisInstaller(['Meow Starter_0.1.0_x64-setup.exe', 'copy.exe'], 'Meow Starter', '0.2.0'),
    /Expected one NSIS installer/,
  )
})

test('uses the Cargo binary name for the installed executable', () => {
  assert.equal(
    resolveInstalledExecutable('D:/repo/src-tauri/target/meow-windows-package-smoke-a/install', 'meow-starter'),
    resolve('D:/repo/src-tauri/target/meow-windows-package-smoke-a/install/meow-starter.exe'),
  )
})

test('retries a temporary Windows directory lock before cleanup succeeds', async () => {
  let attempts = 0
  await removeSmokeRoot('D:/repo/src-tauri/target', 'D:/repo/src-tauri/target/meow-windows-package-smoke-a', {
    delay: async () => {},
    remove: async () => {
      attempts += 1
      if (attempts === 1) {
        const error = new Error('locked') as NodeJS.ErrnoException
        error.code = 'EBUSY'
        throw error
      }
    },
  })
  assert.equal(attempts, 2)
})
