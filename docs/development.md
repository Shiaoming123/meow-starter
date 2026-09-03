# Development guide

Use this guide for a credential-free local checkout. Release accounts, signing keys, and platform certificates are not required for ordinary development.

## Normal setup

Install Node.js 22+, Rust 1.77.2+, and the platform prerequisites listed in the [Tauri documentation](https://tauri.app/start/prerequisites/). Then run:

```bash
npm install
npm run doctor
npm run tauri dev
```

For the Web-only app, use `npm run dev:web`. Before sharing a frontend change, run `npm run verify`; it runs `test`, `check:protocol`, `check:csp`, desktop/Web/mobile `check:modules`, `typecheck`, `build`, `build:web`, `check:layout`, and `check:docs` in that order. Use `npm run release:check` to inspect versions, identifiers, bundle icons, updater configuration, and signing-related configuration in template mode.

`npm run doctor` reports the Node, npm, Rust, Cargo, and local Tauri CLI versions, the official Tauri platform-prerequisite guide, and the locations of `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. Missing tools include installation guidance. The command does not enumerate environment variables, secrets, or keychains.

## exFAT checkouts on macOS

macOS can create AppleDouble sidecars (`._*`) on exFAT volumes. Those sidecars can be mistaken for test files or Tauri capability/configuration files. Run `npm run doctor` after setup and whenever a tool behaves unexpectedly: it warns when it detects this filesystem condition.

The supported cleanup is intentionally narrow:

```bash
npm run clean:appledouble
```

It removes only regular `._*` files under this checkout and does not follow symlinks. Do not delete ordinary dotfiles or configuration files to address this warning.

Rust output should be placed on a native filesystem when the checkout is on exFAT. Choose a local APFS path that is appropriate for your machine; do not commit it:

```bash
CARGO_TARGET_DIR=/absolute/path/on/apfs npm run rust:verify
```

`npm run rust:verify` preserves a caller-provided `CARGO_TARGET_DIR` and cleans known AppleDouble sidecars before its Rust gates. On macOS exFAT only, when no target directory is provided, it uses the operating-system temporary directory as a fallback and warns that the fallback filesystem has not been verified as native. A caller-selected APFS path remains the supported choice for reliable Rust builds.

## Everyday command matrix

| Need | Command |
| --- | --- |
| Diagnose tools, configuration, and filesystem | `npm run doctor` |
| Run the Node test suite | `npm test` |
| Check the product-level application protocol | `npm run check:protocol` |
| Check the production Tauri content-security policy | `npm run check:csp` |
| Verify an existing Android debug APK's identity and ABI metadata | `npm run check:android-artifact -- --apk <path-to-apk>` |
| Check desktop, Web, or mobile module compatibility | `npm run check:modules [-- web|mobile]` |
| Run all frontend quality gates | `npm run verify` |
| Check release configuration in template mode | `npm run release:check` |
| Remove only AppleDouble sidecars | `npm run clean:appledouble` |
| Run the desktop app | `npm run tauri dev` |

The exact commands live in `package.json`; keep documentation synchronized with them rather than inventing aliases.
