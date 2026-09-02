import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { removeAppleDoubleFiles } from './release-kit/appledouble.mjs'
import { inspectEnvironment } from './release-kit/environment.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const removed = await removeAppleDoubleFiles(root)
const environment = await inspectEnvironment(root)
const cargoEnvironment = { ...process.env }

if (process.platform === 'darwin' && environment.summary.at(-1) === 'Filesystem: exfat') {
  cargoEnvironment.CARGO_TARGET_DIR = join(tmpdir(), 'meow-starter-cargo-target')
}

console.log(`Removed ${removed.length} AppleDouble file(s).`)

const commands = [
  ['fmt', '--manifest-path', 'src-tauri/Cargo.toml', '--all', '--', '--check'],
  ['clippy', '--manifest-path', 'src-tauri/Cargo.toml', '--all-targets', '--all-features', '--', '-D', 'warnings'],
  ['test', '--manifest-path', 'src-tauri/Cargo.toml', '--all-features'],
  ['check', '--manifest-path', 'src-tauri/Cargo.toml', '--all-features'],
]

for (const args of commands) {
  const result = spawnSync('cargo', args, { env: cargoEnvironment, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
