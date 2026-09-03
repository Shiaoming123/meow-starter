import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runNpmCommand } from './npm-command.mjs'

function getToolVersionFromResult(tool) {
  return tool.status === 0 ? tool.stdout.trim() : 'missing'
}

function getToolVersion(command, args, runCommand) {
  return getToolVersionFromResult(runCommand(command, args, { encoding: 'utf8' }))
}

function getFilesystemType(root, platform) {
  if (platform !== 'darwin') return 'unavailable (requires macOS)'

  const result = spawnSync('stat', ['-f', '%T', root], { encoding: 'utf8' })
  const filesystemType = result.status === 0 ? result.stdout.trim() : ''
  if (filesystemType && filesystemType !== '/') return filesystemType

  const mounts = spawnSync('mount', [], { encoding: 'utf8' })
  if (mounts.status !== 0) return filesystemType || 'unknown'

  const mount = mounts.stdout
    .split('\n')
    .map((line) => line.match(/^.+ on (.+) \(([^,]+),/))
    .filter(Boolean)
    .map(([, path, type]) => ({ path, type }))
    .filter((mount) => root === mount.path || root.startsWith(`${mount.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0]

  return mount?.type ?? (filesystemType || 'unknown')
}

export function prepareCargoEnvironment(environment, options = {}) {
  const preparedEnvironment = { ...environment }
  const warnings = []
  const platform = options.platform ?? process.platform
  const filesystemType = options.filesystemType?.toLowerCase()

  if (platform === 'darwin' && filesystemType === 'exfat' && !preparedEnvironment.CARGO_TARGET_DIR) {
    const fallback = join(
      options.temporaryDirectory ?? tmpdir(),
      'meow-starter-cargo-target',
    )
    preparedEnvironment.CARGO_TARGET_DIR = fallback
    warnings.push(`CARGO_TARGET_DIR was not set; using ${fallback} as a fallback. Its filesystem type has not been verified; set CARGO_TARGET_DIR to a native filesystem path (APFS on macOS) if Cargo fails.`)
  }

  return { environment: preparedEnvironment, warnings }
}

export async function inspectEnvironment(root, options = {}) {
  const platform = options.platform ?? process.platform
  const runCommand = options.runCommand ?? spawnSync
  const detectedFilesystemType = options.filesystemType ?? getFilesystemType(root, platform)
  const filesystemType = detectedFilesystemType.toLowerCase() === 'exfat' ? 'exfat' : detectedFilesystemType
  const warnings = []
  const tools = {
    node: getToolVersion('node', ['--version'], runCommand),
    npm: getToolVersionFromResult(runNpmCommand(['--version'], {
      platform,
      runCommand,
      spawnOptions: { encoding: 'utf8' },
    })),
    rust: getToolVersion('rustc', ['--version'], runCommand),
    cargo: getToolVersion('cargo', ['--version'], runCommand),
    tauri: getToolVersion(
      process.execPath,
      [join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'), '--version'],
      runCommand,
    ),
  }

  if (platform === 'darwin' && filesystemType.toLowerCase() === 'exfat') {
    warnings.push('exFAT volumes can create AppleDouble sidecars; set CARGO_TARGET_DIR to a native filesystem path before rust:verify.')
  }

  if (tools.node === 'missing') {
    warnings.push('Install Node.js 22 or newer from https://nodejs.org/, then retry npm run doctor.')
  }
  if (tools.npm === 'missing') {
    warnings.push('npm is missing; install it with Node.js 22 or newer, then retry npm run doctor.')
  }
  if (tools.rust === 'missing' || tools.cargo === 'missing') {
    warnings.push('Install Rust 1.77.2 or newer and Cargo via rustup from https://rustup.rs/, then retry npm run doctor.')
  }
  if (tools.tauri === 'missing') {
    warnings.push('The local Tauri CLI is missing; run npm install, then retry npm run doctor.')
  }

  return {
    filesystemType,
    warnings,
    summary: [
      `Node: ${tools.node}`,
      `npm: ${tools.npm}`,
      `Rust: ${tools.rust}`,
      `Cargo: ${tools.cargo}`,
      `Tauri CLI: ${tools.tauri}`,
      `Filesystem: ${filesystemType}`,
      'Tauri prerequisites: https://tauri.app/start/prerequisites/',
      `Package config: ${join(root, 'package.json')}`,
      `Rust config: ${join(root, 'src-tauri', 'Cargo.toml')}`,
      `Tauri config: ${join(root, 'src-tauri', 'tauri.conf.json')}`,
    ],
  }
}
