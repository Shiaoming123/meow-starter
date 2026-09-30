import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveBrowserExecutable } from './smoke-web-persistence.mjs'

const DEFAULT_TIMEOUT_MS = 15_000
const REQUIRED_EVIDENCE = [
  'mainResponseOk',
  'shellVisible',
  'updaterAbsent',
  'todoInputVisible',
  'todoAddVisible',
  'indexedDbLabelVisible',
]

export function parseDeploymentUrl(rawUrl = '') {
  const value = rawUrl.trim()
  if (!value) throw new Error('MEOW_DEPLOYMENT_URL is required for this opt-in smoke.')

  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('MEOW_DEPLOYMENT_URL must be a valid HTTPS URL.')
  }
  if (url.protocol !== 'https:') throw new Error('MEOW_DEPLOYMENT_URL must use HTTPS.')
  if (url.username || url.password) {
    throw new Error('MEOW_DEPLOYMENT_URL must not contain embedded credentials.')
  }

  const safe = new URL(url)
  safe.search = ''
  safe.hash = ''
  return { href: url.href, origin: url.origin, safeUrl: safe.href }
}

export function summarizeDeploymentInspection(url, evidence, errors) {
  const missing = REQUIRED_EVIDENCE.filter((name) => evidence[name] !== true)
  return {
    status: missing.length === 0 && errors.length === 0 ? 'passed' : 'failed',
    url: url.safeUrl,
    evidence,
    errors: [...errors, ...missing.map((name) => `Missing required evidence: ${name}`)],
  }
}

function isAuthorizedPageUrl(candidate, origin) {
  const url = new URL(candidate)
  return url.protocol === 'https:' && url.origin === origin
}

export async function inspectWebDeployment(page, deploymentUrl, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = typeof deploymentUrl === 'string' ? parseDeploymentUrl(deploymentUrl) : deploymentUrl
  const errors = []
  let consoleErrorCount = 0
  let pageErrorCount = 0

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrorCount += 1
  })
  page.on('pageerror', () => { pageErrorCount += 1 })
  page.setDefaultTimeout(timeoutMs)
  page.setDefaultNavigationTimeout(timeoutMs)

  await page.route('**/*', async (route) => {
    const request = route.request()
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      const target = new URL(request.url())
      if (target.protocol !== 'https:' || target.origin !== url.origin) {
        errors.push('Blocked primary navigation outside the authorized HTTPS origin.')
        await route.abort('blockedbyclient')
        return
      }
    }
    await route.fallback()
  })

  const evidence = {
    mainResponseOk: false,
    shellVisible: false,
    updaterAbsent: false,
    todoInputVisible: false,
    todoAddVisible: false,
    indexedDbLabelVisible: false,
    consoleErrorCount: 0,
    pageErrorCount: 0,
  }

  try {
    const response = await page.goto(url.href, { waitUntil: 'networkidle', timeout: timeoutMs })
    if (!isAuthorizedPageUrl(page.url(), url.origin)) {
      errors.push('Final page URL left the authorized HTTPS origin.')
      return summarizeDeploymentInspection(url, evidence, errors)
    }
    evidence.mainResponseOk = response?.ok() === true
    if (!evidence.mainResponseOk) errors.push('Main document did not return a successful response.')

    evidence.shellVisible = await page.locator('.shell').isVisible()
    evidence.updaterAbsent = (await page.getByText('自动更新', { exact: true }).count()) === 0
    await page.getByRole('button', { name: '数据层', exact: true }).first().click()
    evidence.todoInputVisible = await page.getByPlaceholder('写点什么…', { exact: true }).isVisible()
    evidence.todoAddVisible = await page.getByRole('button', { name: '添加', exact: true }).isVisible()
    evidence.indexedDbLabelVisible = await page.getByText(/IndexedDB/).first().isVisible()
    if (!isAuthorizedPageUrl(page.url(), url.origin)) {
      errors.push('Final page URL left the authorized HTTPS origin.')
    }
  } catch {
    errors.push('Deployment inspection could not complete within the allowed page flow.')
  }

  evidence.consoleErrorCount = consoleErrorCount
  evidence.pageErrorCount = pageErrorCount
  if (consoleErrorCount > 0) errors.push(`Browser console errors captured: ${consoleErrorCount}`)
  if (pageErrorCount > 0) errors.push(`Page errors captured: ${pageErrorCount}`)
  return summarizeDeploymentInspection(url, evidence, errors)
}

async function main() {
  let url
  try {
    url = parseDeploymentUrl(process.env.MEOW_DEPLOYMENT_URL)
  } catch (error) {
    console.log(JSON.stringify({
      status: 'prerequisite_failed',
      url: null,
      evidence: {},
      errors: [error instanceof Error ? error.message : 'Invalid deployment URL.'],
    }))
    process.exitCode = 1
    return
  }

  const executablePath = resolveBrowserExecutable()
  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  try {
    const result = await inspectWebDeployment(await context.newPage(), url)
    console.log(JSON.stringify(result))
    if (result.status !== 'passed') process.exitCode = 1
  } finally {
    await context.close()
    await browser.close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => {
    console.log(JSON.stringify({
      status: 'failed',
      url: null,
      evidence: {},
      errors: ['Deployment smoke could not start.'],
    }))
    process.exitCode = 1
  })
}
