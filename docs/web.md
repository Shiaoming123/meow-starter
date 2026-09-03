# Web 端适配指南

> **成熟度：Beta。** Vue UI、主题和组件复用稳定；Todo 示例已使用 IndexedDB 持久化。托盘、原生更新、自启动和全局快捷键只在支持它们的 Tauri 运行时装配。

## 快速开始

```bash
npm install
npm run dev:web
```

生产构建与本地预览：

```bash
npm run build:web
npm run preview:web
```

`dist/` 是普通 Vite 静态站点，不需要 Tauri 运行时。桌面构建仍使用 `npm run tauri dev` / `npm run tauri build`。

## 能力边界

| 能力 | Web | Tauri Desktop | 说明 |
| --- | --- | --- | --- |
| Vue UI、主题、组件 | Stable | Stable | 同一套代码 |
| Todo 本地数据 | Beta：IndexedDB | Stable：SQLite | 复用 `TodoStore` |
| 托盘、自动更新、自启动、全局快捷键 | 不支持 | 支持 | Web 装配器自动跳过 |
| Clipboard / Notification 模块 | Roadmap adapter | Preview | 当前模块使用 Tauri 插件 |
| 云端 Agent | 需要服务端 Gateway | Rust 安全代理 | 不在浏览器保存 Provider Key |
| 本地 Ollama | 需开发者配置网络与 CORS | Preview | 不作为 Web 默认路径 |

运行时信息定义在 `src/lib/platform.ts`。模块通过 `src/modules/contract.ts` 的 `platforms` 与 `requiredCapabilities` 声明兼容条件；装配器会在动态导入前跳过不满足条件的模块，而不是只跳过它的 `setup()`。

原生构建配置与 Web 运行时选择是独立的。运行以下检查可确认 Web 目标不会要求 Cargo feature 或 Tauri permission；该检查不构建桌面安装包，也不验证浏览器以外的平台：

```bash
npm run check:modules -- web
```

## 本地存储

业务 UI 只调用 `src/lib/db.ts`，不直接依赖数据库 SDK：

```text
App / domain code
  -> TodoStore
     -> IndexedDbTodoStore (Web)
     -> TauriSqliteTodoStore (Desktop / Mobile)
     -> InMemoryTodoStore (test / fallback)
```

浏览器实现使用 [`idb`](https://github.com/jakearchibald/idb) 对原生 IndexedDB 做轻量 Promise 封装。需要注意：

- IndexedDB 遵循同源策略；域名、协议或端口变化会得到另一份数据。
- 浏览器配额和回收策略不完全一致，重要数据应提供导出或云同步。
- 无痕/访客模式可能降低配额或不保证持久化。
- 多标签并发要通过事务和版本升级流程协调，不能假设等同桌面数据库锁。

参考：[MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) 与 [浏览器存储配额](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)。

### 可选的数据导出与导入

Todo 示例提供 `await exportTodos()` 与 `await importTodos(json)`，用于让具体产品自行接入下载、文件选择或其他用户界面。JSON 只包含 Todo 的标题、完成状态和创建时间，并带有固定格式与版本；本地数据库 id、SQLite/IndexedDB 文件、密钥、Agent 状态和同步状态都不在范围内。

导入会先验证整个内容，再追加新记录并返回数量：不会清空或覆盖已有数据，重复导入会追加重复项。调用者必须先向用户说明这个语义并获得明确确认。该端口不是云同步、冲突合并或完整数据库恢复功能。

### 增加新的领域存储

不要抽象一个同时模仿 SQL 与 IndexedDB 的万能查询层。为业务领域定义小接口，例如：

```ts
export interface NoteStore {
  list(): Promise<Note[]>
  get(id: string): Promise<Note | undefined>
  put(note: Note): Promise<void>
  remove(id: string): Promise<void>
}
```

然后分别实现 `indexeddb.ts`、`tauri-sqlite.ts` 和 `in-memory.ts`。这会保留平台能力，同时让业务逻辑、Agent 和测试只依赖同一个领域契约。

## Web Agent 安全规则

当前桌面 Agent 把 API Key 存入 OS 钥匙串，并由 Rust 固定目标代理注入请求。浏览器没有同等可信边界，因此：

1. 不把 OpenAI、Anthropic 或其他 Provider Key 写进前端 bundle、localStorage 或 IndexedDB。
2. Web 端先登录自己的账号，再调用服务端 AI Gateway。
3. Gateway 校验用户、配额、Provider 和模型白名单，并在服务端读取密钥。
4. 如果产品允许用户自带 Key，也应在受信后端保存和使用，前端只持有短期业务会话。

## 静态部署

`npm run build:web` 生成 `dist/` 后，可以部署到：

- GitHub Pages：使用官方 Pages workflow 上传 `dist/`。
- Cloudflare Pages：构建命令 `npm run build:web`，输出目录 `dist`。
- Vercel：Framework Preset 选择 Vite，构建命令 `npm run build:web`。
- 任意静态服务器：把 `dist/` 作为站点根目录。

如果加入 Vue Router history 模式，需要把未知路径回退到 `index.html`。当前脚手架没有强制 PWA、Service Worker 或特定托管商配置，避免改变缓存与更新语义。

## 验证

```bash
npm test
npm run typecheck
npm run build:web
npm run check:modules -- web
npm run check:layout
```

浏览器验收至少覆盖：新增 Todo、刷新后仍存在、原生模块入口不显示、控制台无 Tauri IPC 调用错误，以及窄屏底部导航布局。

### 可选的真实浏览器 smoke

在已安装 Edge 或 Chrome 的机器上运行：

```bash
npm run smoke:web-persistence
```

该命令会构建 Web 模式，只监听 `127.0.0.1:4175`，用临时浏览器上下文新增一个唯一 Todo、刷新页面后确认它仍存在，并检查首屏、桌面专属「自动更新」入口与页面错误。它不下载浏览器；自动发现失败时，请把 `MEOW_BROWSER_PATH` 设为浏览器可执行文件的绝对路径。

这是本机 Chrome/Edge 的持久化 smoke，不代表跨浏览器、无痕模式、配额回收、已部署站点或 Web 发布的验证。
