import assert from 'node:assert/strict'
import test from 'node:test'
import { isMobileUserAgent } from '../src/lib/platform.ts'

test('detects Android and iOS user agents without matching desktop', () => {
  assert.equal(isMobileUserAgent('Mozilla/5.0 (Linux; Android 15)'), true)
  assert.equal(isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'), true)
  assert.equal(isMobileUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), false)
})
