<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { resolveIcon } from '../assets/icons/registry'

/**
 * 基于 @lucide/vue 的图标封装（静态注册，保持 tree-shaking）。
 *
 * 用法：<Icon name="settings" :size="16" /> 或 <Icon name="FolderOpen" />
 *
 * 说明：默认注册表只包含模板实际使用的常用图标。
 * - 新图标通过一条静态 import 和一条注册表映射扩展
 * - 名称支持 PascalCase、kebab-case、空格或下划线
 */
const props = withDefaults(
  defineProps<{
    /** Lucide 图标名，如 settings / folder-open / FolderOpen */
    name: string
    /** 尺寸，像素 */
    size?: number
    /** 描边宽度，Lucide 默认 2 */
    strokeWidth?: number
    /** 颜色，默认继承 currentColor */
    color?: string
  }>(),
  { size: 24, strokeWidth: 2, color: 'currentColor' },
)

const icon = computed(() => resolveIcon(props.name) ?? null)

watchEffect(() => {
  if (!icon.value) {
    console.warn(`[Icon] 未找到图标 "${props.name}"，请到 https://lucide.dev/icons 确认名称`)
  }
})
</script>

<template>
  <component
    :is="icon"
    v-if="icon"
    :size="size"
    :stroke-width="strokeWidth"
    :color="color"
    aria-hidden="true"
  />
</template>
