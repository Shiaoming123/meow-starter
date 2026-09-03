# Runtime Smoke Acceptance Specification

## Goal

Add two explicit local smoke checks that make the starter's current Web and Windows desktop claims reproducible without turning either into a release, signing, or device-certification promise.

## Scope

### Web persistence smoke

- Add `npm run smoke:web-persistence`.
- The command builds the explicit Web variant, serves only `127.0.0.1`, and drives the visible Todo flow with `playwright-core` plus an already-installed local browser.
- It creates a uniquely named Todo, reloads, confirms persistence, confirms the desktop-only updater is absent, and fails on page/application console errors.
- `MEOW_BROWSER_PATH` overrides browser discovery. The command never downloads a browser.
- Unit tests cover browser path selection and deterministic URL/marker helpers. This remains outside `npm run verify`.

### Windows package lifecycle smoke

- Add `npm run smoke:windows-package`.
- The Windows-only command builds an unsigned NSIS installer with a transient Tauri config overlay that disables updater artifacts, installs beneath a unique repository-local `src-tauri/target/meow-windows-package-smoke-*` directory, redirects app data to that directory, verifies the installed process stays alive briefly, then stops it and removes only that directory.
- It rejects paths escaping the exact smoke root before cleanup.
- It makes no claim about signing, updater delivery, tray interaction, graceful exit, or a published release.
- Unit tests cover path containment and NSIS argument helpers. The full run remains outside `npm run verify`.

## Non-goals

- No product-facing data-port UI, cloud synchronization, native plugin, browser download, third-party service, signing, release upload, mobile validation, or committed generated artifact.

## Acceptance criteria

1. Both commands have focused automated tests for deterministic helpers.
2. The Web command either completes against an existing browser or provides a precise `MEOW_BROWSER_PATH` prerequisite error.
3. The Windows command uses only guarded D-workspace target paths and returns a real prerequisite/build failure rather than a false success.
4. README, Web, and release documentation distinguish smoke evidence from signing/publishing/device proof.
5. `npm run verify`, `npm run check:modules`, `npm run rust:verify`, and `git diff --check` pass; any Windows permission skip is explicitly reported.
