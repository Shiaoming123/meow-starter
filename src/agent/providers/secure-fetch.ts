import type { ProviderInstance } from './types'
import { createSecureProxyRequest } from './proxy-policy'

export function createSecureProxyFetch(provider: ProviderInstance): typeof fetch {
  return async (input, init) => {
    const req = await createSecureProxyRequest(provider, input, init)
    const { Channel, invoke } = await import('@tauri-apps/api/core')
    const signal = init?.signal

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let settled = false
        const channel = new Channel<number[]>((chunk) => {
          if (!settled) controller.enqueue(Uint8Array.from(chunk))
        })

        const fail = (error: unknown) => {
          if (settled) return
          settled = true
          controller.error(error instanceof Error ? error : new Error(String(error)))
        }

        if (signal?.aborted) {
          fail(signal.reason ?? new DOMException('Aborted', 'AbortError'))
          return
        }
        signal?.addEventListener(
          'abort',
          () => fail(signal.reason ?? new DOMException('Aborted', 'AbortError')),
          { once: true },
        )

        void invoke<void>('proxy_stream', { req, onChunk: channel }).then(() => {
          if (settled) return
          settled = true
          controller.close()
        }, fail)
      },
    })

    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
    })
  }
}
