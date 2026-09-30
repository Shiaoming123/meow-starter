# 设计系统开发指引

> 给下载 meow-starter 的 agent：你无需通读所有代码也能保持视觉与交互的一致性。这份文档讲解设计 token、组件用法、性能与可访问性惯例、性能优化建议，以及「你何时该新建一个组件」。开始产品 UI 前，先读[应用开发与交付标准](./application-standard.md)确定字体、主题、默认状态与验收边界。

---

## 0. 一分钟概览

```text
src/
├── assets/themes/
│   ├── index.ts        ← 主题色板（4 套：ocean/forest/amber/mono，每套含 light/dark）
│   ├── apply.ts        ← 主题持久化、跟随系统深浅色
│   └── global.css       ← 全局 reset + 结构 token（间距/圆角/字号/阴影/动效/层级）
└── components/
    ├── Icon.vue         ← Lucide 图标封装（静态注册表，构建期确定依赖）
    └── ui/
        ├── Button.vue
        ├── Input.vue
        ├── Card.vue
        ├── Badge.vue
        ├── Progress.vue
        └── EmptyState.vue
```

设计系统分两层：

1. **语义色**（`--bg` / `--surface` / `--accent` / `--success` / `--warning` / `--danger` / `--text` / `--muted` / `--border`）：随主题切换，由 `applyTheme()` 动态写入 `<html>` 元素。
2. **结构 token**（`--space-*` / `--radius-*` / `--text-*` / `--font-*` / `--shadow-*` / `--motion-*` / `--z-*`）：与主题无关，在 `global.css` 里静态定义，全主题共享。

> **原则**：写组件时只用 CSS 变量，绝不写死颜色、字号、间距。**改主题就能换肤**。

### 0.1 产品视觉基线

