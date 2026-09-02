import assert from 'node:assert/strict'
import test from 'node:test'
import { conversationMessages } from '../src/agent/memory/conversation.ts'
import type { AgentMessage } from '../src/agent/memory/types.ts'

const message = (
  role: AgentMessage['role'],
  content: string,
  sessionId = 'session',
): AgentMessage => ({ sessionId, role, content })

test('assembles bounded user and assistant history with the new prompt', () => {
  const result = conversationMessages(
    [
      message('system', 'ignore stored system text'),
      message('user', 'old question'),
      message('assistant', 'old answer'),
      message('tool', 'tool output'),
      message('user', 'recent question'),
      message('assistant', 'recent answer'),
    ],
    'next question',
    1,
  )

  assert.deepEqual(result, [
    { role: 'user', content: 'recent question' },
    { role: 'assistant', content: 'recent answer' },
    { role: 'user', content: 'next question' },
  ])
})

test('zero remembered turns sends only the new prompt', () => {
  assert.deepEqual(
    conversationMessages([message('user', 'old')], 'new', 0),
    [{ role: 'user', content: 'new' }],
  )
})

test('normalizes invalid maxTurns values conservatively', () => {
  assert.deepEqual(
    conversationMessages([message('user', 'old')], 'new', Number.NaN),
    [{ role: 'user', content: 'new' }],
  )
})
