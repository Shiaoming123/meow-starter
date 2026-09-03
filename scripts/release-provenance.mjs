import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createReleaseProvenance } from './release-kit/provenance.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const result = createReleaseProvenance({
  packageJson,
  environment: process.env,
  runGit: (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }),
})

for (const error of result.errors) console.error(`ERROR ${error}`)
if (result.errors.length > 0) {
  process.exitCode = 1
} else {
  console.log(JSON.stringify(result.provenance))
}
