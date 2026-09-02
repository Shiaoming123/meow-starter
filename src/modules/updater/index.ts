import type { Module } from '../types'

/**
 * updater 模块 —— 自动更新。
 * 前端逻辑复用 src/lib/updater.ts（检查/下载/安装/重启）。
 * 依赖：tray（更新完成后的重启流程与托盘联动）。
 */
const updater: Module = {
  id: 'updater',
  name: '自动更新',
  dependencies: ['tray'],
  platforms: ['desktop'],
  requiredCapabilities: ['native-updater'],
}

export default updater
