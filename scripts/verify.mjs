import { runNpmCommand } from './release-kit/npm-command.mjs'

const commands = [
  ['run', 'test'],
  ['run', 'check:protocol'],
  ['run', 'check:csp'],
  ['run', 'check:modules'],
  ['run', 'check:modules', '--', 'web'],
  ['run', 'check:modules', '--', 'mobile'],
  ['run', 'typecheck'],
  ['run', 'build'],
  ['run', 'build:web'],
  ['run', 'check:layout'],
  ['run', 'check:docs'],
]

for (const command of commands) {
  const result = runNpmCommand(command, { spawnOptions: { stdio: 'inherit' } })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
