import type { RuntimeCapability, RuntimePlatform } from '../lib/platform.ts'
import type { Module } from './types.ts'

export const moduleIds = [
  'core',
  'storage',
  'sqlite',
  'indexedDb',
  'sync',
  'tray',
  'updater',
  'themes',
  'agent',
  'shortcut',
  'clipboard',
  'notification',
  'autostart',
  'mcp',
] as const

export type ModuleId = (typeof moduleIds)[number]

export type NativeBuildRequirement =
  | { kind: 'none' }
  | {
      kind: 'bundled'
      permissions?: readonly string[]
    }
  | {
      kind: 'cargo-feature'
      feature: string
      platforms: readonly RuntimePlatform[]
      permissions?: readonly string[]
    }

export interface ModuleContract {
  id: ModuleId
  name: string
  dependencies: readonly ModuleId[]
  platforms?: readonly RuntimePlatform[]
  requiredCapabilities?: readonly RuntimeCapability[]
  nativeBuild: NativeBuildRequirement
}

export const moduleContracts: Record<ModuleId, ModuleContract> = {
  core: {
    id: 'core',
    name: '设计系统与基础组件',
    dependencies: [],
    nativeBuild: { kind: 'none' },
  },
  storage: {
    id: 'storage',
    name: '本地存储契约',
    dependencies: ['core'],
    nativeBuild: { kind: 'none' },
  },
  sqlite: {
    id: 'sqlite',
    name: 'SQLite 数据层',
    dependencies: ['storage'],
    platforms: ['desktop', 'mobile'],
    requiredCapabilities: ['native-sql'],
    nativeBuild: { kind: 'bundled', permissions: ['sql:default'] },
  },
  indexedDb: {
    id: 'indexedDb',
    name: 'IndexedDB 本地数据层',
    dependencies: ['storage'],
    platforms: ['web'],
    requiredCapabilities: ['web-storage'],
    nativeBuild: { kind: 'none' },
  },
  sync: {
    id: 'sync',
    name: '本地优先同步',
    dependencies: ['storage'],
    nativeBuild: { kind: 'none' },
  },
  tray: {
    id: 'tray',
    name: '系统托盘',
    dependencies: [],
    platforms: ['desktop'],
    requiredCapabilities: ['system-tray'],
    nativeBuild: { kind: 'bundled' },
  },
  updater: {
    id: 'updater',
    name: '自动更新',
    dependencies: ['tray'],
    platforms: ['desktop'],
    requiredCapabilities: ['native-updater'],
    nativeBuild: {
      kind: 'bundled',
      permissions: ['updater:default', 'process:default', 'dialog:default'],
    },
  },
  themes: {
    id: 'themes',
    name: '风格主题',
    dependencies: ['core'],
    nativeBuild: { kind: 'none' },
  },
  agent: {
    id: 'agent',
    name: 'Agent 运行时',
    dependencies: ['storage'],
    nativeBuild: {
      kind: 'cargo-feature',
      feature: 'agent',
      platforms: ['desktop'],
    },
  },
  shortcut: {
    id: 'shortcut',
    name: '全局快捷键',
    dependencies: [],
    platforms: ['desktop'],
    requiredCapabilities: ['global-shortcut'],
    nativeBuild: {
      kind: 'cargo-feature',
      feature: 'shortcut',
      platforms: ['desktop'],
      permissions: ['global-shortcut:default'],
    },
  },
  clipboard: {
    id: 'clipboard',
    name: '剪贴板',
    dependencies: [],
    platforms: ['desktop', 'mobile'],
    requiredCapabilities: ['native-clipboard'],
    nativeBuild: {
      kind: 'cargo-feature',
      feature: 'clipboard',
      platforms: ['desktop', 'mobile'],
      permissions: ['clipboard-manager:default'],
    },
  },
  notification: {
    id: 'notification',
    name: '系统通知',
    dependencies: [],
    platforms: ['desktop', 'mobile'],
    requiredCapabilities: ['native-notification'],
    nativeBuild: {
      kind: 'cargo-feature',
      feature: 'notification',
      platforms: ['desktop', 'mobile'],
      permissions: ['notification:default'],
    },
  },
  autostart: {
    id: 'autostart',
    name: '开机自启动',
    dependencies: [],
    platforms: ['desktop'],
    requiredCapabilities: ['autostart'],
    nativeBuild: {
      kind: 'cargo-feature',
      feature: 'autostart',
      platforms: ['desktop'],
      permissions: ['autostart:default'],
    },
  },
  mcp: {
    id: 'mcp',
    name: 'MCP 接入',
    dependencies: ['agent'],
    nativeBuild: { kind: 'none' },
  },
}

export function assertModuleMatchesContract(
  module: Module,
  contract: ModuleContract,
): void {
  const matches =
    module.id === contract.id &&
    sameStrings(module.dependencies, contract.dependencies) &&
    sameStrings(module.platforms, contract.platforms) &&
    sameStrings(module.requiredCapabilities, contract.requiredCapabilities)

  if (!matches) {
    throw new Error(
      `Module "${contract.id}" does not match its compatibility contract`,
    )
  }
}

function sameStrings(
  actual: readonly string[] | undefined,
  expected: readonly string[] | undefined,
): boolean {
  return JSON.stringify(actual ?? []) === JSON.stringify(expected ?? [])
}
