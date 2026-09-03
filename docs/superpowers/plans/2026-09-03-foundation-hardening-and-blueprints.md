# Foundation Hardening and Blueprints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local Windows baseline trustworthy and give a cloned scaffold three concise, safe paths to a first application.

**Architecture:** Keep platform command resolution in one small Node helper used by diagnostics and the aggregate verifier. Keep the test fixtures host-portable rather than weakening the AppleDouble implementation. Add documentation-only blueprints that reuse the existing domain-storage and module-boundary patterns without adding product features or default dependencies.

**Tech Stack:** Node.js ESM scripts, Node test runner, GitHub Actions, Vue 3, Tauri 2, Markdown.

**Spec:** `docs/superpowers/specs/2026-09-03-lightweight-interaction-scaffold.md`

## Global Constraints

- Keep the default path credential-free, local-first, and free of cloud backends.
- Use `cmd.exe /c npm.cmd` only for fixed repository npm commands on Windows; do not use `shell: true`.
- Do not weaken symbolic-link avoidance in AppleDouble cleanup to accommodate hosts without Developer Mode.
- Keep desktop as the primary target and preserve existing Stable/Beta/Preview/Roadmap labels.
- Blueprints document optional features; they must not claim that a front-end module switch configures its Cargo feature, capability permission, signing, or release delivery.
- Do not add runtime dependencies or generated artifacts.

---

### Task 1: Make npm command execution portable

**Files:**
- Create: `scripts/release-kit/npm-command.mjs`
- Modify: `scripts/release-kit/environment.mjs`
- Modify: `scripts/verify.mjs`
- Test: `tests/release-kit.test.ts`

**Interfaces:**
- Produces `getNpmInvocation(args, options?)`, returning `{ command, args, options }`.
- Produces `runNpmCommand(args, options?)`, which invokes the returned command through an injected `runCommand` or `spawnSync`.
- `environment.mjs` uses the helper for `npm --version`; `verify.mjs` uses it for each fixed `npm run <script>` command.

- [x] **Step 1: Write failing Windows invocation tests**

Add these tests to `tests/release-kit.test.ts` before adding the helper:

```ts
test('builds a cmd invocation for npm on Windows', () => {
  assert.deepEqual(
    getNpmInvocation(['run', 'test'], { platform: 'win32', commandShell: 'cmd.exe' }),
    {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd run test'],
      options: { windowsHide: true },
    },
  )
})
```

Add a second test that injects `runCommand` into `runNpmCommand`, asserts it receives the same command/arguments and returns the injected result.

- [x] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`

Expected: FAIL because `npm-command.mjs` does not exist.

- [x] **Step 3: Add the smallest helper and use it**

Implement the public helper with this behavior:

```js
export function getNpmInvocation(args, { platform = process.platform, commandShell = process.env.ComSpec ?? 'cmd.exe' } = {}) {
  if (platform === 'win32') {
    return { command: commandShell, args: ['/d', '/s', '/c', `npm.cmd ${args.join(' ')}`], options: { windowsHide: true } }
  }
  return { command: 'npm', args: [...args], options: {} }
}
```

`runNpmCommand` must merge its caller-provided spawn options with the returned `options`, call the injected runner, and never pass a shell option. Replace direct `spawnSync('npm', ...)` calls in `environment.mjs` and `verify.mjs` with this helper.

- [x] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`

Expected: all release-kit tests pass except any host-specific symbolic-link fixture handled in Task 2.

- [x] **Step 5: Commit**

```bash
git add scripts/release-kit/npm-command.mjs scripts/release-kit/environment.mjs scripts/verify.mjs tests/release-kit.test.ts
git commit -m "fix: support npm diagnostics on Windows"
```

### Task 2: Make release-kit fixtures host-portable

**Files:**
- Modify: `tests/release-kit.test.ts`
- Test: `tests/release-kit.test.ts`

**Interfaces:**
- The production AppleDouble functions remain unchanged: symbolic links are ignored and never followed.
- Test path assertions compare literal strings instead of treating Windows paths as regular expressions.

- [x] **Step 1: Write the failing portable expectations**

Replace the three path regex assertions with `assert.ok(summary.includes(join(...)))`. Change the exFAT fallback expectation to `join('/fallback', 'meow-starter-cargo-target')`, which follows the host `node:path` behavior used by production code. Wrap the two `symlink` fixture calls in a `try/catch`; when `error.code === 'EPERM'`, call `t.skip('Windows symbolic links require Developer Mode or elevation')` and return before assertions.

