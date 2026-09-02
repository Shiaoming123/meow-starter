# 本地推理接入指南（Ollama）

> P2 阶段：让 Agent 跑本地模型，数据不出设备。无需 API Key、无云端依赖。
>
> **成熟度：Preview。** 仓库提供 Ollama/OpenAI-compatible 配置预设，但尚未在 CI 中启动真实 Ollama 完成端到端对话；使用者需要自行验证模型、端口和跨域/代理边界。

## 1. 为什么用 Ollama 而不是内置 llama.cpp

meow-starter 选择**适配外部 Ollama**，而非把 llama.cpp 打包进脚手架：

| 方案 | 体积 | 维护 | 灵活性 |
|---|---|---|---|
| 内置 llama.cpp | 巨大（模型引擎 + 依赖） | 高（三端编译 + 更新） | 低（锁定引擎） |
| **适配 Ollama**（本方案） | 不打包推理引擎 | Ollama 独立维护 | 高（Ollama/LM Studio/vLLM 任选） |

用户在机器上跑 `ollama serve`，脚手架通过 OpenAI 兼容协议连接——这就是 `openai-compatible` 通道（P1 已预留）。

## 2. 快速开始

### 第一步：装 Ollama 并拉模型

```bash
# 安装 Ollama（https://ollama.com）
# 拉一个本地模型（按机器内存选）
ollama pull qwen3:8b      # 8B 模型，适合 16GB 内存
ollama pull gemma3:4b     # 4B 模型，适合 8GB 内存
```

### 第二步：配置 provider

在 `agent.config.ts` 里启用（或直接用预设）：

```ts
import { ollamaPreset } from './src/agent/providers/presets'

const config: Partial<AgentConfig> = {
  enabled: true,
  runtime: 'inline',
  providers: [ollamaPreset],
  defaultModel: 'ollama/qwen3:8b',   // 'provider/model' 形式
  // ...
}
```

### 第三步：跑起来

```bash
ollama serve          # 终端 1：启动 Ollama
npm run tauri dev     # 终端 2：启动应用
```

在业务页面显式引入 ChatPanel 后即可对话；请求发往 `http://localhost:11434/v1`，模型在本机推理。若 WebView 报跨域错误，需要在本机服务或 Rust 侧配置明确的开发代理，不要放宽云端密钥代理白名单。

## 3. 云端 Provider（密钥安全）

云端模型可使用 **keychain 类型**，密钥存 OS 钥匙串。已存密钥没有 WebView 读回命令；OpenAI/Anthropic 请求体经 Tauri channel 交给 Rust，由 Rust 注入密钥并只发往固定官方 API：

```ts
providers: [
  { id: 'openai', type: 'openai', apiKeyRef: { kind: 'keychain', service: 'openai', account: 'default' } },
]
```

首次使用前，把密钥存进钥匙串：

```ts
import { saveApiKey } from './src/agent'
await saveApiKey('openai', 'default', 'sk-...')  // 存入系统钥匙串；不要写入源码或 localStorage
```

> 安全铁律：API Key 不硬编码、不存 localStorage。桌面 App 可被逆向，明文密钥 = 裸奔。
> 首次在设置页输入时，密钥会短暂存在于 WebView 内存并通过 IPC 写入钥匙串；写入后只能检查存在性或删除，不能读回。

## 4. 常见问题

- **连接失败**：确认 `ollama serve` 在跑，且端口 11434 未被占用。
- **模型不存在**：先 `ollama pull <model>` 再引用。
- **响应慢**：8B 以上模型在 CPU 上首 token 较慢；换更小的量化模型（如 4B）或启用 GPU 加速。
- **云端代理失败**：确认 Cargo feature `agent` 已启用（`--features agent`），且 `hasApiKey` 返回 true。

## 5. 技术要点

- **openai-compatible 通道**：无密钥的本地 Ollama/vLLM 可直接设置 `baseURL`；带密钥的任意兼容云端在本阶段默认拒绝，需先新增 Rust 侧显式白名单。
- **Rust 密钥代理**：`src-tauri/src/agent/{secrets,proxy}.rs`，keyring（OS 钥匙串）+ reqwest（流式透传），由 Cargo feature `agent` 门控。
- **安全边界**：Rust 只接受 OpenAI/Anthropic 的 HTTPS 官方主机与 `/v1/**` 路径，禁重定向并限制请求体；禁止重新添加可从 WebView 读取明文密钥的通用命令。

### 传输矩阵

| Provider 配置 | 传输 | 状态 |
| --- | --- | --- |
| Ollama/vLLM + `kind: 'none'` | WebView 直连本机 | Preview，需本机 smoke test |
| OpenAI/Anthropic + `kind: 'keychain'` | 固定目标 Rust 流式代理 | Preview，需真实账号 smoke test |
| 任意兼容云端 + 密钥 | 拒绝 | 等待 Rust 显式白名单机制 |
| `kind: 'env'` | 拒绝 | WebView 无可信环境变量边界 |
