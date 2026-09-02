import type { App } from 'vue'
import { detectRuntimeInfo, type RuntimeInfo } from '../lib/platform'
import { selectCompatibleModules } from './compatibility'
import { defaultModuleConfig, moduleRegistry, type ModuleConfig } from './config'
import type { Module } from './types'
import { sortModules } from './topology'

/**
 * 模块装配器。
 *
 * 按 config 开关，动态 import 并执行各模块的 setup()。
 * 未启用的模块完全不加载（不进 bundle、不执行）。
 *
 * 依赖顺序：先按 dependencies 做拓扑排序，保证被依赖的模块先 setup。
 */
export async function mountModules(
  app: App,
  userConfig?: Partial<ModuleConfig>,
  runtime: RuntimeInfo = detectRuntimeInfo(),
): Promise<Module[]> {
  const config: ModuleConfig = { ...defaultModuleConfig, ...userConfig }
  const enabled = (Object.keys(moduleRegistry) as (keyof ModuleConfig)[]).filter(
    (k) => config[k],
  )

  // 加载启用的模块
  const modules: Module[] = []
  for (const key of enabled) {
    const loader = moduleRegistry[key]
    if (!loader) continue
    const mod = (await loader()).default
    modules.push(mod)
  }

  // 拓扑排序（依赖在前）
  const compatible = selectCompatibleModules(
    modules,
    runtime,
    (reason) => console.info(`[modules] ${reason}`),
  )
  const sorted = sortModules(compatible)
  const ctx = { app, config, runtime }

  for (const mod of sorted) {
    await mod.setup?.(ctx)
  }

  return sorted
}
