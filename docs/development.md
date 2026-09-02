# Development guide

Use this guide for a credential-free local checkout. Release accounts, signing keys, and platform certificates are not required for ordinary development.

## Normal setup

Install Node.js 22+, Rust 1.77.2+, and the platform prerequisites listed in the [Tauri documentation](https://tauri.app/start/prerequisites/). Then run:

```bash
npm install
npm run doctor
npm run tauri dev
```

For the Web-only app, use `npm run dev:web`. Before sharing a frontend change, run `npm run verify`; it runs `test`, `typecheck`, `build`, `build:web`, `check:layout`, and `check:docs` in that order. Use `npm run release:check` to inspect versions, identifiers, bundle icons, updater configuration, and signing-related configuration in template mode.

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

`npm run rust:verify` cleans known AppleDouble sidecars before its Rust gates.

## Everyday command matrix

| Need | Command |
| --- | --- |
| Diagnose tools, configuration, and filesystem | `npm run doctor` |
| Run the Node test suite | `npm test` |
| Run all frontend quality gates | `npm run verify` |
| Check release configuration in template mode | `npm run release:check` |
| Remove only AppleDouble sidecars | `npm run clean:appledouble` |
| Run the desktop app | `npm run tauri dev` |

The exact commands live in `package.json`; keep documentation synchronized with them rather than inventing aliases.