- 派生产品默认自托管 **Manrope Variable**（英文与数字）和 **Noto Sans SC Variable**（中文）；模板演示页当前仍使用系统字体栈，安装、导入、回退和许可证记录步骤见[字体基线](./application-standard.md#二字体基线)。
- 视觉参考 iOS 磨砂亚克力：毛玻璃只用于需要表达空间层级的侧栏、工具栏和浮层，正文表面保持稳定可读；light/dark 和不支持 blur 时都要有不透明回退。
- **简约 UI 与直观 UX 优于冗长突兀的文字提醒**。标准图标、布局、状态和微反馈先承担说明作用，必要文案保持短而明确。
- 页面主标题沿用 `--text-xl`（20px）上限，不通过超大字号或粗重字重制造层级。

---

## 1. 设计 Token 速查

### 1.1 语义色（11 个）

| Token | 用途 |
|---|---|
| `--bg` | 页面/窗口整体背景 |
| `--surface` | 卡片、按钮、弹窗等"凸起"容器的背景 |
| `--surface-alt` | 次级表面（hover 态、tooltip、输入框） |
| `--text` | 正文文字 |
| `--muted` | 次要文字（hint、说明） |
| `--border` | 1px 分隔线 |
| `--accent` | 强调色（主按钮、激活态、品牌色） |
| `--accent-text` | 强调色背景上的文字（几乎总是白或黑） |
| `--success` | 成功状态 |
| `--warning` | 警告状态 |
| `--danger` | 危险状态（删除按钮、错误） |

### 1.2 结构 token（覆盖排版与节奏）

**间距**（4px 基准，命名从 1 到 12）：

| Token | 值 | 常用场景 |
|---|---|---|
| `--space-1` | 4px | 图标与文字之间的小间距 |
| `--space-2` | 8px | 内联间距、小按钮内 padding |
| `--space-3` | 12px | 卡片标题与内容间距 |
| `--space-4` | 16px | 卡片内 padding、组件间 gap |
| `--space-5` | 20px | 卡片 padding-lg |
| `--space-6` | 24px | section 间大间距 |
| `--space-8` | 32px | 页面顶部 padding |
| `--space-10` | 40px | 大块空白 |
| `--space-12` | 48px | hero 区域 |

**圆角**：

| Token | 值 | 适用 |
|---|---|---|
| `--radius-sm` | 6px | tag、小 badge |
| `--radius-md` | 8px | 按钮、输入框 |
| `--radius-lg` | 12px | 卡片 |
| `--radius-xl` | 16px | 弹窗 |
| `--radius-full` | 999px | 圆形（头像、dot、徽章） |

**字号**（克制：只 6 档）：

| Token | 值 | 用途 |
|---|---|---|
| `--text-xs` | 11px | hint、底部小字 |
| `--text-sm` | 12px | 标签、说明 |
| `--text-base` | 13px | 按钮、次要正文 |
| `--text-md` | 14px | 卡片标题、正文 |
| `--text-lg` | 16px | 主区顶栏标题 |
| `--text-xl` | 20px | 页面主标题 |

**字重**（只用两个）：

| Token | 值 | 用途 |
|---|---|---|
| `--font-regular` | 400 | 正文、placeholder |
| `--font-medium` | 500 | 按钮、标题、强调 |

> **不要用 600 / 700**：显得过分用力，且在不同主题下视觉重量不一致。

**阴影**（三层叠加）：

| Token | 值 | 适用 |
|---|---|---|
| `--shadow-sm` | 0 1px 2px rgba(0,0,0,0.04) | 卡片默认 |
| `--shadow-md` | 0 2px 8px rgba(0,0,0,0.06) | 弹窗、tooltip |
| `--shadow-lg` | 0 8px 24px rgba(0,0,0,0.10) | 模态层 |

**动效**（一致节奏）：

| Token | 值 | 适用 |
|---|---|---|
| `--motion-fast` | 120ms | hover / focus 微反馈 |
| `--motion-base` | 200ms | 卡片展开、面板切换 |
| `--motion-slow` | 320ms | 模态层进入 |
| `--ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | 标准缓动 |

**层级**：

| Token | 值 | 适用 |
|---|---|---|
| `--z-base` | 1 | 一般浮起 |
| `--z-sticky` | 100 | 顶栏、侧栏 |
| `--z-overlay` | 200 | dropdown、tooltip |
| `--z-modal` | 300 | 模态对话框 |
| `--z-toast` | 400 | 全局提示 |

---

## 2. 组件用法

所有组件用 Vue 3 `<script setup lang="ts">` 写法，单文件 SFC，scoped 样式。

### 2.1 Button

```vue
<Button variant="primary" @click="save">保存更改</Button>
<Button variant="ghost" size="sm">取消</Button>
<Button variant="danger" :disabled="busy">删除</Button>
```

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `variant` | `primary` / `secondary` / `ghost` / `danger` | `secondary` | 视觉变体 |
| `size` | `sm` / `md` | `md` | 尺寸 |
| `disabled` | boolean | `false` | 禁用 |
| `type` | `button` / `submit` | `button` | 原生 type |

**写法约定**：按钮文案用祈使句（"保存"、"删除"、"开始对话"），不用名词短语。

### 2.2 Input

```vue
<Input v-model="title" label="待办标题" placeholder="说点什么…" />
```

| Prop | 类型 | 说明 |
|---|---|---|
| `v-model` | string | 双向绑定 |
| `label` | string | 顶部标签 |
| `placeholder` | string | 占位文案 |

### 2.3 Card

```vue
<Card title="数据层" padding="lg">…内容…</Card>
<Card padding="md">
  <template #title>自定义标题</template>
  <template #action><Button>操作</Button></template>
  …内容…
</Card>
```

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `title` | string | — | 卡片标题（可选） |
| `padding` | `sm` / `md` / `lg` | `md` | 内边距档位 |
| `flat` | boolean | `false` | 去掉阴影（用于视觉分组更轻的场景） |

**何时用 Card**：任何需要"区分上下文"的块（数据列表、设置项、统计、demo 等）。**不要**对每个 div 都套 Card——会显得支离破碎。

### 2.4 Badge

```vue
<Badge>默认</Badge>
<Badge tone="success">已完成</Badge>
<Badge tone="warning">待处理</Badge>
<Badge tone="danger">失败</Badge>
<Badge tone="accent">进行中</Badge>
```

`tone` 对应 5 种语义色。用 Badge 标记状态（短小文字），不要当按钮用。

### 2.5 Progress

```vue
<Progress :value="percent" />
<Progress indeterminate />
```

确定性进度（百分比已知）传 `value`；不确定时（加载中、不知何时结束）用 `indeterminate`，会显示横向滑动动画。

### 2.6 EmptyState

```vue
<EmptyState
  icon="clipboard-list"
  title="还没有数据"
  description="添加一条待办，体验 SQLite 的本地持久化能力。"
>
  <Button variant="primary" @click="add">添加第一条</Button>
</EmptyState>
```

**空状态是邀请行动**：写清「这是什么」+「怎么开始」。永远不要写"暂无数据"这种让用户摸不着头脑的句子。

### 2.7 Icon（静态注册表）

```vue
<Icon name="settings" :size="16" />
<Icon name="folder-open" :size="18" />
<Icon name="CircleCheck" :size="14" class="text-success" />
```

名称支持 PascalCase、kebab-case、空格或下划线（自动转换）。默认注册表只包含模板实际使用的 5 个图标；需要其他 Lucide 图标时，在 `src/assets/icons/registry.ts` 增加静态 import 和映射。图标名未注册会在控制台 warn，不会抛错导致白屏。

---

## 3. 添加新主题

只改 `src/assets/themes/index.ts`，在 `themes` 数组里加一项：

```ts
{
  id: 'mint',          // 唯一 id，用于持久化存储
  name: '薄荷青',       // 显示名
  description: '…',     // 主题选择器里的副标题
  light: { bg, surface, surfaceAlt, text, muted, border, accent, accentText, success, warning, danger },
  dark:  { ...同上 },
}
```

> 结构 token（间距、字号、动效）**不属于主题**。如果你想为某个场景定制更大字号，去 `global.css` 改 `--text-xl` 即可，主题会自动跟随。

主题切换立即生效，自动持久化到 `localStorage`（key=`app-theme`），并跟随系统深浅色（`prefers-color-scheme`）。

---

## 4. 添加新组件

### 什么时候新建组件？

- 在两个或更多地方出现，且每次都是相同或相似的样式 → 抽组件
- 包含交互状态（hover、active、disabled、loading）→ 必抽组件
- 一段 HTML + 一段 CSS + 一段 JS 三者绑在一起 → 抽组件

### 新建步骤

1. **文件名**：单文件 SFC，放在 `src/components/ui/` 下，PascalCase 命名（`Tooltip.vue`、`Avatar.vue`）。
2. **Token 优先**：所有色、间距、圆角、字号、动效一律用 CSS 变量，**绝不写死**。
3. **样式 scoped**：组件内样式只影响组件本身；用 `:deep()` 穿透到子组件。
4. **Props 类型化**：用 `withDefaults(defineProps<{…}>(), { … })`。
5. **emit 显式**：`defineEmits<{ name: [payload: T] }>()`。
6. **可访问性**：交互元素有可见焦点（`focus-visible` 全局已配）；输入有 label；icon-only 按钮必须提供 `aria-label`，`title`/tooltip 只作辅助提示。
7. **动效**：用 `--motion-*` + `--ease`，并在 `@media (prefers-reduced-motion: reduce)` 下自动缩短（已全局配）。

### 反模式（不要这样做）

```vue
<!-- 颜色硬编码 -->
<button style="background: #2f6feb">…</button>

<!-- 字号硬编码 -->
<p style="font-size: 14px">…</p>

<!-- 间距硬编码 -->
<div style="margin-top: 24px">…</div>

<!-- 不需要的 props 全开 -->
<Button :variant="x" :size="y" :loading="x" :disabled="x" :icon="x" @click="x">…</Button>

<!-- 装饰性元素加边框加阴影堆三层 -->
<div style="border: 1px solid; box-shadow: 0 0 0 1px, 0 4px 12px rgba">…</div>
```

同样禁止：用“点击此处”“此按钮用于”等长文解释控件、给每个容器叠加毛玻璃和圆角、只在 hover 时暴露关键操作、用 placeholder 代替 label，以及用低对比透明层换取所谓“高级感”。完整清单见[应用标准](./application-standard.md#必须避免)。

---

## 5. 性能优化建议

### 5.1 图标按需注册

`Icon` 组件通过小型静态注册表加载图标，让 Vite 能在构建时确定真实依赖。不要导入 Lucide 的全量图标映射；新增图标时只导入需要的组件：

```vue
<script setup lang="ts">
import { Search, Settings as SettingsIcon } from '@lucide/vue'  // 同步，但只你用到的
</script>
```

### 5.2 组件代码分割（路由级别）

如果以后加 `vue-router`，用 `() => import('./pages/TodoList.vue')` 做路由级懒加载。Tauri WebView 不需要 SEO，可以放心首屏只加载主框架。

### 5.3 流式响应

AI 类应用（Vercel AI SDK 等）建议：
- 流式 UI：把 `for await` 拿到的事件直接 append 到响应式变量，而不是等完整结果一次性渲染
- 工具调用：`onToolCall` 事件单独展示在「工具调用卡片」中，不要塞进主消息流
- 长会话：实现消息压缩（保留最近 N 轮 + 早期摘要），别无上限累加

### 5.4 SQLite 索引

数据量上来后，**索引先行**：在 Rust 侧 `db.rs` 的迁移中加 `CREATE INDEX IF NOT EXISTS ...`，不要等发现慢再加。

---

## 6. 可访问性底线

- 键盘 `Tab` 可遍历所有交互元素，`focus-visible` 有可见焦点环（2px accent 边）
- `prefers-reduced-motion: reduce` 自动把所有动效缩短到 0.01ms（全局 CSS 已配）
- 颜色对比度：4 套基础色板以 WCAG AA（普通文字 ≥ 4.5:1）为目标；派生应用仍须对自己的文字、透明层、状态和 light/dark 组合重新验证
- 窗口最小尺寸 820×560，已在 `tauri.conf.json` 设好；过窄的窗口会强制缩放，按钮可能挤压

---

## 7. 与脚手架其他能力的衔接

- **数据**：先定义小型领域 Store 接口，再分别实现 Tauri SQLite、Web IndexedDB 和内存测试适配器；参考 `src/storage/todos/`。
- **设置项**：用 `tauri-plugin-store` 持久化用户偏好（主题已经存在 localStorage，可以改造到 store）。
- **默认状态**：集中维护产品默认值、持久化偏好与会话状态，遵循[全局设置与默认状态](./application-standard.md#五全局设置与默认状态)，不要在多个组件中复制默认值。
- **Agent（Preview）**：`src/agent/` 提供 Vercel AI SDK inline 适配器并默认关闭；启用前请完成 Provider 与安全代理验证。需要演示 UI 时可在业务入口显式引入 `ChatPanel.vue`。

---

## 8. 文件结构约定（保持整洁）

新增功能时按以下分类放：

| 内容类型 | 放哪 |
|---|---|
| 可复用 UI 组件 | `src/components/ui/` |
| 业务专属组件 | `src/components/`（根目录，自子子自己用） |
| 业务逻辑（无 UI） | `src/lib/` |
| 类型定义 | 与使用方同目录，或单独 `src/types/` |
| 静态资源 | `src/assets/` |
| Agent 能力 | `src/agent/`（按 `runtime/` `providers/` `tools/` `memory/` `hooks/` `ui/` 分子目录） |

---

## 9. 一句话提醒

> **写组件时只用 CSS 变量；写完后问自己：这个组件如果换主题，还能保持一致好看吗？**
>
> 如果答案是「能」，说明你用对了 token。
> 如果答案是「不行」，找一找哪个值被硬编码了。
