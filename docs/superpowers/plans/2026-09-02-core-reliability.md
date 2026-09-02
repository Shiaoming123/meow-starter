# Core Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing single-repository architecture while making the default desktop foundation testable, honest about its maturity, and safe against the known runtime regressions.

**Architecture:** Use Node's built-in test runner so the reliability baseline adds no testing framework dependency. Extract pure behavior from Vue/Tauri integration points, test it independently, and keep production adapters thin. Runtime-only UI invariants use focused source-contract tests until a browser test layer is justified.

**Tech Stack:** Node.js 22.6+, TypeScript 5.6, Vue 3.5, Vite 6, Tauri 2, Rust 2021, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-meow-starter-hardening-design.md`

## Global Constraints

- Preserve the existing single repository and `src/modules` public contract.
- Add no runtime or test dependency in this phase.
- Do not claim disabled modules have zero installation or distribution size.
- Do not add Agent, MCP, sidecar, RAG, speech, or OCR behavior in this phase.
- Keep README imagery unchanged until code and documentation verification is complete.
- Every behavior change starts with a failing test and ends with an independent commit.

---

### Task 1: Dependency-free test runner and module topology validation

**Files:**
- Create: `scripts/run-tests.mjs`
- Create: `tests/modules-topology.test.ts`
- Create: `src/modules/topology.ts`
- Modify: `src/modules/loader.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `Module` shape from `src/modules/types.ts`.
- Produces: `sortModules(modules: Module[]): Module[]` that throws descriptive errors for missing dependencies and cycles.

- [ ] **Step 1: Add the cross-platform test runner**

Create `scripts/run-tests.mjs`:

```js
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const testsDir = fileURLToPath(new URL('../tests/', import.meta.url))
const files = readdirSync(testsDir)
  .filter((file) => file.endsWith('.test.ts'))
  .sort()
  .map((file) => new URL(`../tests/${file}`, import.meta.url).pathname)

if (files.length === 0) {
  console.error('No test files found in tests/')
  process.exit(1)
}

const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--test', ...files],
  { stdio: 'inherit' },
)

process.exit(result.status ?? 1)
```

Add to `package.json` scripts:

```json
"test": "node scripts/run-tests.mjs"
```

- [ ] **Step 2: Write failing topology tests**

Create `tests/modules-topology.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { sortModules } from '../src/modules/topology.ts'

const module = (id: string, dependencies: string[] = []) => ({
  id,
  name: id,
  dependencies,
})

test('sortModules places dependencies before consumers', () => {
  const result = sortModules([
    module('updater', ['tray']),
    module('tray'),
    module('core'),
  ])
  assert.deepEqual(result.map(({ id }) => id), ['tray', 'updater', 'core'])
})

test('sortModules rejects a missing enabled dependency', () => {
  assert.throws(
    () => sortModules([module('agent', ['sqlite'])]),
    /Module "agent" requires disabled or missing module "sqlite"/,
  )
})

test('sortModules rejects dependency cycles', () => {
  assert.throws(
    () => sortModules([module('a', ['b']), module('b', ['a'])]),
    /Circular module dependency: a -> b -> a/,
  )
})
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because `src/modules/topology.ts` does not exist.

- [ ] **Step 4: Implement topology validation**

Create `src/modules/topology.ts`:

```ts
import type { Module } from './types'

export function sortModules(modules: Module[]): Module[] {
  const byId = new Map(modules.map((module) => [module.id, module]))
  const visited = new Set<string>()
  const active = new Set<string>()
  const result: Module[] = []

  const visit = (id: string, path: string[]) => {
    if (visited.has(id)) return
    if (active.has(id)) {
      const cycleStart = path.indexOf(id)
      const cycle = [...path.slice(cycleStart), id]
      throw new Error(`Circular module dependency: ${cycle.join(' -> ')}`)
    }

    const module = byId.get(id)
    if (!module) return

    active.add(id)
    for (const dependency of module.dependencies) {
      if (!byId.has(dependency)) {
        throw new Error(
          `Module "${id}" requires disabled or missing module "${dependency}"`,
        )
      }
      visit(dependency, [...path, id])
    }
    active.delete(id)
    visited.add(id)
    result.push(module)
  }

  for (const module of modules) visit(module.id, [])
  return result
}
```

Replace the private `topoSort` in `src/modules/loader.ts` with an import and call to `sortModules`.

- [ ] **Step 5: Run focused and project checks**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/run-tests.mjs tests/modules-topology.test.ts src/modules/topology.ts src/modules/loader.ts
git commit -m "test: add module topology reliability baseline"
```

