import type { Component } from 'vue'
import { CircleCheck, ClipboardList, FolderOpen, Inbox, Settings } from '@lucide/vue'

export function normalizeIconName(name: string): string {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

const icons: Record<string, Component> = {
  inbox: Inbox,
  'clipboard-list': ClipboardList,
  'folder-open': FolderOpen,
  settings: Settings,
  'circle-check': CircleCheck,
}

export function resolveIcon(name: string): Component | undefined {
  return icons[normalizeIconName(name)]
}
