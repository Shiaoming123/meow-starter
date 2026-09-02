import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ProviderConfig } from '../config';
import { resolveProviderTransport } from './proxy-policy';
import { createSecureProxyFetch } from './secure-fetch';

/** 保存密钥到 OS 钥匙串（供设置页调用）。 */
export async function saveApiKey(
  service: string,
  account: string,
  secret: string,
): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('set_api_key', { service, account, secret });
}

/** 删除钥匙串中的密钥。 */
export async function deleteApiKey(service: string, account: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('delete_api_key', { service, account });
}

/** 只检查钥匙串中是否存在密钥，不读取密钥内容。 */
export async function hasApiKey(service: string, account: string): Promise<boolean> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<boolean>('has_api_key', { service, account });
}

export function createLanguageModel(
  cfg: ProviderConfig,
  modelId: string,
  secureProxy: boolean,
): LanguageModel {
  const provider = { models: [], ...cfg };
  const transport = resolveProviderTransport(provider, secureProxy);
  const proxyFetch = transport === 'rust-proxy' ? createSecureProxyFetch(provider) : undefined;
  const apiKey = transport === 'rust-proxy' ? 'managed-by-rust-keychain' : undefined;

  switch (cfg.type) {
    case 'openai':
    case 'openai-compatible':
      // createOpenAI 同时承担 openai-compatible：换 baseURL 即可接 Ollama / vLLM
      return createOpenAI({ apiKey, baseURL: cfg.baseUrl, fetch: proxyFetch })(modelId);
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL: cfg.baseUrl, fetch: proxyFetch })(modelId);
    case 'google':
      throw new Error('[agent] google provider 需额外安装 @ai-sdk/google');
    default:
      throw new Error(`[agent] 不支持的 provider 类型: ${String(cfg.type)}`);
  }
}

/** 解析 'provider/model' 形式的模型引用 */
export async function resolveModel(ref: string, secureProxy: boolean): Promise<LanguageModel> {
  const idx = ref.indexOf('/');
  if (idx <= 0) {
    throw new Error(`[agent] model 应为 "provider/model" 形式，收到: "${ref}"`);
  }
  const providerId = ref.slice(0, idx);
  const modelId = ref.slice(idx + 1);

  const { getProvider } = await import('./registry');
  const cfg = getProvider(providerId);
  if (!cfg) {
    throw new Error(
      `[agent] 未注册的 provider: "${providerId}"。请先 registerProvider({ id: '${providerId}', ... })`,
    );
  }
  return createLanguageModel(cfg, modelId, secureProxy);
}
