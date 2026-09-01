import type { Module } from './types'

/**
 * 模块配置 —— 唯一入口，用户只需改这一个文件。
 *
 * 每个 key 对应一个模块：
 * - true  = 启用（前端动态加载 + 参与构建）
 * - false = 关闭（零依赖、零体积、零心智负担）
 *
 * 注意：Rust 侧的 Cargo feature 需与此保持同步（见 src-tauri/Cargo.toml）。
 * 修改后前端生效无需重装；若涉及 Rust 插件，需重新 `tauri dev` / `build`。
 */
export interface ModuleConfig {
  /** 核心模块（设计系统 + 基础组件 + 主题 + Icon），始终启用 */
  core: true
  /** 数据层（SQLite） */
  sqlite: boolean
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
}

/**
 * 默认配置：保留脚手架「开箱即用」的现有体验。
 * core 始终启用；sqlite/tray/updater/themes 默认开；agent 与 P1 新增默认关。
 */
export const defaultModuleConfig: ModuleConfig = {
  core: true,
  sqlite: true,
  tray: true,
  updater: true,
  themes: true,
  agent: false,
  shortcut: false,
  clipboard: false,
  notification: false,
  autostart: false,
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
  sqlite: () => import('./sqlite'),
  tray: () => import('./tray'),
  updater: () => import('./updater'),
  themes: () => import('./themes'),
  agent: () => import('../agent/module'),
  shortcut: () => import('./shortcut'),
  clipboard: () => import('./clipboard'),
  notification: () => import('./notification'),
  autostart: () => import('./autostart'),
}
