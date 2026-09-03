# 账号、云端与局域网同步指南

> **成熟度：Preview。** Sync 默认关闭。仓库提供持久化 outbox/checkpoint、冲突保留、通用 HTTP transport，以及可选的 Supabase Auth + Edge Function 参考路径；尚未提供通用的登录或同步设置 UI，也未完成部署双设备验证。

## 设计原则

同步不属于业务数据源。应用始终先写本地存储，再由可替换的同步 Provider 传播变更：

```text
Domain Store -> Outbox -> SyncProvider
                         ├─ HTTP cloud transport
                         ├─ paired LAN transport
                         ├─ PowerSync / Electric provider
                         └─ Automerge / Yjs document provider
```

同步分两层：

- `SyncProvider`：完整同步方案的顶层接口。PowerSync、Electric、Firestore、Automerge 等可以直接实现。
- `SyncTransport`：内置 outbox 引擎的上传/拉取接口。HTTP 云端、配对后的 LAN 服务或文件传输可以复用。

## 最小用法

同步模块在 `src/modules/config.ts` 中默认关闭。启用后仍不会自动联网；应用必须显式提供白名单、状态存储、传输和远端应用器：

```ts
import {
  createAllowlistSyncPolicy,
  createHttpSyncTransport,
  createInMemorySyncStateStore,
  createOutboxSyncEngine,
} from './src/sync'

const provider = createOutboxSyncEngine({
  store: createInMemorySyncStateStore(),
  policy: createAllowlistSyncPolicy(['notes']),
  transport: createHttpSyncTransport({
    baseUrl: 'https://sync.example.com/v1',
    getAccessToken: async () => session.accessToken,
  }),
  applyRemote: async (change) => noteStore.applyRemote(change),
})

await provider.syncOnce()
```

示例中的内存 store 只用于接口演示和测试。生产应用使用 `createIndexedDbSyncStateStore()`（Web）或 `createTauriSqliteSyncStateStore()`（桌面），确保应用退出或断电后 outbox、冲突和 checkpoint 不丢失。

## 选择路径

| 路径 | 何时选择 | 需要什么 | 验证边界 |
| --- | --- | --- | --- |
| 本地优先（默认） | 尚无账号或多设备需求 | 不需要环境变量、账号、Docker 或网络 | 离线本地存储与 outbox 测试 |
| 托管 Supabase | 需要最快的账号 + Postgres/RLS 参考后端 | Supabase 项目、跟踪的 migration、`sync` Function、用户登录 | 另行完成部署后的两设备验证 |
| 自托管 Supabase | 需要自有基础设施/数据驻留 | 生产级 Supabase 运维、TLS、备份、升级、监控和事件响应 | 本地 CLI 栈不能替代生产验证 |
| 兼容后端 | 已有身份/后端或不希望依赖 Supabase | 实现相同 `SyncTransport` HTTP 合约 | 后端自行证明认证、隔离和并发语义 |

无论路径如何，应用先写本地；同步只传播 `agent_preferences`。Todo 仍是本地示例数据。绝不上传 API key、refresh/session token、credential reference、任意云端 URL、本地路径、提示词/回复、原始用量或原始错误。

## 可选 Supabase 客户端

`createSupabaseSyncClient()` 只在应用明确启用 sync 并导入后调用时创建。构造时不执行登录、同步或云连接；它只从 Auth 的当前 session 读取短期 `access_token`，并把它交给固定的 `${url}/functions/v1/sync` HTTP transport。调用者不能加入任意 Authorization header，也不能传入 service-role/secret key。

Web 使用浏览器 local storage；桌面应用必须注入自己的安全存储适配器（例如 OS keychain 后的适配器）：

```ts
import {
  createBrowserAuthStorage,
  createAllowlistSyncPolicy,
  createIndexedDbSyncStateStore,
  createOutboxSyncEngine,
  createSupabaseSyncClient,
} from './src/sync'

const client = createSupabaseSyncClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  storage: createBrowserAuthStorage(),
})

const provider = createOutboxSyncEngine({
  store: createIndexedDbSyncStateStore(),
  policy: createAllowlistSyncPolicy(['agent_preferences']),
  transport: client.transport,
  applyRemote: applyAgentPreferences,
})
```

可暴露给 Vite 的只有以下两个**非秘密**值：

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

