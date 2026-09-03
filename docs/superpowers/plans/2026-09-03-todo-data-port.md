# Todo Data Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned, append-only JSON backup boundary for Todo data without file UI or storage-engine coupling.

**Architecture:** A pure codec owns the stable envelope and validation. `TodoStore` gains an append operation with explicit imported values, so every adapter allocates its own ids. A small service composes `list`, codec creation/parsing, and adapter append; it is the only public backup API.

**Tech Stack:** TypeScript, existing Todo adapters, Node.js test runner, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-09-03-todo-data-port.md`

## Global Constraints

- Export only Todo title, done state, and creation timestamp.
- Import is append-only and validates before writes.
- Do not add file, cloud, browser-download, or native-permission code.
- Reject more than 10,000 entries and never log imported content.

---

### Task 1: Define and prove the pure JSON codec

**Files:**

- Create: `src/storage/todos/data-port.ts`
- Test: `tests/todo-data-port.test.ts`

**Interfaces:**

- `createTodoExport(todos, exportedAt): TodoExportV1`
- `parseTodoExport(value): TodoExportV1`
- `TodoImportRecord` contains `title`, `done`, and `createdAt` but no id.

- [x] **Step 1: Write failing round-trip and malformed-payload tests**

```ts
const parsed = parseTodoExport(JSON.stringify(createTodoExport(source, '2026-09-03T00:00:00.000Z')))
assert.deepEqual(parsed.data.todos, [{ title: 'keep', done: 1, createdAt: '2026-09-02 00:00:00' }])
assert.throws(() => parseTodoExport('{"format":"wrong"}'), /format/)
```

- [x] **Step 2: Verify the missing-module failure**

Run: `node --experimental-strip-types --test tests/todo-data-port.test.ts`

Expected: FAIL because `data-port.ts` does not exist.

- [x] **Step 3: Implement the pure codec**

```ts
export const TODO_EXPORT_FORMAT = 'meow-starter/data-export'
export const TODO_EXPORT_VERSION = 1
export const MAX_TODO_EXPORT_ITEMS = 10_000
```

Accept either a JSON string or an unknown object. Validate the full envelope and each entry before returning it. Export maps `Todo.created_at` to `createdAt` and omits ids.

- [x] **Step 4: Add and satisfy the oversized-array test**

```ts
assert.throws(() => parseTodoExport(oversizedPayload), /10,000/)
```

- [x] **Step 5: Re-run the focused codec test**

Run: `node --experimental-strip-types --test tests/todo-data-port.test.ts`

Expected: PASS.

### Task 2: Append validated records through every Todo adapter

**Files:**

- Modify: `src/storage/todos/types.ts`, `src/storage/todos/in-memory.ts`, `src/storage/todos/indexeddb.ts`, `src/storage/todos/tauri-sqlite.ts`
- Test: `tests/todo-storage.test.ts`, `tests/todo-data-port.test.ts`

**Interfaces:**

- `TodoStore.appendImported(records: readonly TodoImportRecord[]): Promise<void>` accepts only codec-shaped records and allocates new local ids.
- SQLite uses one `INSERT INTO todos (title, done, created_at)` per record and never accepts exported ids.

- [x] **Step 1: Write failing adapter tests for append semantics**

```ts
await store.add('existing')
await store.appendImported([{ title: 'restored', done: 1, createdAt: '2026-09-02 00:00:00' }])
assert.deepEqual((await store.list()).map(({ title }) => title), ['restored', 'existing'])
```

- [x] **Step 2: Verify the missing-method failure**

Run: `node --experimental-strip-types --test tests/todo-storage.test.ts`

Expected: FAIL because `appendImported` does not exist.

- [x] **Step 3: Implement append on all adapters**

Memory pushes a cloned Todo with its next id; IndexedDB uses an existing database `add`; SQLite passes `[title, done, createdAt]` to its existing SQL boundary.

- [x] **Step 4: Add and satisfy an IndexedDB reopening assertion**

```ts
assert.deepEqual((await reopened.list()).map(({ title }) => title), ['restored', 'existing'])
```

- [x] **Step 5: Run the adapter and data-port tests**

Run: `node --experimental-strip-types --test tests/todo-storage.test.ts tests/todo-data-port.test.ts`

Expected: PASS.

### Task 3: Expose the opt-in service and document its boundary

**Files:**

- Modify: `src/lib/db.ts`, `docs/web.md`, `docs/project-guide.md`, `README.md`, `README.en.md`, `docs/README.md`
- Test: `tests/todo-data-port.test.ts`

**Interfaces:**

- `exportTodos(exportedAt?): Promise<string>` serializes current data.
- `importTodos(content): Promise<{ imported: number }>` parses before calling `appendImported`.

- [x] **Step 1: Write a failing service test that rejects invalid content without writes**

```ts
await assert.rejects(importTodos('{"version":2}'), /version/)
assert.deepEqual(await store.list(), existingTodos)
```

- [x] **Step 2: Verify the missing service-export failure**

Run: `node --experimental-strip-types --test tests/todo-data-port.test.ts`

Expected: FAIL because the public functions do not exist.

- [x] **Step 3: Implement the service using the codec and registered store**

```ts
export async function importTodos(content: string): Promise<{ imported: number }> {
  const backup = parseTodoExport(content)
  await getTodoStore().appendImported(backup.data.todos)
  return { imported: backup.data.todos.length }
}
```

- [x] **Step 4: Document safe integration**

Document confirmation before import, external storage chosen by the product, and intentional duplicate append behavior.

- [x] **Step 5: Run full verification and commit**

Run: `npm test && npm run typecheck && npm run build && npm run build:web && npm run check:docs`

Expected: PASS; report an explicit Windows symbolic-link skip separately.

```bash
git add src/storage/todos src/lib/db.ts tests/todo-storage.test.ts tests/todo-data-port.test.ts README.md README.en.md docs
git commit -m "feat: add versioned todo data port"
```

## Plan self-review

- Spec coverage: codec, append semantics, no-write validation, public opt-in service, and documentation map one-to-one to the three tasks.
- Placeholder scan: all APIs, tests, commands, and data fields are specified.
- Type consistency: `TodoImportRecord`, `TodoExportV1`, `createTodoExport`, `parseTodoExport`, `exportTodos`, and `importTodos` retain the same names throughout.
