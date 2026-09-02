# Web and Sync Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Web runtime and a vendor-neutral local-first sync foundation without weakening the existing Tauri desktop path.

**Architecture:** Runtime capabilities gate modules before setup. Todo persistence uses a domain-level `TodoStore` with memory, Tauri SQLite, and IndexedDB adapters. Sync is split into a replaceable `SyncProvider` and a small outbox engine driven by pluggable `SyncTransport` implementations; the built-in HTTP transport can target a cloud endpoint or a paired LAN endpoint.

**Tech Stack:** Vue 3.5, TypeScript 5.6, Vite 6, Tauri 2, Node.js 22 test runner, `idb`, `fake-indexeddb`, Fetch API.

**Spec:** `docs/superpowers/specs/2026-09-02-web-sync-foundation-design.md`

## Global Constraints

- Preserve the current single repository and the existing Tauri `sqlite` Cargo feature.
- Keep `core` and the new `storage` contract always enabled.
- Default Web persistence uses `idb`; `fake-indexeddb` is test-only.
- Do not add a cloud SDK, account provider, LAN listener, CRDT, PWA, or service worker in this phase.
- Do not sync API keys, tokens, cookies, MCP credentials, local paths, logs, caches, or device-only settings.
- Sync is disabled by default and an empty allowlist permits no collection.
- New behavior follows red-green-refactor and is committed in independently reviewable tasks.
- Local Rust verification is optional only when Cargo is unavailable; GitHub CI remains the Rust gate.

---

### Task 1: Runtime-aware module compatibility

**Files:**
- Create: `src/modules/compatibility.ts`
- Create: `tests/modules-compatibility.test.ts`
- Modify: `src/lib/platform.ts`
- Modify: `src/modules/types.ts`
- Modify: `src/modules/config.ts`
- Modify: `src/modules/loader.ts`
- Modify: `src/modules/{tray,updater,shortcut,autostart,sqlite}/index.ts`

**Interfaces:**
- Produces: `RuntimePlatform`, `RuntimeCapability`, `RuntimeInfo`, `detectRuntimeInfo()`.
- Produces: `moduleCompatibility(module, runtime): { supported: boolean; reason?: string }`.
- Extends: `Module.platforms?`, `Module.requiredCapabilities?`, `ModuleContext.runtime`.

- [ ] **Step 1: Write failing runtime and compatibility tests**

Create `tests/modules-compatibility.test.ts` with literal runtime fixtures and verify these behaviors:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { moduleCompatibility } from '../src/modules/compatibility.ts'
import type { RuntimeInfo } from '../src/lib/platform.ts'
import type { Module } from '../src/modules/types.ts'

const runtime = (
  platform: RuntimeInfo['platform'],
  capabilities: RuntimeInfo['capabilities'] = [],
): RuntimeInfo => ({ platform, capabilities })

const module = (overrides: Partial<Module> = {}): Module => ({
  id: 'example',
  name: 'Example',
  dependencies: [],
  ...overrides,
})

test('accepts a module when platform and capabilities match', () => {
  assert.deepEqual(
    moduleCompatibility(
      module({ platforms: ['web'], requiredCapabilities: ['web-storage'] }),
      runtime('web', ['web-storage']),
    ),
    { supported: true },
  )
})

test('rejects a module on an unsupported platform', () => {
  assert.match(
    moduleCompatibility(module({ platforms: ['desktop'] }), runtime('web')).reason ?? '',
    /platform web/,
  )
})