---

### Task 2: Persistent browser memory fallback

**Files:**
- Create: `src/agent/memory/in-memory.ts`
- Create: `tests/agent-memory.test.ts`
- Modify: `src/agent/memory/store.ts`

**Interfaces:**
- Produces: `createMemoryStore(): MemoryStore` and process-lifetime singleton `browserMemoryStore`.
- Preserves: existing `createMemoryStore` export from `src/agent/memory/store.ts`.

- [ ] **Step 1: Write the failing memory tests**

Create `tests/agent-memory.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { browserMemoryStore, createMemoryStore } from '../src/agent/memory/in-memory.ts'

test('createMemoryStore keeps messages for the lifetime of one store', async () => {
  const store = createMemoryStore()
  await store.append({ sessionId: 'one', role: 'user', content: 'hello' })
  await store.append({ sessionId: 'one', role: 'assistant', content: 'hi' })
  assert.deepEqual(
    (await store.list('one')).map(({ content }) => content),
    ['hello', 'hi'],
  )
})

test('browserMemoryStore reuses the same fallback between calls', async () => {
  await browserMemoryStore.clear('shared')
  await browserMemoryStore.append({ sessionId: 'shared', role: 'user', content: 'persist' })
  assert.equal((await browserMemoryStore.list('shared')).length, 1)
})

test('memory stores isolate sessions and honor limits', async () => {
  const store = createMemoryStore()
  await store.append({ sessionId: 'a', role: 'user', content: 'one' })
  await store.append({ sessionId: 'a', role: 'user', content: 'two' })
  await store.append({ sessionId: 'b', role: 'user', content: 'other' })
  assert.deepEqual((await store.list('a', 1)).map(({ content }) => content), ['two'])
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because `src/agent/memory/in-memory.ts` does not exist.

- [ ] **Step 3: Extract and reuse the in-memory store**

Move the current `createMemoryStore` implementation into `src/agent/memory/in-memory.ts`, import `AgentMessage` and `MemoryStore` as types, and export:

```ts
export function createMemoryStore(): MemoryStore {
  const store = new Map<string, AgentMessage[]>()
  return {
    async append(message) {
      const messages = store.get(message.sessionId) ?? []
      messages.push({ ...message, id: messages.length + 1, createdAt: Date.now() })
      store.set(message.sessionId, messages)
    },
    async list(sessionId, limit = 200) {
      return (store.get(sessionId) ?? []).slice(-limit)
    },
    async clear(sessionId) {
      store.delete(sessionId)
    },
  }
}

export const browserMemoryStore = createMemoryStore()
```

In `store.ts`, replace all three `createMemoryStore()` browser fallbacks with `browserMemoryStore`, re-export `createMemoryStore`, and remove the duplicate implementation.

- [ ] **Step 4: Run checks**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/agent/memory/in-memory.ts src/agent/memory/store.ts tests/agent-memory.test.ts
git commit -m "fix: persist browser agent memory fallback"
```

---

### Task 3: Production-safe Icon registry

**Files:**
- Create: `src/assets/icons/registry.ts`
- Create: `tests/icon-loading.test.ts`
- Modify: `src/components/Icon.vue`
- Modify: `src/assets/icons/catalog.ts`
- Modify: `docs/design-system.md`

**Interfaces:**
- Produces: `normalizeIconName(name: string): string` and `resolveIcon(name: string): Component | undefined`.
- Changes: `<Icon name="...">` supports the curated registry instead of claiming all Lucide icons are dynamically resolvable.

- [ ] **Step 1: Write failing source and normalization tests**

