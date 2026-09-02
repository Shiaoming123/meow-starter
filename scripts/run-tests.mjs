import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const testsDir = fileURLToPath(new URL('../tests/', import.meta.url))

export function isRunnableTestFile(file) {
  const name = basename(file)
  return !name.startsWith('._') && name.endsWith('.test.ts')
}

function main() {
  const files = readdirSync(testsDir)
    .filter(isRunnableTestFile)
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
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
