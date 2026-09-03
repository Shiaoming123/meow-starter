# Runtime Smoke Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide opt-in Web persistence and Windows installer lifecycle smoke commands with narrow, reproducible evidence boundaries.

**Architecture:** A Node Web runner builds and serves the existing Web bundle, then drives its visible Todo flow with `playwright-core` and an already installed browser. A separate Windows-only Node runner owns one validated target subtree, builds an unsigned NSIS installer, invokes it there, probes the child process, and cleans only that subtree. Both export small pure helpers for Node test coverage.

**Tech Stack:** Node.js 22, TypeScript strip-types test runner, Vite preview, `playwright-core` 1.62.1, Tauri CLI / NSIS on Windows.

**Spec:** `docs/superpowers/specs/2026-09-03-runtime-smoke-acceptance.md`

## Global Constraints

- Smoke commands are opt-in and must not be added to `npm run verify` or CI.
- `playwright-core` must not download a browser; `MEOW_BROWSER_PATH` overrides discovery.
- Web serves only `127.0.0.1`; no data or artifact leaves the local machine.
- Windows installer, app-data, and cleanup paths must be unique children of `src-tauri/target/meow-windows-package-smoke-*`; reject every escaping path before deletion.
- The Windows smoke uses an unsigned local NSIS build only and must not claim signing, updater delivery, graceful tray exit, or release readiness.

---

### Task 1: Web smoke runner and deterministic tests

**Files:**
- Create: `scripts/smoke-web-persistence.mjs`
- Create: `tests/web-persistence-smoke.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `resolveBrowserExecutable({ platform, env, exists })`, `createTodoMarker(now)`, and `webSmokeUrl(port)`.
- Produces `npm run smoke:web-persistence`, which builds Web mode, previews `http://127.0.0.1:4175`, creates/reloads a Todo, and exits nonzero on bad rendering, persistence, or app error.

- [x] **Step 1: Write the failing test**

```ts
import { createTodoMarker, resolveBrowserExecutable, webSmokeUrl } from '../scripts/smoke-web-persistence.mjs'

test('prefers an explicit browser path and otherwise selects an existing Windows browser', () => {
  assert.equal(resolveBrowserExecutable({ platform: 'win32', env: { MEOW_BROWSER_PATH: 'D:/browser.exe' }, exists: () => true }), 'D:/browser.exe')
  assert.match(resolveBrowserExecutable({ platform: 'win32', env: {}, exists: (path) => path.endsWith('msedge.exe') }), /msedge\.exe$/)
})

test('uses a loopback URL and unique Todo marker', () => {
  assert.equal(webSmokeUrl(4175), 'http://127.0.0.1:4175/')
  assert.match(createTodoMarker('2026-09-03T00:00:00.000Z'), /^meow-web-smoke-/)
})
```

- [x] **Step 2: Verify red**

Run: `node --experimental-strip-types --test tests/web-persistence-smoke.test.ts`

Expected: FAIL because `scripts/smoke-web-persistence.mjs` does not exist.

- [x] **Step 3: Implement the minimal runner**

```js
export function webSmokeUrl(port) { return `http://127.0.0.1:${port}/` }
export function createTodoMarker(now = new Date().toISOString()) { return `meow-web-smoke-${now}` }
export function resolveBrowserExecutable({ platform, env, exists }) { /* env, then known local paths */ }
```

Build Web mode, run Vite preview with `--host 127.0.0.1 --port 4175 --strictPort`, use `playwright-core` with `executablePath`, fill `写点什么…`, click `添加`, wait for the marker after click and reload, reject a visible `自动更新` control or captured error, then close the browser and preview child in `finally`.

- [x] **Step 4: Add dependency and command**

Run: `npm install --save-dev playwright-core@1.62.1`

Add `"smoke:web-persistence": "node scripts/smoke-web-persistence.mjs"` to `package.json`.

- [x] **Step 5: Verify green and rendered behavior**

Run: `node --experimental-strip-types --test tests/web-persistence-smoke.test.ts`

Expected: PASS.

Run: `npm run smoke:web-persistence`

Expected: a fresh Todo remains after reload with no application console/page errors, or a precise browser prerequisite error.

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/smoke-web-persistence.mjs tests/web-persistence-smoke.test.ts
git commit -m "test: add web persistence smoke"
```

### Task 2: Guarded Windows package smoke runner and tests

