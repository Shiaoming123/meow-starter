import { runNpmCommand } from './release-kit/npm-command.mjs'

const commands = ['test', 'check:protocol', 'typecheck', 'build', 'build:web', 'check:layout', 'check:docs']

for (const command of commands) {
  const result = runNpmCommand(['run', command], { spawnOptions: { stdio: 'inherit' } })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
