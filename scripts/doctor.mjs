import { fileURLToPath } from 'node:url'
import { inspectEnvironment } from './release-kit/environment.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const result = await inspectEnvironment(root)

for (const line of result.summary) console.log(line)
for (const warning of result.warnings) console.warn(`WARN: ${warning}`)
