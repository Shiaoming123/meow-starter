import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseDeploymentUrl,
  summarizeDeploymentInspection,
} from '../scripts/smoke-web-deployment.mjs'

test('deployment URL requires credential-free HTTPS and removes non-origin display data', () => {
  assert.throws(() => parseDeploymentUrl(), /MEOW_DEPLOYMENT_URL/)
  assert.throws(() => parseDeploymentUrl('http://example.test'), /HTTPS/)
  assert.throws(() => parseDeploymentUrl('https://user:secret@example.test'), /credentials/)

  const parsed = parseDeploymentUrl('https://example.test/app?token=secret#private')
  assert.equal(parsed.href, 'https://example.test/app?token=secret#private')
  assert.equal(parsed.safeUrl, 'https://example.test/app')
  assert.equal(parsed.origin, 'https://example.test')
})

test('inspection status passes only with complete visible evidence and no browser errors', () => {
  const url = parseDeploymentUrl('https://example.test/app')
  const evidence = {
    mainResponseOk: true,
    shellVisible: true,
    updaterAbsent: true,
    todoInputVisible: true,
    todoAddVisible: true,
    indexedDbLabelVisible: true,
  }

  assert.deepEqual(summarizeDeploymentInspection(url, evidence, []), {
    status: 'passed',
    url: 'https://example.test/app',
    evidence,
    errors: [],
  })
  assert.equal(
    summarizeDeploymentInspection(url, { ...evidence, todoInputVisible: false }, []).status,
    'failed',
  )
  assert.equal(
    summarizeDeploymentInspection(url, evidence, ['console: uncaught failure']).status,
    'failed',
  )
})
