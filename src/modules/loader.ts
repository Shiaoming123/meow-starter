import type { App } from 'vue'
import {
  assertModuleMatchesContract,
  moduleContracts,
  type ModuleId,
} from './contract.ts'
import { detectRuntimeInfo, type RuntimeInfo } from '../lib/platform.ts'
import { selectCompatibleModules } from './compatibility.ts'
import {
  defaultModuleConfig,
  moduleRegistry,
  type ModuleConfig,
  type ModuleLoaders,
} from './config.ts'
import type { Module } from './types.ts'
import { sortModules } from './topology.ts'

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
  registry: ModuleLoaders = moduleRegistry,
): Promise<Module[]> {
  const config: ModuleConfig = { ...defaultModuleConfig, ...userConfig }
  const enabled = (Object.keys(registry) as ModuleId[]).filter(
    (k) => config[k],
  )

  const compatibleContracts = selectCompatibleModules(
    enabled.map((id) => moduleContracts[id]),
    runtime,
    (reason) => console.info(`[modules] ${reason}`),
  )

  // 仅加载当前运行时能装配的模块。
  const modules: Module[] = []
  for (const contract of compatibleContracts) {
    const loader = registry[contract.id]
    if (!loader) continue
    const mod = (await loader()).default
    assertModuleMatchesContract(mod, contract)
    modules.push(mod)
  }

  // 拓扑排序（依赖在前）
  const sorted = sortModules(modules)
  const ctx = { app, config, runtime }

  for (const mod of sorted) {
    await mod.setup?.(ctx)
  }

  return sorted
}
