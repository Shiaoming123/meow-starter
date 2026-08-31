/**
 * 风格化主题定义。
 * 每个主题提供一套 CSS 变量（浅色 + 深色），通过 data-theme 属性应用到根节点。
 * 一键切换，所有使用 var(--xxx) 的组件自动换肤。
 */

export interface ThemeTokens {
  bg: string
  surface: string
  surfaceAlt: string
  text: string
  muted: string
  border: string
  accent: string
  accentText: string
  success: string
  warning: string
  danger: string
}

export interface Theme {
  id: string
  name: string
  description: string
  light: ThemeTokens
  dark: ThemeTokens
}

export const themes: Theme[] = [
  {
    id: 'ocean',
    name: '海洋蓝',
    description: '专业、冷静，适合开发者工具与效率应用',
    light: {
      bg: '#f5f7fb',
      surface: '#ffffff',
      surfaceAlt: '#eef2f9',
      text: '#1a2233',
      muted: '#5c6b83',
      border: 'rgba(20, 40, 80, 0.12)',
      accent: '#2f6feb',
      accentText: '#ffffff',
      success: '#18a058',
      warning: '#d97b12',
      danger: '#d64545',
    },
    dark: {
      bg: '#0f1620',
      surface: '#1a2333',
      surfaceAlt: '#232f45',
      text: '#e6ecf5',
      muted: '#8b9bb5',
      border: 'rgba(150, 175, 220, 0.16)',
      accent: '#5b8cff',
      accentText: '#0c1a35',
      success: '#4ad88a',
      warning: '#f0a53e',
      danger: '#f27070',
    },
  },
  {
    id: 'forest',
    name: '森林绿',
    description: '清爽、柔和，适合笔记与知识管理类应用',
    light: {
      bg: '#f4f8f4',
      surface: '#ffffff',
      surfaceAlt: '#e9f2e9',
      text: '#1c2b1f',
      muted: '#5c7160',
      border: 'rgba(30, 80, 40, 0.12)',
      accent: '#2f9e5f',
      accentText: '#ffffff',
      success: '#2f9e5f',
      warning: '#c98a12',
      danger: '#d64545',
    },
    dark: {
      bg: '#101710',
      surface: '#1a231a',
      surfaceAlt: '#243026',
      text: '#e4ede4',
      muted: '#8aa08c',
      border: 'rgba(140, 190, 150, 0.16)',
      accent: '#4ad88a',
      accentText: '#0c2a18',
      success: '#4ad88a',
      warning: '#e8b84a',
      danger: '#f27070',
    },
  },
  {
    id: 'amber',
    name: '暖阳橙',
    description: '温暖、有活力，适合创意与生活记录类应用',
    light: {
      bg: '#fdf8f1',
      surface: '#ffffff',
      surfaceAlt: '#f8efe2',
      text: '#2a2217',
      muted: '#7a6a54',
      border: 'rgba(140, 100, 40, 0.14)',
      accent: '#e07a1f',
      accentText: '#ffffff',
      success: '#2f9e5f',
      warning: '#d97b12',
      danger: '#d64545',
    },
    dark: {
      bg: '#1a130c',
      surface: '#241b10',
      surfaceAlt: '#312517',
      text: '#f2e8d8',
      muted: '#a8937a',
      border: 'rgba(220, 180, 120, 0.16)',
      accent: '#f0a53e',
      accentText: '#2a1a08',
      success: '#4ad88a',
      warning: '#f0a53e',
      danger: '#f27070',
    },
  },
  {
    id: 'mono',
    name: '极简黑白',
    description: '克制、中性，适合写作与专注类应用',
    light: {
      bg: '#fafafa',
      surface: '#ffffff',
      surfaceAlt: '#f0f0f0',
      text: '#1a1a1a',
      muted: '#737373',
      border: 'rgba(0, 0, 0, 0.14)',
      accent: '#111111',
      accentText: '#ffffff',
      success: '#2f9e5f',
      warning: '#d97b12',
      danger: '#d64545',
    },
    dark: {
      bg: '#0d0d0d',
      surface: '#171717',
      surfaceAlt: '#222222',
      text: '#ededed',
      muted: '#8a8a8a',
      border: 'rgba(255, 255, 255, 0.14)',
      accent: '#e8e8e8',
      accentText: '#0d0d0d',
      success: '#4ad88a',
      warning: '#f0a53e',
      danger: '#f27070',
    },
  },
]

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0]
}

/**
 * 将主题 token 写入 CSS 变量。
 * 在组件挂载或主题切换时调用，配合 prefers-color-scheme 决定深浅。
 */
export function applyTheme(id: string, dark: boolean) {
  const theme = getTheme(id)
  const tokens = dark ? theme.dark : theme.light
  const root = document.documentElement
  root.dataset.theme = id
  root.dataset.mode = dark ? 'dark' : 'light'
  const map: Record<string, string> = {
    '--bg': tokens.bg,
    '--surface': tokens.surface,
    '--surface-alt': tokens.surfaceAlt,
    '--text': tokens.text,
    '--muted': tokens.muted,
    '--border': tokens.border,
    '--accent': tokens.accent,
    '--accent-text': tokens.accentText,
    '--success': tokens.success,
    '--warning': tokens.warning,
    '--danger': tokens.danger,
  }
  for (const [k, v] of Object.entries(map)) root.style.setProperty(k, v)
}
