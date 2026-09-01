export type AgentRuntimeKind = 'inline' | 'sidecar';

export type ProviderKind = 'openai' | 'anthropic' | 'google' | 'openai-compatible';

/** 密钥永不硬编码在配置里，只描述去哪里取 */
export type ApiKeyRef =
  | { kind: 'none' }
  | { kind: 'keychain'; service: string; account?: string }
  | { kind: 'env'; name: string };

export interface ModelSpec {
  id: string;
  contextWindow?: number;
}

export interface ProviderConfig {
  id: string;
  type: ProviderKind;
  /** openai-compatible 必填：Ollama / vLLM / 任何兼容端点 */
  baseUrl?: string;
  apiKeyRef?: ApiKeyRef;
  models?: ModelSpec[];
}

export type BuiltinToolName = 'fs' | 'db' | 'shell' | 'http';

export interface ApprovalRule {
  tool: string;
  /** 针对字符串入参的正则，命中才应用该规则 */
  pattern?: string;
  action: 'allow' | 'confirm' | 'deny';
}

export interface AgentConfig {
  /** 总开关。false 时本模块完全不进入 bundle */
  enabled: boolean;
  runtime: AgentRuntimeKind;
  providers: ProviderConfig[];
  /** 'provider/model' 形式，如 'openai/gpt-5' */
  defaultModel: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 单次运行最大步数（工具调用轮次上限），防止失控循环 */
  maxSteps: number;
  tools: {
    /** 显式声明，未声明的内置工具不注册 */
    builtins: BuiltinToolName[];
    allowPaths?: string[];
  };
  memory: {
    backend: 'sqlite' | 'memory';
    maxTurns: number;
    compaction: { enabled: boolean; thresholdTokens: number };
  };
  approval: {
    mode: 'auto' | 'confirm' | 'deny';
    rules?: ApprovalRule[];
  };
  /** 请求经 Rust 侧代理，避免密钥出现在前端 */
  secureProxy: boolean;
  sidecar?: {
    binary: string;
    args?: string[];
    nodeRuntime?: 'bundled' | 'system';
  };
}

/** 默认值刻意保守：关闭、无工具、需确认、走安全代理 */
export const defaultAgentConfig: AgentConfig = {
  enabled: false,
  runtime: 'inline',
  providers: [],
  defaultModel: '',
  maxSteps: 20,
  tools: { builtins: [] },
  memory: {
    backend: 'sqlite',
    maxTurns: 20,
    compaction: { enabled: true, thresholdTokens: 32000 },
  },
  approval: { mode: 'confirm' },
  secureProxy: true,
};

export function resolveConfig(user?: Partial<AgentConfig>): AgentConfig {
  return {
    ...defaultAgentConfig,
    ...user,
    tools: { ...defaultAgentConfig.tools, ...user?.tools },
    memory: { ...defaultAgentConfig.memory, ...user?.memory },
    approval: { ...defaultAgentConfig.approval, ...user?.approval },
  };
}
