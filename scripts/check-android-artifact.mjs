import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function parseAndroidBadging(output) {
  const packageMatch = output.match(/package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/)
  const minSdkMatch = output.match(/^sdkVersion:'(\d+)'/m)
  const targetSdkMatch = output.match(/^targetSdkVersion:'(\d+)'/m)
  const nativeCodeMatch = output.match(/^native-code:(.*)$/m)

  return {
    packageName: packageMatch?.[1],
    versionCode: packageMatch?.[2],
    versionName: packageMatch?.[3],
    minSdk: minSdkMatch ? Number(minSdkMatch[1]) : undefined,
    targetSdk: targetSdkMatch ? Number(targetSdkMatch[1]) : undefined,
    abis: nativeCodeMatch ? [...nativeCodeMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]) : [],
  }
}

export function validateAndroidBadging(metadata, { identifier, version }) {
  const errors = []
  if (metadata.packageName !== identifier.replaceAll('-', '_')) {
    errors.push('APK package name does not match the Tauri identifier.')
  }
  if (metadata.versionName !== version) {
    errors.push('APK versionName does not match package.json.')
  }
  if (!Number.isInteger(metadata.minSdk) || !Number.isInteger(metadata.targetSdk)) {
    errors.push('APK must declare numeric minSdk and targetSdk values.')
  }
  if (metadata.abis.length === 0) errors.push('APK must contain at least one native ABI.')
  return errors
}

function parseArgs(args) {
  if (args.length !== 2 || args[0] !== '--apk' || args[1].trim() === '') {
    throw new TypeError('Usage: npm run check:android-artifact -- --apk <path-to-apk>')
  }
  return resolve(args[1])
}

function findAapt(androidHome) {
  if (!androidHome) throw new Error('ANDROID_HOME must be set to inspect an Android APK.')
  const buildTools = join(androidHome, 'build-tools')
  const executable = process.platform === 'win32' ? 'aapt.exe' : 'aapt'
  const versions = readdirSync(buildTools, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))

  const path = versions.map((version) => join(buildTools, version, executable)).find(existsSync)
  if (!path) throw new Error('No Android build-tools aapt executable was found.')
  return path
}

function main() {
  try {
    const apk = parseArgs(process.argv.slice(2))
    if (!existsSync(apk)) throw new Error(`APK does not exist: ${apk}`)

    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const tauriConfig = JSON.parse(readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'))
    const badging = execFileSync(findAapt(process.env.ANDROID_HOME), ['dump', 'badging', apk], {
      encoding: 'utf8',
    })
    const metadata = parseAndroidBadging(badging)
    const errors = validateAndroidBadging(metadata, {
      identifier: tauriConfig.identifier,
      version: packageJson.version,
    })
    if (errors.length > 0) throw new Error(errors.join('\n'))

    console.log(`Android APK verified: ${metadata.packageName} ${metadata.versionName} (${metadata.abis.join(', ')})`)
  } catch (error) {
    console.error(`ERROR ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
