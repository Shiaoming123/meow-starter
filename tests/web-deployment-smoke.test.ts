import assert from 'node:assert/strict'
import test from 'node:test'

import {
  inspectWebDeployment,
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

function pageThatNavigatesAfterDataClick(finalUrl: string) {
  let currentUrl = 'https://example.test/app'
  const visible = { isVisible: async () => true }
  return {
    on() {},
    setDefaultTimeout() {},
    setDefaultNavigationTimeout() {},
    async route() {},
    mainFrame: () => ({}),
    goto: async () => ({ ok: () => true }),
    url: () => currentUrl,
    locator: () => visible,
    getByPlaceholder: () => visible,
    getByText: (text: string | RegExp) => text === '自动更新'
      ? { count: async () => 0 }
      : { first: () => visible },
    getByRole: (_role: string, options: { name: string }) => options.name === '数据层'
      ? { first: () => ({ click: async () => { currentUrl = finalUrl } }) }
      : visible,
  }
}

test('inspection fails when the data interaction ends off-origin or outside HTTPS', async () => {
  for (const finalUrl of ['https://other.test/app', 'http://example.test/app']) {
    const result = await inspectWebDeployment(
      pageThatNavigatesAfterDataClick(finalUrl),
      'https://example.test/app',
    )
    assert.equal(result.status, 'failed')
    assert.match(result.errors.join('\n'), /Final page URL/)
  }
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
