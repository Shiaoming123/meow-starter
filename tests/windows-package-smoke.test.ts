import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { resolve } from 'node:path'
import {
  assertSmokePath,
  classifyWindowsSmokePrerequisite,
  createSmokeRoot,
  createNsisInstallArgs,
  removeSmokeRoot,
  runCommand,
  resolveInstalledExecutable,
  selectNsisInstaller,
  waitForChildToStayAlive,
} from '../scripts/smoke-windows-package.mjs'

test('only skips a proven Windows symbolic-link privilege prerequisite', () => {
  const error = Object.assign(new Error('A required privilege is not held by the client'), {
    code: 'EPERM',
    syscall: 'symlink',
  })
  assert.deepEqual(classifyWindowsSmokePrerequisite(error), {
    status: 'skipped',
    reason: 'symbolic-link-permission',
  })
  assert.deepEqual(classifyWindowsSmokePrerequisite(Object.assign(new Error('denied'), { code: 'EPERM' })), {
    status: 'failed',
    reason: 'smoke-error',
  })
  assert.deepEqual(classifyWindowsSmokePrerequisite(Object.assign(new Error('build failed'), {
    commandOutput: 'EPERM: operation not permitted, mkdir target',
  })), { status: 'failed', reason: 'smoke-error' })
})

test('propagates a proven build symlink privilege failure to skip classification', async () => {
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough() })
  const command = runCommand('tauri', ['build'], {
    captureOutput: true,
    output: { stdout: { write() {} }, stderr: { write() {} } },
  }, () => child as never)
  child.stderr.end("Error: EPERM: operation not permitted, symlink 'source' -> 'target' (os error 1314)")
  child.emit('close', 1, null)
  await assert.rejects(command, (error: Error & { commandOutput?: string }) => {
    assert.deepEqual(classifyWindowsSmokePrerequisite(error), {
      status: 'skipped',
      reason: 'symbolic-link-permission',
    })
    return true
  })
})

test('creates the smoke parent before allocating a unique child', async () => {
  const calls: string[] = []
  const targetRoot = resolve('D:/repo/src-tauri/target')
  const result = await createSmokeRoot(targetRoot, {
    create: async (path) => { calls.push(`mkdir:${path}`) },
    createTemporary: async (prefix) => {
      calls.push(`mkdtemp:${prefix}`)
      return `${prefix}abc`
    },
  })
  assert.deepEqual(calls, [
    `mkdir:${targetRoot}`,
    `mkdtemp:${resolve(targetRoot, 'meow-windows-package-smoke-')}`,
  ])
  assert.equal(result, resolve(targetRoot, 'meow-windows-package-smoke-abc'))
})

test('fails when the installed application cannot be spawned', async () => {
  const child = new EventEmitter()
  const probe = waitForChildToStayAlive(child, 10_000)
  child.emit('error', new Error('spawn failed'))
  await assert.rejects(probe, /spawn failed/)
})

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
