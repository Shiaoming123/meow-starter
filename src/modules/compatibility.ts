import type { RuntimeInfo } from '../lib/platform'
import type { Module } from './types'

export interface ModuleCompatibility {
  supported: boolean
  reason?: string
}

/** 在 setup 前检查模块的平台与能力要求。 */
export function moduleCompatibility(
  module: Module,
  runtime: RuntimeInfo,
): ModuleCompatibility {
  if (module.platforms && !module.platforms.includes(runtime.platform)) {
    return {
      supported: false,
      reason: `Module "${module.id}" does not support platform ${runtime.platform}`,
    }
  }

  const available = new Set(runtime.capabilities)
  const missing = (module.requiredCapabilities ?? []).filter(
    (capability) => !available.has(capability),
  )
  if (missing.length > 0) {
    return {
      supported: false,
      reason: `Module "${module.id}" requires missing capabilities: ${missing.join(', ')}`,
    }
  }

  return { supported: true }
}

export function selectCompatibleModules<T extends Module>(
  modules: readonly T[],
  runtime: RuntimeInfo,
  onSkipped: (reason: string) => void = () => undefined,
): T[] {
  return modules.filter((module) => {
    const compatibility = moduleCompatibility(module, runtime)
    if (!compatibility.supported) {
      onSkipped(compatibility.reason ?? `Module "${module.id}" is unsupported`)
    }
    return compatibility.supported
  })
}
