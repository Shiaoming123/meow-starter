import type { AgentConfig } from './config'
import { clearProviders, registerProvider } from './providers/registry.ts'

export function bootstrapProviders(config: AgentConfig): void {
  const providers = new Set<string>()
  for (const provider of config.providers) {
    if (providers.has(provider.id)) {
      throw new Error(`[agent] 重复的 provider id: "${provider.id}"`)
    }
    providers.add(provider.id)
  }

  const separator = config.defaultModel.indexOf('/')
  if (separator <= 0 || separator === config.defaultModel.length - 1) {
    throw new Error(
      `[agent] defaultModel 应为 "provider/model" 形式，收到: "${config.defaultModel}"`,
    )
  }

  const providerId = config.defaultModel.slice(0, separator)
  if (!providers.has(providerId)) {
    throw new Error(`[agent] defaultModel 引用了未配置的 provider: "${providerId}"`)
  }

  clearProviders()
  for (const provider of config.providers) registerProvider(provider)
}
