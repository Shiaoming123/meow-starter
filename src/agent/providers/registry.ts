import type { ProviderConfig } from '../config';
import { toProviderInstance, type ProviderInstance } from './types.ts';

const providers = new Map<string, ProviderInstance>();

export function registerProvider(cfg: ProviderConfig): void {
  if (providers.has(cfg.id)) {
    throw new Error(`[agent] provider 已注册: "${cfg.id}"`)
  }
  providers.set(cfg.id, toProviderInstance(cfg));
}

export function getProvider(id: string): ProviderInstance | undefined {
  return providers.get(id);
}

export function listProviders(): ProviderInstance[] {
  return [...providers.values()];
}

export function clearProviders(): void {
  providers.clear();
}
