# Module Compatibility Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent incompatible modules from being imported and make the frontend-to-native module boundary mechanically auditable.

**Architecture:** A static TypeScript catalog provides metadata before dynamic import. The loader filters that catalog against the detected runtime, loads only selected entries, then checks the loaded declaration against the catalog before topological setup. A small Node audit reads only committed Cargo and Tauri capability configuration and reports actionable mismatches.

**Tech Stack:** TypeScript, Vue module loader, Node.js built-in test runner, Node.js file APIs, Cargo TOML and Tauri capability JSON as read-only inputs.

**Spec:** `docs/superpowers/specs/2026-09-03-module-compatibility-contract.md`

## Global Constraints

- Preserve the current default module configuration and product UI.
- Do not add dependencies, plugins, credentials, permissions, cloud services, or release claims.
- A Web target skips incompatible native modules; it does not require Cargo features or Tauri permissions.
- The audit reports source-configuration consistency only; it never edits native configuration.
- Every behavior change starts with a focused failing test.

---

### Task 1: Static catalog and pre-import loader selection

**Files:**

- Create: `src/modules/contract.ts`
- Modify: `src/modules/types.ts`, `src/modules/config.ts`, `src/modules/loader.ts`
- Test: `tests/module-loader.test.ts`

**Interfaces:**

- `moduleContracts`, keyed by module configuration key, includes runtime compatibility and native requirement metadata.
- `assertModuleMatchesContract(module, contract)` rejects a dynamically loaded module that differs from its static declaration.
- `mountModules` accepts `ModuleLoaders` so tests can observe whether a module loader ran.

- [x] **Step 1: Write the failing Web pre-import test**

```ts
test('Web never invokes a desktop-only module loader', async () => {
  let desktopLoaderCalls = 0
  await mountModules(app, { tray: true }, webRuntime, testRegistry)
  assert.equal(desktopLoaderCalls, 0)
})
```

- [x] **Step 2: Verify it fails because the current loader imports before filtering**

Run: `node --experimental-strip-types --test tests/module-loader.test.ts`

Expected: FAIL because the desktop loader is called on the Web profile.

- [x] **Step 3: Implement the catalog and loader change**

```ts
const compatible = selectCompatibleModules(
  enabled.map((id) => moduleContracts[id]),
  runtime,
)

for (const contract of compatible) {
  const module = (await registry[contract.id]()).default
  assertModuleMatchesContract(module, contract)
  modules.push(module)
}
```

The catalog retains current module ids, dependencies, platform lists, and runtime capability requirements. Native requirements are declarative metadata only.

- [x] **Step 4: Add and satisfy a contract-mismatch test**

```ts
assert.rejects(
  mountModules(app, undefined, desktopRuntime, mismatchedRegistry),
  /does not match its compatibility contract/,
)
```

Validation compares id, dependency order, platforms, and required capabilities exactly.

- [x] **Step 5: Verify focused tests and type checking**

Run: `node --experimental-strip-types --test tests/module-loader.test.ts && npm run typecheck`

Expected: PASS.

- [x] **Step 6: Commit the runtime-contract change**

```bash
git add src/modules/contract.ts src/modules/types.ts src/modules/config.ts src/modules/loader.ts tests/module-loader.test.ts
git commit -m "feat: enforce module compatibility before import"
```

### Task 2: Native configuration audit and catalog coverage

**Files:**

- Create: `scripts/check-module-contract.mjs`
- Test: `tests/module-contract.test.ts`
- Modify: `package.json`

**Interfaces:**

- `auditModuleContract({ contracts, cargoToml, permissions })` returns `{ errors: string[] }`.
- It consumes the static catalog plus committed Cargo and Tauri capability configuration.
- `npm run check:modules` is a read-only configuration gate.

- [x] **Step 1: Write failing catalog coverage tests**

```ts
test('every catalog module has compatible dependencies in every runtime profile', () => {
  for (const runtime of runtimeProfiles) {
    const selected = selectCompatibleModules(Object.values(moduleContracts), runtime)
    assertDependenciesAreSelected(selected)
  }
})
```

The test asserts catalog keys equal both frontend configuration keys and loader registry keys.

- [x] **Step 2: Verify it fails before the audit API exists**

Run: `node --experimental-strip-types --test tests/module-contract.test.ts`

Expected: FAIL because the module-contract audit API and fixture do not exist.

- [x] **Step 3: Implement the minimal read-only audit**

```js
const errors = auditModuleContract({ contracts, cargoToml, permissions })
if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}
```

For a `cargo-feature` requirement, require the exact feature declaration in Cargo. For a `tauri-permission` requirement, require the exact permission string in the capability JSON. The script never changes either file.

- [x] **Step 4: Add and satisfy a missing-feature fixture test**

```ts
assert.match(
  auditModuleContract({ contracts: fixture, cargoToml: '', permissions: [] }).errors[0],
  /shortcut.*Cargo feature/,
)
```

- [x] **Step 5: Add the package script and run focused checks**

Run: `npm run check:modules && npm test`

Expected: PASS, except the documented Windows symbolic-link fixture may be explicitly skipped when the host lacks link privileges.

- [x] **Step 6: Commit the audit**

```bash
git add scripts/check-module-contract.mjs tests/module-contract.test.ts package.json
git commit -m "test: audit module native configuration"
```

### Task 3: Document the two-plane contract

**Files:**

- Modify: `docs/modular-architecture.md`, `docs/web.md`, `README.md`, `README.en.md`, `docs/README.md`

**Interfaces:**

- Documents the distinction between runtime selection and native build configuration.
- Documents `npm run check:modules` and its evidence boundary.

- [x] **Step 1: Document exact usage and non-claims**

Add a compatibility table naming runtime platform, capability gate, and native build requirement. State that the audit detects mismatch but does not enable features, grant permissions, or certify package behavior.

- [x] **Step 2: Verify documentation links**

Run: `npm run check:docs`

Expected: PASS after every new relative documentation link resolves.

- [x] **Step 3: Run the complete relevant verification matrix**

Run: `npm run check:modules && npm test && npm run typecheck && npm run build && npm run build:web && npm run check:docs`

Expected: PASS. Report any explicit test skip separately rather than describing the suite as fully green.

- [x] **Step 4: Commit documentation and verification changes**

```bash
git add README.md README.en.md docs/README.md docs/modular-architecture.md docs/web.md
git commit -m "docs: explain module compatibility contract"
```

## Plan self-review

- Spec coverage: Tasks 1 and 2 implement every executable contract requirement; Task 3 records the source-consistency boundary and verification commands.
- Placeholder scan: no deferred implementation steps or unspecified interfaces remain.
- Type consistency: `moduleContracts`, `assertModuleMatchesContract`, `ModuleLoaders`, and `auditModuleContract` use the same names throughout.
