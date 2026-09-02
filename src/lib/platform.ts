/**
 * 平台检测 —— 用于桌面专属能力的运行时降级。
 *
 * 桌面专属能力（托盘、单实例、全局快捷键）在移动端无对应概念，
 * Rust 侧已用 cfg 排除，前端这里做 UI 层的降级判断。
 */

/** 是否运行在 Tauri 环境（桌面或移动），而非纯浏览器预览 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 是否移动端（Android / iOS）。基于 UA 判断，覆盖 Tauri 移动端与浏览器移动预览 */
export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent)
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return isMobileUserAgent(navigator.userAgent)
}

/** 是否桌面端 Tauri（有托盘等桌面能力的环境） */
export function isDesktopTauri(): boolean {
  return isTauri() && !isMobile()
}

export type RuntimePlatform = 'web' | 'desktop' | 'mobile'

export type RuntimeCapability =
  | 'web-storage'
  | 'native-sql'
  | 'system-tray'
  | 'native-updater'
  | 'global-shortcut'
  | 'native-clipboard'
  | 'native-notification'
  | 'autostart'
  | 'secure-keychain-proxy'

export interface RuntimeInfo {
  platform: RuntimePlatform
  capabilities: readonly RuntimeCapability[]
}

export function hasRuntimeCapability(
  runtime: RuntimeInfo,
  capability: RuntimeCapability,
): boolean {
  return runtime.capabilities.includes(capability)
}

/** 当前运行时可用能力的单一事实来源。 */
export function detectRuntimeInfo(): RuntimeInfo {
  if (!isTauri()) {
    return { platform: 'web', capabilities: ['web-storage'] }
  }

  if (isMobile()) {
    return {
      platform: 'mobile',
      capabilities: ['native-sql', 'native-clipboard', 'native-notification'],
    }
  }

  return {
    platform: 'desktop',
    capabilities: [
      'native-sql',
      'system-tray',
      'native-updater',
      'global-shortcut',
      'native-clipboard',
      'native-notification',
      'autostart',
      'secure-keychain-proxy',
    ],
  }
}
