import type { App } from 'vue'
import type {
  RuntimeCapability,
  RuntimeInfo,
  RuntimePlatform,
} from '../lib/platform'
import type { ModuleConfig } from './config'

/**
 * 模块契约 —— meow-starter 模块化架构的核心接口。
 *
 * 每个功能板块（数据层 / 托盘 / 更新 / 主题 / Agent / …）都是一个自包含的模块，
 * 暴露统一的 Module 接口。装配器（loader.ts）按 src/modules/config.ts 的开关，
 * 只加载启用的模块。
 *
 * 设计目标：灵活性（可插拔）+ 稳定性（独立验证）+ 集成化（统一契约）。
 * 详见 docs/modular-architecture.md。
 */
export interface Module {
  /** 模块唯一 id，对应 src/modules/config.ts 的 key；原生模块可再对应 Cargo feature */
  id: string
  /** 模块名（展示用） */
  name: string
  /** 依赖的其他模块 id（如 agent 依赖 sqlite） */
  dependencies: readonly string[]
  /** 模块支持的平台；省略表示所有平台。 */
  platforms?: readonly RuntimePlatform[]
  /** 模块启动前必须具备的运行时能力。 */
  requiredCapabilities?: readonly RuntimeCapability[]
  /** 前端侧初始化（可选），在 app.mount 前调用 */
  setup?: (ctx: ModuleContext) => void | Promise<void>
  /** 前端侧清理（可选），应用卸载时调用 */
  teardown?: (ctx: ModuleContext) => void | Promise<void>
}

export interface ModuleContext {
  /** Vue 应用实例，模块可在此注册全局组件 / provide 依赖 */
  app: App
  /** 模块配置（来自 src/modules/config.ts） */
  config: ModuleConfig
  /** 当前平台与可用原生/浏览器能力。 */
  runtime: RuntimeInfo
}
