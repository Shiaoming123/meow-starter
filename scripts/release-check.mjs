import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { inspectReleaseConfig } from './release-kit/config.mjs'

const mode = process.argv.includes('--mode=release') ? 'release' : 'template'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const result = await inspectReleaseConfig(root, mode)

for (const line of result.summary) console.log(line)
for (const warning of result.warnings) console.log(`WARN ${warning}`)
for (const error of result.errors) console.error(`ERROR ${error}`)

if (result.errors.length > 0) process.exitCode = 1
