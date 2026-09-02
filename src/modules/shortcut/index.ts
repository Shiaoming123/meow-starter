import type { Module } from '../types'

/**
 * shortcut 模块 —— 全局快捷键唤起（P1，官方插件）。
 *
 * 典型场景：Option+Space 唤起 Spotlight 式 AI 面板。
 * 前端薄封装；真正的快捷键注册在 Rust 侧（tauri-plugin-global-shortcut）。
 *
 * 注意：macOS 需用户在「辅助功能」里授权。
 * 用法：启用后通过 register() 注册快捷键，见模块内函数。
 */
const shortcut: Module = {
  id: 'shortcut',
  name: '全局快捷键',
  dependencies: [],
  platforms: ['desktop'],
  requiredCapabilities: ['global-shortcut'],
}

export default shortcut

// —— 前端 API（启用本模块后可用）——
let registered = false

export async function registerShortcut(
  shortcut: string,
  handler: () => void,
): Promise<void> {
  const { register } = await import('@tauri-apps/plugin-global-shortcut')
  await register(shortcut, (event) => {
    if (event.state === 'Pressed') handler()
  })
  registered = true
}

export async function unregisterShortcut(shortcut: string): Promise<void> {
  const { unregister } = await import('@tauri-apps/plugin-global-shortcut')
  await unregister(shortcut)
  registered = false
}

export function isShortcutRegistered(): boolean {
  return registered
}
