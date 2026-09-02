import type { ProviderInstance } from './types'

export const MAX_PROXY_BODY_BYTES = 2 * 1024 * 1024

export type SecureProxyProvider = 'openai' | 'anthropic'
export type ProviderTransport = 'direct' | 'rust-proxy'

export interface SecureProxyRequest {
  provider: SecureProxyProvider
  service: string
  account: string
  url: string
  body: unknown
}

const allowedOrigins: Record<SecureProxyProvider, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
}

function isSecureProxyProvider(type: ProviderInstance['type']): type is SecureProxyProvider {
  return type === 'openai' || type === 'anthropic'
}

export function resolveProviderTransport(
  provider: ProviderInstance,
  secureProxy: boolean,
): ProviderTransport {
  if (!provider.apiKeyRef || provider.apiKeyRef.kind === 'none') return 'direct'
  if (provider.apiKeyRef.kind === 'env') {
    throw new Error('[agent] WebView 不支持 env 密钥引用；请使用 keychain 或无密钥本地模型')
  }
  if (!secureProxy) {
    throw new Error('[agent] keychain provider 必须启用 secureProxy，拒绝把密钥读入 WebView')
  }
  if (!isSecureProxyProvider(provider.type)) {
    throw new Error(`[agent] 带密钥的 ${provider.type} 端点尚无 Rust 侧白名单，已拒绝连接`)
  }
  return 'rust-proxy'
}

function assertAllowedTarget(provider: SecureProxyProvider, url: URL): void {
  const valid =
    url.origin === allowedOrigins[provider] &&
    !url.username &&
    !url.password &&
    !url.hash &&
    (url.pathname === '/v1' || url.pathname.startsWith('/v1/'))

  if (!valid) {
    throw new Error(`[agent] 代理目标不在允许范围: ${url.toString()}`)
  }
}

export async function createSecureProxyRequest(
  provider: ProviderInstance,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<SecureProxyRequest> {
  if (!isSecureProxyProvider(provider.type)) {
    throw new Error(`[agent] provider "${provider.type}" 不支持安全云端代理`)
  }
  if (provider.apiKeyRef?.kind !== 'keychain') {
    throw new Error('[agent] 安全云端代理需要 keychain 密钥引用')
  }

  const inputUrl = new URL(input instanceof Request ? input.url : input.toString())
  assertAllowedTarget(provider.type, inputUrl)

  const request = new Request(input, init)
  if (request.method.toUpperCase() !== 'POST') {
    throw new Error('[agent] 安全云端代理仅允许 POST 请求')
  }

  const url = new URL(request.url)

  const text = await request.text()
  if (!text) throw new Error('[agent] 代理请求体必须是 JSON 字符串')
  if (new TextEncoder().encode(text).byteLength > MAX_PROXY_BODY_BYTES) {
    throw new Error('[agent] 代理请求体超过 2 MiB 上限')
  }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error('[agent] 代理请求体不是有效 JSON')
  }

  return {
    provider: provider.type,
    service: provider.apiKeyRef.service,
    account: provider.apiKeyRef.account ?? 'default',
    url: url.toString(),
    body,
  }
}