test('rejects a module when a required capability is absent', () => {
  assert.match(
    moduleCompatibility(
      module({ requiredCapabilities: ['system-tray'] }),
      runtime('desktop'),
    ).reason ?? '',
    /system-tray/,
  )
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test tests/modules-compatibility.test.ts`

Expected: FAIL because `src/modules/compatibility.ts` and the runtime types do not exist.

- [ ] **Step 3: Implement runtime information and compatibility**

In `src/lib/platform.ts`, consolidate the existing Tauri detection and add:

```ts
export type RuntimePlatform = 'web' | 'desktop' | 'mobile'

export type RuntimeCapability =
  | 'web-storage'
  | 'native-sql'
  | 'system-tray'
  | 'native-updater'
  | 'global-shortcut'
  | 'autostart'
  | 'secure-keychain-proxy'

export interface RuntimeInfo {
  platform: RuntimePlatform
  capabilities: readonly RuntimeCapability[]
}

export function detectRuntimeInfo(): RuntimeInfo {
  if (!isTauri()) return { platform: 'web', capabilities: ['web-storage'] }
  if (isMobile()) return { platform: 'mobile', capabilities: ['native-sql'] }
  return {
    platform: 'desktop',
    capabilities: [
      'native-sql',
      'system-tray',
      'native-updater',
      'global-shortcut',
      'autostart',
      'secure-keychain-proxy',
    ],
  }
}
```

Extend `Module` and `ModuleContext`, then implement `moduleCompatibility()` as a pure function. Update `mountModules()` to accept an optional `RuntimeInfo`, skip unsupported modules before `setup()`, and include runtime in the module context.

Mark native-only modules with exact compatibility metadata:

```ts
platforms: ['desktop']
requiredCapabilities: ['system-tray']
```

Use `native-updater`, `global-shortcut`, and `autostart` for their corresponding modules. Mark `sqlite` as `platforms: ['desktop', 'mobile']` with `native-sql`.

- [ ] **Step 4: Run focused and regression tests**

Run:

```bash
node --experimental-strip-types --test tests/modules-compatibility.test.ts
npm test
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/platform.ts src/modules tests/modules-compatibility.test.ts
git commit -m "feat: gate modules by runtime capabilities"
```

---

### Task 2: Domain storage ports and persistent IndexedDB adapter

**Files:**
- Create: `src/storage/todos/types.ts`
- Create: `src/storage/todos/in-memory.ts`
- Create: `src/storage/todos/registry.ts`
- Create: `src/storage/todos/tauri-sqlite.ts`
- Create: `src/storage/indexeddb/database.ts`
- Create: `src/storage/todos/indexeddb.ts`
- Create: `src/modules/storage/index.ts`
- Create: `src/modules/indexeddb/index.ts`
- Create: `tests/todo-storage.test.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/modules/sqlite/index.ts`
- Modify: `src/modules/config.ts`
- Modify: `src/agent/module.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `Todo`, `TodoStore`, `createInMemoryTodoStore()`, `createIndexedDbTodoStore()`, `createTauriSqliteTodoStore()`.
- Produces: `registerTodoStore(store)` and `getTodoStore()`.
- Preserves: `listTodos()`, `addTodo()`, `toggleTodo()`, `removeTodo()` exports from `src/lib/db.ts`.

- [ ] **Step 1: Install the minimal mature Web storage dependencies**

Run:

```bash
npm install idb
npm install -D fake-indexeddb
```

Expected: `idb` appears in `dependencies`, `fake-indexeddb` appears in `devDependencies`, and the lockfile is updated.

- [ ] **Step 2: Write failing cross-adapter behavior tests**

Create `tests/todo-storage.test.ts`. Use the same literal behavior suite for memory and IndexedDB, with `fake-indexeddb/auto` providing the real IndexedDB API:

```ts
import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteDB } from 'idb'
import { createInMemoryTodoStore } from '../src/storage/todos/in-memory.ts'
import { createIndexedDbTodoStore } from '../src/storage/todos/indexeddb.ts'
import type { TodoStore } from '../src/storage/todos/types.ts'

async function verifiesTodoStore(store: TodoStore) {
  await store.add('first')
  await store.add('second')
  const listed = await store.list()
  assert.deepEqual(listed.map(({ title }) => title), ['second', 'first'])
  await store.toggle(listed[0].id, true)
  assert.equal((await store.list())[0].done, 1)
  await store.remove(listed[0].id)
  assert.deepEqual((await store.list()).map(({ title }) => title), ['first'])
}

test('memory adapter implements the TodoStore contract', async () => {
  await verifiesTodoStore(createInMemoryTodoStore())
})

test('IndexedDB adapter implements the TodoStore contract and survives reopening', async () => {
  const databaseName = 'meow-test-todos'
  await deleteDB(databaseName)
  await verifiesTodoStore(createIndexedDbTodoStore({ databaseName }))
  assert.deepEqual(
    (await createIndexedDbTodoStore({ databaseName }).list()).map(({ title }) => title),
    ['first'],
  )
  await deleteDB(databaseName)
})
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test tests/todo-storage.test.ts`

Expected: FAIL because the storage adapter files do not exist.

- [ ] **Step 4: Implement the storage adapters and registry**

Define the domain contract in `src/storage/todos/types.ts`:

```ts
export interface Todo {
  id: number
  title: string
  done: 0 | 1
  created_at: string
}

export interface TodoStore {
  list(): Promise<Todo[]>
  add(title: string): Promise<void>
  toggle(id: number, done: boolean): Promise<void>
  remove(id: number): Promise<void>
}
```

The in-memory adapter must allocate monotonically increasing numeric IDs and sort by `created_at DESC, id DESC`.

The IndexedDB database must use one `todos` object store with `keyPath: 'id'`, `autoIncrement: true`, and a `created_at` index. Accept `{ databaseName?: string }` so tests and consumers can isolate databases.

The Tauri adapter must dynamically import `@tauri-apps/plugin-sql`, reuse a lazy `sqlite:app.db` connection, and preserve the existing SQL queries.

The registry owns an in-memory default and permits platform modules to replace it:

```ts
let current: TodoStore = createInMemoryTodoStore()

export function registerTodoStore(store: TodoStore): void {
  current = store
}

export function getTodoStore(): TodoStore {
  return current
}
```

Replace `src/lib/db.ts` with thin compatibility functions that delegate to `getTodoStore()` and re-export `Todo`.

- [ ] **Step 5: Wire storage modules**

Add `storage: true`, `indexedDb: boolean`, and their registry loaders. `storage` depends on `core`, `indexedDb` depends on `storage`, and `sqlite` depends on `storage`.

- `storage.setup()` registers a fresh in-memory store.
- `indexedDb.setup()` registers `createIndexedDbTodoStore()` and supports only `web` with `web-storage`.
- `sqlite.setup()` registers `createTauriSqliteTodoStore()` and retains its native compatibility metadata.
- Agent depends on `storage` instead of `sqlite`, removing a false coupling at the module topology level.

- [ ] **Step 6: Run focused and project checks**

Run:

```bash
node --experimental-strip-types --test tests/todo-storage.test.ts
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0, and the Web production bundle contains no eager `plugin-sql` import in the entry chunk.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/db.ts src/storage src/modules src/agent/module.ts tests/todo-storage.test.ts
git commit -m "feat: persist web data through storage adapters"
```

---

### Task 3: Vendor-neutral outbox sync engine

**Files:**
- Create: `src/sync/types.ts`
- Create: `src/sync/policy.ts`
- Create: `src/sync/in-memory-store.ts`
- Create: `src/sync/engine.ts`
- Create: `src/sync/index.ts`
- Create: `src/modules/sync/index.ts`
- Create: `tests/sync-engine.test.ts`
- Modify: `src/modules/config.ts`

**Interfaces:**
- Produces: `SyncMutation`, `SyncTransport`, `SyncStateStore`, `SyncProvider`, `SyncResult`.
- Produces: `createAllowlistSyncPolicy(collections)` and `createOutboxSyncEngine(options)`.
- Produces: `createInMemorySyncStateStore(initial?)` for examples and tests.

- [ ] **Step 1: Write failing sync policy and engine tests**

Create tests that exercise real stores and literal mutations. Required cases:

1. Empty allowlist rejects every collection.
2. Explicit allowlist accepts only the named collection.
3. Successful sync uploads pending changes, acknowledges accepted IDs, applies pulled changes, and advances checkpoint.
4. A push error leaves the pending outbox untouched.
5. A remote apply error leaves the old checkpoint untouched.

Use this mutation fixture shape:

```ts
const mutation = {
  operationId: 'op-1',
  collection: 'notes',
  recordId: 'note-1',
  kind: 'upsert' as const,
  payload: { title: 'hello' },
  revision: 'device-a:1',
  deviceId: 'device-a',
  occurredAt: '2026-09-02T00:00:00.000Z',
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test tests/sync-engine.test.ts`

Expected: FAIL because `src/sync` does not exist.

- [ ] **Step 3: Implement the contracts and allowlist**

Use these public contracts:

```ts
export interface SyncMutation {
  operationId: string
  collection: string
  recordId: string
  kind: 'upsert' | 'delete'
  payload?: Record<string, unknown>
  revision: string
  deviceId: string
  occurredAt: string
}

export interface SyncTransport {
  push(changes: readonly SyncMutation[]): Promise<{ acceptedOperationIds: string[] }>
  pull(checkpoint?: string): Promise<{ changes: SyncMutation[]; checkpoint?: string }>
}

export interface SyncStateStore {
  enqueue(change: SyncMutation): Promise<void>
  listPending(limit: number): Promise<SyncMutation[]>
  acknowledge(operationIds: readonly string[]): Promise<void>
  getCheckpoint(): Promise<string | undefined>
  setCheckpoint(checkpoint: string): Promise<void>
}

export interface SyncProvider {
  syncOnce(): Promise<SyncResult>
}
```

`createAllowlistSyncPolicy()` stores a defensive `Set` copy and exposes `allows(collection): boolean`.

- [ ] **Step 4: Implement the minimal outbox engine**

`createOutboxSyncEngine()` accepts `store`, `transport`, `policy`, `applyRemote`, and optional `batchSize` defaulting to 100.

The engine must:

1. Read pending changes.
2. Throw before network I/O if any pending collection is outside policy.
3. Push allowed changes and acknowledge only IDs returned by the transport.
4. Pull using the current checkpoint.
5. Throw before applying if any remote collection is outside policy.
6. Apply remote changes in received order.
7. Advance checkpoint only after every remote change succeeds.
8. Return literal uploaded/downloaded counts and the final checkpoint.

- [ ] **Step 5: Register the disabled-by-default sync module**

Add `sync: false` to `ModuleConfig` and the module registry. `src/modules/sync/index.ts` depends on `storage`, exports the public sync API, and performs no network action during `setup()`.

- [ ] **Step 6: Run focused and project checks**

Run:

```bash
node --experimental-strip-types --test tests/sync-engine.test.ts
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/sync src/modules/sync src/modules/config.ts tests/sync-engine.test.ts
git commit -m "feat: add vendor-neutral sync foundation"
```

---

### Task 4: Reusable secure HTTP sync transport

**Files:**
- Create: `src/sync/transports/http.ts`
- Create: `tests/sync-http-transport.test.ts`
- Modify: `src/sync/index.ts`

**Interfaces:**
- Produces: `createHttpSyncTransport(options): SyncTransport`.
- Consumes: `baseUrl`, optional async `getAccessToken`, optional injected `fetch` for non-browser runtimes.
- Uses: `POST /push` and `GET /pull?checkpoint=<value>`.

- [ ] **Step 1: Write a failing integration test against a real local HTTP server**

Use Node's `createServer()` on `127.0.0.1` with an ephemeral port. Assert observable requests and parsed responses rather than mocking fetch:

- `push()` sends JSON to `/push`, uses `Content-Type: application/json`, and attaches `Authorization: Bearer test-token`.
- `pull('cursor-1')` requests `/pull?checkpoint=cursor-1` and returns the server's literal `changes` and `checkpoint`.
- `http://example.com` is rejected; HTTPS and loopback HTTP are accepted.
- Non-2xx responses throw an error containing the status without including the access token.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test tests/sync-http-transport.test.ts`

Expected: FAIL because the HTTP transport does not exist.

- [ ] **Step 3: Implement the transport**

Normalize `baseUrl` once with `new URL()`. Permit `https:` everywhere and `http:` only for `localhost`, `127.0.0.1`, or `::1`. Build headers internally; callers cannot inject arbitrary authorization headers. Parse JSON only after checking `response.ok` and throw `Sync HTTP <status>` on failure.

- [ ] **Step 4: Run focused and project checks**

Run:

```bash
node --experimental-strip-types --test tests/sync-http-transport.test.ts
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/sync tests/sync-http-transport.test.ts
git commit -m "feat: add reusable HTTP sync transport"
```

---

### Task 5: Web profile, product copy, CI, and integration guides

**Files:**
- Create: `docs/web.md`
- Create: `docs/sync.md`
- Modify: `package.json`
- Modify: `src/App.vue`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/modular-architecture.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `npm run dev:web`, `npm run build:web`, `npm run preview:web`.
- Documents: Web capability matrix, storage adapter creation, SyncProvider/SyncTransport selection, Supabase/PowerSync/Electric/LAN/CRDT boundaries, and secret exclusions.

- [ ] **Step 1: Add explicit Web scripts**

Add:

```json
"dev:web": "vite --mode web",
"build:web": "vue-tsc --noEmit && vite build --mode web",
"preview:web": "vite preview --mode web"
```

- [ ] **Step 2: Make the demonstration UI platform-honest**

Use one computed/runtime value from `detectRuntimeInfo()` and show:

- `IndexedDB 本地数据层` on Web.
- `SQLite 本地数据层` on Tauri.
- Native updater and tray cards only when the corresponding runtime capability exists.
- Header copy `Web + Desktop + Mobile` without claiming unsupported native features on Web.

Do not add a new visual system or redesign the page in this task.

- [ ] **Step 3: Write the Web guide**

`docs/web.md` must include:

1. `npm run dev:web` and `npm run build:web`.
2. Stable/Beta/unsupported capability table.
3. IndexedDB same-origin, quota, eviction, private browsing, and multi-tab caveats.
4. Static hosting instructions for GitHub Pages, Cloudflare Pages, Vercel, and any HTTP static server without activating a provider-specific workflow.
5. Browser Agent rule: use a server-side Gateway; never ship provider API keys to the browser.
6. How to add a new `TodoStore`-style domain adapter.

- [ ] **Step 4: Write the synchronization guide**

`docs/sync.md` must define:

1. Device-local, account preferences, domain data, and collaborative document tiers.
2. The never-sync list copied from the spec.
3. `SyncProvider` versus `SyncTransport` selection.
4. Supabase HTTP reference route, Firebase provider route, PowerSync/Electric provider route, LAN transport route, and Automerge/Yjs document-only route.
5. Required synced schema fields: globally unique ID, owner ID, device ID, timestamps, tombstone, revision, schema version.
6. Conflict guidance: server/HLC LWW for scalar preferences, revision-aware row conflicts for records, CRDT only for collaborative documents.
7. LAN security: discovery is not authentication; require QR/short-code pairing, public-key confirmation, encryption, expiry, and device revocation.

- [ ] **Step 5: Update module documentation and README maturity labels**

Link `docs/web.md` and `docs/sync.md` from both README indexes. Correct claims that disabled dynamic modules have zero installation or distribution size. Mark persistent Web storage as Beta and the generic sync module as Preview.

- [ ] **Step 6: Add Web build to CI**

Add `npm run build:web` after the default build in the frontend CI job. Keep the Rust job unchanged.

- [ ] **Step 7: Run documentation, tests, and builds**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run build:web
npm run check:layout
npm run check:docs
```

Expected: every command exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json src/App.vue README.md docs .github/workflows/ci.yml
git commit -m "docs: add web and sync integration paths"
```

---

### Task 6: Browser verification and final gate

**Files:**
- Modify only files required by defects reproduced during verification.

**Interfaces:**
- Verifies: browser load, IndexedDB persistence after reload, unsupported native modules remaining inactive, and responsive layout.

- [ ] **Step 1: Start the Web application**

Run: `npm run dev:web -- --host 127.0.0.1`

Expected: Vite reports a local URL and keeps running without startup errors.

- [ ] **Step 2: Verify in a real browser**

Using browser automation:

1. Open the local URL.
2. Navigate to the data page.
3. Add `web persistence check`.
4. Reload the page.
5. Verify the Todo remains.
6. Verify no Tauri IPC error is logged.
7. Verify tray and native updater controls are absent.
8. Capture a desktop and narrow viewport screenshot for visual inspection.

- [ ] **Step 3: Run the complete fresh verification gate**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run build:web
npm run check:layout
npm run check:docs
git diff --check
git status --short
```

If Cargo is available, also run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
```

Expected: all available commands exit 0; the status contains only intentional source, test, documentation, and lockfile changes.

- [ ] **Step 4: Handle verification defects through TDD**

If verification exposes a defect, stop the final gate, append a new task to this plan naming the reproduced behavior and exact files, then run its red-green cycle before repeating Task 6. Do not create a speculative catch-all commit.
