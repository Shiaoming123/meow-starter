import { spawnSync } from 'node:child_process'

const commands = ['test', 'typecheck', 'build', 'build:web', 'check:layout', 'check:docs']

for (const command of commands) {
  const result = spawnSync('npm', ['run', command], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
