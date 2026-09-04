import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const tauriTargetRoot = resolve(projectRoot, 'src-tauri', 'target')

export function assertSmokePath(targetRoot, candidate) {
  const resolvedRoot = resolve(targetRoot)
  const resolvedCandidate = resolve(candidate)
  if (!resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`Smoke path must stay inside ${resolvedRoot}: ${resolvedCandidate}`)
  }
  return resolvedCandidate
}

export function createNsisInstallArgs(_installerPath, installPath) {
  return ['/S', `/D=${installPath}`]
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

function runCommand(command, args, options = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit', windowsHide: true, ...options })
    child.once('error', rejectCommand)
    child.once('exit', (code, signal) => {
      if (code === 0) return resolveCommand()
      rejectCommand(new Error(`${command} exited with ${signal ?? code}`))
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

async function waitForChildToStayAlive(child, durationMs) {
  await new Promise((resolveWait, rejectWait) => {
    const timer = setTimeout(() => {
      child.removeListener('exit', onExit)
      resolveWait()
    }, durationMs)
    const onExit = (code, signal) => {
      clearTimeout(timer)
      rejectWait(new Error(`Installed application exited before smoke probe completed (${signal ?? code}).`))
    }
    child.once('exit', onExit)
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

  const smokeRoot = assertSmokePath(
    tauriTargetRoot,
    await mkdtemp(resolve(tauriTargetRoot, 'meow-windows-package-smoke-')),
  )
  const installPath = assertSmokePath(smokeRoot, resolve(smokeRoot, 'install'))
  const appDataPath = assertSmokePath(smokeRoot, resolve(smokeRoot, 'appdata'))
  const localAppDataPath = assertSmokePath(smokeRoot, resolve(smokeRoot, 'localappdata'))
  let application

  try {
    await Promise.all([mkdir(installPath), mkdir(appDataPath), mkdir(localAppDataPath)])
    const tauriCli = resolve(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
    const nsisDirectory = resolve(tauriTargetRoot, 'release', 'bundle', 'nsis')
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
    ])

    const installerName = selectNsisInstaller(
      await listNsisInstallers(nsisDirectory),
      tauriConfig.productName,
      tauriConfig.version,
    )
    const installerPath = resolve(nsisDirectory, installerName)
    await runCommand(installerPath, createNsisInstallArgs(installerPath, installPath))

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
    console.log(`Windows package smoke passed: ${installerPath}`)
  } finally {
    await terminateChild(application)
    await removeSmokeRoot(tauriTargetRoot, smokeRoot)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
