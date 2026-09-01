import type { AgentConfig } from '../config';
import type { AgentRuntime } from './types';

export type { AgentRuntime, AgentRequest, AgentEvent, AgentCapabilities } from './types';

/**
 * 运行时工厂。
 *
 * 用动态 import 加载具体实现 —— AI SDK 只在这条路径被执行时才进入 bundle，
 * `enabled: false` 的项目永远加载不到它。
 */
export async function createRuntime(cfg: AgentConfig): Promise<AgentRuntime> {
  if (cfg.runtime === 'inline') {
    const { createInlineRuntime } = await import('./inline');
    return createInlineRuntime(cfg);
  }
  throw new Error(
    '[agent] sidecar 运行时未启用：请在 P3 阶段配置 Pi RPC sidecar，并实现 src/agent/runtime/sidecar.ts',
  );
}
