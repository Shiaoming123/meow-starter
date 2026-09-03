import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectMobileToolchains } from '../scripts/mobile-doctor.mjs'

test('reports Android prerequisites without printing environment values', () => {
  const result = inspectMobileToolchains({
    platform: 'win32',
    environment: {},
    runCommand: () => ({ status: 1, stdout: '', stderr: '' }),
  })

  assert.deepEqual(result.android.errors, [
    'Set ANDROID_HOME or ANDROID_SDK_ROOT to an Android SDK directory.',
    'Set NDK_HOME to an installed Android NDK directory.',
    'Set JAVA_HOME to a JDK directory.',
    'Install Android platform-tools so adb is available.',
    'Install Rust Android targets: aarch64-linux-android, armv7-linux-androideabi, i686-linux-android, x86_64-linux-android.',
  ])
  assert.equal(result.android.summary.some((line) => line.includes('ANDROID_HOME=')), false)
  assert.equal(result.ios.state, 'unavailable')
})

test('reports an available Android device separately from toolchain readiness', () => {
  const result = inspectMobileToolchains({
    platform: 'win32',
    environment: { ANDROID_HOME: 'configured', NDK_HOME: 'configured', JAVA_HOME: 'configured' },
    runCommand: (command, args) => {
      if (command === 'rustup') {
        return {
          status: 0,
          stdout: 'aarch64-linux-android\narmv7-linux-androideabi\ni686-linux-android\nx86_64-linux-android\n',
        }
      }
      if (command === 'adb' && args[0] === 'version') return { status: 0, stdout: 'Android Debug Bridge' }
      if (command === 'adb' && args[0] === 'devices') return { status: 0, stdout: 'List of devices attached\nemulator-5554\tdevice\n' }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`)
    },
  })

  assert.deepEqual(result.android.errors, [])
  assert.deepEqual(result.android.devices, ['emulator-5554'])
  assert.match(result.android.summary.join('\n'), /Android device\/emulator: emulator-5554/)
})
