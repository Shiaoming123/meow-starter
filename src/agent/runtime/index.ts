import type { AgentConfig } from '../config';
import type { AgentRuntime } from './types';

export type { AgentRuntime, AgentRequest, AgentEvent, AgentCapabilities } from './types';

/**
 * 运行时工厂。两条轨道在 P1 / P3 阶段分别落地，
 * 此处保持显式报错，避免"装了却静默不工作"。
 */
export async function createRuntime(cfg: AgentConfig): Promise<AgentRuntime> {
  if (cfg.runtime === 'inline') {
    throw new Error(
      '[agent] inline 运行时未启用：请在 P1 阶段安装 ai + @ai-sdk/vue，并实现 src/agent/runtime/inline.ts',
    );
  }
  throw new Error(
    '[agent] sidecar 运行时未启用：请在 P3 阶段配置 Pi RPC sidecar，并实现 src/agent/runtime/sidecar.ts',
  );
}
