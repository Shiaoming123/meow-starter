# 蓝图：开发者本地工具

## 适用场景

JSON/YAML 格式化、日志查看、文本转换、请求草稿或本地记录浏览。目标是让开发者快速完成一件窄任务，而不是在模板中预装高权限工作台。

## 完成后的首个用户旅程

用户粘贴或选择一份文本，看到校验或格式化结果，保存最近记录，复制或下载处理后的内容；Web 版仍可完成粘贴和下载，桌面版再按需增加文件选择。

## 从哪些现有文件开始

| 目的 | 现有模式 |
| --- | --- |
| UI 页面和主题 | `src/App.vue`、`src/components/ui/`、`src/assets/themes/` |
| 本地历史记录 | `src/storage/todos/` 与 `src/lib/db.ts` |
| 运行时能力判断 | `src/lib/platform.ts`、`src/modules/compatibility.ts` |
| 原生模块门控 | `src/modules/config.ts` 与 `src-tauri/Cargo.toml` |

## 实施顺序

1. 先把解析、格式化、校验写成无副作用的纯函数，为空输入、无效语法与超大输入添加测试。
2. 定义只保存必要元数据或用户明确保存内容的领域存储；不要把剪贴板、令牌或完整敏感日志默认持久化。
3. 用现有的 storage adapter 模式保存最近记录，并把 UI 状态与领域存储分开。
4. Web 默认只提供粘贴、校验、格式化与下载。确实需要文件选择、系统剪贴板或通知时，再启用对应模块。
5. 启用原生能力时同时检查前端模块配置、Cargo feature、`src-tauri/capabilities/` 权限与 Web 降级。四者缺一不可。

## 平台与安全边界

- 不启用 Shell 来执行用户输入的命令；格式化器应运行在纯函数或受控库中。
- 不做目录递归扫描、任意文件读取或 Token 保存。若产品确需文件访问，必须通过选择器并收紧 capability。
- 「API 客户端」在本蓝图里只代表请求草稿和本地历史。带认证的网络请求、代理与凭据管理是项目层的安全设计，不是模板默认能力。

## 不在本蓝图范围内

不包括命令执行、容器控制、任意网络代理、目录同步、云端账户或团队共享历史。

## 验证

```bash
npm test
npm run typecheck
npm run build
npm run build:web
npm run check:docs
```

额外手测 Web 降级：不依赖 Tauri IPC 也能粘贴、处理并下载结果；桌面专属入口在 Web 中不应显示或调用。
