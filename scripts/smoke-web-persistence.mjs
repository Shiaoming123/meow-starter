import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getNpmInvocation } from './release-kit/npm-command.mjs'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

export async function findAvailableLoopbackPort() {
  const server = createServer()
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  await new Promise((resolveClose, rejectClose) => server.close((error) => (
    error ? rejectClose(error) : resolveClose()
  )))
  if (!address || typeof address === 'string') throw new Error('Could not allocate a loopback smoke port.')
  return address.port
}

export function webSmokeUrl(port) {
  return `http://127.0.0.1:${port}/`
}

export function createTodoMarker(now = new Date().toISOString()) {
  return `meow-web-smoke-${now.replace(/[^a-zA-Z0-9]+/g, '-')}`
}

export function resolveBrowserExecutable({
  platform = process.platform,
  env = process.env,
  exists = existsSync,
} = {}) {
  const explicitPath = env.MEOW_BROWSER_PATH?.trim()
  if (explicitPath) {
    if (!exists(explicitPath)) {
      throw new Error(`MEOW_BROWSER_PATH does not exist: ${explicitPath}`)
    }
    return explicitPath
  }

  const candidates =
    platform === 'win32'
      ? [
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : platform === 'darwin'
        ? [
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          ]
        : ['/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium']

  const executable = candidates.find((candidate) => exists(candidate))
  if (!executable) {
    throw new Error(
      'No supported local browser was found. Install Edge or Chrome, or set MEOW_BROWSER_PATH to its executable.',
    )
  }
  return executable
}

function runCommand(command, args, options = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit', ...options })
    child.once('error', rejectCommand)
    child.once('exit', (code, signal) => {
      if (code === 0) return resolveCommand()
      rejectCommand(new Error(`${command} exited with ${signal ?? code}`))
    })
  })
}

async function waitForPreview(url) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Vite has not started listening yet.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
  }
  throw new Error(`Timed out waiting for Web preview at ${url}`)
}

function stopPreview(preview) {
  if (!preview.killed) preview.kill()
}

async function main() {
  const npm = getNpmInvocation(['run', 'build:web'])
  await runCommand(npm.command, npm.args, npm.options)

  const previewPort = await findAvailableLoopbackPort()
  const url = webSmokeUrl(previewPort)
  const viteCli = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  const preview = spawn(
    process.execPath,
    [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    { cwd: projectRoot, stdio: 'inherit', windowsHide: true },
  )

  try {
    await waitForPreview(url)
    const executablePath = resolveBrowserExecutable()
    const { chromium } = await import('playwright-core')
    const browser = await chromium.launch({ executablePath, headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    })
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`))

    try {
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.locator('.shell').waitFor({ state: 'visible' })
      if (await page.getByText('自动更新', { exact: true }).count()) {
        throw new Error('Web preview rendered a desktop-only updater entry.')
      }

      await page.getByRole('button', { name: '数据层', exact: true }).first().click()
      const marker = createTodoMarker()
      await page.getByPlaceholder('写点什么…', { exact: true }).fill(marker)
      await page.getByRole('button', { name: '添加', exact: true }).click()
      await page.getByText(marker, { exact: true }).waitFor({ state: 'visible' })

      await page.reload({ waitUntil: 'networkidle' })
      await page.getByRole('button', { name: '数据层', exact: true }).first().click()
      await page.getByText(marker, { exact: true }).waitFor({ state: 'visible' })

      if (errors.length > 0) {
        throw new Error(`Web preview emitted errors:\n${errors.join('\n')}`)
      }
      console.log(`Web persistence smoke passed: ${marker}`)
    } finally {
      await context.close()
      await browser.close()
    }
  } finally {
    stopPreview(preview)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
