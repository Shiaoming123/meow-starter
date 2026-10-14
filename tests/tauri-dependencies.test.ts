import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const npmLock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
const cargoLock = readFileSync(new URL('../src-tauri/Cargo.lock', import.meta.url), 'utf8')
const cargoVersions = new Map(
  cargoLock.split('[[package]]').slice(1).map((entry) => [
    entry.match(/^name = "([^"]+)"$/m)?.[1],
    entry.match(/^version = "([^"]+)"$/m)?.[1],
  ]),
)

test('Tauri core npm packages and Rust runtime share a minor version', () => {
  const rustMinor = cargoVersions.get('tauri')?.split('.').slice(0, 2).join('.')
  assert.ok(rustMinor)
  for (const name of ['@tauri-apps/api', '@tauri-apps/cli']) {
    assert.equal(npmLock.packages[`node_modules/${name}`].version.split('.').slice(0, 2).join('.'), rustMinor, name)
  }
})

test('each Tauri plugin npm package matches its locked Rust counterpart exactly', () => {
  for (const name of Object.keys(packageJson.dependencies).filter((name) => name.startsWith('@tauri-apps/plugin-'))) {
    const rustName = name.replace('@tauri-apps/', 'tauri-')
    assert.equal(npmLock.packages[`node_modules/${name}`].version, cargoVersions.get(rustName), name)
  }
})
