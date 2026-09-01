import type { AgentConfig } from './src/agent/config';

/**
 * Agent 能力配置。
 *
 * 使用方式：在应用侧以 `await import('./src/agent')` 动态加载，
 * 本文件保持零运行时依赖，避免被静态打进主包。
 *
 * 完整字段说明见 docs/agent-integration.md
 */
const config: Partial<AgentConfig> = {
  // 总开关。false 时整个 agent 模块不加载，产物与未接入时一致
  enabled: false,

  // 'inline' = 跑在 WebView（需 P1）；'sidecar' = Pi RPC 子进程（需 P3）
  runtime: 'inline',

  providers: [
    // 例：本地 Ollama，无需密钥，适合离线场景
    // {
    //   id: 'ollama',
    //   type: 'openai-compatible',
    //   baseUrl: 'http://localhost:11434/v1',
    //   apiKeyRef: { kind: 'none' },
    //   models: [{ id: 'qwen3:8b', contextWindow: 32768 }],
    // },
    //
    // 例：云端 Provider，密钥存钥匙串、请求走 Rust 代理
    // {
    //   id: 'openai',
    //   type: 'openai',
    //   apiKeyRef: { kind: 'keychain', service: 'your-app' },
    // },
  ],

  defaultModel: '',

  // 内置工具必须显式声明；shell 默认不开，避免 Agent 执行任意命令
  tools: { builtins: [] },

  // 请求经 Rust 侧代理，密钥不出现在前端
  secureProxy: true,
};

export default config;
