import { createClient } from '@supabase/supabase-js'
import { createHttpSyncTransport } from '../transports/http.ts'
import type { AuthenticatedSyncScope, SyncTransport } from '../types.ts'
import type { SupabaseAuthStorage } from './auth-storage.ts'

export interface SupabaseAuthFacade {
  getSession(): Promise<{
    data: {
      session: {
        access_token: string
        user: { id: string }
      } | null
    }
  }>
}

export interface CreateSupabaseSyncClientOptions {
  url: string
  publishableKey: string
  storage: SupabaseAuthStorage
  /** Test seam; production callers use the Auth facade created from supabase-js. */
  auth?: SupabaseAuthFacade
}

export interface SupabaseSyncClient {
  getAccessToken(): Promise<string | undefined>
  transport: SyncTransport
}

function isLoopback(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
}

function normalizeProjectUrl(value: string): URL {
  const url = new URL(value.endsWith('/') ? value : `${value}/`)
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Supabase project URL must not contain credentials, query, or fragment')
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) {
    throw new Error('Supabase project URL requires HTTPS outside loopback')
  }
  return url
}

function isServiceRoleJwt(value: string): boolean {
  const parts = value.split('.')
  if (parts.length !== 3) return false
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(encoded.padEnd(encoded.length + ((4 - encoded.length % 4) % 4), '=')))
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

function assertPublishableKey(value: string): void {
  if (typeof value !== 'string') {
    throw new Error('Supabase publishable key must be a non-whitespace sb_publishable_ key')
  }
  if (value.startsWith('sb_secret_') || value.startsWith('sb_service_role_') || isServiceRoleJwt(value)) {
    throw new Error('Supabase service-role and secret keys are not allowed in the client')
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Supabase publishable key must be a non-whitespace sb_publishable_ key')
  }
}

export function createSupabaseSyncClient(
  options: CreateSupabaseSyncClientOptions,
): SupabaseSyncClient {
  const projectUrl = normalizeProjectUrl(options.url)
  assertPublishableKey(options.publishableKey)
  const auth = options.auth ?? createClient(projectUrl.href, options.publishableKey, {
    auth: {
      storage: options.storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      skipAutoInitialize: true,
    },
  }).auth
  const baseUrl = new URL('functions/v1/sync', projectUrl).href

  async function getAccessToken(): Promise<string | undefined> {
    const session = (await auth.getSession()).data.session
    return session?.access_token
  }

  async function getAuthenticatedScope(): Promise<AuthenticatedSyncScope> {
    const session = (await auth.getSession()).data.session
    if (!session) throw new Error('Authenticated Supabase sync session is required')
    if (!session.user.id.trim()) {
      throw new Error('Authenticated Supabase sync subject is required')
    }
    if (!session.access_token.trim()) {
      throw new Error('Authenticated Supabase sync access token is required')
    }

    return {
      subject: session.user.id,
      transport: createHttpSyncTransport({
        baseUrl,
        getAccessToken: async () => session.access_token,
      }),
    }
  }

  const transport: SyncTransport = {
    ...createHttpSyncTransport({ baseUrl, getAccessToken }),
    getAuthenticatedScope,
  }

  return {
    getAccessToken,
    transport,
  }
}
