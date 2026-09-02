import type { Module } from '../types'

/**
 * clipboard 模块 —— 剪贴板读写（P1，官方插件）。
 *
 * 典型场景：AI 助手「读剪贴板 → 分析 → 写回剪贴板」。
 * 前端薄封装；底层由 tauri-plugin-clipboard-manager 提供。
 */
const clipboard: Module = {
  id: 'clipboard',
  name: '剪贴板',
  dependencies: [],
  platforms: ['desktop', 'mobile'],
  requiredCapabilities: ['native-clipboard'],
}

export default clipboard

// —— 前端 API ——
export async function readClipboardText(): Promise<string> {
  const { readText } = await import('@tauri-apps/plugin-clipboard-manager')
  return readText()
}

export async function writeClipboardText(text: string): Promise<void> {
  const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
  await writeText(text)
}
