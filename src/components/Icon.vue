<script setup lang="ts">
import { ref, watchEffect, type Component } from 'vue'

/**
 * 基于 @lucide/vue 的图标封装（按需动态加载，保持 tree-shaking）。
 *
 * 用法：<Icon name="settings" :size="16" /> 或 <Icon name="FolderOpen" />
 *
 * 说明：本模板图标统一走 Lucide（ISC 协议，商用无需署名，1700+ 图标）。
 * - 通过动态 import 加载单个图标，避免引入整个 icons 映射表，控制打包体积
 * - 名称支持 PascalCase 或 kebab-case，见 https://lucide.dev/icons
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

// PascalCase -> kebab-case（Lucide per-icon 文件名是 kebab-case）
function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

const icon = ref<Component | null>(null)

watchEffect(async () => {
  const file = kebab(props.name)
  try {
    const mod = await import(/* @vite-ignore */ `@lucide/vue/dist/esm/icons/${file}.mjs`)
    icon.value = (mod.default ?? mod) as Component
  } catch {
    console.warn(`[Icon] 未找到图标 "${props.name}"，请到 https://lucide.dev/icons 确认名称`)
    icon.value = null
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
