<script setup lang="ts">
/**
 * Progress 进度条 —— 设计系统小组件。
 * 用于展示确定性进度（如更新下载百分比）。
 */
withDefaults(
  defineProps<{
    /** 0-100 的进度值 */
    value?: number
    /** 不确定进度（无 value 时显示动画） */
    indeterminate?: boolean
  }>(),
  { value: 0, indeterminate: false },
)
</script>

<template>
  <div class="progress" role="progressbar" :aria-valuenow="indeterminate ? undefined : value">
    <div
      class="progress__bar"
      :class="{ 'progress__bar--indeterminate': indeterminate }"
      :style="{ width: indeterminate ? undefined : `${value}%` }"
    />
  </div>
</template>

<style scoped>
.progress {
  width: 100%;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--surface-alt);
  overflow: hidden;
}

.progress__bar {
  height: 100%;
  background: var(--accent);
  border-radius: var(--radius-full);
  transition: width var(--motion-base) var(--ease);
}

.progress__bar--indeterminate {
  width: 40%;
  animation: indeterminate 1.2s var(--ease) infinite;
}

@keyframes indeterminate {
  0% {
    margin-left: -40%;
  }
  100% {
    margin-left: 100%;
  }
}
</style>
