# Release Kit Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a credential-free developer/release validation layer and durable guidance for `meow-starter`.

**Architecture:** A small `scripts/release-kit/` library owns filesystem-safe cleanup, configuration inspection, and toolchain reporting. Thin executable scripts expose the library through package commands, existing tests retain the Node built-in test runner, and documentation makes the release maturity boundary explicit.

**Tech Stack:** Node.js ESM, Node built-in test runner, npm scripts, GitHub Actions YAML, Markdown, Tauri JSON/TOML configuration.

**Spec:** `docs/superpowers/specs/2026-09-02-release-kit-foundation-design.md`

## Global Constraints

- No command reads, prints, creates, or uploads credentials.
- Placeholder updater configuration is valid for a template checkout and must be identified explicitly.
- Release-ready mode rejects placeholder updater URLs and mismatched versions.
- Cleanup may delete only regular files whose basename starts with `._`; it must not traverse symlinks.
- AppleDouble files must be ignored by test discovery even if cleanup is not run.
- CI remains structurally intact except for invoking `release:check`.
- Android/iOS initialization, provider deployment, code signing, notarization, and store upload remain outside this plan.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/release-kit/appledouble.mjs` | Discover and remove AppleDouble sidecars without following links. |
| `scripts/release-kit/config.mjs` | Read the three version sources and validate identifier, icons, and updater state. |
| `scripts/release-kit/environment.mjs` | Report local toolchain and filesystem conditions without exposing secrets. |
| `scripts/clean-appledouble.mjs` | CLI for opt-in cleanup. |
| `scripts/doctor.mjs` | CLI for local prerequisite diagnostics. |
| `scripts/release-check.mjs` | CLI for template/release configuration validation. |
| `scripts/verify.mjs` | Stable sequential frontend verification runner. |
| `scripts/rust-verify.mjs` | AppleDouble-safe Rust verification runner. |
| `tests/release-kit.test.ts` | Tests for sidecar filtering and release configuration checks. |
| `AGENTS.md` | Required working agreement for future agents. |
| `docs/development.md` | Human development setup and verification guide. |
| `docs/release-kit.md` | Release lifecycle and maturity guide. |

### Task 1: Make test discovery AppleDouble-safe

**Files:**
- Modify: `scripts/run-tests.mjs`
- Modify: `tests/release-kit.test.ts`

**Interfaces:**
- Produces: `isRunnableTestFile(file: string): boolean`, exported from `scripts/run-tests.mjs`.
- Consumes: Node `path.basename` semantics only; no third-party dependency.

- [ ] **Step 1: Write the failing test**

```ts
import { isRunnableTestFile } from '../scripts/run-tests.mjs'

test('ignores AppleDouble test sidecars', () => {
  assert.equal(isRunnableTestFile('agent.test.ts'), true)
  assert.equal(isRunnableTestFile('._agent.test.ts'), false)
})
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`

Expected: failure because `isRunnableTestFile` is not exported.

- [ ] **Step 3: Implement the minimum filter**

```js
export function isRunnableTestFile(file) {
  return !file.startsWith('._') && file.endsWith('.test.ts')
}

const files = readdirSync(testsDir).filter(isRunnableTestFile)
```

- [ ] **Step 4: Run focused and full Node tests**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts && npm test`

Expected: the focused assertion and all existing tests pass even if `tests/._*.test.ts` exists.

- [ ] **Step 5: Commit**

```bash
git add scripts/run-tests.mjs tests/release-kit.test.ts
git commit -m "fix: ignore AppleDouble test sidecars"
```

### Task 2: Add safe AppleDouble discovery and cleanup

**Files:**
- Create: `scripts/release-kit/appledouble.mjs`
- Create: `scripts/clean-appledouble.mjs`
- Modify: `tests/release-kit.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `findAppleDoubleFiles(root: string): Promise<string[]>` and `removeAppleDoubleFiles(root: string): Promise<string[]>`.
- The cleanup CLI exits `0` after reporting zero or more removed sidecars.

- [ ] **Step 1: Add a temporary-directory failing test**

```ts
const root = await mkdtemp(join(tmpdir(), 'meow-appledouble-'))
await writeFile(join(root, '._sidecar'), 'metadata')
await writeFile(join(root, '.env'), 'keep')
assert.deepEqual(await findAppleDoubleFiles(root), [join(root, '._sidecar')])
assert.deepEqual(await removeAppleDoubleFiles(root), [join(root, '._sidecar')])
assert.equal(await readFile(join(root, '.env'), 'utf8'), 'keep')
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`

Expected: import failure for `scripts/release-kit/appledouble.mjs`.

- [ ] **Step 3: Implement a non-symlink traversal**

```js
const entry = await lstat(path)
if (entry.isSymbolicLink()) return []
if (entry.isFile() && basename(path).startsWith('._')) return [path]
if (!entry.isDirectory()) return []
```

Use `readdir(path, { withFileTypes: true })`, recurse only into directory
entries that are not symbolic links, and call `unlink` only for discovered
regular files.

- [ ] **Step 4: Add the CLI and package command**

```json
"clean:appledouble": "node scripts/clean-appledouble.mjs"
```

The CLI resolves the repository root from `import.meta.url`, removes only files
returned by `removeAppleDoubleFiles`, and prints `Removed N AppleDouble file(s).`.

- [ ] **Step 5: Run proof commands**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts && npm run clean:appledouble && npm test`

