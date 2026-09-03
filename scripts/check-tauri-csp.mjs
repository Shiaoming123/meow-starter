import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const required = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'"],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'ipc:', 'http://ipc.localhost'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
}

export function validateProductionCsp(csp) {
  if (typeof csp !== 'string' || csp.trim() === '') return ['app.security.csp must not be null or empty.']
  const directives = new Map(csp.split(';').map((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/)
    return [name, sources]
  }))
  const errors = []
  for (const [name, sources] of directives) {
    if (sources.includes('*')) errors.push(`${name} must not allow a wildcard.`)
    if (sources.includes("'unsafe-eval'")) errors.push(`${name} must not allow unsafe-eval.`)
  }
  for (const [name, expected] of Object.entries(required)) {
    const sources = directives.get(name) ?? []
    for (const source of expected) if (!sources.includes(source)) errors.push(`${name} must include ${source}.`)
  }
  return errors
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'))
  const errors = validateProductionCsp(config.app?.security?.csp)
  for (const error of errors) console.error(`ERROR ${error}`)
  if (errors.length > 0) process.exitCode = 1
  else console.log('Tauri production CSP is valid.')
}
