import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const releaseRoot = resolve(projectRoot, 'release-artifacts', 'windows')

export function resolveCargoTargetRoot(root = projectRoot, environment = process.env) {
  const configured = environment.CARGO_TARGET_DIR?.trim()
  return configured ? resolve(root, configured) : resolve(root, 'src-tauri', 'target')
}

const cargoTargetRoot = resolveCargoTargetRoot()
const tauriTarget = resolve(cargoTargetRoot, 'release')

export function assertDeliveryPath(root, candidate) {
  const resolvedRoot = resolve(root)
  const resolvedCandidate = resolve(candidate)
  if (!resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`Delivery path must stay inside ${resolvedRoot}: ${resolvedCandidate}`)
  }
  return resolvedCandidate
}

export function artifactPrefix(productName, packageName) {
  const asciiName = productName
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const fallback = packageName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const prefix = asciiName || fallback
  if (!prefix) throw new Error('Could not derive a stable ASCII artifact prefix.')
  return prefix
}

export function deliveryFileName(prefix, kind, version, arch = 'x64') {
  const suffixes = { nsis: 'Setup.exe', msi: 'Installer.msi', portable: 'Portable.exe' }
  const suffix = suffixes[kind]
  if (!suffix) throw new TypeError(`Unknown Windows delivery artifact kind: ${kind}`)
  return `${prefix}_${version}_${arch}_${suffix}`
}

export function selectSingleArtifact(candidates, extension, version) {
  const matches = candidates.filter((candidate) => (
    candidate.toLowerCase().endsWith(extension.toLowerCase()) && basename(candidate).includes(version)
  ))
  if (matches.length !== 1) {
    throw new Error(`Expected one Windows ${extension} artifact for ${version}, found ${matches.length}.`)
  }
  return matches[0]
}

export function assertArtifactSet(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length !== 3) {
    throw new Error('Windows delivery manifest must describe NSIS, MSI, and portable artifacts.')
  }
  const kinds = artifacts.map((artifact) => artifact.kind)
  const files = artifacts.map((artifact) => artifact.file)
  if (new Set(kinds).size !== 3 || !['nsis', 'msi', 'portable'].every((kind) => kinds.includes(kind))) {
    throw new Error('Windows delivery manifest must contain one unique NSIS, MSI, and portable artifact.')
  }
  if (new Set(files).size !== files.length) {
    throw new Error('Windows delivery manifest artifact filenames must be unique.')
  }
}

export function hasWindowsBinaryHeader(contents, kind) {
  if (kind === 'msi') {
    return contents.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  }
  const peOffset = contents.length >= 0x40 ? contents.readUInt32LE(0x3c) : -1
  return contents.subarray(0, 2).equals(Buffer.from('MZ'))
    && peOffset >= 0
    && peOffset <= contents.length - 4
    && contents.subarray(peOffset, peOffset + 4).equals(Buffer.from([0x50, 0x45, 0, 0]))
}

export function assertDeliveryMetadata(manifest, expected) {
  for (const field of ['productName', 'packageName', 'binaryName', 'identifier', 'version', 'architecture']) {
    if (manifest[field] !== expected[field]) {
      throw new Error(`Windows delivery manifest ${field} does not match the current build configuration.`)
    }
  }
}

export function assertUniqueArtifactDigests(digests) {
  if (new Set(digests).size !== digests.length) {
    throw new Error('Windows delivery artifacts must not contain byte-identical binaries.')
  }
}

function runCommand(command, args) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, CARGO_TARGET_DIR: cargoTargetRoot },
    })
    child.once('error', rejectCommand)
    child.once('exit', (code, signal) => {
      if (code === 0) return resolveCommand()
      rejectCommand(new Error(`${command} exited with ${signal ?? code}`))
    })
  })
}

async function listFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    return entries.filter((entry) => entry.isFile()).map((entry) => resolve(directory, entry.name))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return []
    throw error
  }
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function assertBinaryHeader(path, kind) {
  const contents = await readFile(path)
  if (!hasWindowsBinaryHeader(contents, kind)) {
    throw new Error(`Invalid ${kind.toUpperCase()} binary header: ${path}`)
  }
}

export async function auditWindowsDelivery(directory, expected) {
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'))
  if (manifest.platform !== 'windows' || manifest.signing !== 'unsigned-local') {
    throw new Error('Windows delivery manifest has an unexpected platform or signing status.')
  }
  assertArtifactSet(manifest.artifacts)
  assertDeliveryMetadata(manifest, expected)

  const checksums = []
  const artifactDigests = []
  for (const artifact of manifest.artifacts) {
    const artifactPath = assertDeliveryPath(directory, resolve(directory, artifact.file))
    const artifactStat = await stat(artifactPath)
    if (!artifactStat.isFile() || artifactStat.size !== artifact.bytes) {
      throw new Error(`Windows delivery artifact size mismatch: ${artifact.file}`)
    }
    const digest = await sha256(artifactPath)
    if (digest !== artifact.sha256) {
      throw new Error(`Windows delivery artifact checksum mismatch: ${artifact.file}`)
    }
    artifactDigests.push(digest)
    await assertBinaryHeader(artifactPath, artifact.kind)
    checksums.push(`${digest}  ${artifact.file}`)
  }
  assertUniqueArtifactDigests(artifactDigests)

  const expectedChecksums = `${checksums.sort().join('\n')}\n`
  if (await readFile(resolve(directory, 'SHA256SUMS.txt'), 'utf8') !== expectedChecksums) {
    throw new Error('SHA256SUMS.txt does not match the delivery manifest.')
  }
  return manifest
}

