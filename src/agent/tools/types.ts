import type { ZodType } from 'zod';

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
 * 工具定义。P1 起 inputSchema 收敛为 Zod schema（AI SDK 原生格式）。
 * zod 仅以 `import type` 引入，类型在编译期擦除，不影响运行时打包。
 */
export interface ToolDef<TInput = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema?: ZodType;
  /** 返回 true 时触发人工审批门 */
  needsApproval?: (args: TInput) => boolean;
  execute: (args: TInput, ctx: ToolContext) => Promise<ToolResult>;
}
