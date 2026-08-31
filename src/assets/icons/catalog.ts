/**
 * 常用 Lucide 图标名目录（仅供参考，非运行时必需）。
 *
 * 本模板图标统一走 Lucide（ISC 协议，商用无需署名，1791 个图标）。
 * 完整列表与实时搜索见 https://lucide.dev/icons
 *
 * 使用方式：
 *   import Icon from '@/components/Icon.vue'
 *   <Icon name="settings" />          // kebab-case
 *   <Icon name="FolderOpen" />        // PascalCase
 */

export const iconCatalog = {
  // 通用操作
  通用: ['search', 'plus', 'minus', 'check', 'x', 'menu', 'more-horizontal', 'edit', 'settings'],
  // 文件与数据
  文件: ['folder', 'folder-open', 'file', 'file-text', 'image', 'database', 'archive', 'download', 'upload'],
  // 导航
  导航: ['home', 'arrow-left', 'arrow-right', 'arrow-up', 'arrow-down', 'chevron-left', 'chevron-right', 'external-link'],
  // 状态反馈
  状态: ['check-circle', 'x-circle', 'alert-circle', 'info', 'clock', 'loader', 'bell', 'star', 'heart'],
  // 账户与安全
  账户: ['user', 'users', 'lock', 'unlock', 'key', 'shield', 'fingerprint', 'log-out'],
  // 通信与媒体
  通信: ['mail', 'message-circle', 'send', 'link', 'share', 'copy', 'clipboard'],
  // 视图切换
  视图: ['layout-grid', 'list', 'columns', 'sidebar', 'panel-left', 'panel-top', 'maximize', 'minimize'],
  // 系统与电源
  系统: ['power', 'refresh', 'rotate-cw', 'save', 'trash', 'command', 'terminal', 'monitor', 'wifi'],
} as const

export type IconCategory = keyof typeof iconCatalog
