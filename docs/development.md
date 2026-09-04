# Development guide

Use this guide for a credential-free local checkout. Release accounts, signing keys, and platform certificates are not required for ordinary development.

## Normal setup

Install Node.js 22+, Rust 1.77.2+, and the platform prerequisites listed in the [Tauri documentation](https://tauri.app/start/prerequisites/). On Windows, this includes the Visual Studio C++ Build Tools and Microsoft Edge WebView2 Runtime. Then run:

```bash
npm ci
npm run doctor
npm run check:modules
npm run tauri dev
```

The development server uses the fixed port `1420`. SQLite is embedded through the Tauri plugin (`sqlite:app.db`), so ordinary local development does not require a separate database service or a `.env` file. Credentials and environment variables belong only to optional integrations that explicitly document them; leaving those integrations disabled must not block the core app.

For the Web-only app, use `npm run dev:web`. A successful browser render proves only the Web path, which uses browser capabilities and fallbacks; it does not prove that the native plugin, Cargo feature, or Tauri ACL is correct. Before sharing a frontend change, run `npm run verify`; it runs `test`, `check:protocol`, `check:csp`, desktop/Web/mobile `check:modules`, `typecheck`, `build`, `build:web`, `check:layout`, and `check:docs` in that order. Use `npm run release:check` to inspect versions, identifiers, bundle icons, updater configuration, and signing-related configuration in template mode.

`npm run doctor` reports the Node, npm, Rust, Cargo, and local Tauri CLI versions, the official Tauri platform-prerequisite guide, and the locations of `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. Missing tools include installation guidance. The command does not enumerate environment variables, secrets, or keychains.

## Native startup acceptance checklist

Treat module initialization as part of the native startup critical path. Storage adapters are selected before Vue mounts, but `src/main.ts` catches setup failures and mounts the shell from `finally`, so a rejected optional capability degrades visibly instead of leaving a blank WebView. Keep that fail-safe when customizing startup.

When enabling or changing a native module:

1. Match the commands the module actually invokes against explicit Tauri permissions. Do not assume an aggregate permission such as `plugin-name:default` grants every command—or any command. For example, code that calls the global-shortcut plugin's `register` and `unregister` commands needs `global-shortcut:allow-register` and `global-shortcut:allow-unregister` in the capability assigned to the main window. Add those permissions only when the Cargo feature is enabled: Tauri also rejects capability permissions for an optional plugin that is not compiled.
2. Keep all four declarations aligned: `src/modules/config.ts`, `src/modules/contract.ts`, the corresponding Cargo feature/plugin registration, and `src-tauri/capabilities/*.json`. Run `npm run check:modules` after each change.
3. Start the real desktop runtime with `npm run tauri dev`, keep its startup log visible, and exercise the native control that caused the permission request. A running process, an open window, a successful Web build, or browser rendering alone is not native UI evidence.
4. Accept the startup only when the Vue UI is visibly mounted and the Tauri log has no rejected module setup or `not allowed` ACL error. If the window is blank, inspect the first module/setup rejection before debugging CSS or packaging.

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
