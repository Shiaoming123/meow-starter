# Application Protocol and Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight, machine-checked application protocol, then advance release, Web, and mobile readiness only through separately evidenced milestones.

**Architecture:** `app.protocol.json` declares product-level intent and evidence boundaries. Existing `src/modules/config.ts`, `src/modules/contract.ts`, and Todo data-port constants remain the technical sources of truth; a small Node checker cross-checks the protocol without becoming a runtime dependency.

**Tech Stack:** JSON, Node.js built-in test runner, TypeScript source imports via Node strip-types, Vue/Tauri 2 existing verification scripts.

**Spec:** `docs/superpowers/specs/2026-09-03-application-protocol.md`

## Global Constraints

- Keep desktop primary, Web/mobile Beta, sync/Agent/MCP Preview, and do not upgrade claims without fresh platform evidence.
- Keep local-first storage default; sync stays optional and off by default.
- Do not introduce an event bus, plugin framework, runtime protocol fetch, credentials, or generated artefacts.
- Never claim signing, hosted updates, stores, deployed Web, or real-device behaviour from configuration or local build checks.
- Preserve the existing module configuration, compatibility contract, data-port, and native-build boundary as independent facts.

---

### Task 1: Application protocol v1

**Files:**
- Create: `app.protocol.json`
- Create: `scripts/check-app-protocol.mjs`
- Create: `tests/app-protocol.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `defaultModuleConfig`, `moduleContracts`, `TODO_EXPORT_FORMAT`, `TODO_EXPORT_VERSION`, `package.json` scripts.
- Produces: `validateApplicationProtocol(input): { errors: string[] }` and `npm run check:protocol`.

- [ ] **Step 1: Write the failing tests**

```ts
assert.deepEqual(validateApplicationProtocol(validFixture).errors, [])
assert.match(validateApplicationProtocol({ ...validFixture, modulePolicy: { enabled: ['core'] } }).errors.join('\n'), /modulePolicy/)
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --experimental-strip-types --test tests/app-protocol.test.ts`
Expected: FAIL because the checker does not exist.

- [ ] **Step 3: Implement the smallest checker and protocol JSON**

```js
export function validateApplicationProtocol({ protocol, packageJson, config, contracts, dataPort }) {
  return { errors: [] }
}
```

Implement exact validation for each v1 invariant; the command reads files and reports every error without modifying them.

- [ ] **Step 4: Run focused tests and the command**

Run: `node --experimental-strip-types --test tests/app-protocol.test.ts && npm run check:protocol`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add app.protocol.json scripts/check-app-protocol.mjs tests/app-protocol.test.ts package.json
git commit -m "feat: add application protocol check"
```

### Task 2: Protocol guide and normal gates

**Files:**
- Create: `docs/application-protocol.md`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/README.md`
- Modify: `scripts/verify.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `app.protocol.json`, `npm run check:protocol`, existing maturity/release documents.
- Produces: a linked operator guide and protocol verification in local/CI frontend gates.

- [ ] **Step 1: Write the failing package-level check test**

```ts
assert.equal(runProtocolCheck(projectFixture).status, 0)
```

- [ ] **Step 2: Run it to verify the un-wired gate fails**

Run: `node --experimental-strip-types --test tests/app-protocol.test.ts`
Expected: FAIL because `verify` does not invoke the protocol check.

- [ ] **Step 3: Wire the existing command and document exact boundaries**

Add `check:protocol` once to `verify` and frontend CI. Explain how to update the JSON with module/data changes, which source files determine capability details, and which evidence remains conditional.

- [ ] **Step 4: Run documentation and frontend gates**

