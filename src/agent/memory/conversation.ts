import type { AgentMessage } from './types'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export function conversationMessages(
  history: AgentMessage[],
  prompt: string,
  maxTurns: number,
): ConversationMessage[] {
  const turns = Number.isFinite(maxTurns) ? Math.max(0, Math.floor(maxTurns)) : 0
  const eligible = history
    .filter(
      (message): message is AgentMessage & { role: ConversationMessage['role'] } =>
        message.role === 'user' || message.role === 'assistant',
    )
  const recent = (turns === 0 ? [] : eligible.slice(-(turns * 2)))
    .map(({ role, content }) => ({ role, content }))

  return [...recent, { role: 'user', content: prompt }]
}
