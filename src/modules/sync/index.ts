import type { Module } from '../types'

/**
 * 同步接缝默认不联网。应用需显式配置 policy、store、transport 后创建 provider。
 */
const sync: Module = {
  id: 'sync',
  name: '本地优先同步',
  dependencies: ['storage'],
}

export default sync
export * from '../../sync'
