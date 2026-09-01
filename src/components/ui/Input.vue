<script setup lang="ts">
/**
 * Input 输入框 —— 设计系统基础组件。
 * 用 v-model 绑定。可带前缀图标或标签。
 */
import { useId } from 'vue'

withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    label?: string
    disabled?: boolean
    type?: string
  }>(),
  { type: 'text' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const id = useId()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="field">
    <label v-if="label" :for="id" class="field__label">{{ label }}</label>
    <input
      :id="id"
      class="field__input"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
}

.field__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--muted);
}

.field__input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-md);
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color var(--motion-fast) var(--ease);
}

.field__input::placeholder {
  color: var(--muted);
}

.field__input:focus {
  border-color: var(--accent);
}

.field__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
