<script setup lang="ts">
import { ref } from 'vue'
import { Bot, Send, Square, User, Wrench } from '@lucide/vue'
import type { AgentConfig } from '../config'
import type { AgentRuntime } from '../runtime/types'
import { HookBus } from '../hooks/bus'
import { loadAgent } from '../index'

const props = defineProps<{ config?: Partial<AgentConfig> }>()

interface Bubble {
  role: 'user' | 'assistant'
  content: string
  tools: string[]
}

const bubbles = ref<Bubble[]>([])
const draft = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

let runtime: AgentRuntime | null = null
const sessionId = globalThis.crypto?.randomUUID?.() ?? `agent-${Date.now()}`

async function ensureRuntime(): Promise<AgentRuntime> {
  if (runtime) return runtime
  const r = await loadAgent(props.config)
  if (!r) throw new Error('Agent 未启用：请在 agent.config.ts 中设置 enabled: true')
  runtime = r
  return r
}

async function send() {
  const text = draft.value.trim()
  if (!text || busy.value) return

  draft.value = ''
  error.value = null
  busy.value = true

  bubbles.value.push({ role: 'user', content: text, tools: [] })
  const index = bubbles.value.push({ role: 'assistant', content: '', tools: [] }) - 1

  try {
    const r = await ensureRuntime()
    const hooks = new HookBus()
    hooks.register({
      onApprovalRequired: ({ name, args }) =>
        window.confirm(`Agent 请求执行工具 ${name}：\n\n${JSON.stringify(args, null, 2)}`),
    })

    for await (const event of r.stream({ prompt: text, sessionId }, hooks)) {
      if (event.type === 'text-delta') {
        bubbles.value[index].content += event.text
      } else if (event.type === 'tool-call') {
        bubbles.value[index].tools.push(event.name)
      } else if (event.type === 'error') {
        error.value = event.message
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function stop() {
  await runtime?.abort('user stopped')
  busy.value = false
}
</script>

<template>
  <section class="chat">
    <header class="chat-head">
      <Bot :size="18" />
      <span>Agent 对话</span>
      <span v-if="busy" class="badge">生成中…</span>
    </header>

    <div class="chat-body">
      <p v-if="!bubbles.length" class="empty">
        还没有对话。发送一条消息试试 —— 需先在 agent.config.ts 里注册 provider 并设置 enabled: true。
      </p>

      <div v-for="(b, i) in bubbles" :key="i" class="bubble-row" :class="b.role">
        <div class="avatar">
          <User v-if="b.role === 'user'" :size="14" />
          <Bot v-else :size="14" />
        </div>
        <div class="bubble">
          <div v-if="b.tools.length" class="tools">
            <Wrench :size="12" />
            <span v-for="(t, j) in b.tools" :key="j">{{ t }}</span>
          </div>
          <p class="text">{{ b.content || (busy && i === bubbles.length - 1 ? '…' : '') }}</p>
        </div>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <form class="chat-input" @submit.prevent="send">
      <input v-model="draft" :disabled="busy" placeholder="说点什么…" @keydown.enter.exact.prevent="send" />
      <button v-if="busy" type="button" class="stop" title="停止" @click="stop">
        <Square :size="14" />
      </button>
      <button v-else type="submit" :disabled="!draft.trim()" title="发送">
        <Send :size="14" />
      </button>
    </form>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
}

.chat-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-alt);
  color: var(--muted);
  font-size: 11px;
}

.chat-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 320px;
  overflow-y: auto;
}

.empty {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.bubble-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.bubble-row.user {
  flex-direction: row-reverse;
}

.avatar {
  display: grid;
  place-items: center;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--surface-alt);
  color: var(--muted);
}

.bubble {
  max-width: 78%;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--surface-alt);
  font-size: 13px;
}

.bubble-row.user .bubble {
  background: var(--accent);
  color: var(--accent-text);
}

.tools {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 11px;
}

.text {
  margin: 0;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  font-size: 12px;
  line-height: 1.55;
}

.chat-input {
  display: flex;
  gap: 8px;
}

.chat-input input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
}

.chat-input input:focus {
  outline: none;
  border-color: var(--accent);
}

.chat-input button {
  display: grid;
  place-items: center;
  width: 34px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-text);
  cursor: pointer;
}

.chat-input button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chat-input .stop {
  background: var(--danger);
  color: #fff;
}
</style>
