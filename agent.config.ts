import type { AgentConfig } from './src/agent/config';

/**
 * Agent 能力配置。
 *
 * 使用方式：在应用侧以 `await import('./src/agent')` 动态加载，
 * 本文件保持为纯配置；enabled: false 时 Agent 不进入默认运行时加载路径。
 *
 * 完整字段说明见 docs/agent-integration.md
 */
const config: Partial<AgentConfig> = {
  // 总开关。false 时整个 agent 模块不进入默认运行时加载路径
  enabled: false,

  // 'inline' = 跑在 WebView（需 P1）；'sidecar' = Pi RPC 子进程（需 P3）
  runtime: 'inline',

  providers: [
    // 例 1：本地 Ollama（隐私优先，零云端依赖）—— 推荐本地推理首选
    // 前置：本机先 `ollama serve` 并 `ollama pull qwen3:8b`
    // {
    //   id: 'ollama',
    //   type: 'openai-compatible',
    //   baseUrl: 'http://localhost:11434/v1',
    //   apiKeyRef: { kind: 'none' },
    //   models: [{ id: 'qwen3:8b', contextWindow: 32768 }],
    // },
    //
    // 例 2：云端 Provider，密钥存 OS 钥匙串，请求由 Rust 代理注入密钥
    // 首次使用前调用 saveApiKey('openai', 'default', 'sk-...') 存入钥匙串
    // {
    //   id: 'openai',
    //   type: 'openai',
    //   apiKeyRef: { kind: 'keychain', service: 'openai', account: 'default' },
    // },
  ],

  defaultModel: '',

  // 内置工具必须显式声明；shell 默认不开，避免 Agent 执行任意命令
  tools: { builtins: [] },

  // keychain Provider 必须为 true；WebView 没有读取已存密钥的命令
  // 需用 Cargo feature `agent` 构建 Tauri 应用
  secureProxy: true,
};

export default config;