Expected: safe cleanup reports a count and the full test suite remains green.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/release-kit/appledouble.mjs scripts/clean-appledouble.mjs tests/release-kit.test.ts
git commit -m "fix: handle AppleDouble workspace sidecars"
```

### Task 3: Implement release configuration inspection

**Files:**
- Create: `scripts/release-kit/config.mjs`
- Create: `scripts/release-check.mjs`
- Modify: `tests/release-kit.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `inspectReleaseConfig(root: string, mode: 'template' | 'release'): Promise<{ errors: string[]; warnings: string[]; summary: string[] }>`.
- `release:check` uses template mode by default; `npm run release:check -- --mode=release` uses release mode.

- [ ] **Step 1: Add version and updater assertions**

```ts
const result = await inspectReleaseConfig(fixtureRoot, 'template')
assert.deepEqual(result.errors, [])
assert.match(result.warnings.join('\n'), /placeholder updater endpoint/)

const releaseResult = await inspectReleaseConfig(fixtureRoot, 'release')
assert.match(releaseResult.errors.join('\n'), /placeholder updater endpoint/)
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`

Expected: import failure for `scripts/release-kit/config.mjs`.

- [ ] **Step 3: Implement the inspector**

```js
const versionPattern = /^version\s*=\s*"([^"]+)"/m
const cargoVersion = cargoToml.match(versionPattern)?.[1]
const versionsMatch = [packageVersion, cargoVersion, tauri.version].every(
  (version) => version === packageVersion,
)
```

Validate a non-empty `identifier`, every icon path listed under `bundle.icon`,
and each updater endpoint as HTTPS with no `OWNER/REPO` segment. In template
mode, a placeholder endpoint is a warning; in release mode it is an error.
Return errors instead of throwing for malformed project configuration.

- [ ] **Step 4: Add the CLI and package command**

```json
"release:check": "node scripts/release-check.mjs"
```

Print each summary line, prefix warnings with `WARN`, errors with `ERROR`, and
exit `1` when `errors.length > 0`.

- [ ] **Step 5: Run validation commands**

Run: `npm run release:check && npm run release:check -- --mode=release`

