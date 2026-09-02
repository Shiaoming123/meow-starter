import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { removeAppleDoubleFiles } from './release-kit/appledouble.mjs'
import { inspectEnvironment, prepareCargoEnvironment } from './release-kit/environment.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const removed = await removeAppleDoubleFiles(root)
const environment = await inspectEnvironment(root)
const cargo = prepareCargoEnvironment(process.env, {
  filesystemType: environment.filesystemType,
  platform: process.platform,
})

console.log(`Removed ${removed.length} AppleDouble file(s).`)
for (const warning of cargo.warnings) console.warn(`WARN: ${warning}`)

const commands = [
  ['fmt', '--manifest-path', 'src-tauri/Cargo.toml', '--all', '--', '--check'],
  ['clippy', '--manifest-path', 'src-tauri/Cargo.toml', '--all-targets', '--all-features', '--', '-D', 'warnings'],
  ['test', '--manifest-path', 'src-tauri/Cargo.toml', '--all-features'],
  ['check', '--manifest-path', 'src-tauri/Cargo.toml', '--all-features'],
]

for (const args of commands) {
  const result = spawnSync('cargo', args, { env: cargo.environment, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
