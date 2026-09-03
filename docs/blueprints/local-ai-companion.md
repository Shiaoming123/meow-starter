# 蓝图：本地 AI 伴侣

## 适用场景

以本地 Ollama 或兼容运行时为主的个人对话工具、写作辅助或小型知识工作台。它适合愿意自己验证模型、端口和本机资源的开发者。

## 成熟度与前提

Agent、本地推理与 MCP 均为 **Preview**。本蓝图展示如何显式接入，不代表模型、工具调用或跨平台打包已经得到通用生产验证。先读 [local-inference.md](../local-inference.md) 与 [agent-integration.md](../agent-integration.md)。

## 完成后的首个用户旅程

用户明确安装 Agent 依赖并配置本地模型，创建一个本地会话，发送消息，重启后读取自己的会话；任何工具调用都应在用户可见、可审阅的边界内发生。

## 从哪些现有文件开始

| 目的 | 现有模式 |
| --- | --- |
| Agent 总开关与 Provider 配置 | `agent.config.ts`、`src/modules/config.ts` |
| Agent 运行时与 UI | `src/agent/`、`src/agent/ui/ChatPanel.vue` |
| 本地模型预设 | `src/agent/providers/presets.ts` |
| 安全与运行时边界 | `docs/agent-integration.md`、`docs/local-inference.md` |

## 实施顺序

1. 明确产品是否只支持本地模型；若是，先使用本地/no-key profile，避免在首版引入云端密钥与代理。
2. 运行 `npm run add:agent`，在 `agent.config.ts` 只配置项目需要的 Provider 与模型，再显式启用前端 Agent 模块。
3. 将 `ChatPanel.vue` 作为界面参考，不把聊天记录、系统提示词或工具结果误当成无边界的通用记忆。
4. 只在用户明确选择后启用工具；为工具输入、批准、失败和取消路径写项目级测试。
5. 只有接入 OpenAI 或 Anthropic 的真实云端密钥时，才继续配置 Rust `agent` feature、Keychain 与固定目标代理；不得把密钥放入 WebView、前端 bundle 或本地 Web 存储。

## 平台与安全边界

- 本地模型需要用户自行启动并验证运行时；端口、CORS 和模型兼容性不是模板的发布承诺。
- 默认不联网、不启用 MCP、不接 RAG、不上传文档、不自动执行工具。
- Web 端没有等同 OS Keychain 的可信边界。需要云端模型时，应采用项目自己的服务端 Gateway，而非把 Provider Key 放入浏览器。

## 不在本蓝图范围内

不包括自动化 Agent、MCP host、任意工具执行、云端 Key 管理、RAG、向量数据库、文件上传、费用统计或多设备同步。

## 验证

```bash
npm test
npm run typecheck
npm run build
npm run build:web
npm run check:docs
```

有现成 Ollama 运行时时，再手动完成一次无工具对话并记录模型、平台与失败边界；没有本地运行时时，应明确标为未运行而不是宣称已验证。
