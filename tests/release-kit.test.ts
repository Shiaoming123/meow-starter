import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { findAppleDoubleFiles, removeAppleDoubleFiles } from '../scripts/release-kit/appledouble.mjs'
import { inspectReleaseConfig } from '../scripts/release-kit/config.mjs'
import { inspectEnvironment, prepareCargoEnvironment } from '../scripts/release-kit/environment.mjs'
import { getNpmInvocation, runNpmCommand } from '../scripts/release-kit/npm-command.mjs'
import { createReleaseProvenance } from '../scripts/release-kit/provenance.mjs'
import { isRunnableTestFile } from '../scripts/run-tests.mjs'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

test('publishes development and release-kit guidance', () => {
  assert.equal(existsSync(join(projectRoot, 'AGENTS.md')), true)
  assert.equal(existsSync(join(projectRoot, 'docs', 'development.md')), true)
  assert.equal(existsSync(join(projectRoot, 'docs', 'release-kit.md')), true)
})

test('ignores AppleDouble test sidecars', () => {
  assert.equal(isRunnableTestFile('agent.test.ts'), true)
  assert.equal(isRunnableTestFile('._agent.test.ts'), false)
  assert.equal(isRunnableTestFile('tests/agent.test.ts'), true)
  assert.equal(isRunnableTestFile('tests/._agent.test.ts'), false)
})

test('builds a cmd invocation for npm on Windows', () => {
  assert.deepEqual(
    getNpmInvocation(['run', 'test'], { platform: 'win32', commandShell: 'cmd.exe' }),
    {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd run test'],
      options: { windowsHide: true },
    },
  )
})

test('runs the Windows npm invocation through an injected runner', () => {
  const calls = []
  const expected = { status: 0, stdout: '10.0.0', stderr: '' }

  const result = runNpmCommand(['--version'], {
    platform: 'win32',
    commandShell: 'cmd.exe',
    spawnOptions: { encoding: 'utf8' },
    runCommand: (...args) => {
      calls.push(args)
      return expected
    },
  })

  assert.equal(result, expected)
  assert.deepEqual(calls, [[
    'cmd.exe',
    ['/d', '/s', '/c', 'npm.cmd --version'],
    { encoding: 'utf8', windowsHide: true },
  ]])
})

test('creates release provenance only for a clean source revision matching its tag', () => {
  const result = createReleaseProvenance({
    packageJson: { version: '1.2.3' },
    environment: { GITHUB_REF_NAME: 'v1.2.3', GITHUB_REF_TYPE: 'tag' },
    runGit: (args) => {
      if (args[0] === 'rev-parse') return { status: 0, stdout: 'abc123\n' }
      if (args[0] === 'status') return { status: 0, stdout: '' }
      throw new Error(`Unexpected git arguments: ${args.join(' ')}`)
    },
  })

  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.provenance, {
    version: '1.2.3',
    commit: 'abc123',
    sourceTree: 'clean',
    tag: 'v1.2.3',
  })
})

test('rejects provenance when a tag does not match the checked version', () => {
  const result = createReleaseProvenance({
    packageJson: { version: '1.2.3' },
    environment: { GITHUB_REF_NAME: 'v1.2.4', GITHUB_REF_TYPE: 'tag' },
    runGit: (args) => ({
      status: 0,
      stdout: args[0] === 'status' ? '' : 'abc123\n',
    }),
  })

  assert.match(result.errors.join('\n'), /Release tag v1.2.4 must match package version v1.2.3/)
})

test('warns about AppleDouble files on macOS exFAT volumes', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'meow-environment-'))

  t.after(async () => {
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  const result = await inspectEnvironment(fixtureRoot, {
    filesystemType: 'ExFAT',
    platform: 'darwin',
  })

  assert.match(result.warnings.join('\n'), /AppleDouble/)
  assert.match(result.summary.join('\n'), /Filesystem: exfat/)
})

