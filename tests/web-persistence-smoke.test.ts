import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTodoMarker,
  findAvailableLoopbackPort,
  resolveBrowserExecutable,
  webSmokeUrl,
} from '../scripts/smoke-web-persistence.mjs'

test('prefers an explicit browser path and otherwise selects an existing Windows browser', () => {
  assert.equal(
    resolveBrowserExecutable({
      platform: 'win32',
      env: { MEOW_BROWSER_PATH: 'D:/tools/browser.exe' },
      exists: () => true,
    }),
    'D:/tools/browser.exe',
  )

  assert.match(
    resolveBrowserExecutable({
      platform: 'win32',
      env: {},
      exists: (path) => path.endsWith('msedge.exe'),
    }),
    /msedge\.exe$/,
  )
})

test('uses a loopback URL and unique Todo marker', () => {
  assert.equal(webSmokeUrl(4175), 'http://127.0.0.1:4175/')
  assert.match(createTodoMarker('2026-09-03T00:00:00.000Z'), /^meow-web-smoke-/)
})

test('selects a currently available loopback port for the smoke server', async () => {
  const port = await findAvailableLoopbackPort()
  assert.equal(Number.isInteger(port), true)
  assert.ok(port > 0 && port <= 65535)
})
