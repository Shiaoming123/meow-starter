import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ApiKeyRef, ProviderConfig } from '../config';

/**
 * 解析密钥。
 *
 * 三种来源：
 * - `none`：本地模型（Ollama / vLLM），无需密钥，返回 undefined
 * - `keychain`：经 Rust 侧从 OS 钥匙串读取（P2 已落地）
 * - `env`：读环境变量（WebView 内无 process.env，需 P2 代理或改用 keychain）
 *
 * 安全铁律：密钥绝不硬编码、绝不存 localStorage —— 桌面 App 可被逆向提取。
 */
export async function resolveApiKey(ref?: ApiKeyRef): Promise<string | undefined> {
  if (!ref || ref.kind === 'none') return undefined;

  if (ref.kind === 'keychain') {
    return readFromKeychain(ref.service, ref.account);
  }

  throw new Error(
    `[agent] 密钥类型 "${ref.kind}" 暂不支持。\n` +
      `桌面端请使用 keychain 类型（经 Rust 侧从 OS 钥匙串读取），本地模型请用 { kind: 'none' }。`,
  );
}

/**
 * 从 OS 钥匙串读密钥（走 Tauri invoke，Rust 侧 keyring crate）。
 * 需要 Cargo feature `agent` 已启用。
 */
async function readFromKeychain(service: string, account?: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('get_api_key', {
    service,
    account: account ?? 'default',
  });
}

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
