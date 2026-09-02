<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { addTodo, listTodos, removeTodo, toggleTodo, type Todo } from './lib/db'
import { checkForUpdates, IDLE_UPDATE_STATE, type UpdateState } from './lib/updater'
import {
  Minus,
  Plus,
  RefreshCw,
  Search,
  FolderOpen,
  Database,
  Settings as SettingsIcon,
  Bell,
  CircleCheck,
  CircleAlert,
  Trash,
  PanelLeft,
  LayoutGrid,
  Paintbrush,
  Blocks,
} from '@lucide/vue'
import { themes, setTheme, getSavedTheme } from './assets/themes/apply'
import { isDesktopTauri } from './lib/platform'
import Button from './components/ui/Button.vue'
import Card from './components/ui/Card.vue'
import Badge from './components/ui/Badge.vue'
import Progress from './components/ui/Progress.vue'
import EmptyState from './components/ui/EmptyState.vue'

/** 与 src-tauri/src/tray.rs 中的 CHECK_UPDATE_EVENT 保持一致 */
const CHECK_UPDATE_EVENT = 'tray://check-update'

type NavKey = 'overview' | 'themes' | 'data' | 'updater'

const nav = [
  { key: 'overview', label: '概览', icon: LayoutGrid },
  { key: 'themes', label: '主题与样式', icon: Paintbrush },
  { key: 'data', label: '数据层', icon: Database },
  { key: 'updater', label: '自动更新', icon: RefreshCw },
] as const

const active = ref<NavKey>('overview')
const sidebarOpen = ref(true)

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
  try {
    unlistenTray = await listen(CHECK_UPDATE_EVENT, () => runUpdateCheck(false))
  } catch {
    // 纯浏览器预览环境无 Tauri 事件系统，忽略即可
  }
})

onUnmounted(() => unlistenTray?.())
</script>

<template>
  <div class="shell">
    <aside class="sidebar" :class="{ 'sidebar--collapsed': !sidebarOpen }">
      <div class="sidebar__brand">
        <span class="brand-mark">M</span>
        <span v-if="sidebarOpen" class="brand-name">Meow Starter</span>
      </div>

      <nav class="sidebar__nav">
        <button
          v-for="item in nav"
          :key="item.key"
          class="nav-item"
          :class="{ active: active === item.key }"
          :title="item.label"
          @click="active = item.key"
        >
          <component :is="item.icon" :size="16" />
          <span v-if="sidebarOpen" class="nav-item__label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar__foot">
        <button class="nav-item" :title="sidebarOpen ? '收起侧栏' : '展开侧栏'" @click="sidebarOpen = !sidebarOpen">
          <PanelLeft :size="16" />
          <span v-if="sidebarOpen" class="nav-item__label">收起</span>
        </button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div>
          <h1 class="topbar__title">{{ nav.find((n) => n.key === active)?.label }}</h1>
          <p class="topbar__sub">Tauri 2 + Vue 3 · SQLite · 托盘 · 自动更新 · 三端打包</p>
        </div>
        <div class="topbar__actions">
          <Badge v-if="busy" tone="accent">{{ updateState.phase }}</Badge>
          <Button v-if="isDesktopTauri()" variant="ghost" size="sm" title="隐藏到托盘" @click="hideToTray">
            <Minus :size="14" />
            托盘
          </Button>
        </div>
      </header>

      <div class="content">
        <!-- 概览 -->
        <template v-if="active === 'overview'">
          <Card title="已内置的能力">
            <div class="feature-grid">
              <div class="feature">
                <Blocks :size="18" />
                <div>
                  <strong>SQLite 数据层</strong>
                  <p>类型化封装 + 迁移 + 浏览器 mock 降级</p>
                </div>
              </div>
              <div v-if="isDesktopTauri()" class="feature">
                <Bell :size="18" />
                <div>
                  <strong>系统托盘</strong>
                  <p>常驻后台，关闭即隐藏，进程不退出</p>
                </div>
              </div>
              <div class="feature">
                <RefreshCw :size="18" />
                <div>
                  <strong>自动更新</strong>
                  <p>签名校验 + 三端打包，打 tag 即出安装包</p>
                </div>
              </div>
              <div class="feature">
                <Paintbrush :size="18" />
                <div>
                  <strong>{{ themes.length }} 套风格主题</strong>
                  <p>一键切换，自动适配系统深浅色</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="技术栈">
            <div class="stack-row">
              <Badge>Tauri 2</Badge>
              <Badge>Vue 3</Badge>
              <Badge>TypeScript</Badge>
              <Badge>Rust</Badge>
              <Badge>Vite</Badge>
              <Badge>SQLite</Badge>
            </div>
            <p class="muted">完整设计系统与开发指引见 <code>docs/design-system.md</code>。</p>
          </Card>
        </template>

        <!-- 主题与样式 -->
        <template v-else-if="active === 'themes'">
          <Card title="风格主题" padding="lg">
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
          </Card>

          <Card title="图标库" padding="lg">
            <div class="icon-row">
              <Search :size="18" />
              <FolderOpen :size="18" />
              <Database :size="18" />
              <SettingsIcon :size="18" />
              <Bell :size="18" />
              <CircleCheck :size="18" class="text-success" />
              <CircleAlert :size="18" class="text-warning" />
              <Trash :size="18" class="text-danger" />
            </div>
            <p class="muted">
              统一使用 <code>@lucide/vue</code>（ISC，1700+ 图标）。按需渲染，
              <code>&lt;Icon name="..." /&gt;</code>，名称见
              <code>src/assets/icons/catalog.ts</code>。
            </p>
          </Card>
        </template>

        <!-- 数据层 -->
        <template v-else-if="active === 'data'">
          <Card title="SQLite 待办示例" padding="lg">
            <form class="row" @submit.prevent="submitTodo">
              <input v-model="draft" class="input" placeholder="写点什么…" />
              <Button type="submit" variant="primary" :disabled="!draft.trim()">
                <Plus :size="14" />
                添加
              </Button>
            </form>
            <p v-if="dbError" class="error">读取失败：{{ dbError }}</p>
            <ul v-else-if="todos.length" class="todos">
              <li v-for="todo in todos" :key="todo.id" :class="{ done: todo.done === 1 }">
                <label>
                  <input type="checkbox" :checked="todo.done === 1" @change="flip(todo)" />
                  <span>{{ todo.title }}</span>
                </label>
                <button class="icon-btn" title="删除" @click="drop(todo.id)">
                  <Trash :size="14" />
                </button>
              </li>
            </ul>
            <EmptyState
              v-else
              icon="clipboard-list"
              title="还没有数据"
              description="添加一条待办，体验 SQLite 的本地持久化能力。"
            />
          </Card>
        </template>

        <!-- 自动更新 -->
        <template v-else-if="active === 'updater'">
          <Card title="自动更新" padding="lg">
            <div class="row">
              <Button variant="primary" :disabled="busy" @click="runUpdateCheck(false)">
                <RefreshCw :size="14" />
                检查更新
              </Button>
              <span v-if="updateState.message" class="status">{{ updateState.message }}</span>
            </div>
            <Progress
              v-if="updateState.phase === 'downloading'"
              :value="updateState.percent"
              class="mt"
            />
            <p class="muted mt">
              更新端点在 <code>src-tauri/tauri.conf.json</code> 的
              <code>plugins.updater.endpoints</code> 配置。
            </p>
          </Card>

          <Card v-if="isDesktopTauri()" title="系统托盘" padding="lg">
            <p class="muted">
              左键点击托盘图标切换窗口显隐，右键弹出菜单（显示 / 隐藏、检查更新、退出）。
              关闭窗口只会隐藏，进程常驻托盘；从托盘菜单选「退出」才会真正结束进程。
            </p>
          </Card>
        </template>
      </div>
    </div>

    <nav class="tabbar">
      <button
        v-for="item in nav"
        :key="item.key"
        class="tabbar__item"
        :class="{ active: active === item.key }"
        @click="active = item.key"
      >
        <component :is="item.icon" :size="20" />
        <span>{{ item.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ---- 侧边栏 ---- */
.sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 200px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  transition: width var(--motion-base) var(--ease);
}

.sidebar--collapsed {
  width: 56px;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--accent-text);
  font-weight: var(--font-medium);
  flex-shrink: 0;
}

