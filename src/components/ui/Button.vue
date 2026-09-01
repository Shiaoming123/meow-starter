<script setup lang="ts">
/**
 * Button 按钮 —— 设计系统基础组件。
 *
 * 变体：
 * - primary   主操作（accent 底）
 * - secondary 次操作（surface 底 + 边框）
 * - ghost     弱化操作（透明底，悬停显 surface-alt）
 * - danger    危险操作
 *
 * 尺寸：sm / md（默认）
 * 语义：按钮是唯一「可点击动作」入口，文案用祈使句（如「保存更改」而非「提交」）。
 */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    disabled?: boolean
    type?: 'button' | 'submit'
    /** 图标的视觉描述（无障碍），有 icon 时建议填写 */
    title?: string
  }>(),
  { variant: 'secondary', size: 'md', disabled: false, type: 'button' },
)

defineEmits<{ click: [e: MouseEvent] }>()
</script>

<template>
  <button
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`]"
    :disabled="disabled"
    :type="type"
    :title="title"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: inherit;
  font-weight: var(--font-medium);
  line-height: 1;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--motion-fast) var(--ease),
    border-color var(--motion-fast) var(--ease),
    opacity var(--motion-fast) var(--ease),
    transform var(--motion-fast) var(--ease);
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* 尺寸 */
.btn--md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-base);
}
.btn--sm {
  padding: 4px var(--space-3);
  font-size: var(--text-sm);
}

/* 变体 */
.btn--primary {
  background: var(--accent);
  color: var(--accent-text);
}
.btn--primary:hover:not(:disabled) {
  filter: brightness(0.96);
}

.btn--secondary {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text);
}
.btn--secondary:hover:not(:disabled) {
  background: var(--surface-alt);
}

.btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text);
}
.btn--ghost:hover:not(:disabled) {
  background: var(--surface-alt);
}

.btn--danger {
  background: var(--danger);
  color: #fff;
}
.btn--danger:hover:not(:disabled) {
  filter: brightness(0.94);
}
</style>
