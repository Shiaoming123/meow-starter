import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { moduleContracts } from '../src/modules/contract.ts'
import { defaultModuleConfig } from '../src/modules/config.ts'

const SUPPORTED_PLATFORMS = new Set(['web', 'desktop', 'mobile'])

export function auditModuleContract({
  contracts,
  config,
  platform,
  cargoToml,
  permissions,
}) {
  const errors = []

  for (const contract of contracts) {
    const { nativeBuild } = contract
    const enabled = nativeBuild.kind === 'bundled' || config[contract.id] === true
    if (
      !enabled ||
      nativeBuild.kind === 'none' ||
      (contract.platforms && !contract.platforms.includes(platform))
    ) continue

    if (
      nativeBuild.kind === 'cargo-feature' &&
      nativeBuild.platforms.includes(platform) &&
      !hasCargoFeature(cargoToml, nativeBuild.feature)
    ) {
      errors.push(
        `Module "${contract.id}" requires Cargo feature "${nativeBuild.feature}".`,
      )
    }

    for (const permission of nativeBuild.permissions ?? []) {
      if (!permissions.includes(permission)) {
        errors.push(
          `Module "${contract.id}" requires Tauri permission "${permission}".`,
        )
      }
    }
  }

  return { errors }
}

export function capabilityPermissions(capabilities, platform) {
  const supportedTargets =
    platform === 'desktop'
      ? new Set(['linux', 'macOS', 'windows'])
      : platform === 'mobile'
        ? new Set(['android', 'iOS'])
        : new Set()

  return capabilities.flatMap(({ permissions = [], platforms }) => {
    if (!platforms || platforms.some((target) => supportedTargets.has(target))) {
      return permissions
    }
    return []
  })
}

function hasCargoFeature(cargoToml, feature) {
  const escapedFeature = feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escapedFeature}\\s*=`, 'm').test(cargoToml)
}

function parsePlatform(argv) {
  const requested = argv[0] ?? 'desktop'
  if (!SUPPORTED_PLATFORMS.has(requested)) {
    throw new Error(`Unsupported module-contract platform: ${requested}`)
  }
  return requested
}

function main() {
  const platform = parsePlatform(process.argv.slice(2))
  const root = new URL('../', import.meta.url)
  const cargoToml = readFileSync(new URL('src-tauri/Cargo.toml', root), 'utf8')
  const capabilities = JSON.parse(
    readFileSync(new URL('src-tauri/capabilities/default.json', root), 'utf8'),
  )
  const result = auditModuleContract({
    contracts: Object.values(moduleContracts),
    config: defaultModuleConfig,
    platform,
    cargoToml,
    permissions: capabilityPermissions(capabilities, platform),
  })

  if (result.errors.length > 0) {
    console.error(result.errors.join('\n'))
    process.exitCode = 1
    return
  }

  console.log(`Module contract passed for ${platform}.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
