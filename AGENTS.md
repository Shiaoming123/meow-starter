# Working agreement

## Read before changing code

1. Read `README.md` or `README.en.md` for product scope and maturity labels.
2. Read `docs/README.md`, then the document for the area being changed.
3. Read the immediate callers, exports, tests, and configuration before editing.
4. For development and release checks, read `docs/development.md` and `docs/release-kit.md`.

## Boundaries

- This is a Tauri 2 + Vue 3 starter. Desktop is the primary target; Web and mobile responsive support have the maturity stated in the README.
- Keep modules behind the existing configuration, loader, runtime-capability, and Rust feature boundaries. Do not make optional modules load by default.
- Treat the WebView as untrusted for secrets. Never commit credentials, private keys, certificates, provisioning profiles, or `.env` values; never print them in logs, tests, documentation, or issues.
- Do not turn template updater endpoints or optional release secrets into a release claim. Signing, notarization, store submission, and hosted delivery require separate verified platform work.

## Changes and verification

- Keep changes small and preserve unrelated working-tree changes.
- Add or update focused tests for changed behavior. Run the applicable gates:

| Change | Required checks |
| --- | --- |
| TypeScript/Vue or scripts | `npm test`, `npm run typecheck`, `npm run build`, `npm run build:web` |
| Documentation | `npm run check:docs` |
| Release configuration | `npm run release:check` |
| Full frontend change | `npm run verify` |
| Rust/Tauri change | `npm run rust:verify` |

`npm run doctor` is the prerequisite diagnostic; it reports configuration and filesystem conditions without reading or displaying secret values.

## Definition of Done

A change is done when its intended behavior has focused test coverage, the relevant commands above pass, documentation and maturity claims match what was actually verified, and the diff contains no generated artifacts or secrets.
