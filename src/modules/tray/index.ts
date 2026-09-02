import type { Module } from '../types'

/**
 * tray 模块 —— 系统托盘。
 * Rust 侧由 tray.rs 实现（见 src-tauri/src/tray.rs），
 * 前端主要负责「关闭窗口 → 隐藏到托盘」的交互与更新事件监听。
 */
const tray: Module = {
  id: 'tray',
  name: '系统托盘',
  dependencies: [],
  platforms: ['desktop'],
  requiredCapabilities: ['system-tray'],
}

export default tray
