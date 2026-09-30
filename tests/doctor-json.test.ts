import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { inspectEnvironment } from '../scripts/release-kit/environment.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const doctor = join(root, 'scripts', 'doctor.mjs')

test('environment diagnostics expose versioned structured tool and configuration fields', async () => {
  const versions = new Map([
    ['node', 'v22.20.0'],
    ['npm', '10.9.3'],
    ['rustc', 'rustc 1.90.0'],
    ['cargo', 'cargo 1.90.0'],
    [process.execPath, 'tauri-cli 2.8.4'],
  ])
  const report = await inspectEnvironment(root, {
    platform: 'linux',
    filesystemType: 'unavailable (requires macOS)',
    runCommand: (command) => ({ status: 0, stdout: `${versions.get(command)}\n`, stderr: '' }),
  })

  assert.equal(report.schemaVersion, 1)
  assert.equal(report.platform, 'linux')
  assert.deepEqual(report.tools, {
    node: 'v22.20.0',
    npm: '10.9.3',
    rust: 'rustc 1.90.0',
    cargo: 'cargo 1.90.0',
    tauri: 'tauri-cli 2.8.4',
  })
  assert.deepEqual(report.configPaths, {
    package: join(root, 'package.json'),
    rust: join(root, 'src-tauri', 'Cargo.toml'),
    tauri: join(root, 'src-tauri', 'tauri.conf.json'),
  })
  assert.equal(report.prerequisites, 'https://tauri.app/start/prerequisites/')
  assert.deepEqual(report.warnings, [])
})

test('structured diagnostics preserve missing-tool warnings without exposing command errors', async () => {
  const report = await inspectEnvironment(root, {
    platform: 'linux',
    filesystemType: 'unavailable',
    runCommand: () => ({ status: 1, stdout: 'private command output', stderr: 'private error' }),
  })

  assert.deepEqual(report.tools, {
    node: 'missing', npm: 'missing', rust: 'missing', cargo: 'missing', tauri: 'missing',
  })
  assert.match(report.warnings.join('\n'), /Install Node.js 22/)
  assert.match(report.warnings.join('\n'), /rustup/)
  assert.equal(JSON.stringify(report).includes('private'), false)
})

test('doctor --json emits only one JSON report with warnings inside it', () => {
  const result = spawnSync(process.execPath, [doctor, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, MEOW_DOCTOR_TEST_SECRET: 'must-not-appear-in-diagnostics' },
  })

  assert.equal(result.status, 0)
  const report = JSON.parse(result.stdout)
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.platform, process.platform)
  assert.equal(report.tools.node, process.version)
  assert.ok(Array.isArray(report.warnings))
  assert.equal(result.stderr, '')
  assert.equal(result.stdout.includes('must-not-appear-in-diagnostics'), false)
})

test('doctor keeps the default human-readable report', () => {
  const result = spawnSync(process.execPath, [doctor], { encoding: 'utf8' })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /^Node: v/m)
  assert.match(result.stdout, /^Tauri prerequisites: https:\/\/tauri.app\/start\/prerequisites\//m)
  assert.match(result.stdout, /^Package config:/m)
})

test('doctor rejects unknown arguments instead of silently ignoring them', () => {
  for (const args of [['--jsno'], ['--json', '--unexpected']]) {
    const result = spawnSync(process.execPath, [doctor, ...args], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /Usage:.*doctor.*\[--json\]/)
  }
})
