/**
 * meow-starter 默认注册的 Lucide 图标目录。
 *
 * 默认集合刻意保持精简。需要其他图标时，在 registry.ts 中增加
 * 一条静态 import 和一条映射；完整列表见 https://lucide.dev/icons。
 *
 * 使用方式：
 *   import Icon from '@/components/Icon.vue'
 *   <Icon name="settings" />          // kebab-case
 *   <Icon name="FolderOpen" />        // PascalCase
 */

export const iconCatalog = {
  通用: ['inbox', 'clipboard-list', 'folder-open', 'settings', 'circle-check'],
} as const

export type IconCategory = keyof typeof iconCatalog
