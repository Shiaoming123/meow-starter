import type { ProviderConfig } from '../config';
import { toProviderInstance, type ProviderInstance } from './types';

const providers = new Map<string, ProviderInstance>();

export function registerProvider(cfg: ProviderConfig): void {
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
