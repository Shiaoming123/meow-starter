import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveCargoTargetRoot } from './package-windows.mjs'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const smokeTargetRoot = resolve(projectRoot, 'src-tauri', 'target')
const cargoTargetRoot = resolveCargoTargetRoot(projectRoot)

export function assertSmokePath(targetRoot, candidate) {
  const resolvedRoot = resolve(targetRoot)
  const resolvedCandidate = resolve(candidate)
  if (!resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`Smoke path must stay inside ${resolvedRoot}: ${resolvedCandidate}`)
  }
  return resolvedCandidate
}

export function createNsisInstallArgs(installPath) {
  return ['/S', `/D=${installPath}`]
}

export function classifyWindowsSmokePrerequisite(error) {
  const output = error && typeof error === 'object' ? error.commandOutput : undefined
  if (
    error && typeof error === 'object'
    && ((error.code === 'EPERM' && error.syscall === 'symlink')
      || (typeof output === 'string' && /symlink/i.test(output) && /(?:os error 1314|system error 1314)/i.test(output)))
  ) {
    return { status: 'skipped', reason: 'symbolic-link-permission' }
  }
  return { status: 'failed', reason: 'smoke-error' }
}

export async function createSmokeRoot(
  targetRoot,
  { create = (path) => mkdir(path, { recursive: true }), createTemporary = mkdtemp } = {},
) {
  await create(targetRoot)
  return assertSmokePath(targetRoot, await createTemporary(resolve(targetRoot, 'meow-windows-package-smoke-')))
}

export function selectNsisInstaller(candidates, productName, version) {
  const matches = candidates.filter(
    (candidate) => candidate.startsWith(`${productName}_${version}_`) && candidate.endsWith('-setup.exe'),
  )
  if (matches.length !== 1) {
    throw new Error(`Expected one NSIS installer for ${productName} ${version}, found ${matches.length}.`)
  }
  return matches[0]
}

export function resolveInstalledExecutable(installPath, binaryName) {
  return resolve(installPath, `${binaryName}.exe`)
}

export async function removeSmokeRoot(
  targetRoot,
  candidate,
  {
    remove = (path) => rm(path, { recursive: true, force: true }),
    delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)),
  } = {},
) {
  const smokeRoot = assertSmokePath(targetRoot, candidate)
  const retryDelays = [250, 500, 1_000]
  for (let attempt = 0; ; attempt += 1) {
    try {
      await remove(smokeRoot)
      return
    } catch (error) {
      const code = error && typeof error === 'object' ? error.code : undefined
      if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(code) || attempt === retryDelays.length) {
        throw error
      }
      await delay(retryDelays[attempt])
    }
  }
}

export function runCommand(command, args, options = {}, spawnProcess = spawn) {
  const { captureOutput = false, output = process, ...spawnOptions } = options
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawnProcess(command, args, {
      cwd: projectRoot,
      stdio: captureOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
      ...spawnOptions,
    })
    let commandOutput = ''
    if (captureOutput) {
      for (const [stream, destination] of [[child.stdout, output.stdout], [child.stderr, output.stderr]]) {
        stream.on('data', (chunk) => {
          destination.write(chunk)
          commandOutput = `${commandOutput}${chunk}`.slice(-16_384)
        })
      }
    }
    child.once('error', rejectCommand)
    child.once('close', (code, signal) => {
      if (code === 0) return resolveCommand()
      rejectCommand(Object.assign(new Error(`${command} exited with ${signal ?? code}`), { commandOutput }))
    })
  })
}

async function listNsisInstallers(directory) {
  try {
    const entries = await readdir(directory)
    return entries.filter((entry) => entry.endsWith('-setup.exe'))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return []
    throw error
  }
}

export async function waitForChildToStayAlive(child, durationMs) {
  await new Promise((resolveWait, rejectWait) => {
    const timer = setTimeout(() => {
      child.removeListener('exit', onExit)
      child.removeListener('error', onError)
      resolveWait()
    }, durationMs)
    const onExit = (code, signal) => {
      clearTimeout(timer)
      child.removeListener('error', onError)
      rejectWait(new Error(`Installed application exited before smoke probe completed (${signal ?? code}).`))
    }
    const onError = (error) => {
      clearTimeout(timer)
      child.removeListener('exit', onExit)
      rejectWait(error)
    }
    child.once('exit', onExit)
    child.once('error', onError)
  })
}

async function terminateChild(child) {
  if (!child?.pid || child.exitCode !== null) return
  await runCommand('taskkill', ['/pid', String(child.pid), '/t', '/f'])
  if (child.exitCode === null) await once(child, 'exit')
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('Windows package smoke only runs on Windows.')
  }

  const smokeRoot = await createSmokeRoot(smokeTargetRoot)
  const installPath = assertSmokePath(smokeRoot, resolve(smokeRoot, 'install'))
  const appDataPath = assertSmokePath(smokeRoot, resolve(smokeRoot, 'appdata'))
  const localAppDataPath = assertSmokePath(smokeRoot, resolve(smokeRoot, 'localappdata'))
  let application

  try {
    await Promise.all([mkdir(installPath), mkdir(appDataPath), mkdir(localAppDataPath)])
    const tauriCli = resolve(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
    const nsisDirectory = resolve(cargoTargetRoot, 'release', 'bundle', 'nsis')
    const tauriConfig = JSON.parse(
      await readFile(resolve(projectRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'),
    )
    const cargoManifest = await readFile(resolve(projectRoot, 'src-tauri', 'Cargo.toml'), 'utf8')
    const cargoPackageName = cargoManifest.match(/^name\s*=\s*"([^"]+)"/m)?.[1]
    if (!cargoPackageName) throw new Error('Could not read the Cargo package name for the installed executable.')
    const binaryName = tauriConfig.mainBinaryName?.trim() || cargoPackageName
    await runCommand(process.execPath, [
      tauriCli,
      'build',
      '--bundles',
      'nsis',
      '--no-sign',
      '--config',
      '{"bundle":{"createUpdaterArtifacts":false}}',
    ], { captureOutput: true, env: { ...process.env, CARGO_TARGET_DIR: cargoTargetRoot } })

    const installerName = selectNsisInstaller(
      await listNsisInstallers(nsisDirectory),
      tauriConfig.productName,
      tauriConfig.version,
    )
    const installerPath = resolve(nsisDirectory, installerName)
    await runCommand(installerPath, createNsisInstallArgs(installPath))

    const executablePath = assertSmokePath(
      installPath,
      resolveInstalledExecutable(installPath, binaryName),
    )
    const executableStat = await stat(executablePath)
    if (!executableStat.isFile()) throw new Error(`Installed application is missing: ${executablePath}`)

    application = spawn(executablePath, [], {
      cwd: installPath,
      windowsHide: true,
      env: {
        ...process.env,
        APPDATA: appDataPath,
        LOCALAPPDATA: localAppDataPath,
      },
    })
    await waitForChildToStayAlive(application, 2_000)
    return { status: 'passed', installerPath }
  } finally {
    let terminationError
    try {
      await terminateChild(application)
    } catch (error) {
      terminationError = error
    }
    if (!application?.pid || application.exitCode !== null || application.signalCode !== null) {
      await removeSmokeRoot(smokeTargetRoot, smokeRoot)
    }
    if (terminationError) throw terminationError
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().then((result) => {
    console.log(JSON.stringify(result))
  }).catch((error) => {
    const result = classifyWindowsSmokePrerequisite(error)
    console.error(JSON.stringify({ ...result, error: error instanceof Error ? error.message : String(error) }))
    process.exitCode = result.status === 'skipped' ? 2 : 1
  })
}
