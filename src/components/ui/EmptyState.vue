<script setup lang="ts">
/**
 * EmptyState 空状态 —— 设计系统组件。
 * 空状态是「邀请行动」，不是「沮丧提示」：告诉用户这是什么 + 怎么开始。
 */
import Icon from '../Icon.vue'

withDefaults(
  defineProps<{
    /** Lucide 图标名，见 src/assets/icons/catalog.ts */
    icon?: string
    title: string
    description?: string
  }>(),
  { icon: 'inbox' },
)
</script>

<template>
  <div class="empty">
    <div class="empty__icon">
      <Icon :name="icon" :size="24" />
    </div>
    <p class="empty__title">{{ title }}</p>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--surface-alt);
  color: var(--muted);
}

.empty__title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--font-medium);
  color: var(--text);
}

.empty__desc {
  margin: 0;
  font-size: var(--text-base);
  color: var(--muted);
  line-height: 1.6;
  max-width: 320px;
}
</style>
