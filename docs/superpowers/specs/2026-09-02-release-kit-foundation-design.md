# Release Kit Foundation Design

**Status:** proposed

## Purpose

Make `meow-starter` safe for a new developer or agent to take over and ready
for later platform release work without claiming that unsigned builds, mobile
projects, or store uploads are production-ready.

This phase establishes a no-secret development and release-validation layer.
It does not publish artifacts, access credentials, initialize Android or iOS,
or change the existing desktop release workflow's signing behaviour.

## First principles

1. A default checkout must be diagnosable and verifiable without credentials.
2. A check must distinguish template configuration from release-ready
   configuration; it must not silently bless placeholders.
3. Platform providers remain optional adapters. GitHub Releases, App Store
   Connect, Google Play, and a Web host are not core runtime dependencies.
4. Documentation must describe demonstrated maturity, not intended capability.
5. Local filesystem quirks must fail clearly and be recoverable without
   modifying source files by hand.

## Observed baseline

- CI currently validates frontend tests, type checking, desktop and Web builds,
  documentation/layout checks, and Rust formatting, clippy, tests, and checks.
- `release.yml` builds draft desktop releases for macOS arm64/x64, Windows, and
  Linux; updater and macOS signing inputs are optional GitHub Secrets.
- Version `0.1.0` appears in `package.json`, `src-tauri/Cargo.toml`, and
  `src-tauri/tauri.conf.json`.
- The updater endpoint is intentionally a template (`OWNER/REPO`).
- On the current exFAT workspace, macOS emits AppleDouble `._*` files. They
  caused the Node test discovery to execute binary sidecars and caused Tauri to
  parse a sidecar as a capabilities JSON file. Removing the sidecars restored
  all 52 Node tests and the Rust build. Rust build output succeeds when its
  target directory is placed on an APFS cache path.

## Phase-one changes

### Agent and contributor guidance

Add root `AGENTS.md` and `docs/development.md`.

- State the project goal, supported maturity levels, required reading order,
  module/security boundaries, branch and verification expectations, and
  definition of done.
- Document the local exFAT condition, how `doctor` detects it, and the
  supported cache-target override. No user-specific cache path is committed.

### Release Kit documentation

Add `docs/release-kit.md`, link it from both README variants and the docs
index, and distinguish:

- local checks and unsigned package dry-runs;
- desktop build artifacts from signing, notarization, and updater signing;
- Android APK/AAB and iOS IPA/TestFlight as later stages requiring native
  toolchains, accounts, certificates, and hardware validation;
- Web deployment as a provider-neutral template to be added later.

### Commands

Add small Node scripts and package commands:

- `doctor`: report Node/npm/Rust/Cargo/Tauri prerequisites, configuration
  locations, and detectable filesystem warnings; never read or print secrets.
- `verify`: run the established frontend quality gates in their current order.
- `release:check`: inspect the three version sources, identifier, bundle icons,
  updater endpoint, and signing-related configuration. Template mode is a
  passing-but-explicit state; release mode rejects placeholders and invalid
  endpoints.
- `clean:appledouble`: remove only `._*` sidecars beneath the checkout. It is
  opt-in and is invoked by local verification/build wrappers only when the
  filesystem warning is present.

The test runner will ignore AppleDouble filenames even when a developer elects
not to clean them. Tauri-oriented commands will clean known sidecars before
Cargo sees `capabilities/` or generated configuration folders.

### CI and tests

- Add focused tests for the Release Kit parsers and AppleDouble-safe test-file
  discovery.
- Have the existing frontend CI job run `npm run release:check` after
  dependency installation. Keep the current CI and desktop release workflows
  intact otherwise.
- Add only generated folders and AppleDouble sidecars to `.gitignore`; do not
  ignore real configuration files or errors.

## Error handling

- Missing tools are reported by `doctor` with installation guidance and a
  non-zero status only when the requested verification actually needs them.
- `release:check` produces field-specific failures and never converts a
  placeholder updater endpoint into a real one.
- Cleanup never follows symlinks outside the checkout and never removes normal
  dotfiles; only basenames beginning with `._` are eligible.

## Verification

Run:

```bash
npm test
npm run doctor
npm run release:check
npm run verify
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-features
cargo check --manifest-path src-tauri/Cargo.toml --all-features
```

For an exFAT checkout, Rust verification preserves a caller-selected target
directory on a native filesystem. If no target directory is provided on macOS
exFAT, the wrapper may use the operating-system temporary directory only as a
fallback and must warn that its filesystem type has not been verified as
native. CI remains unchanged because its Linux filesystem does not create
AppleDouble sidecars.

## Deferred work

Workflow splitting, unsigned desktop-package dry-runs, Windows signing,
Android/iOS project initialization and CI, store uploads, and Web deployment
templates are separate phases. Each requires its own provider, credential, and
platform validation decision.
