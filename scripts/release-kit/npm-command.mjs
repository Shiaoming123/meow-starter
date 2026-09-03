import { spawnSync } from 'node:child_process'

export function getNpmInvocation(
  args,
  { platform = process.platform, commandShell = process.env.ComSpec ?? 'cmd.exe' } = {},
) {
  if (platform === 'win32') {
    return {
      command: commandShell,
      args: ['/d', '/s', '/c', `npm.cmd ${args.join(' ')}`],
      options: { windowsHide: true },
    }
  }

  return { command: 'npm', args: [...args], options: {} }
}

export function runNpmCommand(
  args,
  {
    platform = process.platform,
    commandShell = process.env.ComSpec ?? 'cmd.exe',
    runCommand = spawnSync,
    spawnOptions = {},
  } = {},
) {
  const invocation = getNpmInvocation(args, { platform, commandShell })
  return runCommand(invocation.command, invocation.args, {
    ...spawnOptions,
    ...invocation.options,
  })
}
