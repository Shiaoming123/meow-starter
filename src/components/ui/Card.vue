<script setup lang="ts">
/**
 * Card 卡片 —— 设计系统基础容器组件。
 * 统一的表面容器：surface 底 + 边框 + 圆角 + 阴影。
 * 提供 title 插槽（可选标题区）与默认插槽（内容区）。
 */
withDefaults(
  defineProps<{
    /** 卡片标题，为空则不渲染标题区 */
    title?: string
    /** 是否使用无边框的扁平样式 */
    flat?: boolean
    padding?: 'sm' | 'md' | 'lg'
  }>(),
  { flat: false, padding: 'md' },
)

const pad = { sm: 'var(--space-4)', md: 'var(--space-5)', lg: 'var(--space-6)' }
</script>

<template>
  <section class="card" :class="{ 'card--flat': flat }" :style="{ padding: pad[padding] }">
    <header v-if="title || $slots.title" class="card__head">
      <slot name="title">
        <h3 class="card__title">{{ title }}</h3>
      </slot>
      <slot name="action" />
    </header>
    <slot />
  </section>
</template>

<style scoped>
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.card--flat {
  box-shadow: none;
}

.card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.card__title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--text);
}
</style>