不要提交 `.env`，也不要创建 `VITE_` service-role、secret、用户 access token 或 refresh token 变量。发布型 key 可被浏览器看到，安全性必须由用户 JWT、RLS 和 Edge Function 验证保证。

### 用户可见的开关路径

模板没有预置账户页面；接入者应在“设置 → 账户与同步”提供显式流程：默认显示“仅本地”，用户登录并确认要同步 `agent_preferences` 后才启用模块和创建 provider；显示当前账号与同步状态；“关闭同步”立即停止调度、卸载 provider 并保留本机 outbox/数据。“清除本机同步数据”必须是单独确认操作，不能作为关闭同步的副作用。

## Supabase 采用方案

### 1. 本地优先（默认）

保持 `src/modules/config.ts` 的 `sync: false`，不要创建 Supabase client 或配置环境变量。Agent 偏好和用量都留在当前设备；这是首次运行和离线应用的推荐模式。

### 2. 托管 Supabase

1. 在自己的项目中先检查已安装 CLI 的命令：`supabase --help`、`supabase db --help`、`supabase functions --help`。
2. 审阅并应用仓库跟踪的 `supabase/migrations/`；部署仓库的 `sync` Edge Function。该 Function 需要用户 JWT，publishable key 不能作为其 Bearer token。
3. 只在本机开发/部署环境提供上述两个 `VITE_` 值，并实现登录、明确的同步开关和持久化 sync store。
4. 以两个不同用户和两台设备验证 RLS 隔离、离线 outbox 重启、同 revision 冲突、tombstone 与有序 checkpoint；不要把单设备单元测试当作此证据。

应用不会链接、部署或创建任何云项目；这些操作是采用者在其项目边界内显式执行的。

### 3. 自托管 Supabase

使用同一 migration、Function 和 publishable URL/key，但由运营方负责公开 HTTPS、备份/恢复演练、升级、监控、日志留存和事件响应。`supabase start` 的 CLI/Docker 栈仅供开发和本地集成测试；它不是公开服务、生产拓扑或生产安全证明。

### 4. 自带兼容后端

不需要导入 Supabase 包。实现 `POST /push` 与 `GET /pull?checkpoint=…`，返回现有 `SyncPushResult` / pull JSON，并提供：用户认证、owner 隔离、operation ID 幂等、基于 `baseRevision` 的 compare-and-swap、tombstone 与每 owner 有序 checkpoint。保持固定 HTTPS 端点和只接收短期 access token；不要让 WebView 选择任意认证 header 或后端 URL。

## HTTP 协议

内置 transport 使用两个端点：

```http
POST /push
Authorization: Bearer <short-lived-session>
Content-Type: application/json

{"changes":[SyncMutation]}
```

返回：

```json
{"accepted":[{"operationId":"op-1","collection":"agent_preferences","recordId":"profile-1","kind":"upsert","revision":"2","deviceId":"device-a","occurredAt":"2026-09-03T00:00:00.000Z"}],"conflicts":[]}
```

拉取：

```http
GET /pull?checkpoint=cursor-1
Authorization: Bearer <short-lived-session>
```

返回：

```json
{"changes":[],"checkpoint":"cursor-2"}
```

非回环地址必须使用 HTTPS，URL 不允许携带用户名或密码。调用者只能提供短期 access token，不能注入任意鉴权 Header。

## 数据分级

| 层级 | 数据 | 默认策略 |
| --- | --- | --- |
| Device local | API Key、Token、本地模型/文件路径、托盘、快捷键、自启动、日志、缓存 | 永不同步 |
| Account preferences | 主题、语言、布局、安全的 Provider/模型选择 | 登录后可默认同步 |
| Domain data | Todo、笔记、会话正文、项目数据 | 用户显式开启 |
| Collaborative documents | 多人富文本、白板、结构化文档 | 独立 CRDT Provider |

永不进入通用同步层：API Key、refresh token、Cookie、MCP 凭据或环境变量、OS 钥匙串内容、本地绝对路径、日志、缓存、向量索引、更新签名私钥。

同步策略使用白名单；`createAllowlistSyncPolicy()` 不传集合时拒绝全部数据。

## 可同步数据模型

新建需要同步的表或对象时至少包含：

- 全局唯一 `id`（UUID/ULID），不要依赖设备内自增 ID。
- `owner_id` 与 `device_id`。
- `created_at`、`updated_at`。
- `deleted_at` 或 tombstone，删除不能直接消失。
- `revision`（服务端版本、HLC 或领域版本向量）。
- `schema_version`。
- 每次变更唯一且可幂等的 `operation_id`。

