import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ANDROID_TARGETS = [
  'aarch64-linux-android',
  'armv7-linux-androideabi',
  'i686-linux-android',
  'x86_64-linux-android',
]

const IOS_TARGETS = [
  'aarch64-apple-ios',
  'x86_64-apple-ios',
  'aarch64-apple-ios-sim',
]

export function inspectMobileToolchains({
  platform = process.platform,
  environment = process.env,
  runCommand = spawnSync,
} = {}) {
  return {
    android: inspectAndroid({ environment, runCommand }),
    ios: inspectIos({ platform, runCommand }),
  }
}

function inspectAndroid({ environment, runCommand }) {
  const errors = []
  const summary = []
  if (!environment.ANDROID_HOME && !environment.ANDROID_SDK_ROOT) {
    errors.push('Set ANDROID_HOME or ANDROID_SDK_ROOT to an Android SDK directory.')
  }
  if (!environment.NDK_HOME) errors.push('Set NDK_HOME to an installed Android NDK directory.')
  if (!environment.JAVA_HOME) errors.push('Set JAVA_HOME to a JDK directory.')

  const adbVersion = run(runCommand, 'adb', ['version'])
  if (adbVersion.status !== 0) {
    errors.push('Install Android platform-tools so adb is available.')
  }

  const installedTargets = installedRustTargets(runCommand)
  const missingTargets = ANDROID_TARGETS.filter((target) => !installedTargets.includes(target))
  if (missingTargets.length > 0) {
    errors.push(`Install Rust Android targets: ${missingTargets.join(', ')}.`)
  }

  const devices = adbVersion.status === 0 ? androidDevices(run(runCommand, 'adb', ['devices']).stdout) : []
  summary.push(`Android SDK environment: ${environment.ANDROID_HOME || environment.ANDROID_SDK_ROOT ? 'configured' : 'missing'}`)
  summary.push(`Android NDK environment: ${environment.NDK_HOME ? 'configured' : 'missing'}`)
  summary.push(`Java environment: ${environment.JAVA_HOME ? 'configured' : 'missing'}`)
  summary.push(`Android platform-tools: ${adbVersion.status === 0 ? 'available' : 'missing'}`)
  summary.push(`Android Rust targets: ${missingTargets.length === 0 ? 'available' : `missing ${missingTargets.length}`}`)
  summary.push(`Android device/emulator: ${devices.length > 0 ? devices.join(', ') : 'none detected'}`)

  return { state: errors.length === 0 ? 'ready' : 'missing-prerequisites', errors, summary, devices }
}

function inspectIos({ platform, runCommand }) {
  if (platform !== 'darwin') {
    return {
      state: 'unavailable',
      errors: [],
      summary: ['iOS toolchain: unavailable (requires macOS with full Xcode).'],
    }
  }

  const errors = []
  const xcode = run(runCommand, 'xcodebuild', ['-version'])
  const pod = run(runCommand, 'pod', ['--version'])
  const installedTargets = installedRustTargets(runCommand)
  const missingTargets = IOS_TARGETS.filter((target) => !installedTargets.includes(target))
  if (xcode.status !== 0) errors.push('Install full Xcode and accept its license.')
  if (pod.status !== 0) errors.push('Install CocoaPods so pod is available.')
  if (missingTargets.length > 0) errors.push(`Install Rust iOS targets: ${missingTargets.join(', ')}.`)

  return {
    state: errors.length === 0 ? 'ready' : 'missing-prerequisites',
    errors,
    summary: [
      `Xcode: ${xcode.status === 0 ? 'available' : 'missing'}`,
      `CocoaPods: ${pod.status === 0 ? 'available' : 'missing'}`,
      `iOS Rust targets: ${missingTargets.length === 0 ? 'available' : `missing ${missingTargets.length}`}`,
      'iOS device/simulator: not inspected; select one before running an explicit Tauri command.',
    ],
  }
}

function installedRustTargets(runCommand) {
  const result = run(runCommand, 'rustup', ['target', 'list', '--installed'])
  return result.status === 0 ? result.stdout.split(/\r?\n/).filter(Boolean) : []
}

function androidDevices(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([id, state]) => id && state === 'device')
    .map(([id]) => id)
}

function run(runCommand, command, args) {
  try {
    const result = runCommand(command, args, { encoding: 'utf8' })
    return {
      status: result?.status ?? 1,
      stdout: typeof result?.stdout === 'string' ? result.stdout : '',
    }
  } catch {
    return { status: 1, stdout: '' }
  }
}

function main() {
  const result = inspectMobileToolchains()
  for (const target of ['android', 'ios']) {
    const report = result[target]
    console.log(`${target}: ${report.state}`)
    for (const line of report.summary) console.log(`  ${line}`)
    for (const error of report.errors) console.warn(`  WARN ${error}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
