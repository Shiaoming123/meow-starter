import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const testsDir = fileURLToPath(new URL('../tests/', import.meta.url))
const files = readdirSync(testsDir)
  .filter((file) => file.endsWith('.test.ts'))
  .sort()
  .map((file) => fileURLToPath(new URL(`../tests/${file}`, import.meta.url)))

if (files.length === 0) {
  console.error('No test files found in tests/')
  process.exit(1)
}

const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--test', ...files],
  { stdio: 'inherit' },
)

process.exit(result.status ?? 1)