**Files:**
- Create: `scripts/smoke-windows-package.mjs`
- Create: `tests/windows-package-smoke.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `assertSmokePath(targetRoot, candidate)` and `createNsisInstallArgs(installerPath, installPath)`.
- Produces `npm run smoke:windows-package`, which owns a fresh `src-tauri/target/meow-windows-package-smoke-*` directory.

- [x] **Step 1: Write the failing test**

```ts
import { assertSmokePath, createNsisInstallArgs } from '../scripts/smoke-windows-package.mjs'

test('rejects cleanup outside the dedicated target subtree', () => {
  assert.throws(() => assertSmokePath('D:/repo/src-tauri/target', 'D:/repo/outside'), /must stay inside/)
})

test('keeps the NSIS destination argument last', () => {
  assert.deepEqual(createNsisInstallArgs('D:/bundle/setup.exe', 'D:/repo/src-tauri/target/meow-windows-package-smoke-a/install'), ['/S', '/D=D:/repo/src-tauri/target/meow-windows-package-smoke-a/install'])
})
```

- [x] **Step 2: Verify red**

Run: `node --experimental-strip-types --test tests/windows-package-smoke.test.ts`

Expected: FAIL because `scripts/smoke-windows-package.mjs` does not exist.

- [x] **Step 3: Implement the smallest guarded lifecycle runner**

```js
export function assertSmokePath(targetRoot, candidate) { /* resolve and require targetRoot + separator */ }
export function createNsisInstallArgs(_installerPath, installPath) { return ['/S', `/D=${installPath}`] }
```

Require Windows; create one unique target child; invoke the local Tauri CLI with `build --bundles nsis --no-sign --config {"bundle":{"createUpdaterArtifacts":false}}`; select exactly one NSIS installer; silently install to the validated `install` child; launch the installed Cargo-named executable with `APPDATA` and `LOCALAPPDATA` inside that child; assert it remains alive for two seconds; call `taskkill /pid <pid> /t /f`; wait for that child to exit; and in `finally` retry cleanup only for the validated root on transient Windows locks.

- [x] **Step 4: Add command and verify green**

Add `"smoke:windows-package": "node scripts/smoke-windows-package.mjs"` to `package.json`.

Run: `node --experimental-strip-types --test tests/windows-package-smoke.test.ts`

Expected: PASS.

- [x] **Step 5: Run the real Windows package smoke**

Run: `npm run smoke:windows-package`

Expected: unsigned NSIS installer builds, installs below the repository target tree, process stays alive briefly, and the dedicated target root is removed. Any prerequisite error remains an explicit failed result.

- [x] **Step 6: Commit**

```bash
git add package.json scripts/smoke-windows-package.mjs tests/windows-package-smoke.test.ts
git commit -m "test: add Windows package smoke"
```

### Task 3: Document evidence boundaries and run release-quality gates

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/web.md`
- Modify: `docs/release-kit.md`

**Interfaces:**
- Documents both smoke commands and `MEOW_BROWSER_PATH` as opt-in local evidence with exact exclusions.

- [x] **Step 1: Document exact evidence**

State the Web flow: build Web -> loopback preview -> add Todo -> reload -> persisted Todo -> no desktop updater UI/error.

State the Windows flow: unsigned NSIS build -> target-tree install -> short process-liveness check -> forced cleanup.

State that neither proves signing, hosted updater delivery, store acceptance, mobile compatibility, or a release.

- [x] **Step 2: Run quality gates**

Run: `npm run verify && npm run check:modules && npm run rust:verify && git diff --check`

Expected: every command exits zero; report any explicit Windows symlink permission skip and existing dependency build warnings separately from failures.

- [x] **Step 3: Commit**

```bash
git add README.md README.en.md docs/web.md docs/release-kit.md
git commit -m "docs: document runtime smoke checks"
```

## Self-review

- Spec coverage: Task 1 covers the browser override, rendered persistence flow, and error boundary. Task 2 covers Windows build/install/liveness, containment, and cleanup. Task 3 documents the exact evidence limits and executes every required gate.
- Placeholder scan: no TBD/TODO markers or indirect implementation references remain.
- Type consistency: every helper used by a test is exported by its corresponding runner and package commands match the documented names.

## Execution Handoff

Plan saved at `docs/superpowers/plans/2026-09-03-runtime-smoke-acceptance.md`. The user previously chose continuous autonomous delivery, so execute inline with `superpowers:executing-plans`, with a checkpoint after each task.
