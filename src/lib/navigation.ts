import { hasRuntimeCapability } from './platform.ts'
import type { RuntimeInfo } from './platform'

export type NavKey = 'overview' | 'themes' | 'data' | 'updater'

export function availableNavigationKeys(runtime: RuntimeInfo): NavKey[] {
  const keys: NavKey[] = ['overview', 'themes', 'data']
  if (hasRuntimeCapability(runtime, 'native-updater')) keys.push('updater')
  return keys
}
