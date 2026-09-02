import { bootstrapProviders, resolveAgentConfiguration } from './bootstrap';
import type { AgentConfig } from './config';
import type { AgentRuntime } from './runtime/types';

/**
 * Agent 模块唯一入口。
 *
 * 请以 `await import('./agent')` 方式调用 —— 这样整个模块会被 Vite
 * 分割成独立 chunk；`enabled: false` 时既不加载也不进入主包。
 */
export async function loadAgent(user?: Partial<AgentConfig>): Promise<AgentRuntime | null> {
  const cfg = await resolveAgentConfiguration(user);
  if (!cfg.enabled) return null;
  bootstrapProviders(cfg);
  const { createRuntime } = await import('./runtime');
  return createRuntime(cfg);
}

export { defaultAgentConfig, resolveConfig } from './config';
export type { AgentConfig, ProviderConfig, BuiltinToolName, ApprovalRule, ApiKeyRef } from './config';

export { HookBus } from './hooks/bus';
export type { HookHandlers, ToolCallPayload, ToolResultPayload } from './hooks/bus';

export { registerTool, getTool, listTools, clearTools } from './tools/registry';
export type { ToolDef, ToolContext, ToolResult } from './tools/types';

export { registerProvider, getProvider, listProviders, clearProviders } from './providers/registry';
export type { ProviderInstance, ProviderAdapter } from './providers/types';
export { ollamaPreset, vllmPreset, openaiPreset, anthropicPreset, providerPresets } from './providers/presets';
export { saveApiKey, deleteApiKey, hasApiKey } from './providers/adapter';

export type { AgentMessage, MemoryStore, ContextAssembler, CompactionStrategy } from './memory/types';
export { sqliteMemoryStore, createMemoryStore, initAgentTables } from './memory/store';

/**
 * 注意：ChatPanel.vue 不在此导出 —— 它内部 import 了本文件的 loadAgent，
 * 若再从这里导出会形成循环依赖。请按路径引入：
 * `import ChatPanel from './agent/ui/ChatPanel.vue'`
 */