- [x] **Step 2: Verify RED on Windows**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`

Expected before applying the assertion changes: the three existing host-sensitive failures reproduce.

- [x] **Step 3: Apply only the fixture fixes**

Do not change `scripts/release-kit/appledouble.mjs`. The test must continue to assert that regular `._*` files are removed, `.env` is preserved, and an external file remains untouched whenever symbolic links are available.

- [x] **Step 4: Verify GREEN**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`

Expected: PASS, or one explicit `SKIP` for unavailable Windows symbolic-link privileges.

- [x] **Step 5: Commit**

```bash
git add tests/release-kit.test.ts
git commit -m "test: make release-kit fixtures portable"
```

### Task 3: Add a Windows regression gate

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces a `windows-smoke` CI job that installs the locked dependencies, runs `npm test`, then runs `npm run doctor` on `windows-latest`.
- Existing Ubuntu frontend and Rust jobs remain unchanged.

- [x] **Step 1: Add the job after the frontend job**

Use the same checkout, Node 22, and npm cache steps as `frontend`, followed only by:

```yaml
  windows-smoke:
    name: Windows npm and diagnostics
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run doctor
```

- [x] **Step 2: Verify YAML and local behavior**

Run: `npm test && npm run doctor && npm run verify && npm run release:check`

Expected: all commands pass; `doctor` reports an npm version rather than `missing`.

- [x] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: smoke test npm commands on Windows"
```

### Task 4: Add first-product blueprints

**Files:**
- Create: `docs/blueprints/README.md`
- Create: `docs/blueprints/local-notebook.md`
- Create: `docs/blueprints/developer-utility.md`
- Create: `docs/blueprints/local-ai-companion.md`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/README.md`
- Modify: `docs/project-guide.md`

**Interfaces:**
- The blueprints are documentation-only and begin from the current Todo storage pattern.
- Every blueprint declares a user journey, exact starting files, non-goals, platform degradation, security/release boundary, and verification commands.

- [x] **Step 1: Write the blueprint index**

Create a selection table with exactly three rows: local notebook (domain data/migrations), developer utility (minimal permissions and Web degradation), and local AI companion (explicit Preview opt-in). Its shared flow is: run `npm run doctor`; write the user journey; define the domain port and adapters; add a one-statement SQLite migration; replace the demo UI; run the listed checks; verify a desktop restart manually.

- [x] **Step 2: Write the notebook blueprint**

Describe a local notes app with create, browse, edit, restart persistence, search, and a project-owned JSON export contract. Point to `src/storage/todos/*`, `src/lib/db.ts`, `src-tauri/src/db.rs`, and `tests/todo-storage.test.ts` as the patterns to follow. Explicitly exclude collaboration, cloud sync, RAG, rich text, and a promised backup implementation.

- [x] **Step 3: Write the developer-utility blueprint**

Describe paste/import, validate/format, local recent history, copy/download, and a Web-safe fallback. Require pure-function tests for malformed and oversized input. Explain that file selection, clipboard, or native features require matching front-end configuration, Cargo features, and capability permissions; exclude shell execution, directory crawling, token storage, and arbitrary authenticated requests.

- [x] **Step 4: Write the local-AI-companion blueprint**

Describe explicit Agent dependency installation, an explicitly configured local Ollama profile, local sessions, and reviewable tool use. Link `docs/local-inference.md`, `docs/agent-integration.md`, `agent.config.ts`, and `src/agent/ui/ChatPanel.vue`. Label Agent, MCP, and local inference Preview; exclude default networking, MCP, RAG, document upload, autonomous tools, and cloud key setup.

- [x] **Step 5: Link the blueprints without duplicating them**

Add one Blueprints link to each README navigation table, list `blueprints/` in the documentation index, and add the index to `docs/project-guide.md` as the implementation follow-up after project-fit selection.

- [x] **Step 6: Verify documentation**

Run: `npm run check:docs`

Expected: all Markdown relative links are valid.

- [x] **Step 7: Commit**

```bash
git add README.md README.en.md docs/README.md docs/project-guide.md docs/blueprints
git commit -m "docs: add first-app blueprints"
```

### Task 5: Final first-phase verification

**Files:**
- Verify only; no source changes.

- [x] **Step 1: Run the whole local baseline**

Run: `npm run verify && npm run release:check && npm run rust:verify`

Expected: all checks pass; release check remains a template-mode warning until a downstream project supplies a real updater endpoint and signing configuration.

- [x] **Step 2: Review the exact change boundary**

Run: `git diff origin/main...HEAD --check && git status --short`

Expected: no whitespace errors, no generated build artifacts, no secrets, and no unexpected modified files.

- [x] **Step 3: Record outcome**

Windows verification passed with 66 tests and one explicit symbolic-link fixture skip because this machine does not grant Developer Mode or elevated link privileges. Do not call a signed release, mobile package, cloud sync, or real-provider interaction verified by these commands.
