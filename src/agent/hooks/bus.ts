export interface ToolCallPayload {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultPayload {
  toolCallId: string;
  name: string;
  result: unknown;
  isError: boolean;
}

export interface RequestContext {
  messages: unknown[];
  systemPrompt?: string;
}

type Maybe<T> = T | void | Promise<T | void>;

/** 与框架无关的钩子子集，对应 Pi 的同名事件语义 */
export interface HookHandlers {
  onBeforeRequest?: (ctx: RequestContext) => Maybe<Partial<RequestContext>>;
  onToolCall?: (p: ToolCallPayload) => Maybe<{ block?: boolean; reason?: string; args?: Record<string, unknown> }>;
  onToolResult?: (p: ToolResultPayload) => Maybe<{ result?: unknown; isError?: boolean }>;
  onStreamChunk?: (chunk: string) => void;
  onApprovalRequired?: (p: ToolCallPayload) => Maybe<boolean>;
  onError?: (e: { message: string }) => void;
  onComplete?: (p: { finishReason?: string }) => void;
  onSessionPersist?: (p: { sessionId: string }) => Maybe<void>;
}

export class HookBus {
  private handlers = new Set<HookHandlers>();

  register(h: HookHandlers): () => void {
    this.handlers.add(h);
    return () => {
      this.handlers.delete(h);
    };
  }

  async beforeRequest(ctx: RequestContext): Promise<RequestContext> {
    let cur = ctx;
    for (const h of this.handlers) {
      if (!h.onBeforeRequest) continue;
      const patch = await h.onBeforeRequest(cur);
      if (patch) cur = { ...cur, ...patch };
    }
    return cur;
  }

  async interceptToolCall(p: ToolCallPayload) {
    let args = p.args;
    for (const h of this.handlers) {
      if (!h.onToolCall) continue;
      const r = await h.onToolCall({ ...p, args });
      if (!r) continue;
      if (r.args) args = r.args;
      if (r.block) return { blocked: true as const, reason: r.reason, args };
    }
    return { blocked: false as const, args };
  }

  async rewriteToolResult(p: ToolResultPayload): Promise<ToolResultPayload> {
    let cur = p;
    for (const h of this.handlers) {
      if (!h.onToolResult) continue;
      const patch = await h.onToolResult(cur);
      if (!patch) continue;
      cur = {
        ...cur,
        result: patch.result !== undefined ? patch.result : cur.result,
        isError: patch.isError !== undefined ? patch.isError : cur.isError,
      };
    }
    return cur;
  }

  emitChunk(text: string): void {
    for (const h of this.handlers) h.onStreamChunk?.(text);
  }

  /** 无人响应时默认拒绝，保持保守 */
  async requestApproval(p: ToolCallPayload): Promise<boolean> {
    for (const h of this.handlers) {
      if (!h.onApprovalRequired) continue;
      const ok = await h.onApprovalRequired(p);
      if (ok !== undefined) return ok;
    }
    return false;
  }

  emitError(message: string): void {
    for (const h of this.handlers) h.onError?.({ message });
  }

  emitComplete(finishReason?: string): void {
    for (const h of this.handlers) h.onComplete?.({ finishReason });
  }

  async persist(sessionId: string): Promise<void> {
    for (const h of this.handlers) await h.onSessionPersist?.({ sessionId });
  }
}