test('reports Tauri prerequisites, config locations, and missing-tool guidance', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'meow-environment-missing-'))

  t.after(async () => {
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  const result = await inspectEnvironment(fixtureRoot, {
    filesystemType: 'unavailable',
    platform: 'linux',
    runCommand: () => ({ status: 1, stderr: '', stdout: '' }),
  })
  const summary = result.summary.join('\n')
  const warnings = result.warnings.join('\n')

  assert.match(summary, /Node: missing/)
  assert.match(summary, /npm: missing/)
  assert.match(summary, /Rust: missing/)
  assert.match(summary, /Cargo: missing/)
  assert.match(summary, /Tauri CLI: missing/)
  assert.match(summary, /Tauri prerequisites: https:\/\/tauri\.app\/start\/prerequisites\//)
  assert.ok(summary.includes(`Package config: ${join(fixtureRoot, 'package.json')}`))
  assert.ok(summary.includes(`Rust config: ${join(fixtureRoot, 'src-tauri', 'Cargo.toml')}`))
  assert.ok(summary.includes(`Tauri config: ${join(fixtureRoot, 'src-tauri', 'tauri.conf.json')}`))
  assert.match(warnings, /Install Node\.js 22 or newer/)
  assert.match(warnings, /rustup/)
  assert.match(warnings, /npm install/)
})

test('preserves a caller-provided Cargo target directory on macOS exFAT', () => {
  const result = prepareCargoEnvironment(
    { CARGO_TARGET_DIR: '/caller/target', PATH: '/bin' },
    { filesystemType: 'exfat', platform: 'darwin', temporaryDirectory: '/fallback' },
  )

  assert.equal(result.environment.CARGO_TARGET_DIR, '/caller/target')
  assert.deepEqual(result.warnings, [])
})

test('uses a warned Cargo target fallback only on macOS exFAT', () => {
  const exfatResult = prepareCargoEnvironment(
    { PATH: '/bin' },
    { filesystemType: 'exfat', platform: 'darwin', temporaryDirectory: '/fallback' },
  )
  const apfsResult = prepareCargoEnvironment(
    { PATH: '/bin' },
    { filesystemType: 'apfs', platform: 'darwin', temporaryDirectory: '/fallback' },
  )

  assert.equal(exfatResult.environment.CARGO_TARGET_DIR, join('/fallback', 'meow-starter-cargo-target'))
  assert.match(exfatResult.warnings.join('\n'), /filesystem type has not been verified/)
  assert.equal('CARGO_TARGET_DIR' in apfsResult.environment, false)
})

test('finds and removes only regular AppleDouble sidecars without following symlinks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'meow-appledouble-'))
  const outside = await mkdtemp(join(tmpdir(), 'meow-appledouble-outside-'))
  const sidecar = join(root, '._sidecar')
  const nestedSidecar = join(root, 'nested', '._nested-sidecar')
  const outsideSidecar = join(outside, '._outside-sidecar')

  t.after(async () => {
    await rm(root, { force: true, recursive: true })
    await rm(outside, { force: true, recursive: true })
  })

  await writeFile(sidecar, 'metadata')
  await writeFile(join(root, '.env'), 'keep')
  await mkdir(join(root, 'nested'))
  await writeFile(nestedSidecar, 'metadata')
  await writeFile(outsideSidecar, 'metadata')
  try {
    await symlink(outsideSidecar, join(root, '._linked-sidecar'))
    await symlink(outside, join(root, 'linked-directory'))
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('Windows symbolic links require Developer Mode or elevation')
      return
    }
    throw error
  }

  assert.deepEqual(await findAppleDoubleFiles(root), [sidecar, nestedSidecar])
  assert.deepEqual(await removeAppleDoubleFiles(root), [sidecar, nestedSidecar])
  assert.equal(await readFile(join(root, '.env'), 'utf8'), 'keep')
  assert.equal(await readFile(outsideSidecar, 'utf8'), 'metadata')
})

test('reports a placeholder updater endpoint according to inspection mode', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'meow-release-config-'))

  t.after(async () => {
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  await mkdir(join(fixtureRoot, 'src-tauri', 'icons'), { recursive: true })
  await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify({ version: '1.2.3' }))
  await writeFile(join(fixtureRoot, 'src-tauri', 'Cargo.toml'), '[package]\nversion = "1.2.3"\n')
  await writeFile(join(fixtureRoot, 'src-tauri', 'icons', 'icon.png'), 'icon')
  await writeFile(join(fixtureRoot, 'src-tauri', 'tauri.conf.json'), JSON.stringify({
    version: '1.2.3',
    identifier: 'com.example.app',
    bundle: { icon: ['icons/icon.png'] },
    plugins: { updater: { endpoints: ['https://github.com/OWNER/REPO/releases/latest/download/latest.json'] } },
  }))

  const result = await inspectReleaseConfig(fixtureRoot, 'template')
  assert.deepEqual(result.errors, [])
  assert.match(result.warnings.join('\n'), /placeholder updater endpoint/)

  const releaseResult = await inspectReleaseConfig(fixtureRoot, 'release')
  assert.match(releaseResult.errors.join('\n'), /placeholder updater endpoint/)
})

