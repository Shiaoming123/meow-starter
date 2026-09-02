import type { Module } from '../types'

/**
 * autostart 模块 —— 开机自启动（P1，官方插件）。
 *
 * 典型场景：托盘常驻类 AI 助手开机自动启动。
 * 底层由 tauri-plugin-autostart 提供。
 */
const autostart: Module = {
  id: 'autostart',
  name: '开机自启动',
  dependencies: [],
  platforms: ['desktop'],
  requiredCapabilities: ['autostart'],
}

export default autostart

// —— 前端 API ——
export async function enableAutostart(): Promise<void> {
  const { enable } = await import('@tauri-apps/plugin-autostart')
  await enable()
}

export async function disableAutostart(): Promise<void> {
  const { disable } = await import('@tauri-apps/plugin-autostart')
  await disable()
}

export async function isAutostartEnabled(): Promise<boolean> {
  const { isEnabled } = await import('@tauri-apps/plugin-autostart')
  return isEnabled()
}
