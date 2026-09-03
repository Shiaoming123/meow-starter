# Reliability Hardening Specification

## Goal

Make the default checkout stricter and more reproducible without changing its
local-first product path: resolve the actionable dependency conflict, run all
declared module checks in normal gates, replace the null production CSP, make
sync outbox state persistent behind its existing seam, and make Windows/Android
evidence explicit.

## Constraints

- Upgrade only the coherent Vite 8 / Vue plugin 6 / vue-tsc 3 group; retain
  TypeScript 5.6 because its independent major upgrade is not validated.
- CSP permits only current same-origin assets and Tauri IPC. It must not add
  wildcards, `unsafe-eval`, third-party hosts, or future Agent/sync allowances.
- Sync stays disabled by default and receives no provider, cloud account, or
  conflict UI. Persistence is an adapter behind `SyncStateStore`.
- Android setup may install public SDK tooling and configure user environment
  variables, but must not expose credentials or claim device validation until
  an actual `tauri android dev` run succeeds. iOS remains deferred.

## Acceptance

1. `npm ci` resolves the upgraded dependency group without force flags.
2. `verify` and CI run module checks for desktop, Web, and mobile.
3. Production Tauri CSP has the minimum IPC/same-origin policy and is tested.
4. Sync state survives adapter recreation and preserves pending mutations and
   checkpoint semantics under tests.
5. Windows smoke reports an explicit prerequisite/permission outcome; Android
   doctor reaches a toolchain-ready state before any device smoke is attempted.
