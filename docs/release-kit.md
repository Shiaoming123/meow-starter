# Release Kit

## Current boundary

The Release Kit makes a checkout diagnosable and validates release configuration. It does not publish an artifact, obtain credentials, sign a binary, notarize an app, submit to a store, initialize mobile projects, or deploy a Web host.

| Stage | Current maturity | What is available now | Still required |
| --- | --- | --- | --- |
| Local checks | Available | `npm run doctor`, `npm run verify`, and `npm run release:check` | Project-specific platform validation |
| Desktop build/package | Local Windows smoke available, not release proof | The existing release workflow has macOS arm64/x64, Windows, and Linux draft-release build jobs; Windows can locally build an unsigned NSIS installer, install it beneath the ignored target tree, and check short process liveness | Run and inspect a real build for every target and installer format; signing and distribution remain separate |
| Desktop code signing | Deferred | Tauri updater signing inputs are wired; Authenticode options are documented separately | Certificate ownership, Authenticode integration, secret provisioning, signed-artifact verification |
| macOS notarization | Deferred | Workflow accepts optional Apple signing/notarization inputs | Apple account, certificates, notarization submission, and installed-artifact validation |
| Updater signing/delivery | Template only | Updater code and signing configuration are present | A real HTTPS endpoint, public key, private-key signing, hosted artifacts, and update-path validation |
| Windows/Linux distribution | Windows portable path available | Windows builds can stage a stable-name Portable EXE with SHA-256 proof and verify its GitHub Release asset | Authenticode, clean-device validation, and Linux distribution decisions |
| Android package | Local debug evidence | Android emulator `tauri android dev` and local universal debug APK/AAB build have completed | Recreate the ignored generated project on a clean checkout; real-device smoke, signing, Play Console, and store submission |
| iOS package and store | Deferred | Responsive UI and desktop-capability degradation only | Native project initialization, Xcode/CocoaPods, accounts, certificates, device testing, and store submission |
| Web deployment | Deferred | `npm run build:web` creates a static build | Select/configure a provider and validate a deployed site |

An unsigned desktop artifact is not evidence of a signed, notarized, store-ready, or auto-updatable release. Likewise, a responsive mobile interface is not an APK, AAB, IPA, TestFlight build, or store submission.

`src-tauri/gen/` is intentionally ignored. The Android Gradle project and its
debug APK/AAB are local build outputs, so a clean checkout must regenerate it
with `npm run tauri -- android init --ci` before rebuilding. The verified local
debug artifacts do not carry an upload keystore or prove Google Play acceptance.
After a debug build, run `npm run check:android-artifact -- --apk <path>` to
check its package identity, version, SDK metadata, and included ABI list. The
manual `android-debug` workflow runs the same check and uploads its debug APK;
it deliberately does not sign or publish anything. Its clean-runner path has
been executed successfully once for the current Android debug baseline.

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

Tag releases run that strict mode before `tauri-action` starts. They also run:

```bash
npm run release:provenance
```

The command emits a non-secret JSON record containing the checked package
version, source commit, clean-tree status, and (for a tag build) tag name. It
fails if Git cannot resolve the commit, the source tree has changes, or a tag
does not equal `v<package version>`. This is reproducibility provenance for the
source input; it does not prove byte-for-byte reproducible binaries, signing,
notarization, hosted updater availability, or a successful user installation.

## Optional local runtime smoke

On Windows, `npm run smoke:windows-package` performs an explicit local package lifecycle check: it builds an unsigned NSIS installer with a transient `bundle.createUpdaterArtifacts=false` overlay, silently installs beneath a fresh ignored target subdirectory, redirects `APPDATA` and `LOCALAPPDATA` there, confirms the installed process remains alive briefly, then force-stops that child process and removes only the validated temporary directory.

The command leaves the generated NSIS bundle under the ignored Tauri target directory and does not need a signing private key. It is deliberately not a signed release, updater-delivery, offline-installation, tray graceful-exit, store, or macOS/Linux package test.

## Windows single-file delivery

For downstream product acceptance, “runs locally” means a non-developer can double-click a verified installer or Portable EXE; `tauri dev`, a browser render, or a successful compile is not that evidence. Apply the product-wide checklist in [application-standard.md](./application-standard.md) before release preparation.

`npm run package:windows` builds an unsigned NSIS installer, MSI installer, and
single-file Portable EXE into `release-artifacts/windows/<version>/`, together
with a manifest and SHA-256 checksums. `npm run package:windows:audit` rechecks
the existing kit without rebuilding it. The release workflow stages the raw
Windows executable under a stable ASCII name in the separate
`release-artifacts/github-release/windows/<version>/` tree, uploads it and its
checksum to the draft GitHub Release, then fails if the uploaded bytes or
checksum content differ from the staged artifact.

Portable means no installation step; it does not make application data live
beside the EXE, and it does not bundle WebView2. Authenticode is also distinct
from Tauri updater signing. See [windows-distribution.md](./windows-distribution.md)
for the fast personal-developer path, release prevention checklist,
symptom-based repair sequence, and certificate options.

## Credentials and handoff

Never commit or print private signing keys, certificates, passwords, Apple credentials, or provider tokens. Store them in the platform's secret manager, record only the owning team and setup procedure in private operational documentation, and verify release artifacts in the target platform after the authorized release process runs.
