import Database from '@tauri-apps/plugin-sql';
import { isTauri } from '../../lib/db';
import { browserMemoryStore } from './in-memory';
import type { AgentMessage, MemoryStore } from './types';

export { createMemoryStore } from './in-memory';

const DB_URL = 'sqlite:app.db';

let conn: Promise<Database> | null = null;

function db(): Promise<Database> {
  if (!conn) conn = Database.load(DB_URL);
  return conn;
}

/**
 * 建表（幂等）。脚手架其他表在 Rust 侧迁移（src-tauri/src/db.rs），
 * 这里放在前端是为了让 P1 阶段能独立跑通；稳定后建议并入 Rust 迁移。
 */
export async function initAgentTables(): Promise<void> {
  if (!isTauri()) return;
  const d = await db();
  await d.execute(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await d.execute(
    'CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, id)',
  );
}

/** 默认实现：复用脚手架已有的 tauri-plugin-sql 连接 */
export const sqliteMemoryStore: MemoryStore = {
  async append(msg: AgentMessage): Promise<void> {
    if (!isTauri()) return browserMemoryStore.append(msg);
    const d = await db();
    await d.execute('INSERT INTO agent_messages (session_id, role, content) VALUES ($1, $2, $3)', [
      msg.sessionId,
      msg.role,
      msg.content,
    ]);
  },

  async list(sessionId: string, limit = 200): Promise<AgentMessage[]> {
    if (!isTauri()) return browserMemoryStore.list(sessionId, limit);
    const d = await db();
    return d.select<AgentMessage[]>(
      `SELECT id,
              session_id AS sessionId,
              role,
              content,
              created_at AS createdAt
         FROM agent_messages
        WHERE session_id = $1
        ORDER BY id ASC
        LIMIT $2`,
      [sessionId, limit],
    );
  },

  async clear(sessionId: string): Promise<void> {
    if (!isTauri()) return browserMemoryStore.clear(sessionId);
    const d = await db();
    await d.execute('DELETE FROM agent_messages WHERE session_id = $1', [sessionId]);
  },
};
