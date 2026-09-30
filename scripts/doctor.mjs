import { fileURLToPath } from 'node:url'
import { inspectEnvironment } from './release-kit/environment.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)

if (args.some((argument) => argument !== '--json')) {
  console.error('Usage: node scripts/doctor.mjs [--json]')
  process.exitCode = 1
} else {
  const result = await inspectEnvironment(root)

  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    for (const line of result.summary) console.log(line)
    for (const warning of result.warnings) console.warn(`WARN: ${warning}`)
  }
}
