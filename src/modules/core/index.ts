import { initTheme } from '../../assets/themes/apply'
import type { Module } from '../types'

/**
 * core 模块 —— 始终启用，是「集成化」的锚点。
 * 负责：设计系统 token、基础组件库、主题初始化、图标封装。
 * 这些是任何 meow-starter 项目都需要的底座，不可关闭。
 */
const core: Module = {
  id: 'core',
  name: '设计系统与基础组件',
  dependencies: [],
  setup() {
    // 应用已保存的主题 + 跟随系统深浅色
    initTheme()
  },
}

export default core
