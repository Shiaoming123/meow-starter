import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import {
  createSyncRequestHandler,
  parsePullResult,
  parsePushResult,
  type SyncBackend,
} from './contract.ts'

interface SyncRpcClient {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, context) => {
    const supabase = context.supabase as unknown as SyncRpcClient
    const backend: SyncBackend = {
      async push(changes) {
        const { data, error } = await supabase.rpc('sync_push', {
          p_changes: changes,
        })
        if (error) throw new Error('Sync push failed')
        return parsePushResult(data)
      },
      async pull(checkpoint) {
        const { data, error } = await supabase.rpc('sync_pull', {
          p_checkpoint: checkpoint ?? null,
        })
        if (error) throw new Error('Sync pull failed')
        return parsePullResult(data)
      },
    }

    return createSyncRequestHandler(backend)(request)
  }),
}