export async function readWindowsBuildMetadata(root = projectRoot) {
  const [packageJson, tauriConfig, cargoManifest] = await Promise.all([
    readFile(resolve(root, 'package.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'src-tauri', 'tauri.conf.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'src-tauri', 'Cargo.toml'), 'utf8'),
  ])
  const cargoVersion = cargoManifest.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
  const packageName = cargoManifest.match(/^name\s*=\s*"([^"]+)"/m)?.[1]
  if (!cargoVersion || !packageName) throw new Error('Could not read Cargo package metadata.')
  if (new Set([packageJson.version, tauriConfig.version, cargoVersion]).size !== 1) {
    throw new Error('Package, Tauri, and Cargo versions must match before Windows packaging.')
  }
  if (!tauriConfig.productName?.trim() || !tauriConfig.identifier?.trim()) {
    throw new Error('Windows packaging requires a product name and identifier.')
  }
  return {
    packageName,
    binaryName: tauriConfig.mainBinaryName?.trim() || packageName,
    productName: tauriConfig.productName,
    identifier: tauriConfig.identifier,
    version: packageJson.version,
    prefix: artifactPrefix(tauriConfig.productName, packageName),
  }
}

async function buildDelivery() {
  if (process.platform !== 'win32') throw new Error('Windows delivery packaging only runs on Windows.')
  const config = await readWindowsBuildMetadata()
  const architecture = process.arch === 'x64' ? 'x64' : process.arch
  const outputDirectory = assertDeliveryPath(releaseRoot, resolve(releaseRoot, config.version))

  await runCommand(process.execPath, [
    resolve(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
    'build', '--bundles', 'nsis,msi', '--no-sign', '--ci',
    '--config', '{"bundle":{"createUpdaterArtifacts":false}}',
  ])

  const [nsisCandidates, msiCandidates] = await Promise.all([
    listFiles(resolve(tauriTarget, 'bundle', 'nsis')),
    listFiles(resolve(tauriTarget, 'bundle', 'msi')),
  ])
  const sources = {
    nsis: selectSingleArtifact(nsisCandidates, '-setup.exe', config.version),
    msi: selectSingleArtifact(msiCandidates, '.msi', config.version),
    portable: resolve(tauriTarget, `${config.binaryName}.exe`),
  }
  if (!(await stat(sources.portable)).isFile()) {
    throw new Error(`Missing Tauri release executable: ${sources.portable}`)
  }

  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(outputDirectory, { recursive: true })
  const artifacts = []
  for (const kind of ['nsis', 'msi', 'portable']) {
    const file = deliveryFileName(config.prefix, kind, config.version, architecture)
    const destination = assertDeliveryPath(outputDirectory, resolve(outputDirectory, file))
    await copyFile(sources[kind], destination)
    const artifactStat = await stat(destination)
    artifacts.push({ kind, file, bytes: artifactStat.size, sha256: await sha256(destination) })
  }

  const manifest = {
    schemaVersion: 1,
    productName: config.productName,
    packageName: config.packageName,
    binaryName: config.binaryName,
    identifier: config.identifier,
    version: config.version,
    platform: 'windows',
    architecture,
    signing: 'unsigned-local',
    artifacts,
  }
  await writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(
    resolve(outputDirectory, 'SHA256SUMS.txt'),
    `${artifacts.map(({ file, sha256: digest }) => `${digest}  ${file}`).sort().join('\n')}\n`,
  )
  await writeFile(resolve(outputDirectory, 'README.txt'), [
    `${config.productName} ${config.version} Windows delivery kit`,
    '',
    '- Setup.exe: per-user NSIS installer.',
    '- Installer.msi: Windows Installer package.',
    '- Portable.exe: single executable; no installation required.',
    '- SHA256SUMS.txt: SHA-256 checksums for all three binaries.',
    '- manifest.json: artifact metadata and explicit signing status.',
    '',
    'These local artifacts are unsigned. SmartScreen may warn until you add trusted Authenticode signing.',
    'Portable mode still stores application data in the current user AppData directory.',
    '',
  ].join('\r\n'))

  await auditWindowsDelivery(outputDirectory, { ...config, architecture })
  console.log(`Windows delivery package passed audit: ${relative(projectRoot, outputDirectory)}`)
}

async function auditExistingDelivery() {
  const config = await readWindowsBuildMetadata()
  const architecture = process.arch === 'x64' ? 'x64' : process.arch
  const outputDirectory = assertDeliveryPath(releaseRoot, resolve(releaseRoot, config.version))
  await auditWindowsDelivery(outputDirectory, { ...config, architecture })
  console.log(`Windows delivery package passed audit: ${relative(projectRoot, outputDirectory)}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const action = process.argv.includes('--audit-only') ? auditExistingDelivery : buildDelivery
  action().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
