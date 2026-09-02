import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import type { FlexibleSchema, ModelMessage } from 'ai';
import { z } from 'zod';
import type { AgentConfig } from '../config';
import type { HookBus } from '../hooks/bus';
import { conversationMessages } from '../memory/conversation';
import { browserMemoryStore } from '../memory/in-memory';
import { initAgentTables, sqliteMemoryStore } from '../memory/store';
import { resolveModel } from '../providers/adapter';
import { decideToolApproval } from '../tools/approval';
import { listTools } from '../tools/registry';
import type { AgentEvent, AgentRequest, AgentRuntime } from './types';

/**
 * 默认轨：AI SDK 的 ToolLoopAgent，直接跑在 WebView 内。
 *
 * 能力边界（对应方案 §2.3）：
 * - 会话树 / 沙箱 需进阶轨（Pi sidecar）
 * - 压缩由 memory 层的 CompactionStrategy 承担，非运行时内置
 */
export function createInlineRuntime(cfg: AgentConfig): AgentRuntime {
  let controller: AbortController | null = null;

  return {
    kind: 'inline',
    capabilities: { sessionTree: false, compaction: true, sandbox: false },

    abort: async (reason?: string) => {
      controller?.abort(reason);
    },

    async *stream(req: AgentRequest, hooks: HookBus): AsyncIterable<AgentEvent> {
      controller = new AbortController();

      const modelRef = req.model ?? cfg.defaultModel;
      if (!modelRef) {
        throw new Error('[agent] 未指定模型：请在 agent.config.ts 设置 defaultModel');
      }
      const model = await resolveModel(modelRef, cfg.secureProxy);
      const memory = cfg.memory.backend === 'sqlite' ? sqliteMemoryStore : browserMemoryStore;
      if (req.sessionId && cfg.memory.backend === 'sqlite') await initAgentTables();
      const history = req.sessionId
        ? await memory.list(req.sessionId, Math.max(0, cfg.memory.maxTurns * 2))
        : [];
      const requestContext = await hooks.beforeRequest({
        messages: conversationMessages(history, req.prompt, cfg.memory.maxTurns),
        systemPrompt: cfg.systemPrompt,
      });

      // 注册中心的工具 → AI SDK 的 tool 格式；审批与改写交给 HookBus
      const tools = Object.fromEntries(
        listTools().map((t) => [
          t.name,
          tool({
            description: t.description,
            // AI SDK 要求 inputSchema 必填；无参工具兜底为空对象 schema。
            // ToolDef 侧保持 unknown 以免骨架强绑 zod，适配在此收敛。
            inputSchema: (t.inputSchema ?? z.object({})) as FlexibleSchema<unknown>,
            execute: async (args, opts) => {
              const intercepted = await hooks.interceptToolCall({
                toolCallId: opts.toolCallId,
                name: t.name,
                args: (args ?? {}) as Record<string, unknown>,
              });
              if (intercepted.blocked) {
                return { error: intercepted.reason ?? 'blocked by hook' };
              }

              let toolRequiresApproval = false;
              try {
                toolRequiresApproval = t.needsApproval?.(intercepted.args as never) ?? false;
              } catch {
                return { error: 'tool approval predicate failed closed' };
              }

              const approval = decideToolApproval(
                cfg.approval,
                t.name,
                intercepted.args,
                toolRequiresApproval,
              );
              if (approval === 'deny') {
                return { error: 'tool execution denied by policy' };
              }
              if (
                approval === 'confirm' &&
                !(await hooks.requestApproval({
                  toolCallId: opts.toolCallId,
                  name: t.name,
                  args: intercepted.args,
                }))
              ) {
                return { error: 'tool execution was not approved' };
              }

              const result = await t.execute(intercepted.args, {
                signal: opts.abortSignal,
                sessionId: req.sessionId,
              });

              const rewritten = await hooks.rewriteToolResult({
                toolCallId: opts.toolCallId,
                name: t.name,
                result: result.content,
                isError: result.isError ?? false,
              });
              return rewritten.result;
            },
          }),
        ]),
      );

      const agent = new ToolLoopAgent({
        model,
        instructions: requestContext.systemPrompt,
        tools,
        stopWhen: stepCountIs(cfg.maxSteps),
      });

      const result = await agent.stream({
        messages: requestContext.messages as ModelMessage[],
        abortSignal: controller.signal,
      });

      let assistantText = '';
      let completed = false;
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            assistantText += part.text;
            hooks.emitChunk(part.text);
            yield { type: 'text-delta', text: part.text };
            break;
          case 'tool-call':
            yield {
              type: 'tool-call',
              toolCallId: part.toolCallId,
              name: part.toolName,
              args: part.input,
            };
            break;
          case 'tool-result':
            yield {
              type: 'tool-result',
              toolCallId: part.toolCallId,
              name: part.toolName,
              result: part.output,
            };
            break;
          case 'tool-error':
            hooks.emitError(String(part.error));
            yield { type: 'error', message: String(part.error) };
            break;
          case 'error':
            hooks.emitError(String(part.error));
            yield { type: 'error', message: String(part.error) };
            break;
          case 'finish':
            completed = true;
            hooks.emitComplete(part.finishReason);
            yield { type: 'done', finishReason: part.finishReason };
            break;
          default:
            break;
        }
      }

      if (completed && req.sessionId) {
        await memory.append({
          sessionId: req.sessionId,
          role: 'user',
          content: req.prompt,
        });
        if (assistantText) {
          await memory.append({
            sessionId: req.sessionId,
            role: 'assistant',
            content: assistantText,
          });
        }
        await hooks.persist(req.sessionId);
      }
    },
  };
}
