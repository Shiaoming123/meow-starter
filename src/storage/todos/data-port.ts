import type { Todo, TodoImportRecord } from './types.ts'

export type { TodoImportRecord } from './types.ts'

export const TODO_EXPORT_FORMAT = 'meow-starter/data-export'
export const TODO_EXPORT_VERSION = 1
export const MAX_TODO_EXPORT_ITEMS = 10_000

export interface TodoExportV1 {
  format: typeof TODO_EXPORT_FORMAT
  version: typeof TODO_EXPORT_VERSION
  exportedAt: string
  data: {
    todos: TodoImportRecord[]
  }
}

export function createTodoExport(
  todos: readonly Todo[],
  exportedAt = new Date().toISOString(),
): TodoExportV1 {
  if (todos.length > MAX_TODO_EXPORT_ITEMS) {
    throw new Error(`Todo export cannot contain more than ${MAX_TODO_EXPORT_ITEMS.toLocaleString()} items.`)
  }

  return {
    format: TODO_EXPORT_FORMAT,
    version: TODO_EXPORT_VERSION,
    exportedAt,
    data: {
      todos: todos.map(({ title, done, created_at }) => ({
        title,
        done,
        createdAt: created_at,
      })),
    },
  }
}

export function parseTodoExport(value: unknown): TodoExportV1 {
  const parsed = parseValue(value)
  if (!isRecord(parsed)) throw new Error('Todo import must be a JSON object.')
  if (parsed.format !== TODO_EXPORT_FORMAT) {
    throw new Error(`Unsupported Todo import format: ${String(parsed.format)}.`)
  }
  if (parsed.version !== TODO_EXPORT_VERSION) {
    throw new Error(`Unsupported Todo import version: ${String(parsed.version)}.`)
  }
  if (typeof parsed.exportedAt !== 'string' || parsed.exportedAt.length === 0) {
    throw new Error('Todo import requires a non-empty exportedAt value.')
  }
  if (!isRecord(parsed.data) || !Array.isArray(parsed.data.todos)) {
    throw new Error('Todo import requires a data.todos array.')
  }
  if (parsed.data.todos.length > MAX_TODO_EXPORT_ITEMS) {
    throw new Error(`Todo import cannot contain more than ${MAX_TODO_EXPORT_ITEMS.toLocaleString()} items.`)
  }

  return {
    format: TODO_EXPORT_FORMAT,
    version: TODO_EXPORT_VERSION,
    exportedAt: parsed.exportedAt,
    data: { todos: parsed.data.todos.map(parseTodoImportRecord) },
  }
}

function parseValue(value: unknown): unknown {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    throw new Error('Todo import must contain valid JSON.')
  }
}

function parseTodoImportRecord(value: unknown): TodoImportRecord {
  if (!isRecord(value)) throw new Error('Todo import contains an invalid Todo entry.')
  if (typeof value.title !== 'string') {
    throw new Error('Todo import entries require a string title.')
  }
  if (value.done !== 0 && value.done !== 1) {
    throw new Error('Todo import entries require done to be 0 or 1.')
  }
  if (typeof value.createdAt !== 'string' || value.createdAt.length === 0) {
    throw new Error('Todo import entries require a non-empty createdAt value.')
  }

  return { title: value.title, done: value.done, createdAt: value.createdAt }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
