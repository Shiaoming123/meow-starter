export interface Todo {
  id: number
  title: string
  done: 0 | 1
  created_at: string
}

export interface TodoImportRecord {
  title: string
  done: 0 | 1
  createdAt: string
}

export interface TodoStore {
  list(): Promise<Todo[]>
  add(title: string): Promise<void>
  toggle(id: number, done: boolean): Promise<void>
  remove(id: number): Promise<void>
  appendImported(records: readonly TodoImportRecord[]): Promise<void>
}

export function sortTodosNewestFirst(todos: readonly Todo[]): Todo[] {
  return [...todos].sort(
    (left, right) =>
      right.created_at.localeCompare(left.created_at) || right.id - left.id,
  )
}