Create `tests/icon-loading.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeIconName, resolveIcon } from '../src/assets/icons/registry.ts'

test('normalizes PascalCase, spaces and underscores', () => {
  assert.equal(normalizeIconName('FolderOpen'), 'folder-open')
  assert.equal(normalizeIconName('clipboard_list'), 'clipboard-list')
  assert.equal(normalizeIconName('Circle Check'), 'circle-check')
})

test('resolves curated icons through normalized public names', () => {
  assert.ok(resolveIcon('FolderOpen'))
  assert.ok(resolveIcon('clipboard-list'))
  assert.equal(resolveIcon('not-in-the-starter-registry'), undefined)
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement the curated literal registry**

Create `src/assets/icons/registry.ts` with an intentionally small default set. Additional icons remain easy to add through one literal import and one registry entry:

```ts
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
```

Replace the asynchronous watcher in `Icon.vue` with a computed lookup through `resolveIcon`. Reduce `iconCatalog` to these five guaranteed names and link to Lucide for discovering additional names.

- [ ] **Step 4: Align catalog and documentation**

Change catalog and design-system wording from “all 1700+ icons are dynamically supported” to “the starter ships a curated tree-shakeable registry; add a literal import and registry entry for additional Lucide icons.”

- [ ] **Step 5: Run checks**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0 and Vite produces no ignored dynamic-import warning for `Icon.vue`.

- [ ] **Step 6: Commit**

```bash
git add src/assets/icons/registry.ts src/assets/icons/catalog.ts src/components/Icon.vue tests/icon-loading.test.ts docs/design-system.md
git commit -m "fix: replace runtime icon imports with static registry"
```

---

### Task 4: Mobile shell layout and platform detection

**Files:**
- Create: `scripts/check-built-layout.mjs`
- Create: `tests/mobile-platform.test.ts`
- Modify: `src/lib/platform.ts`
- Modify: `src/App.vue`
- Modify: `docs/mobile.md`
- Modify: `package.json`

**Interfaces:**
- Produces: `isMobileUserAgent(userAgent: string): boolean` for deterministic platform tests.
- Preserves: `isMobile()` and `isDesktopTauri()` public behavior.

- [ ] **Step 1: Write failing platform and layout tests**

Create `tests/mobile-platform.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { isMobileUserAgent } from '../src/lib/platform.ts'

test('detects Android and iOS user agents without matching desktop', () => {
  assert.equal(isMobileUserAgent('Mozilla/5.0 (Linux; Android 15)'), true)
  assert.equal(isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'), true)
  assert.equal(isMobileUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), false)
})

```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because `isMobileUserAgent` does not exist.

- [ ] **Step 3: Implement deterministic platform detection**

Add to `src/lib/platform.ts`:

```ts
export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent)
}
```

Make `isMobile()` call it. Run `npm test` and expect all platform tests to pass before changing layout CSS.

- [ ] **Step 4: Add a final-artifact layout check and verify RED**

Create `scripts/check-built-layout.mjs`:

```js
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const assets = resolve('dist/assets')
const cssFiles = (await readdir(assets)).filter((file) => file.endsWith('.css'))
const css = (await Promise.all(cssFiles.map((file) => readFile(resolve(assets, file), 'utf8')))).join('\n')
const compact = css.replace(/\s+/g, '')

const hasMobileShell = /@media\(max-width:768px\)[\s\S]*?\.shell\{[^}]*flex-direction:column/.test(compact)
const hasSafeArea = /@media\(max-width:768px\)[\s\S]*?\.tabbar\{[^}]*padding-bottom:env\(safe-area-inset-bottom,0px\)/.test(compact)

if (!hasMobileShell || !hasSafeArea) {
  console.error('Built CSS is missing the mobile column shell or bottom safe-area rule.')
  process.exit(1)
}

console.log('Built mobile layout contract is valid.')
```

Add to `package.json`:

```json
"check:layout": "node scripts/check-built-layout.mjs"
```

Before editing `App.vue`, run:

```bash
npm run build
npm run check:layout
```

Expected: `npm run build` exits 0 and `npm run check:layout` exits 1 because the final CSS does not stack `.shell` or reserve the safe area.

- [ ] **Step 5: Implement the mobile shell layout**

In the mobile media query, add:

```css
.shell {
  flex-direction: column;
}

.main {
  min-height: 0;
}

