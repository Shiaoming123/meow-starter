import type { AgentConfig } from '../config'

export type ApprovalDecision = 'allow' | 'confirm' | 'deny'

export function decideToolApproval(
  policy: AgentConfig['approval'],
  toolName: string,
  args: unknown,
  toolRequiresApproval = false,
): ApprovalDecision {
  const serializedArgs = JSON.stringify(args ?? {})
  let decision: ApprovalDecision | undefined

  for (const rule of policy.rules ?? []) {
    if (rule.tool !== '*' && rule.tool !== toolName) continue

    if (rule.pattern) {
      try {
        if (!new RegExp(rule.pattern).test(serializedArgs)) continue
      } catch {
        return 'deny'
      }
    }

    decision = rule.action
    break
  }

  decision ??= policy.mode === 'auto' ? 'allow' : policy.mode
  return decision === 'allow' && toolRequiresApproval ? 'confirm' : decision
}
