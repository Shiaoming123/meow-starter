import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

const versionPattern = /^version\s*=\s*"([^"]+)"/m

async function readText(path, errors, label) {
  try {
    return await readFile(path, 'utf8')
  } catch {
    errors.push(`Unable to read ${label}: ${path}`)
    return undefined
  }
}

function parseJson(text, errors, label) {
  if (text === undefined) return undefined

  try {
    return JSON.parse(text)
  } catch {
    errors.push(`Invalid JSON in ${label}`)
    return undefined
  }
}

function isPlaceholderEndpoint(endpoint) {
  try {
    return new URL(endpoint).pathname.split('/').some((segment, index, segments) => (
      segment.toUpperCase() === 'OWNER' && segments[index + 1]?.toUpperCase() === 'REPO'
    ))
  } catch {
    return false
  }
}

export function validateWindowsReleaseWorkflow(workflow) {
  if (typeof workflow !== 'string') {
    return ['Missing .github/workflows/release.yml for formal release validation']
  }

  const activeWorkflow = workflow
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
  const errors = []
  if (!activeWorkflow.includes('platform: windows-latest')) {
    errors.push('Release workflow must retain a windows-latest build')
  }
  if (!activeWorkflow.includes('tauri-apps/tauri-action@v0')) {
    errors.push('Release workflow must retain the Tauri build action')
  }
  if (!activeWorkflow.includes('- name: Require version tag source') || !activeWorkflow.includes("github.ref_type != 'tag'")) {
    errors.push('Release workflow must reject branch-based manual dispatches')
  }
  const stageIndex = activeWorkflow.indexOf('- name: Stage portable Windows EXE')
  const publishIndex = activeWorkflow.indexOf('- name: Upload and verify portable Windows EXE')
  const stageStep = stageIndex < 0 ? '' : activeWorkflow.slice(stageIndex, publishIndex > stageIndex ? publishIndex : undefined)
  if (!stageStep.includes('node scripts/stage-windows-portable.mjs') || !stageStep.includes("matrix.platform == 'windows-latest'")) {
    errors.push('Windows release workflow must stage the portable EXE')
  }
  const publishStep = publishIndex < 0 ? '' : activeWorkflow.slice(publishIndex)
  if (!publishStep.includes('gh release upload') || !publishStep.includes('--clobber')) {
    errors.push('Windows release workflow must upload the staged portable EXE')
  }
  if (!publishStep.includes('gh release view')
    || !publishStep.includes('portableAsset.digest')
    || !publishStep.includes('expectedDigest')
    || !publishStep.includes('gh release download')
    || !publishStep.includes('expectedChecksum')
    || !publishStep.includes('steps.portable.outputs')
    || !publishStep.includes("matrix.platform == 'windows-latest'")) {
    errors.push('Windows release workflow must verify uploaded portable bytes and checksum content')
  }
  return errors
}

export async function inspectReleaseConfig(root, mode) {
  if (mode !== 'template' && mode !== 'release') {
    throw new TypeError(`Unknown release check mode: ${mode}`)
  }

  const errors = []
  const warnings = []
  const summary = [`Release configuration mode: ${mode}`]
  const packageJson = parseJson(
    await readText(join(root, 'package.json'), errors, 'package.json'),
    errors,
    'package.json',
  )
  const cargoToml = await readText(join(root, 'src-tauri', 'Cargo.toml'), errors, 'src-tauri/Cargo.toml')
  const tauri = parseJson(
    await readText(join(root, 'src-tauri', 'tauri.conf.json'), errors, 'src-tauri/tauri.conf.json'),
    errors,
    'src-tauri/tauri.conf.json',
  )
  const packageVersion = packageJson?.version
  const cargoVersion = cargoToml?.match(versionPattern)?.[1]
  const tauriVersion = tauri?.version
  const versionsMatch = [packageVersion, cargoVersion, tauriVersion].every(
    (version) => typeof version === 'string' && version === packageVersion,
  )

  if (!versionsMatch) {
    errors.push(`Version mismatch: package.json=${packageVersion ?? 'missing'}, Cargo.toml=${cargoVersion ?? 'missing'}, tauri.conf.json=${tauriVersion ?? 'missing'}`)
  } else {
    summary.push(`Version: ${packageVersion}`)
  }

  if (typeof tauri?.identifier !== 'string' || tauri.identifier.trim() === '') {
    errors.push('Missing non-empty Tauri identifier')
  } else {
    summary.push(`Identifier: ${tauri.identifier}`)
  }

  const icons = tauri?.bundle?.icon
  if (!Array.isArray(icons) || icons.length === 0) {
    errors.push('Missing bundle icons')
  } else {
    for (const icon of icons) {
      if (typeof icon !== 'string' || icon.trim() === '') {
        errors.push('Invalid bundle icon path')
        continue
      }

      const iconPath = isAbsolute(icon) ? icon : join(root, 'src-tauri', icon)
      try {
        if (!(await stat(iconPath)).isFile()) {
          errors.push(`Invalid bundle icon: ${icon} (not a regular file)`)
        }
      } catch {
        errors.push(`Missing bundle icon: ${icon}`)
      }
    }
    summary.push(`Bundle icons: ${icons.length}`)
  }

  const endpoints = tauri?.plugins?.updater?.endpoints
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    errors.push('Missing updater endpoints')
  } else {
    for (const endpoint of endpoints) {
      let url
      try {
        url = new URL(endpoint)
      } catch {
        errors.push(`Invalid updater endpoint: ${endpoint}`)
        continue
      }

      if (url.protocol !== 'https:') {
        errors.push(`Updater endpoint must use HTTPS: ${endpoint}`)
        continue
      }

      if (isPlaceholderEndpoint(endpoint)) {
        const message = `placeholder updater endpoint: ${endpoint}`
        ;(mode === 'release' ? errors : warnings).push(message)
      }
    }
    summary.push(`Updater endpoints: ${endpoints.length}`)
  }

  const signingIssues = []
  if (typeof tauri?.plugins?.updater?.pubkey !== 'string' || tauri.plugins.updater.pubkey.trim() === '') {
    signingIssues.push('Missing non-empty updater public key at plugins.updater.pubkey')
  } else {
    summary.push('Updater public key: configured')
  }

  const updaterArtifacts = tauri?.bundle?.createUpdaterArtifacts
  if (updaterArtifacts !== true && updaterArtifacts !== 'v1Compatible') {
    signingIssues.push('bundle.createUpdaterArtifacts must enable updater artifacts (true or "v1Compatible")')
  } else {
    summary.push('Updater artifacts: enabled')
  }

  ;(mode === 'release' ? errors : warnings).push(...signingIssues)

  if (mode === 'release') {
    const workflow = await readText(
      join(root, '.github', 'workflows', 'release.yml'),
      errors,
      '.github/workflows/release.yml',
    )
    const workflowErrors = validateWindowsReleaseWorkflow(workflow)
    errors.push(...workflowErrors)
    if (workflowErrors.length === 0) summary.push('Portable Windows release asset: enforced')
  }

  return { errors, warnings, summary }
}