本轮没有把示例 Todo 直接升级为同步表，避免用一个演示模型替应用决定账号、冲突和删除语义。

## 冲突策略

- 主题、语言等标量偏好：可使用服务端时间或 HLC 的 last-write-wins。
- Todo、记录和列表：使用行级 revision 与 tombstone；revision 不匹配时合并、拒绝或进入冲突 UI。
- 富文本与实时协作：按文档领域使用 Automerge/Yjs，不要把整个应用数据库 CRDT 化。
- 不同步 SQLite 数据库文件；同步变更记录或领域对象。

## 其他方案选择与接入位置

| 方案 | 推荐接入 | 适用场景 | 注意事项 |
| --- | --- | --- | --- |
| [Supabase Auth + Postgres/RLS](https://supabase.com/docs/guides/auth) | Auth 获取短期 token；Edge Function/服务实现 HTTP transport | 开源、可自托管的账号与业务数据参考实现 | Supabase Auth/Realtime 本身不等于离线冲突引擎 |
| [Firebase Firestore](https://firebase.google.com/docs/firestore/manage-data/enable-offline) | 独立 `SyncProvider` | 希望快速获得 Web 离线缓存与账号体系 | 数据模型和冲突语义绑定 Firestore |
| [PowerSync](https://docs.powersync.com/client-sdks/reference/javascript-web) | 替换内置 outbox 的 `SyncProvider` | SQLite/local-first 体验优先 | Web SDK 成熟度与 Rust SDK 状态要分别评估 |
| [Electric](https://electric-sql.com/docs/intro) | 独立 `SyncProvider` | Postgres 下行数据同步 | 写入与冲突链路需应用设计 |
| LAN | 配对发现层 + `SyncTransport` | 同一网络的一次性迁移或按需同步 | 发现不等于认证，第一版不要后台自动组网 |
| [Automerge](https://automerge.org/docs/hello/) / [Yjs](https://docs.yjs.dev/) | 文档领域独立 Provider | 实时多人文档 | 不作为通用数据库同步层 |

核心同步引擎不绑定任何一项。Supabase 客户端是显式采用的可选依赖；一个适配器应能删除而不影响领域存储和其他传输。

## 局域网同步安全基线

推荐第一版只实现“扫码/短码配对 + 用户触发传输”：

1. mDNS/DNS-SD 只做发现，不能作为设备身份。
2. QR 或短码交换短期配对令牌与公钥指纹。
3. 两端显示设备名称与指纹，要求用户确认。
4. 传输使用 TLS/QUIC/Noise 等经认证加密通道。
5. 配对令牌过期、操作幂等、设备可撤销。
6. Web 端通过桌面伴侣暴露的受限 HTTPS/WebSocket 地址接入；浏览器不承担原始 mDNS/UDP。

iOS 需要本地网络隐私声明，Android 新版本的附近 Wi-Fi 能力需要相应运行时权限。权限、后台服务和防火墙规则都应留在 LAN transport 模块，不进入同步核心。

## 证据等级与生产验收

| 等级 | 可证明的内容 | 不能证明的内容 |
| --- | --- | --- |
| 离线单元/构建检查 | URL/key 拒绝规则、session token 提取、合约和本地状态行为 | Auth、RLS、Postgres 或真实网络 |
| 本地 Supabase 集成 | CLI/Docker 环境下的 migration、Function、双用户 RLS/并发路径 | 公网 TLS、托管配置、真实两台设备 |
| 已部署两设备验证 | 采用者项目上的登录、RLS、断网恢复、冲突与 checkpoint | 所有业务领域或正式发布就绪 |

本任务只具备离线单元/构建检查；本地 Supabase 集成和已部署两设备验证需要采用者的 Docker/项目/设备，不能由此仓库的测试替代。

- 断网写入后重启应用，outbox 不丢失。
- 重复上传同一 operation 不产生重复记录。
- 上传失败不删除 outbox。
- 远端应用失败不推进 checkpoint。
- 删除使用 tombstone 并能跨设备传播。
- 两台设备同时编辑时执行已声明的冲突策略。
- 越权 collection 在网络发送和远端应用前均被拒绝。
- 日志、错误和遥测不包含 token、密钥或完整敏感 payload。
