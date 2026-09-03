# 蓝图：本地笔记库

## 适用场景

离线笔记、日记、收藏、习惯记录或个人知识库。选择它的前提是「本机数据优先于账号和协作」。

## 完成后的首个用户旅程

用户启动应用，创建一条笔记，按集合或标签浏览，编辑内容，重启应用后搜索到同一条记录；应用可以按项目自己定义的 JSON 格式导出数据。

## 从哪些现有文件开始

| 目的 | 现有模式 |
| --- | --- |
| 领域接口与三端适配 | `src/storage/todos/` |
| 面向 UI 的调用入口 | `src/lib/db.ts` |
| SQLite migration | `src-tauri/src/db.rs` |
| 跨 adapter 行为测试 | `tests/todo-storage.test.ts` |
| 演示页面与组件 | `src/App.vue`、`src/components/ui/` |

## 实施顺序

1. 先定义 `Note` 与小型 `NoteStore`：仅覆盖 `list`、`get`、`put`、`remove` 和首版所需的搜索条件。
2. 在 `src/storage/notes/` 建立内存、IndexedDB、Tauri SQLite 三个适配器；UI 和业务逻辑只能依赖 `NoteStore`。
3. 在 `src-tauri/src/db.rs` 为笔记表、集合/标签与必要索引逐条添加 migration。不要在一条 migration 中写多条 SQL。
4. 为每个 adapter 复用 Todo 的行为测试思路：创建、更新、删除、重开存储后的可见性与搜索。
5. 将 `App.vue` 的演示区替换为列表、详情和编辑表单；保持当前主题 token 与基础组件，而不是从零造另一套设计系统。
6. 如需导出，先定义版本化、透明的 JSON schema 与手动导出入口；导入、冲突处理和自动备份必须在项目中另行实现和验证。

## 平台与安全边界

- Tauri 桌面端使用 SQLite；Web 端使用 IndexedDB，同一份 UI 不能假设两端共享数据。
- 浏览器换域名、协议或端口会得到另一份 IndexedDB；重要数据必须由产品提供明确的导出或备份策略。
- SQLite 默认不是加密数据库。笔记若包含敏感内容，需要项目自行决定加密、主密钥与恢复体验。

## 不在本蓝图范围内

不包括多人协作、云同步、富文本编辑器、向量检索、RAG、AI 自动分类或已实现的备份恢复。先把单机数据模型与迁移做稳，再按真实需求扩展。

## 验证

```bash
npm test
npm run typecheck
npm run build
npm run build:web
npm run check:docs
```

另在桌面端创建、编辑并重启一次；在 Web 端刷新页面确认 IndexedDB 持久化。
