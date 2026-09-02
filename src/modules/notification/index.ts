import type { Module } from '../types'

/**
 * notification 模块 —— 系统通知（P1，官方插件）。
 *
 * 典型场景：Agent 完成任务后弹系统通知提醒。
 * 底层由 tauri-plugin-notification 提供。
 */
const notification: Module = {
  id: 'notification',
  name: '系统通知',
  dependencies: [],
  platforms: ['desktop', 'mobile'],
  requiredCapabilities: ['native-notification'],
}

export default notification

// —— 前端 API ——
export async function sendNotification(
  title: string,
  body?: string,
): Promise<void> {
  const { isPermissionGranted, requestPermission, sendNotification } = await import(
    '@tauri-apps/plugin-notification'
  )
  let granted = await isPermissionGranted()
  if (!granted) {
    granted = (await requestPermission()) === 'granted'
  }
  if (granted) {
    sendNotification({ title, body })
  }
}