Run: `npm run check:protocol && npm run check:docs && npm run verify`
Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/application-protocol.md README.md README.en.md docs/README.md scripts/verify.mjs .github/workflows/ci.yml tests/app-protocol.test.ts
git commit -m "docs: explain application protocol boundaries"
```

### Task 3: Release-readiness evidence model (after Task 2)

**Files:**
- Modify: `app.protocol.json`
- Modify: `scripts/release-kit/config.mjs`
- Modify: `scripts/release-check.mjs`
- Modify: `tests/release-kit.test.ts`
- Modify: `docs/release-kit.md`

**Interfaces:**
- Consumes: existing template/release check results and protocol release boundary.
- Produces: reproducible local metadata checks that distinguish configuration readiness from an actual signed/hosted release.

- [ ] **Step 1: Write a failing test for an evidence mismatch**

```ts
assert.match(inspectReleaseConfig(fixture, 'release').errors.join('\n'), /protocol release boundary/)
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --experimental-strip-types --test tests/release-kit.test.ts`
Expected: FAIL because release check does not read the declared boundary.

- [ ] **Step 3: Add the smallest read-only cross-check**

Make the script reject only contradictory release assertions; do not inspect secrets or perform signing/network delivery.

- [ ] **Step 4: Run release and frontend gates**

Run: `npm test && npm run release:check && npm run verify`
Expected: all exit 0; template warnings remain explicit.

- [ ] **Step 5: Commit**

```bash
git add app.protocol.json scripts/release-kit/config.mjs scripts/release-check.mjs tests/release-kit.test.ts docs/release-kit.md
git commit -m "feat: cross-check release evidence boundary"
```

### Task 4: Windows installation evidence (conditional, after Task 3)

**Files:**
- Modify: `scripts/smoke-windows-package.mjs`
- Modify: `tests/windows-package-smoke.test.ts`
- Modify: `docs/release-kit.md`

**Interfaces:**
- Consumes: unsigned NSIS package smoke and protocol conditional evidence.
- Produces: explicit pass, prerequisite failure, or permission skip without converting unsigned installation into signing/release proof.

- [ ] **Step 1: Write a failing test for a Windows prerequisite/skip classification**

```ts
assert.deepEqual(classifyWindowsSmokePrerequisite(error), { status: 'skipped', reason: 'symbolic-link-permission' })
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --experimental-strip-types --test tests/windows-package-smoke.test.ts`
Expected: FAIL because the classifier does not exist.

- [ ] **Step 3: Implement only explicit result classification**

Keep containment guards and process cleanup; do not add certificate or updater handling.

- [ ] **Step 4: Run Windows unit checks and, when prerequisites exist, smoke**

Run: `npm test && npm run smoke:windows-package`
Expected: unit tests pass; smoke reports pass, a precise prerequisite failure, or its documented permission skip.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-windows-package.mjs tests/windows-package-smoke.test.ts docs/release-kit.md
git commit -m "feat: classify Windows installation smoke evidence"
```

### Task 5: Web deployment acceptance (conditional, after Task 2)

**Files:**
- Create: `scripts/smoke-web-deployment.mjs`
- Create: `tests/web-deployment-smoke.test.ts`
- Modify: `package.json`
- Modify: `docs/web.md`

**Interfaces:**
- Consumes: an explicit HTTPS URL supplied by the caller, never a provider credential.
- Produces: an opt-in deployed-site smoke that proves only the named URL's public payload and client errors.

- [ ] **Step 1: Write a failing test for URL validation and evidence output**

```ts
assert.throws(() => parseDeploymentUrl('http://example.test'), /HTTPS/)
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --experimental-strip-types --test tests/web-deployment-smoke.test.ts`
Expected: FAIL because the deployment smoke does not exist.

- [ ] **Step 3: Implement an opt-in HTTPS-only smoke**

Require `MEOW_DEPLOYMENT_URL`; observe visible Todo capability degradation and browser console output without publishing or choosing a host.

- [ ] **Step 4: Run local checks and conditionally the remote smoke**

Run: `npm test && npm run verify && npm run smoke:web-deployment`
Expected: local gates pass; remote smoke either completes for an explicit URL or fails with its precise prerequisite.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-web-deployment.mjs tests/web-deployment-smoke.test.ts package.json docs/web.md
git commit -m "feat: add opt-in Web deployment smoke"
```

### Task 6: Mobile toolchain and device smoke (conditional, after Task 2)

**Files:**
- Create: `scripts/mobile-doctor.mjs`
- Create: `tests/mobile-doctor.test.ts`
- Modify: `package.json`
- Modify: `docs/mobile.md`

**Interfaces:**
- Consumes: caller machine Android/Xcode tooling and an explicitly selected device/simulator.
- Produces: non-secret prerequisite report; no generated native project or device test runs without a caller command.

- [ ] **Step 1: Write a failing test for platform-specific prerequisites**

```ts
assert.match(checkAndroidPrerequisites({ env: {} }).errors.join('\n'), /ANDROID_HOME/)
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --experimental-strip-types --test tests/mobile-doctor.test.ts`
Expected: FAIL because mobile doctor does not exist.

- [ ] **Step 3: Implement read-only prerequisite inspection**

Report only tool availability, Rust targets, and selected-device requirements; never print environment values or initialize mobile projects.

- [ ] **Step 4: Run focused and frontend checks**

Run: `npm test && npm run verify && npm run mobile:doctor`
Expected: local gates pass; mobile doctor reports available/missing prerequisites without claiming a device result.

- [ ] **Step 5: Commit**

```bash
git add scripts/mobile-doctor.mjs tests/mobile-doctor.test.ts package.json docs/mobile.md
git commit -m "feat: add mobile toolchain doctor"
```

## Self-review

- Spec coverage: Tasks 1-2 deliver the protocol goal and CI check; Tasks 3-6 sequence future release, Windows, Web, and mobile work by dependency and retain conditional evidence.
- Placeholder scan: each task names exact files, an observable failing test, verification commands, and commit scope.
- Type consistency: Task 1 alone defines `validateApplicationProtocol`; later tasks consume the command rather than duplicating protocol parsing.
