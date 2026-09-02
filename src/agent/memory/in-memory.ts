import type { AgentMessage, MemoryStore } from './types'

export function createMemoryStore(): MemoryStore {
  const store = new Map<string, AgentMessage[]>()
  return {
    async append(message) {
      const messages = store.get(message.sessionId) ?? []
      messages.push({ ...message, id: messages.length + 1, createdAt: Date.now() })
      store.set(message.sessionId, messages)
    },
    async list(sessionId, limit = 200) {
      return (store.get(sessionId) ?? []).slice(-limit)
    },
    async clear(sessionId) {
      store.delete(sessionId)
    },
  }
}

export const browserMemoryStore = createMemoryStore()
