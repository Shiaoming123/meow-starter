import type { ProviderConfig } from '../config';

/**
 * 常用 Provider 预设 —— 开箱即用的配置模板。
 * 使用者按需复制到 agent.config.ts，或直接 import 后 registerProvider。
 *
 * 关键：本地推理走 Ollama（openai-compatible 通道），密钥用 keychain 存云端 Key。
 */

/** 本地 Ollama（隐私优先，零云端依赖） */
export const ollamaPreset: ProviderConfig = {
  id: 'ollama',
  type: 'openai-compatible',
  baseUrl: 'http://localhost:11434/v1',
  apiKeyRef: { kind: 'none' },
  models: [
    { id: 'qwen3:8b', contextWindow: 32768 },
    { id: 'llama3.1:8b', contextWindow: 32768 },
    { id: 'gemma3:4b', contextWindow: 32768 },
  ],
};

/** 本地 vLLM（生产级本地推理服务） */
export const vllmPreset: ProviderConfig = {
  id: 'vllm',
  type: 'openai-compatible',
  baseUrl: 'http://localhost:8000/v1',
  apiKeyRef: { kind: 'none' },
  models: [{ id: 'qwen3-8b', contextWindow: 32768 }],
};

/** OpenAI 云端（密钥存钥匙串，经 Rust 代理） */
export const openaiPreset: ProviderConfig = {
  id: 'openai',
  type: 'openai',
  apiKeyRef: { kind: 'keychain', service: 'openai', account: 'default' },
};

/** Anthropic 云端（密钥存钥匙串） */
export const anthropicPreset: ProviderConfig = {
  id: 'anthropic',
  type: 'anthropic',
  apiKeyRef: { kind: 'keychain', service: 'anthropic', account: 'default' },
};

/** 所有预设 */
export const providerPresets: ProviderConfig[] = [
  ollamaPreset,
  vllmPreset,
  openaiPreset,
  anthropicPreset,
];
