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

在 ChatPanel 里对话即可，请求发往 `http://localhost:11434/v1`，模型在本机推理。

## 3. 云端 Provider（密钥安全）

云端模型可使用 **keychain 类型**，密钥存 OS 钥匙串。当前安全代理仍是 Preview，正式分发前必须验证密钥不会通过 WebView API 返回明文：

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

## 4. 常见问题

- **连接失败**：确认 `ollama serve` 在跑，且端口 11434 未被占用。
- **模型不存在**：先 `ollama pull <model>` 再引用。
- **响应慢**：8B 以上模型在 CPU 上首 token 较慢；换更小的量化模型（如 4B）或启用 GPU 加速。
- **密钥读取失败**：确认 Cargo feature `agent` 已启用（`--features agent`），且密钥已用 `saveApiKey` 存入。

## 5. 技术要点

- **openai-compatible 通道**：`createOpenAI({ baseURL })` 同时覆盖 OpenAI / Ollama / vLLM / 任何兼容端点，换 baseURL 即可切换。
- **Rust 密钥代理**：`src-tauri/src/agent/{secrets,proxy}.rs`，keyring（OS 钥匙串）+ reqwest（流式透传），由 Cargo feature `agent` 门控。
- **安全边界**：正式分发应由 Rust 侧读取密钥并代发受限请求；禁止设计可从 WebView 直接读取明文密钥的通用命令。
