# 首个应用蓝图

这些蓝图把 `meow-starter` 从「可以运行的模板」变成「可以开始改造的起点」。它们不会新增依赖、云端账户或隐藏功能；请先按产品需求选择一条，再只实现对应的业务能力。

| 想做什么 | 选这篇 | 优先学习的能力 | 不应默认加入的能力 |
| --- | --- | --- | --- |
| 离线知识、笔记、日记或个人效率工具 | [本地笔记库](./local-notebook.md) | 领域存储、SQLite migration、Web IndexedDB 降级 | 协作、云同步、RAG、富文本编辑器 |
| JSON/YAML、日志、格式化或请求草稿工具 | [开发者本地工具](./developer-utility.md) | 纯函数校验、最小权限、Web 降级 | Shell、目录扫描、Token 保存、任意网络请求 |
| 以本地模型为主的个人 AI 工作台 | [本地 AI 伴侣](./local-ai-companion.md) | 明确 opt-in、会话边界、人工审阅 | 默认联网、MCP、RAG、自动执行工具 |

## 所有蓝图共用的起步路径

1. 克隆后先运行 `npm run doctor`，确认 Node、Rust、Cargo 与本地 Tauri CLI 的诊断结果。
2. 先用一句话写下首个用户旅程，例如「创建一条笔记，重启后仍能搜索到它」；不要先让 AI 大范围改目录。
3. 定义一个小型领域接口，仿照 `src/storage/todos/` 提供内存、IndexedDB 与 Tauri SQLite 适配器。
4. 在 `src-tauri/src/db.rs` 为每一步数据库变化添加一条 SQL migration，并为领域行为添加测试。
5. 用业务 UI 替换 `src/App.vue` 的 Todo 演示；完成后运行 `npm test`、`npm run typecheck`、`npm run build`、`npm run build:web` 与 `npm run check:docs`。
6. 在桌面端手动重启应用，确认本地数据仍存在；Web 端要单独验证 IndexedDB 的同源持久化。

## 模块与平台边界

`src/modules/config.ts` 只控制前端装配。涉及原生插件时，还必须显式匹配 Cargo feature、Tauri capability 权限与目标平台；不要把一个前端开关描述成完整的原生功能安装或发布配置。桌面是主要目标，Web 是 Beta 降级路径，移动端不能因响应式页面而视作已发布。

发布、签名、更新端点和凭据不属于蓝图默认步骤。开始发布工作前请读 [release-kit.md](../release-kit.md)。
