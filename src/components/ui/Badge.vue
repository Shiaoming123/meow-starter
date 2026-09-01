<script setup lang="ts">
/**
 * Badge 徽标 —— 设计系统小组件。
 * 用于状态标记（如「生成中」「成功」「警告」）。
 */
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
  }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <span class="badge" :class="`badge--${tone}`"><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1.4;
  border-radius: var(--radius-full);
}

.badge--neutral {
  background: var(--surface-alt);
  color: var(--muted);
}
.badge--accent {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.badge--success {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}
.badge--warning {
  background: color-mix(in srgb, var(--warning) 16%, transparent);
  color: var(--warning);
}
.badge--danger {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}
</style>