.tabbar {
  width: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

Run `npm run build && npm run check:layout` and expect both commands to exit 0.

- [ ] **Step 6: Correct mobile maturity wording**

State in `docs/mobile.md` that M1-M2 are browser-verified code adaptations, while M3-M5 require real Android/iOS toolchains and remain unverified in this repository.

- [ ] **Step 7: Run checks**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run check:layout
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/check-built-layout.mjs src/lib/platform.ts src/App.vue tests/mobile-platform.test.ts docs/mobile.md
git commit -m "fix: make mobile navigation a real bottom bar"
```

---

### Task 5: Updater configuration guard

**Files:**
- Create: `src/lib/updater-config.ts`
- Create: `tests/updater-config.test.ts`
- Modify: `vite.config.ts`
- Modify: `tsconfig.node.json`
- Modify: `src/vite-env.d.ts`
- Modify: `src/lib/updater.ts`
- Modify: `src/App.vue`
- Modify: `README.md`
- Modify: `README.en.md`

**Interfaces:**
- Produces: `isUpdaterEndpointConfigured(endpoints: string[]): boolean` and `isUpdaterConfiguredForBuild(): boolean`.
- Extends: `UpdatePhase` with `'unconfigured'`.

- [ ] **Step 1: Write failing updater configuration tests**

Create `tests/updater-config.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { isUpdaterEndpointConfigured } from '../src/lib/updater-config.ts'

test('rejects empty and starter placeholder endpoints', () => {
  assert.equal(isUpdaterEndpointConfigured([]), false)
  assert.equal(
    isUpdaterEndpointConfigured([
      'https://github.com/OWNER/REPO/releases/latest/download/latest.json',
    ]),
    false,
  )
})

test('accepts a concrete HTTPS update endpoint', () => {
  assert.equal(
    isUpdaterEndpointConfigured([
      'https://github.com/acme/desktop/releases/latest/download/latest.json',
    ]),
    true,
  )
})

test('rejects non-HTTPS remote endpoints', () => {
  assert.equal(isUpdaterEndpointConfigured(['http://updates.example.com/latest.json']), false)
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because `src/lib/updater-config.ts` does not exist.

- [ ] **Step 3: Implement build-time updater detection**

Create `src/lib/updater-config.ts`:

```ts
declare const __UPDATER_CONFIGURED__: boolean

export function isUpdaterEndpointConfigured(endpoints: string[]): boolean {
  return (
    endpoints.length > 0 &&
    endpoints.every((endpoint) => {
      try {
        const url = new URL(endpoint)
        return url.protocol === 'https:' && !/\bOWNER\b|\bREPO\b/.test(endpoint)
      } catch {
        return false
      }
    })
  )
}

export function isUpdaterConfiguredForBuild(): boolean {
  return typeof __UPDATER_CONFIGURED__ !== 'undefined' && __UPDATER_CONFIGURED__
}
```

In `vite.config.ts`, import `src-tauri/tauri.conf.json` and `isUpdaterEndpointConfigured`, then add:

```ts
define: {
  __UPDATER_CONFIGURED__: JSON.stringify(
    isUpdaterEndpointConfigured(tauriConfig.plugins.updater.endpoints),
  ),
},
```

Enable `resolveJsonModule` in `tsconfig.node.json` and declare the build constant in `src/vite-env.d.ts`.

- [ ] **Step 4: Guard the update flow**

Add `'unconfigured'` to `UpdatePhase`. At the start of `checkForUpdates`, return before calling Tauri when the build is unconfigured:

```ts
if (!isUpdaterConfiguredForBuild()) {
  onState({
    phase: 'unconfigured',
    percent: 0,
    message: '自动更新尚未配置：请设置仓库端点和签名公钥。',
  })
  return
}
```

In `App.vue`, render the message and disable the update button when `updateState.phase === 'unconfigured'` after the first check.

- [ ] **Step 5: Complete the rename/setup checklist**

Add updater endpoint replacement, keychain service rename, repository metadata, UI brand text, tray tooltip, and version synchronization to both README checklists. Do not claim the updater pipeline is verified until a signed release exists.

- [ ] **Step 6: Run checks**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/updater-config.ts tests/updater-config.test.ts vite.config.ts tsconfig.node.json src/vite-env.d.ts src/lib/updater.ts src/App.vue README.md README.en.md
git commit -m "fix: guard unconfigured updater builds"
```

---

### Task 6: CI gates and honest capability documentation

**Files:**
- Create: `scripts/check-doc-links.mjs`
- Create: `tests/doc-links.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/README.md`
- Modify: `docs/modular-architecture.md`
- Modify: `docs/agent-integration.md`
- Modify: `docs/ai-capabilities.md`
- Modify: `docs/mcp.md`
- Modify: `docs/local-inference.md`

**Interfaces:**
- Produces: `npm run check:docs` and CI evidence for default frontend, tests, Rust formatting, lint, default features, and all features.

- [ ] **Step 1: Write a failing documentation link test**

Create `scripts/check-doc-links.mjs` with the implementation from Step 3. It scans repository Markdown files, extracts relative Markdown targets, strips anchors, and reports missing files. Export `findBrokenMarkdownLinks(root)` for the test and execute it when the script is run directly.

Create `tests/doc-links.test.ts`:

```ts
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { findBrokenMarkdownLinks } from '../scripts/check-doc-links.mjs'

test('repository Markdown files have no broken relative links', async () => {
  assert.deepEqual(await findBrokenMarkdownLinks(new URL('../', import.meta.url)), [])
})

test('reports a missing relative Markdown target', async () => {
  const root = await mkdtemp(join(tmpdir(), 'meow-doc-links-'))
  try {
    await writeFile(join(root, 'README.md'), '[missing](./missing.md)')
    assert.deepEqual(await findBrokenMarkdownLinks(root), ['README.md -> ./missing.md'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
```

Add:

```json
"check:docs": "node scripts/check-doc-links.mjs"
```

- [ ] **Step 2: Run the documentation test to verify failure**

Run: `npm test`

Expected: FAIL because `scripts/check-doc-links.mjs` does not exist.

- [ ] **Step 3: Implement the link checker**

Create `scripts/check-doc-links.mjs`:

```js
import { access, readdir, readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'target'])

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : markdownFiles(path)
    }
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
  }))
  return nested.flat()
}

function relativeTargets(source) {
  return [...source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().replace(/^<|>$/g, ''))
    .filter((target) => target && !/^(?:https?:|mailto:|app:|sandbox:|#)/.test(target))
    .map((target) => target.split('#', 1)[0].split('?', 1)[0])
}

export async function findBrokenMarkdownLinks(rootInput) {
  const root = rootInput instanceof URL ? fileURLToPath(rootInput) : resolve(rootInput)
  const broken = []
  for (const file of await markdownFiles(root)) {
    const source = await readFile(file, 'utf8')
    for (const target of relativeTargets(source)) {
      const destination = resolve(dirname(file), target)
      try {
        await access(destination)
      } catch {
        broken.push(`${relative(root, file)} -> ${target}`)
      }
    }
  }
  return broken.sort()
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  const broken = await findBrokenMarkdownLinks(new URL('../', import.meta.url))
  if (broken.length > 0) {
    console.error(broken.join('\n'))
    process.exit(1)
  }
  console.log('Markdown relative links are valid.')
}
```

- [ ] **Step 4: Expand CI**

In the frontend job, run:

```yaml
- run: npm ci
- run: npm test
- run: npm run typecheck
- run: npm run build
- run: npm run check:docs
```

In the Rust job, install `rustfmt` and `clippy`, then run:

```yaml
- run: cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
- run: cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
- run: cargo check --manifest-path src-tauri/Cargo.toml
- run: cargo check --manifest-path src-tauri/Cargo.toml --all-features
```

- [ ] **Step 5: Align documentation with verified maturity**

Apply the Stable/Beta/Preview/Roadmap model from the design spec. Replace “zero dependencies/zero size” with “not loaded on the default runtime path”; label Agent, MCP, Ollama and optional system plugins Preview; label mobile responsive support and updater Beta; keep sidecar and advanced AI abilities Roadmap.

- [ ] **Step 6: Protect generated directories**

Add these entries to `.gitignore`:

```gitignore
src-tauri/target/
.tauri/
```

Do not ignore `src-tauri/gen/` because initialized mobile projects may intentionally be versioned.

- [ ] **Step 7: Run the full phase verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run check:docs
git diff --check
git status --short
```

When Rust is available, also run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo check --manifest-path src-tauri/Cargo.toml --all-features
```

Expected: every available command exits 0; any unavailable tool is recorded explicitly and its GitHub CI replacement is linked.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/check-doc-links.mjs tests/doc-links.test.ts .github/workflows/ci.yml .gitignore README.md README.en.md docs
git commit -m "ci: enforce core reliability and maturity gates"
```
