# Release Kit

## Current boundary

The Release Kit makes a checkout diagnosable and validates release configuration. It does not publish an artifact, obtain credentials, sign a binary, notarize an app, submit to a store, initialize mobile projects, or deploy a Web host.

| Stage | Current maturity | What is available now | Still required |
| --- | --- | --- | --- |
| Local checks | Available | `npm run doctor`, `npm run verify`, and `npm run release:check` | Project-specific platform validation |
| Desktop build/package | Local Windows smoke available, not release proof | The existing release workflow has macOS arm64/x64, Windows, and Linux draft-release build jobs; Windows can locally build an unsigned NSIS installer, install it beneath the ignored target tree, and check short process liveness | Run and inspect a real build for every target and installer format; signing and distribution remain separate |
| Desktop code signing | Deferred | Workflow accepts optional signing inputs | Certificate ownership, secret provisioning, signed-artifact verification |
| macOS notarization | Deferred | Workflow accepts optional Apple signing/notarization inputs | Apple account, certificates, notarization submission, and installed-artifact validation |
| Updater signing/delivery | Template only | Updater code and signing configuration are present | A real HTTPS endpoint, public key, private-key signing, hosted artifacts, and update-path validation |
| Windows/Linux distribution | Deferred | Desktop build jobs exist | Distributor/signing decisions and installation validation |
| Android/iOS package and store | Deferred | Responsive UI and desktop-capability degradation only | Native project initialization, toolchains, accounts, certificates, device testing, and store submission |
| Web deployment | Deferred | `npm run build:web` creates a static build | Select/configure a provider and validate a deployed site |

An unsigned desktop artifact is not evidence of a signed, notarized, store-ready, or auto-updatable release. Likewise, a responsive mobile interface is not an APK, AAB, IPA, TestFlight build, or store submission.

## Local release preparation

Run these before proposing a release configuration change:

```bash
npm run doctor
npm run release:check
npm run verify
```

`npm run release:check` defaults to template mode. In that mode, the starter's `OWNER/REPO` updater endpoint and incomplete updater-signing preparation are reported explicitly as warnings rather than accepted as release-ready. The check inspects the non-secret `plugins.updater.pubkey` and `bundle.createUpdaterArtifacts` fields; it never reads a private signing key or secret. When a project has supplied a real endpoint and signing configuration, use the stricter check:

```bash
npm run release:check -- --mode=release
```

Keep `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` versions aligned. A valid identifier, bundle icons, and HTTPS updater endpoint are configuration checks, not a substitute for a signed end-to-end release.

Only `template` and `release` are valid mode values. Unknown values fail instead of falling back to template mode.

## Optional local runtime smoke

On Windows, `npm run smoke:windows-package` performs an explicit local package lifecycle check: it builds an unsigned NSIS installer with a transient `bundle.createUpdaterArtifacts=false` overlay, silently installs beneath a fresh `src-tauri/target/meow-windows-package-smoke-*` directory, redirects `APPDATA` and `LOCALAPPDATA` there, confirms the installed process remains alive briefly, then force-stops that child process and removes only the validated temporary directory.

The command leaves the generated NSIS bundle under the ignored Tauri target directory and does not need a signing private key. It is deliberately not a signed release, updater-delivery, offline-installation, tray graceful-exit, store, or macOS/Linux package test.

## Credentials and handoff

Never commit or print private signing keys, certificates, passwords, Apple credentials, or provider tokens. Store them in the platform's secret manager, record only the owning team and setup procedure in private operational documentation, and verify release artifacts in the target platform after the authorized release process runs.
