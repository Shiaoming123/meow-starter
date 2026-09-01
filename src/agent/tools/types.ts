export interface ToolContext {
  sessionId?: string;
  signal?: AbortSignal;
  /** 走 Rust 侧代理，避免密钥出现在前端 */
  ipc?: <T = unknown>(cmd: string, args?: unknown) => Promise<T>;
}

export interface ToolResult {
  content: unknown;
  isError?: boolean;
}

/**
 * 工具定义。inputSchema 在 P1 接入 AI SDK 后收敛为 Zod schema，
 * P0 阶段保持 unknown，以免为零依赖骨架引入新包。
 */
export interface ToolDef<TInput = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema?: unknown;
  /** 返回 true 时触发人工审批门 */
  needsApproval?: (args: TInput) => boolean;
  execute: (args: TInput, ctx: ToolContext) => Promise<ToolResult>;
}
