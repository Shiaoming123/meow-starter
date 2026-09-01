export interface AgentMessage {
  id?: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  createdAt?: number;
}

/** 接缝 1：持久化。默认实现复用脚手架已有的 tauri-plugin-sql */
export interface MemoryStore {
  append(msg: AgentMessage): Promise<void>;
  list(sessionId: string, limit?: number): Promise<AgentMessage[]>;
  clear(sessionId: string): Promise<void>;
}

/** 接缝 2：上下文组装。可替换为 RAG 检索注入等策略 */
export interface ContextAssembler {
  assemble(sessionId: string, systemPrompt?: string): Promise<unknown[]>;
}

/** 接缝 3：压缩。对应 Pi 的 session_before_compact / dsh 的 ctx.compaction */
export interface CompactionStrategy {
  shouldCompact(messages: AgentMessage[]): boolean;
  compact(messages: AgentMessage[]): Promise<AgentMessage[]>;
}
