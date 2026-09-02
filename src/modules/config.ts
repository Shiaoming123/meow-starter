import type { Module } from './types'

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
export interface ModuleConfig {
  /** 核心模块（设计系统 + 基础组件 + 主题 + Icon），始终启用 */
  core: true
  /** 领域存储契约与内存回退，始终启用 */
  storage: true
  /** 数据层（SQLite） */
  sqlite: boolean
  /** Web 持久化数据层（IndexedDB） */
  indexedDb: boolean
  /** 本地优先同步接口与内置 outbox 引擎（默认不联网） */
  sync: boolean
  /** 系统托盘 */
  tray: boolean
  /** 自动更新 */
  updater: boolean
  /** 主题系统（4 套风格主题） */
  themes: boolean
  /** Agent 运行时（需装 ai + @ai-sdk/vue） */
  agent: boolean
  /** 全局快捷键唤起（P1） */
  shortcut: boolean
  /** 剪贴板读写（P1） */
  clipboard: boolean
  /** 系统通知（P1） */
  notification: boolean
  /** 开机自启动（P1） */
  autostart: boolean
  /** MCP 接入（P3，需 @ai-sdk/mcp，依赖 agent） */
  mcp: boolean
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
export const moduleRegistry: Record<
  keyof ModuleConfig,
  (() => Promise<{ default: Module }>) | null
> = {
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
