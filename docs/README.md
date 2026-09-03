# 📚 文档中心

欢迎来到 meow-starter 的文档中心。按你的角色或目标，选择入口：

## 成熟度速览

| 级别 | 能力 |
| --- | --- |
| **Stable** | core、SQLite、主题、桌面托盘/单实例 |
| **Beta** | Web IndexedDB、更新器、移动端响应式与桌面能力降级 |
| **Preview** | Sync、Agent、Ollama、MCP、可选系统插件 |
| **Roadmap** | sidecar、RAG、语音、OCR |

专题文档既包含当前用法，也包含目标设计；每篇开头的成熟度说明优先于路线图描述。

## 按目标导航

| 我想… | 文档 |
| --- | --- |
| 快速了解项目定位与适配场景 | [project-guide.md](./project-guide.md) |
| 配置本地开发与 exFAT 工作区 | [development.md](./development.md) |
| 定义产品目标、数据与交付边界 | [application-protocol.md](./application-protocol.md) |
| 了解 Release Kit 与发布边界 | [release-kit.md](./release-kit.md) |
| 从模板做出第一个应用 | [blueprints/README.md](./blueprints/README.md) |
| 用设计系统、写组件、加主题 | [design-system.md](./design-system.md) |
| 理解模块化架构、扩展模块 | [modular-architecture.md](./modular-architecture.md) |
| 了解全部 AI Native 能力规划 | [ai-capabilities.md](./ai-capabilities.md) |
| 接入 Agent（对话/工具/记忆） | [agent-integration.md](./agent-integration.md) |
| 接本地模型（Ollama） | [local-inference.md](./local-inference.md) |
| 接 MCP 外部工具 | [mcp.md](./mcp.md) |
| 运行和部署 Web 版 | [web.md](./web.md) |
| 接账号、云端或局域网同步 | [sync.md](./sync.md) |
| 移动端适配（Android/iOS） | [mobile.md](./mobile.md) |
| 维护开源社区与推广节奏 | [community-growth.md](./community-growth.md) |

## 按角色导航

- **新用户 / 决策者** → 先读 [project-guide.md](./project-guide.md)，判断项目是否适合
- **贡献者 / Agent** → 先读 [development.md](./development.md)，再遵守 [../AGENTS.md](../AGENTS.md)
- **发布负责人** → 读 [release-kit.md](./release-kit.md)，确认已验证范围与待完成的平台工作
- **准备做首个应用的开发者** → 先读 [blueprints/README.md](./blueprints/README.md)，按产品类型选择一条窄路径
- **前端开发者** → 先读 [design-system.md](./design-system.md)，再动手写组件
- **架构师 / 进阶开发者** → 先读 [modular-architecture.md](./modular-architecture.md) 与 [agent-integration.md](./agent-integration.md)
- **AI 应用开发者** → 按需读 [agent-integration.md](./agent-integration.md)、[local-inference.md](./local-inference.md)、[mcp.md](./mcp.md)
- **多端开发者** → 读 [web.md](./web.md) 与 [mobile.md](./mobile.md) 了解各平台适配与降级策略
- **本地优先应用开发者** → 读 [sync.md](./sync.md) 选择账号、云端或 LAN 接入层

## 文档清单

| 文档 | 一句话说明 |
| --- | --- |
| project-guide.md | 项目适配指南：适合做什么 + 分类型注意事项 |
| development.md | 本地开发：环境诊断、验证命令与 exFAT 处理 |
| application-protocol.md | 应用协议：产品意图、能力、数据、降级与证据边界 |
| release-kit.md | Release Kit：配置检查与发布成熟度边界 |
| blueprints/ | 首个应用蓝图：本地笔记、开发者工具、本地 AI 伴侣 |
| design-system.md | 设计系统：tokens + 组件 + 主题 + 性能 + 可达性 |
| modular-architecture.md | 模块化架构：运行时与原生构建双平面契约 + 平台能力 |
| ai-capabilities.md | AI Native 能力清单：P1-P3 落地节奏 |
| agent-integration.md | Agent 集成方案：框架对比 + 双轨设计 + 分阶段路径 |
| local-inference.md | 本地推理：Ollama 接入 + 密钥安全 |
| mcp.md | MCP 接入：连接外部工具到 Agent |
| mobile.md | 移动端适配（Android/iOS）：前置依赖 + 初始化 + 降级 |
| web.md | Web 适配：IndexedDB、版本化 Todo 数据端口、平台能力与静态部署 |
| sync.md | 同步接缝：outbox + HTTP + 云端/LAN/CRDT 方案选择 |
| community-growth.md | 开源曝光、贡献者入口与首月运营节奏 |

## 架构图

![架构总览](./architecture.svg)

## 其他资源

- 主 README：[../README.md](../README.md)（中文）· [../README.en.md](../README.en.md)（English）
- 贡献：[../CONTRIBUTING.md](../CONTRIBUTING.md)
- 行为准则：[../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)
- 安全：[../SECURITY.md](../SECURITY.md)
- 变更日志：[../CHANGELOG.md](../CHANGELOG.md)
