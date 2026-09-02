import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { findAppleDoubleFiles, removeAppleDoubleFiles } from '../scripts/release-kit/appledouble.mjs'
import { inspectReleaseConfig } from '../scripts/release-kit/config.mjs'
import { inspectEnvironment } from '../scripts/release-kit/environment.mjs'
import { isRunnableTestFile } from '../scripts/run-tests.mjs'

test('ignores AppleDouble test sidecars', () => {
  assert.equal(isRunnableTestFile('agent.test.ts'), true)
  assert.equal(isRunnableTestFile('._agent.test.ts'), false)
  assert.equal(isRunnableTestFile('tests/agent.test.ts'), true)
  assert.equal(isRunnableTestFile('tests/._agent.test.ts'), false)
})

test('warns about AppleDouble files on macOS exFAT volumes', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'meow-environment-'))

  t.after(async () => {
    await rm(fixtureRoot, { force: true, recursive: true })
  })

  const result = await inspectEnvironment(fixtureRoot, {
    filesystemType: 'exfat',
    platform: 'darwin',
  })

  assert.match(result.warnings.join('\n'), /AppleDouble/)
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
  await symlink(outsideSidecar, join(root, '._linked-sidecar'))
  await symlink(outside, join(root, 'linked-directory'))

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
    bundle: { icon: ['icons/icon.png'] },
    plugins: { updater: { endpoints: ['https://example.com/latest.json'] } },
  }))

  const result = await inspectReleaseConfig(fixtureRoot, 'release')
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.warnings, [])
})