.brand-name {
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  white-space: nowrap;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: var(--text-base);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--motion-fast) var(--ease),
    color var(--motion-fast) var(--ease);
}

.nav-item:hover {
  background: var(--surface-alt);
  color: var(--text);
}

.nav-item.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
}

.nav-item__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__foot {
  padding: var(--space-2);
  border-top: 1px solid var(--border);
}

/* ---- 主区 ---- */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.topbar__title {
  margin: 0 0 2px;
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
}

.topbar__sub {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--muted);
}

.topbar__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 860px;
}

/* ---- 概览 ---- */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.feature {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  color: var(--accent);
}

.feature strong {
  display: block;
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--text);
}

.feature p {
  margin: 2px 0 0;
  font-size: var(--text-base);
  color: var(--muted);
  line-height: 1.5;
}

.stack-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.muted {
  margin: var(--space-3) 0 0;
  font-size: var(--text-base);
  color: var(--muted);
  line-height: 1.7;
}

/* ---- 主题 ---- */
.themes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.theme {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  text-align: left;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
  transition: border-color var(--motion-fast) var(--ease);
}

.theme:hover {
  border-color: var(--accent);
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
  font-size: var(--text-base);
  font-weight: var(--font-medium);
}

.theme__meta small {
  font-size: var(--text-xs);
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

/* ---- 数据 ---- */
.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-md);
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
}

.input:focus {
  border-color: var(--accent);
}

.todos {
  list-style: none;
  margin: var(--space-4) 0 0;
  padding: 0;
}

.todos li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--border);
}

.todos label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-md);
  cursor: pointer;
}

.todos .done span {
  text-decoration: line-through;
  color: var(--muted);
}

.icon-btn {
  display: grid;
  place-items: center;
  padding: 6px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--ease),
    color var(--motion-fast) var(--ease);
}

.icon-btn:hover {
  background: var(--surface-alt);
  color: var(--danger);
}

.status {
  font-size: var(--text-base);
  color: var(--muted);
}

.error {
  font-size: var(--text-base);
  color: var(--danger);
  margin: var(--space-3) 0 0;
}

.mt {
  margin-top: var(--space-4);
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--text-sm);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--surface-alt);
}

/* ---- 底部 tab bar（移动端） ---- */
.tabbar {
  display: none;
}

@media (max-width: 768px) {
  .shell {
    flex-direction: column;
  }

  .sidebar {
    display: none;
  }

  .main {
    min-height: 0;
  }

  .tabbar {
    display: flex;
    flex-shrink: 0;
    width: 100%;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    border-top: 1px solid var(--border);
    background: var(--surface);
  }

  .tabbar__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-2) 0;
    border: none;
    background: transparent;
    color: var(--muted);
    font-family: inherit;
    font-size: var(--text-xs);
    cursor: pointer;
  }

  .tabbar__item.active {
    color: var(--accent);
  }

  .content {
    padding: var(--space-4);
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .themes {
    grid-template-columns: 1fr;
  }
}
</style>
