import { access, readFile } from 'node:fs/promises'
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

export async function inspectReleaseConfig(root, mode) {
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
        await access(iconPath)
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

  return { errors, warnings, summary }
}
