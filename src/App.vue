<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { addTodo, listTodos, removeTodo, toggleTodo, type Todo } from './lib/db'
import { checkForUpdates, IDLE_UPDATE_STATE, type UpdateState } from './lib/updater'
import Icon from './components/Icon.vue'
import { themes, setTheme, getSavedTheme } from './assets/themes/apply'

/** 与 src-tauri/src/tray.rs 中的 CHECK_UPDATE_EVENT 保持一致 */
const CHECK_UPDATE_EVENT = 'tray://check-update'

const todos = ref<Todo[]>([])
const draft = ref('')
const dbError = ref('')
const updateState = ref<UpdateState>({ ...IDLE_UPDATE_STATE })
const currentTheme = ref(getSavedTheme())
let unlistenTray: (() => void) | undefined

const busy = computed(() =>
  ['checking', 'downloading', 'installing'].includes(updateState.value.phase),
)

function pickTheme(id: string) {
  currentTheme.value = id
  setTheme(id)
}

async function refreshTodos() {
  try {
    todos.value = await listTodos()
    dbError.value = ''
  } catch (error) {
    dbError.value = error instanceof Error ? error.message : String(error)
  }
}

async function submitTodo() {
  const title = draft.value.trim()
  if (!title) return
  await addTodo(title)
  draft.value = ''
  await refreshTodos()
}

async function flip(todo: Todo) {
  await toggleTodo(todo.id, todo.done === 0)
  await refreshTodos()
}

async function drop(id: number) {
  await removeTodo(id)
  await refreshTodos()
}

async function runUpdateCheck(silent = false) {
  await checkForUpdates((state) => (updateState.value = state), { silent })
}

function hideToTray() {
  void getCurrentWindow().hide()
}

onMounted(async () => {
  await refreshTodos()
  unlistenTray = await listen(CHECK_UPDATE_EVENT, () => runUpdateCheck(false))
})

onUnmounted(() => unlistenTray?.())
</script>

<template>
  <main class="page">
    <header class="page__head">
      <div>
        <h1>Tauri 2 + Vue 3 模板</h1>
        <p class="sub">SQLite · 系统托盘 · 自动更新 · 三端打包</p>
      </div>
      <button class="ghost" @click="hideToTray">
        <Icon name="minus" :size="14" />
        隐藏到托盘
      </button>
    </header>

    <section class="card">
      <h2>风格主题</h2>
      <p class="hint">内置 {{ themes.length }} 套风格化主题，一键切换，自动适配深浅色。</p>
      <div class="themes">
        <button
          v-for="t in themes"
          :key="t.id"
          class="theme"
          :class="{ active: currentTheme === t.id }"
          @click="pickTheme(t.id)"
        >
          <span class="theme__dot" :style="{ background: t.light.accent }" />
          <span class="theme__meta">
            <strong>{{ t.name }}</strong>
            <small>{{ t.description }}</small>
          </span>
        </button>
      </div>
    </section>

    <section class="card">
      <h2>图标库</h2>
      <p class="hint">
        统一使用 <code>@lucide/vue</code>（ISC 协议，1700+ 图标）。通过
        <code>&lt;Icon name="..." /&gt;</code> 按需渲染，名称见
        <code>src/assets/icons/catalog.ts</code>。
      </p>
      <div class="icon-row">
        <Icon name="search" :size="18" />
        <Icon name="folder-open" :size="18" />
        <Icon name="database" :size="18" />
        <Icon name="settings" :size="18" />
        <Icon name="bell" :size="18" />
        <Icon name="check-circle" :size="18" class="text-success" />
        <Icon name="alert-circle" :size="18" class="text-warning" />
        <Icon name="trash" :size="18" class="text-danger" />
      </div>
    </section>

    <section class="card">
      <h2>SQLite 数据层</h2>
      <form class="row" @submit.prevent="submitTodo">
        <input v-model="draft" placeholder="写点什么…" />
        <button type="submit" class="primary">
          <Icon name="plus" :size="14" />
          添加
        </button>
      </form>
      <p v-if="dbError" class="error">读取失败：{{ dbError }}</p>
      <ul v-else-if="todos.length" class="todos">
        <li v-for="todo in todos" :key="todo.id" :class="{ done: todo.done === 1 }">
          <label>
            <input type="checkbox" :checked="todo.done === 1" @change="flip(todo)" />
            <span>{{ todo.title }}</span>
          </label>
          <button class="ghost small" @click="drop(todo.id)">
            <Icon name="trash" :size="13" />
          </button>
        </li>
      </ul>
      <p v-else class="empty">还没有数据，添加一条试试。</p>
    </section>

    <section class="card">
      <h2>自动更新</h2>
      <div class="row">
        <button class="primary" :disabled="busy" @click="runUpdateCheck(false)">
          <Icon name="refresh" :size="14" />
          检查更新
        </button>
        <span v-if="updateState.message" class="status">{{ updateState.message }}</span>
      </div>
      <div v-if="updateState.phase === 'downloading'" class="progress">
        <div class="progress__bar" :style="{ width: `${updateState.percent}%` }" />
      </div>
      <p class="hint">
        更新端点在 <code>src-tauri/tauri.conf.json</code> 的
        <code>plugins.updater.endpoints</code> 配置。
      </p>
    </section>

    <section class="card">
      <h2>系统托盘</h2>
      <p class="hint">
        左键点击托盘图标切换窗口显隐，右键弹出菜单（显示 / 隐藏、检查更新、退出）。<br />
        关闭窗口只会隐藏，进程常驻托盘；从托盘菜单选「退出」才会真正结束进程。
      </p>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 28px 48px;
}

.page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px;
}

.sub {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 16px;
}

h2 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 14px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
}

input[type='text'],
input:not([type]) {
  flex: 1;
  padding: 8px 12px;
  font-size: 14px;
  font-family: inherit;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: default;
}

button.primary {
  background: var(--accent);
  border-color: transparent;
  color: var(--accent-text);
}

button.small {
  padding: 4px 10px;
  font-size: 12px;
}

/* 主题选择 */
.themes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.theme {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
}

.theme.active {
  border-color: var(--accent);
  background: var(--surface-alt);
}

.theme__dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}

.theme__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.theme__meta strong {
  font-size: 13px;
  font-weight: 600;
}

.theme__meta small {
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 图标展示 */
.icon-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.todos {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
}

.todos li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
}

.todos label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  cursor: pointer;
}

.todos .done span {
  text-decoration: line-through;
  color: var(--muted);
}

.empty,
.hint,
.status {
  font-size: 13px;
  color: var(--muted);
  margin: 12px 0 0;
}

.hint {
  line-height: 1.7;
}

.error {
  font-size: 13px;
  color: var(--danger);
  margin: 12px 0 0;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-alt);
}

.progress {
  height: 6px;
  margin-top: 14px;
  border-radius: 999px;
  background: var(--surface-alt);
  overflow: hidden;
}

.progress__bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}
</style>