test('reports field-specific release configuration failures', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'meow-release-config-invalid-'))

  t.after(async () => {
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  await mkdir(join(fixtureRoot, 'src-tauri', 'icons'), { recursive: true })
  await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify({ version: '1.2.3' }))
  await writeFile(join(fixtureRoot, 'src-tauri', 'Cargo.toml'), '[package]\nversion = "2.3.4"\n')
  await writeFile(join(fixtureRoot, 'src-tauri', 'tauri.conf.json'), JSON.stringify({
    version: '3.4.5',
    identifier: ' ',
    bundle: { icon: ['icons', 'icons/missing.png', ''] },
    plugins: { updater: { endpoints: ['not a URL', 'http://example.com/latest.json'] } },
  }))

  const result = await inspectReleaseConfig(fixtureRoot, 'template')
  const errors = result.errors.join('\n')
  assert.match(errors, /Version mismatch/)
  assert.match(errors, /Missing non-empty Tauri identifier/)
  assert.match(errors, /^Invalid bundle icon: icons \(not a regular file\)$/m)
  assert.match(errors, /Missing bundle icon: icons\/missing\.png/)
  assert.match(errors, /Invalid bundle icon path/)
  assert.match(errors, /Invalid updater endpoint: not a URL/)
  assert.match(errors, /Updater endpoint must use HTTPS: http:\/\/example\.com\/latest\.json/)
})

test('accepts a non-placeholder HTTPS updater endpoint', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'meow-release-config-valid-'))

  t.after(async () => {
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  await mkdir(join(fixtureRoot, 'src-tauri', 'icons'), { recursive: true })
  await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify({ version: '1.2.3' }))
  await writeFile(join(fixtureRoot, 'src-tauri', 'Cargo.toml'), '[package]\nversion = "1.2.3"\n')
  await writeFile(join(fixtureRoot, 'src-tauri', 'icons', 'icon.png'), 'icon')
  await writeFile(join(fixtureRoot, 'src-tauri', 'tauri.conf.json'), JSON.stringify({
    version: '1.2.3',
    identifier: 'com.example.app',
    bundle: { createUpdaterArtifacts: 'v1Compatible', icon: ['icons/icon.png'] },
    plugins: {
      updater: {
        endpoints: ['https://example.com/latest.json'],
        pubkey: 'configured-public-key',
      },
    },
  }))

  const result = await inspectReleaseConfig(fixtureRoot, 'release')
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.warnings, [])
})

test('reports missing updater signing configuration according to inspection mode', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'meow-release-signing-config-'))

  t.after(async () => {
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  await mkdir(join(fixtureRoot, 'src-tauri', 'icons'), { recursive: true })
  await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify({ version: '1.2.3' }))
  await writeFile(join(fixtureRoot, 'src-tauri', 'Cargo.toml'), '[package]\nversion = "1.2.3"\n')
  await writeFile(join(fixtureRoot, 'src-tauri', 'icons', 'icon.png'), 'icon')
  await writeFile(join(fixtureRoot, 'src-tauri', 'tauri.conf.json'), JSON.stringify({
    version: '1.2.3',
    identifier: 'com.example.app',
    bundle: { createUpdaterArtifacts: false, icon: ['icons/icon.png'] },
    plugins: { updater: { endpoints: ['https://example.com/latest.json'], pubkey: ' ' } },
  }))

  const templateResult = await inspectReleaseConfig(fixtureRoot, 'template')
  assert.deepEqual(templateResult.errors, [])
  assert.match(templateResult.warnings.join('\n'), /plugins\.updater\.pubkey/)
  assert.match(templateResult.warnings.join('\n'), /bundle\.createUpdaterArtifacts/)

  const releaseResult = await inspectReleaseConfig(fixtureRoot, 'release')
  assert.match(releaseResult.errors.join('\n'), /plugins\.updater\.pubkey/)
  assert.match(releaseResult.errors.join('\n'), /bundle\.createUpdaterArtifacts/)
})

test('release check rejects unknown modes', () => {
  const result = spawnSync(
    process.execPath,
    [join(projectRoot, 'scripts', 'release-check.mjs'), '--mode=preview'],
    { encoding: 'utf8' },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Unknown release check mode: preview/)
})

test('release check does not ignore an unknown mode after a valid mode', () => {
  const result = spawnSync(
    process.execPath,
    [
      join(projectRoot, 'scripts', 'release-check.mjs'),
      '--mode=release',
      '--mode=preview',
    ],
    { encoding: 'utf8' },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Unknown release check mode: preview/)
})
