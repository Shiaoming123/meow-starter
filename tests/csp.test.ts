import assert from 'node:assert/strict'
import test from 'node:test'
import { validateProductionCsp } from '../scripts/check-tauri-csp.mjs'

test('accepts the minimum same-origin Tauri IPC policy', () => {
  assert.deepEqual(validateProductionCsp("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; base-uri 'self'; form-action 'self'"), [])
})

test('rejects a disabled or overly broad production CSP', () => {
  assert.match(validateProductionCsp(null).join('\n'), /must not be null/)
  assert.match(validateProductionCsp("default-src *; script-src 'self' 'unsafe-eval'").join('\n'), /wildcard|unsafe-eval/)
})