Expected: template mode exits `0` with one placeholder warning; release mode
exits `1` with the same endpoint identified as an error.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/release-kit/config.mjs scripts/release-check.mjs tests/release-kit.test.ts
git commit -m "feat: add release configuration checks"
```

### Task 4: Add local diagnostic and verification commands

**Files:**
- Create: `scripts/release-kit/environment.mjs`
- Create: `scripts/doctor.mjs`
- Create: `scripts/verify.mjs`
- Create: `scripts/rust-verify.mjs`
- Modify: `package.json`
- Modify: `tests/release-kit.test.ts`

**Interfaces:**
- Produces: `inspectEnvironment(root: string): Promise<{ warnings: string[]; summary: string[] }>`.
- `verify` runs `test`, `typecheck`, `build`, `build:web`, `check:layout`, and `check:docs` in that exact order; `rust:verify` removes AppleDouble files before invoking the four existing Cargo gates.

- [ ] **Step 1: Add a filesystem-warning test**

```ts
const result = await inspectEnvironment(fixtureRoot, {
  filesystemType: 'exfat',
  platform: 'darwin',
})
assert.match(result.warnings.join('\n'), /AppleDouble/)
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`

Expected: import failure for `scripts/release-kit/environment.mjs`.

- [ ] **Step 3: Implement diagnostics without secret access**

```js
const tool = spawnSync(command, ['--version'], { encoding: 'utf8' })
const version = tool.status === 0 ? tool.stdout.trim() : 'missing'
```

Report Node, npm, Rust, Cargo, and the filesystem type from the macOS
`stat -f %T` query applied to the project root. The report must use command version output only;
it must not enumerate environment variables, keychains, or GitHub Secrets.

- [ ] **Step 4: Implement sequential verification**

```js
const commands = ['test', 'typecheck', 'build', 'build:web', 'check:layout', 'check:docs']
for (const command of commands) {
  const result = spawnSync('npm', ['run', command], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
```

Add `doctor`, `verify`, and `rust:verify` package scripts. `doctor` exits
successfully with warnings; both verification commands exit at the first failed
quality gate. `rust:verify` imports `removeAppleDoubleFiles`, preserves any
caller-provided `CARGO_TARGET_DIR`, and uses
`join(tmpdir(), 'meow-starter-cargo-target')` only as a macOS exFAT fallback
when that variable is absent. The fallback must warn that the temporary
directory's filesystem type has not been verified as native; a caller-selected
native target directory remains the supported path.

- [ ] **Step 5: Run proof commands**

Run: `npm run doctor && npm run verify && npm run rust:verify`

Expected: the current machine warns about exFAT, reports installed tool
versions, and then completes all frontend gates.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/release-kit/environment.mjs scripts/doctor.mjs scripts/verify.mjs scripts/rust-verify.mjs tests/release-kit.test.ts
git commit -m "feat: add local release kit diagnostics"
```

### Task 5: Publish the working agreement and Release Kit guidance

**Files:**
- Create: `AGENTS.md`
- Create: `docs/development.md`
- Create: `docs/release-kit.md`
- Modify: `docs/README.md`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `.gitignore`

**Interfaces:**
- Documentation exposes `doctor`, `verify`, `release:check`, and
  `clean:appledouble` exactly as named in `package.json`.

- [ ] **Step 1: Add documentation-link tests**

```ts
assert.equal(existsSync(join(projectRoot, 'AGENTS.md')), true)
assert.equal(existsSync(join(projectRoot, 'docs', 'development.md')), true)
assert.equal(existsSync(join(projectRoot, 'docs', 'release-kit.md')), true)
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`

Expected: failure because the new guidance files do not exist.

- [ ] **Step 3: Write focused guidance**

`AGENTS.md` states reading order, no-secret boundaries, module rules, test
matrix, and Definition of Done. `development.md` provides normal and exFAT
setup paths. `release-kit.md` separates build, package, signing, notarization,
store submission, updater signing, and their current maturity levels.

- [ ] **Step 4: Link the documentation and ignore generated noise**

Add the two docs to the docs index and both README navigation tables. Add only:

```gitignore
._*
src-tauri/gen/
```

Keep `.worktrees/` ignored. Do not add broad wildcard ignores for JSON, TOML,
or hidden project configuration.

- [ ] **Step 5: Run documentation and full frontend checks**

Run: `npm test && npm run check:docs && npm run verify`

Expected: all links resolve and all frontend gates pass.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md docs/development.md docs/release-kit.md docs/README.md README.md README.en.md .gitignore tests/release-kit.test.ts
git commit -m "docs: add release kit development guidance"
```

### Task 6: Integrate the check into existing CI and verify the complete phase

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- CI frontend job invokes the same `npm run release:check` command developers
  run locally.

- [ ] **Step 1: Add the CI command after dependency installation**

```yaml
      - run: npm ci
      - run: npm run release:check
      - run: npm test
```

- [ ] **Step 2: Validate workflow syntax and local command parity**

Run: `npm run release:check && npm run verify`

Expected: local template mode is green and emits its explicit placeholder
warning; the exact CI command needs no secret.

- [ ] **Step 3: Run the full Rust matrix using a native cache target**

Run:

```bash
npm run rust:verify
```

Expected: formatting, linting, tests, and checks pass without source-tree
AppleDouble parsing; the script selects a temporary native-filesystem target on
macOS exFAT workspaces.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: validate release configuration"
```

## Plan Self-Review

- Spec coverage: Tasks 1-2 provide filesystem resilience; Tasks 3-4 provide
  credential-free Release Kit commands; Task 5 documents limits and ownership;
  Task 6 adds the only CI change. Deferred providers and signing stay deferred.
- Scope: no release workflow split, native mobile bootstrap, secret, signing,
  deployment, or package upload is introduced.
- Interface consistency: all CLIs call the exact package command names defined
  in the tasks; `inspectReleaseConfig`, `inspectEnvironment`, and
  AppleDouble utilities are defined before their consumers.
