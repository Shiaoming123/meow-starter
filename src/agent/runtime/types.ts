import type { HookBus } from '../hooks/bus';

export interface AgentRequest {
  prompt: string;
  sessionId?: string;
  /** 覆盖默认模型，'provider/model' 形式 */
  model?: string;
}

export type AgentEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; name: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; name: string; result: unknown; isError?: boolean }
  | { type: 'approval-required'; toolCallId: string; name: string; args: unknown }
  | { type: 'error'; message: string }
  | { type: 'done'; finishReason?: string };

export interface AgentCapabilities {
  /** Pi sidecar 支持会话树，inline 轨默认不支持 */
  sessionTree: boolean;
  compaction: boolean;
  sandbox: boolean;
}

/**
 * 防腐层核心：业务代码只依赖此接口。
 * inline 轨（AI SDK）与 sidecar 轨（Pi RPC）各自提供实现。
 */
export interface AgentRuntime {
  readonly kind: 'inline' | 'sidecar';
  readonly capabilities: AgentCapabilities;
  stream(req: AgentRequest, hooks: HookBus): AsyncIterable<AgentEvent>;
  abort(reason?: string): Promise<void>;
}
