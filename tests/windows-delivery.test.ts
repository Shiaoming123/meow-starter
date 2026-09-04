import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  artifactPrefix,
  assertArtifactSet,
  assertDeliveryMetadata,
  assertUniqueArtifactDigests,
  assertDeliveryPath,
  deliveryFileName,
  readWindowsBuildMetadata,
  resolveCargoTargetRoot,
  selectSingleArtifact,
} from '../scripts/package-windows.mjs'
import { stageWindowsPortable } from '../scripts/stage-windows-portable.mjs'
import { validateWindowsReleaseWorkflow } from '../scripts/release-kit/config.mjs'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

function testPeExecutable() {
  const executable = Buffer.alloc(0x44)
  executable.write('MZ', 0, 'ascii')
  executable.writeUInt32LE(0x40, 0x3c)
  executable.set([0x50, 0x45, 0, 0], 0x40)
  return executable
}

test('keeps Windows delivery files inside the versioned release root', () => {
  const root = resolve('D:/repo/release-artifacts/windows')
  assert.equal(
    assertDeliveryPath(root, 'D:/repo/release-artifacts/windows/1.2.3'),
    resolve('D:/repo/release-artifacts/windows/1.2.3'),
  )
  assert.throws(() => assertDeliveryPath(root, 'D:/repo/release-artifacts'), /must stay inside/)
})

test('derives stable ASCII artifact names with a package-name fallback', () => {
  assert.equal(artifactPrefix('Meow Starter', 'meow-starter'), 'Meow_Starter')
  assert.equal(artifactPrefix('拾学', 'meow-study'), 'meow_study')
  assert.equal(
    deliveryFileName('Meow_Starter', 'portable', '1.2.3'),
    'Meow_Starter_1.2.3_x64_Portable.exe',
  )
  assert.throws(() => deliveryFileName('Meow_Starter', 'appx', '1.2.3'), /Unknown Windows/)
})

test('uses one deterministic Cargo target root for custom and default builds', () => {
  const root = resolve('D:/repo')
  assert.equal(resolveCargoTargetRoot(root, {}), resolve(root, 'src-tauri', 'target'))
  assert.equal(resolveCargoTargetRoot(root, { CARGO_TARGET_DIR: 'build/cargo' }), resolve(root, 'build/cargo'))
  assert.equal(resolveCargoTargetRoot(root, { CARGO_TARGET_DIR: 'D:/shared/cargo' }), resolve('D:/shared/cargo'))
})

test('uses Tauri mainBinaryName when a derived app renames its executable', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'meow-main-binary-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'src-tauri'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }))
  await writeFile(join(root, 'src-tauri', 'Cargo.toml'), '[package]\nname = "cargo-name"\nversion = "1.2.3"\n')
  await writeFile(join(root, 'src-tauri', 'tauri.conf.json'), JSON.stringify({
    version: '1.2.3',
    productName: 'Derived App',
    mainBinaryName: 'renamed-app',
    identifier: 'com.example.derived',
  }))

  const metadata = await readWindowsBuildMetadata(root)
  assert.equal(metadata.packageName, 'cargo-name')
  assert.equal(metadata.binaryName, 'renamed-app')
})

test('selects exactly one version-matching installer artifact', () => {
  assert.equal(
    selectSingleArtifact(['D:/bundle/App_1.0.0_x64-setup.exe'], '-setup.exe', '1.0.0'),
    'D:/bundle/App_1.0.0_x64-setup.exe',
  )
  assert.throws(() => selectSingleArtifact([], '.msi', '1.0.0'), /found 0/)
})

test('requires one unique artifact of each Windows delivery kind', () => {
  const valid = [
    { kind: 'nsis', file: 'setup.exe' },
    { kind: 'msi', file: 'installer.msi' },
    { kind: 'portable', file: 'portable.exe' },
  ]
  assert.doesNotThrow(() => assertArtifactSet(valid))
  assert.throws(
    () => assertArtifactSet(valid.map(() => ({ kind: 'portable', file: 'portable.exe' }))),
    /one unique NSIS, MSI, and portable/,
  )
  assert.throws(
    () => assertArtifactSet(valid.map((artifact) => ({ ...artifact, file: 'same.exe' }))),
    /filenames must be unique/,
  )
})

test('rejects stale metadata and byte-identical delivery binaries', () => {
  const expected = {
    productName: 'App', packageName: 'app', binaryName: 'app',
    identifier: 'com.example.app', version: '1.2.3', architecture: 'x64',
  }
  assert.doesNotThrow(() => assertDeliveryMetadata({ ...expected }, expected))
  assert.throws(() => assertDeliveryMetadata({ ...expected, identifier: 'com.other.app' }, expected), /identifier/)
  assert.doesNotThrow(() => assertUniqueArtifactDigests(['a', 'b', 'c']))
  assert.throws(() => assertUniqueArtifactDigests(['a', 'b', 'a']), /byte-identical/)
})

test('stages a portable executable with stable name and checksum proof', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'meow-portable-release-'))
  const source = join(root, 'app.exe')
  const output = join(root, 'release')
  await writeFile(source, testPeExecutable())
  t.after(() => rm(root, { recursive: true, force: true }))

  const result = await stageWindowsPortable({
    source,
    outputDirectory: output,
    prefix: 'Meow_Starter',
    version: '1.2.3',
    architecture: 'x64',
  })

  assert.equal(result.fileName, 'Meow_Starter_1.2.3_x64_Portable.exe')
  assert.deepEqual(await readFile(result.path), testPeExecutable())
  assert.match(await readFile(result.checksumPath, 'utf8'), /^[a-f0-9]{64}  Meow_Starter_1\.2\.3_x64_Portable\.exe\n$/)
})

test('rejects a non-PE file before staging a portable release', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'meow-portable-invalid-'))
  const source = join(root, 'not-an-exe.bin')
  await writeFile(source, 'not a PE file')
  t.after(() => rm(root, { recursive: true, force: true }))

  await assert.rejects(stageWindowsPortable({
    source,
    outputDirectory: join(root, 'release'),
    prefix: 'Meow_Starter',
    version: '1.2.3',
    architecture: 'x64',
  }), /valid PE executable/)
})

test('rejects an MZ-prefixed file without a PE signature', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'meow-portable-mz-only-'))
  const source = join(root, 'not-a-pe.exe')
  await writeFile(source, Buffer.from('MZportable-test'))
  t.after(() => rm(root, { recursive: true, force: true }))

  await assert.rejects(stageWindowsPortable({
    source,
    outputDirectory: join(root, 'release'),
    prefix: 'Meow_Starter',
    version: '1.2.3',
    architecture: 'x64',
  }), /valid PE executable/)
})

test('repository release workflow retains the reusable portable Windows gate', async () => {
  const workflow = await readFile(join(projectRoot, '.github', 'workflows', 'release.yml'), 'utf8')
  assert.deepEqual(validateWindowsReleaseWorkflow(workflow), [])
})
