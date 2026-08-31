/**
 * 主题变量落地到 <html> 的 data-theme / data-mode 属性。
 * 各主题 token 见 src/assets/themes/index.ts。
 */
import { applyTheme, themes } from './index'

export type { Theme, ThemeTokens } from './index'
export { themes, getTheme, applyTheme } from './index'

/** 当前主题 id（可持久化到 localStorage 或 tauri-plugin-store） */
const STORAGE_KEY = 'app-theme'

export function getSavedTheme(): string {
  return localStorage.getItem(STORAGE_KEY) ?? themes[0].id
}

export function setTheme(id: string) {
  localStorage.setItem(STORAGE_KEY, id)
  applyTheme(id, prefersDark())
}

export function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** 初始化主题：应用已保存的主题，并监听系统深浅色变化 */
export function initTheme() {
  applyTheme(getSavedTheme(), prefersDark())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    applyTheme(getSavedTheme(), e.matches)
  })
}
