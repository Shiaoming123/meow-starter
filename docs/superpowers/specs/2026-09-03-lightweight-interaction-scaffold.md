# Lightweight Interaction Scaffold Direction

## Product intent

`meow-starter` is a local-first, desktop-first interaction scaffold for people building personal applications with AI assistance. It should remove repeatable platform work while keeping downstream product decisions visible and reversible.

## Non-negotiable principles

- The default path remains credential-free, local-first, and useful without a cloud account.
- Desktop is the primary product target. Web stays a documented Beta fallback; mobile remains responsive code, not a release claim, until native device evidence exists.
- Optional capabilities stay behind configuration, runtime-capability, and native Cargo-feature boundaries. They do not become default dependencies or background network work.
- Capability claims must match evidence: release configuration is not a signed release, and Preview integrations are not product promises.
- The scaffold should give AI coding agents executable constraints, narrow recipes, deterministic checks, and small domain examples instead of a large built-in product surface.
- No credentials, private keys, user data, or cloud backends are introduced by default.

## Roadmap

### Phase 0 — trustworthy local baseline

Make `doctor`, test execution, and the release-kit tests work on Windows as well as the existing CI host. Add a Windows CI smoke job so command-resolution and test-fixture regressions are visible before merge.

### Phase 1 — compatibility and first-product guidance

Document three narrow product blueprints (local notebook, developer utility, local AI companion) and a shared selection process. Add a machine-readable compatibility contract only after the current module metadata cannot express a tested platform promise.

### Phase 2 — local data continuity and focused acceptance

Define an opt-in, versioned export/import boundary for application-owned data, then add a small Web persistence smoke and a Windows packaged-app start/exit smoke. The scaffold must not claim cloud sync, device sync, or native mobile packaging from these checks.

### Deferred work

Supabase synchronization, full multi-provider Agent settings, usage analytics, RAG, MCP host behavior, and mobile store delivery remain project-specific optional work. The existing Supabase/Agent plan is not a default-scaffold milestone.

## First-phase acceptance criteria

- On Windows, `npm run doctor` detects npm correctly and `npm test` is green without requiring Developer Mode.
- The Windows CI smoke runs `npm test` and `npm run doctor`.
- New developers can choose one blueprint and identify the exact files, safety boundaries, platform degradation, and verification commands before editing product code.
