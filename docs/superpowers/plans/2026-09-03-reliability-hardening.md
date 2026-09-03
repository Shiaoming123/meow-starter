# Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the default development and delivery path while preserving local-first and optional capabilities.

**Architecture:** Dependency compatibility is resolved as one package group; quality checks stay thin script orchestration. CSP is a static Tauri policy. Persistent sync state is a concrete adapter of the existing `SyncStateStore` seam rather than a provider framework.

**Tech Stack:** npm, Vite/Vue, Node test runner, Tauri 2, IndexedDB, GitHub Actions, Android SDK.

**Spec:** `docs/superpowers/specs/2026-09-03-reliability-hardening.md`

## Global Constraints

- No force dependency resolution, third-party CSP host, sync provider, credential, signing, or iOS implementation.
- Every code behaviour begins with a focused failing test; configuration changes use their consuming command as evidence.

---

### Task 1: Resolve the Vite compatibility group

**Files:** `package.json`, `package-lock.json`, `tests/release-kit.test.ts`

- [x] Observe the current peer conflict with the existing Vite-only update, then keep the compatible group together.
- [x] Upgrade only `vite` to `^8.2.2`, `@vitejs/plugin-vue` to `^6.0.8`, and `vue-tsc` to `^3.3.11`; retain TypeScript 5.6.
- [x] Run `npm ci`, `npm run verify`, three `check:modules` profiles, and `npm run rust:verify`.
- [x] Commit the completed hardening changes together after final verification.

### Task 2: Close declared module gates

**Files:** `scripts/verify.mjs`, `.github/workflows/ci.yml`, `docs/development.md`

- [x] Add each desktop/Web/mobile module command to normal verification and frontend CI without duplicating implementation checks.
- [x] Run `npm run verify` and validate CI YAML by its current command paths.
- [x] Commit the completed hardening changes together after final verification.

### Task 3: Enforce production CSP

**Files:** `src-tauri/tauri.conf.json`, `tests/updater-config.test.ts`, `docs/development.md`

- [x] Write a failing CSP validator test that rejects null/wildcard and requires the Tauri IPC sources.
- [x] Add the minimal same-origin/IPC CSP and its focused documentation.
- [x] Run focused tests, `npm run verify`, `npm run rust:verify`, and a local Tauri build.
- [x] Commit the completed hardening changes together after final verification.

### Task 4: Persist the local sync outbox

**Files:** `src/sync/indexeddb-store.ts`, `src/sync/types.ts`, `src/sync/index.ts`, `tests/sync-engine.test.ts`, `docs/sync.md`

- [x] Write failing tests proving an adapter reopened with the same database preserves pending mutations/checkpoint and only acknowledges accepted IDs.
- [x] Implement the IndexedDB `SyncStateStore` adapter with transactions; keep sync disabled and provider-free.
- [x] Run focused sync tests, `npm run verify`, and Web persistence smoke when a browser is available.
- [x] Commit the completed hardening changes together after final verification.

### Task 5: Platform evidence and Android readiness

**Files:** `scripts/smoke-windows-package.mjs`, `tests/windows-package-smoke.test.ts`, `docs/release-kit.md`, Android user SDK environment

- [x] Run the existing Windows smoke and record its explicit unsigned-package outcome.
- [x] Install Android Studio/SDK command-line tooling, platform-tools, NDK, Rust Android targets; set non-secret user environment paths and verify `npm run mobile:doctor`.
- [x] Initialize an Android emulator and run `tauri android dev`; configure the Windows symbolic-link and JDK 21 prerequisites, then verify the installed app remains running. Do not modify iOS.
- [x] Keep SDK installation local-only and exclude generated Android files from the commit.
