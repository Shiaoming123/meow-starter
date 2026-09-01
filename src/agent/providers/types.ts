import type { ApiKeyRef, ModelSpec, ProviderKind } from '../config';

export interface ProviderInstance {
  id: string;
  type: ProviderKind;
  baseUrl?: string;
  apiKeyRef?: ApiKeyRef;
  models: ModelSpec[];
}

/**
 * Provider 适配器的最小契约。
 * P1 起由 AI SDK 的 @ai-sdk/* 包实现；openai-compatible 一条路径
 * 覆盖 Ollama / vLLM / llama.cpp 等本地模型。
 */
export interface ProviderAdapter {
  readonly kind: ProviderKind;
  create(cfg: ProviderInstance): Promise<unknown>;
}

export function toProviderInstance(cfg: {
  id: string;
  type: ProviderKind;
  baseUrl?: string;
  apiKeyRef?: ApiKeyRef;
  models?: ModelSpec[];
}): ProviderInstance {
  return { models: [], ...cfg };
}
