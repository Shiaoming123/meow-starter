# Web 与同步底座设计

## 1. 目标

在不拆分现有单仓、不改变 Tauri 2 主路径的前提下，让同一套 Vue 3 应用具备可持久化的浏览器运行模式，并建立与具体云厂商、局域网协议无关的同步扩展接缝。

本轮交付必须同时满足：

1. 桌面端继续使用 Tauri SQLite，浏览器端使用 IndexedDB。
2. 业务 UI 不直接判断平台或导入具体数据库 SDK。
3. 模块在装配前声明支持的平台；不支持的模块不执行初始化。
4. 同步核心默认关闭、默认不连接网络、默认不同步任何集合。
5. 云同步、局域网同步、PowerSync/Electric、CRDT 可以通过稳定接口接入，但不成为默认依赖。
6. API Key、Token、Cookie、MCP 凭据、本地路径和设备设置不得进入同步数据。

## 2. 非目标

- 本轮不部署线上账号系统或云数据库。
- 本轮不启动局域网监听服务，不申请 mDNS、iOS 或 Android 网络权限。
- 本轮不实现实时多人协作或 CRDT 文档模型。
- 本轮不把 Tauri SQLite 和 IndexedDB 抽象成通用 SQL 方言；只在领域仓储层复用契约。
- 本轮不修改现有 Todo 表主键或同步现有 Todo 数据。
- 本轮不在浏览器保存云模型 API Key，也不绕过当前 Rust 安全代理。

## 3. 架构

```text
Vue / 领域模块
  ├─ RuntimeInfo（web / desktop / mobile + capabilities）
  ├─ TodoStore
  │    ├─ TauriSqliteTodoStore
  │    ├─ IndexedDbTodoStore
  │    └─ InMemoryTodoStore
  └─ SyncProvider
       ├─ OutboxSyncEngine + SyncTransport
       ├─ PowerSync / Electric adapter（后续）
       └─ CRDT provider（后续，仅文档协作）
```

### 3.1 平台能力

运行时平台固定为 `web | desktop | mobile`。模块通过 `platforms` 和 `requiredCapabilities` 描述兼容条件，装配器在动态加载和 `setup()` 前过滤不兼容模块，并返回可诊断的跳过原因。

首批能力标识：

- `web-storage`
- `native-sql`
- `system-tray`
- `native-updater`
- `global-shortcut`
- `autostart`
- `secure-keychain-proxy`

### 3.2 本地存储

不提供伪通用 SQL API。Todo 示例使用 `TodoStore` 领域接口：

```ts
export interface TodoStore {
  list(): Promise<Todo[]>
  add(title: string): Promise<void>
  toggle(id: number, done: boolean): Promise<void>
  remove(id: number): Promise<void>
}
```

默认装配顺序：

1. `storage` 注册内存回退，实现 SSR、测试和异常降级。
2. `sqlite` 仅在 Tauri 运行时覆盖为 SQLite 适配器。
3. `indexedDb` 仅在 Web 运行时覆盖为 IndexedDB 适配器。

浏览器适配器使用轻量、成熟的 `idb` 封装；测试使用 `fake-indexeddb`，不依赖真实浏览器状态。

### 3.3 同步扩展

同步分为两层：

- `SyncProvider`：顶层可替换实现。PowerSync、Electric、Automerge 可以直接实现这一层。
- `SyncTransport`：内置 outbox 引擎的传输接口。HTTP 云端、LAN HTTP/WebSocket、文件导入导出可以复用这一层的数据契约。

内置 outbox 引擎只处理：上传待处理变更、确认成功操作、按 checkpoint 拉取、调用远端变更应用器、全部成功后推进 checkpoint。冲突合并策略由领域适配器决定。

`createAllowlistSyncPolicy()` 必须采用白名单；空白名单表示不同步任何数据。

## 4. 模块配置

新增：

- `storage: true`：不可关闭的本地存储契约和内存回退。
- `indexedDb: true`：Web 默认适配器，仅 Web 装配。
- `sync: false`：同步接口和内置引擎，默认关闭。

保留 `sqlite` 配置和 Cargo feature，避免破坏已有使用者。Agent 的模块依赖从 `sqlite` 调整为 `storage`，但现有 Tauri Agent memory 实现不在本轮迁移。

## 5. Web 功能边界

| 能力 | Web 状态 |
| --- | --- |
| Vue UI、主题、组件 | Stable |
| Todo 本地持久化 | Beta（IndexedDB） |
| 托盘、自动更新、自启动、全局快捷键 | 不支持，装配器跳过 |
| 浏览器通知、剪贴板 | 后续独立 Web adapter |
| 云端 Agent | 需要服务端 Gateway，本轮不启用 |
| Ollama | 仅开发者明确配置 CORS/网络后使用，不作为默认路径 |

## 6. 成熟方案兼容策略

| 方案 | 接入位置 | 默认状态 |
| --- | --- | --- |
| Supabase Auth + Postgres/RLS | AuthProvider + HTTP SyncTransport | 文档示例 |
| Firebase Firestore | 独立 SyncProvider | 文档指引 |
| PowerSync / Electric | 独立 SyncProvider，可替换内置 outbox | Preview 指引 |
| LAN 配对传输 | SyncTransport；发现与配对位于传输层外 | Preview 指引 |
| Automerge / Yjs | 文档领域的独立 SyncProvider | Roadmap 指引 |

## 7. 验收

1. Web 刷新后 Todo 仍存在。
2. 同一 CRUD API 在内存、IndexedDB 和 Tauri SQLite 适配器上保持一致签名。
3. Web 装配时不会执行托盘、Updater、快捷键或自启动模块。
4. 桌面装配时不会执行 IndexedDB 模块。
5. 同步引擎在上传失败时保留 outbox，在远端应用失败时不推进 checkpoint。
6. 默认同步策略拒绝所有集合，只有显式白名单可以进入传输。
7. `npm test`、`npm run typecheck`、`npm run build`、`npm run build:web` 和文档检查通过。
8. Rust 检查由 GitHub CI 完成；若本地没有 Cargo，交付说明必须明确这一验证边界。
