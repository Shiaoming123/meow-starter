import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { inspectReleaseConfig } from './release-kit/config.mjs'

function parseMode(args) {
  let mode = 'template'
  let modeWasProvided = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument !== '--mode' && !argument.startsWith('--mode=')) continue

    const value = argument === '--mode' ? args[index += 1] : argument.slice('--mode='.length)
    if (value !== 'template' && value !== 'release') {
      throw new TypeError(`Unknown release check mode: ${value ?? '(missing)'}. Expected template or release.`)
    }
    if (modeWasProvided) {
      throw new TypeError('Release check mode may be provided only once.')
    }

    mode = value
    modeWasProvided = true
  }

  return mode
}

let mode
try {
  mode = parseMode(process.argv.slice(2))
} catch (error) {
  console.error(`ERROR ${error.message}`)
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = await inspectReleaseConfig(root, mode)

for (const line of result.summary) console.log(line)
for (const warning of result.warnings) console.log(`WARN ${warning}`)
for (const error of result.errors) console.error(`ERROR ${error}`)

if (result.errors.length > 0) process.exitCode = 1
