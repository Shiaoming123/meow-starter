import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ApiKeyRef, ProviderConfig } from '../config';

/**
 * 解析密钥。
 *
 * P1 阶段只支持 `none`（本地模型，如 Ollama）。
 * `env` / `keychain` 必须经 Rust 侧读取 —— WebView 内既无 process.env，
 * 也不该接触钥匙串，硬编码或存 localStorage 都会被逆向提取。
 */
export async function resolveApiKey(ref?: ApiKeyRef): Promise<string | undefined> {
  if (!ref || ref.kind === 'none') return undefined;
  throw new Error(
    `[agent] 密钥类型 "${ref.kind}" 需要 P2 阶段的 Rust 侧代理（WebView 内无法安全访问钥匙串或环境变量）。\n` +
      `P1 阶段请先用本地模型，例如 Ollama：{ type: 'openai-compatible', apiKeyRef: { kind: 'none' } }`,
  );
}

export function createLanguageModel(
  cfg: ProviderConfig,
  apiKey: string | undefined,
  modelId: string,
): LanguageModel {
  switch (cfg.type) {
    case 'openai':
    case 'openai-compatible':
      // createOpenAI 同时承担 openai-compatible：换 baseURL 即可接 Ollama / vLLM
      return createOpenAI({ apiKey, baseURL: cfg.baseUrl })(modelId);
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL: cfg.baseUrl })(modelId);
    case 'google':
      throw new Error('[agent] google provider 需额外安装 @ai-sdk/google');
    default:
      throw new Error(`[agent] 不支持的 provider 类型: ${String(cfg.type)}`);
  }
}

/** 解析 'provider/model' 形式的模型引用 */
export async function resolveModel(ref: string): Promise<LanguageModel> {
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
  const apiKey = await resolveApiKey(cfg.apiKeyRef);
  return createLanguageModel(cfg, apiKey, modelId);
}
