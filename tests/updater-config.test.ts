import test from 'node:test'
import assert from 'node:assert/strict'
import { isUpdaterEndpointConfigured } from '../src/lib/updater-config.ts'

test('rejects missing and template updater endpoints', () => {
  assert.equal(isUpdaterEndpointConfigured([]), false)
  assert.equal(
    isUpdaterEndpointConfigured([
      'https://github.com/OWNER/REPO/releases/latest/download/latest.json',
    ]),
    false,
  )
})

test('accepts an explicit HTTPS updater endpoint', () => {
  assert.equal(
    isUpdaterEndpointConfigured([
      'https://github.com/acme/desktop/releases/latest/download/latest.json',
    ]),
    true,
  )
})

test('rejects insecure or malformed updater endpoints', () => {
  assert.equal(
    isUpdaterEndpointConfigured([
      'http://github.com/acme/desktop/releases/latest/download/latest.json',
    ]),
    false,
  )
  assert.equal(isUpdaterEndpointConfigured(['not a URL']), false)
})
