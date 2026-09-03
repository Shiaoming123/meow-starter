import { type ModuleId } from './contract.ts'
import type { Module } from './types.ts'

/**
 * 模块配置 —— 唯一入口，用户只需改这一个文件。
 *
 * 每个 key 对应一个模块：
 * - true  = 启用（前端动态加载 + 参与构建）
 * - false = 关闭（不装配、不执行；安装依赖与构建 chunk 以实际构建为准）
 *
 * 注意：使用 Rust 插件的原生模块还需启用同名 Cargo feature。
 * 纯 Web 模块（如 indexedDb）没有对应的 Cargo feature。
 */
export type ModuleConfig = Record<ModuleId, boolean> & {
  /** 核心模块（设计系统 + 基础组件 + 主题 + Icon），始终启用 */
  core: true
  /** 领域存储契约与内存回退，始终启用 */
  storage: true
}

/**
 * 默认配置：保留脚手架「开箱即用」的现有体验。
 * core 始终启用；sqlite/tray/updater/themes 默认开；agent 与 P1/P3 新增默认关。
 */
export const defaultModuleConfig: ModuleConfig = {
  core: true,
  storage: true,
  sqlite: true,
  indexedDb: true,
  sync: false,
  tray: true,
  updater: true,
  themes: true,
  agent: false,
  shortcut: false,
  clipboard: false,
  notification: false,
  autostart: false,
  mcp: false,
}

/**
 * 模块注册表：把模块 id 映射到「动态加载器」。
 * 每个模块用 default export 暴露 Module，loader 返回模块命名空间，
 * loader.ts 会解包 .default。
 * 只有 config 里为 true 的模块，其 loader 才会被调用（从而被 Vite 打包）。
 */
export type ModuleLoaders = Record<
  ModuleId,
  (() => Promise<{ default: Module }>) | null
>

export const moduleRegistry: ModuleLoaders = {
  core: () => import('./core'),
  storage: () => import('./storage'),
  sqlite: () => import('./sqlite'),
  indexedDb: () => import('./indexeddb'),
  sync: () => import('./sync'),
  tray: () => import('./tray'),
  updater: () => import('./updater'),
  themes: () => import('./themes'),
  agent: () => import('../agent/module'),
  shortcut: () => import('./shortcut'),
  clipboard: () => import('./clipboard'),
  notification: () => import('./notification'),
  autostart: () => import('./autostart'),
  mcp: () => import('./mcp'),
}
