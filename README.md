<p align="center">
  <strong>English</strong> · <a href="./README.zh-CN.md">中文</a>
</p>

<p align="center">
  <img src="./public/meow-mark.svg" alt="meow-starter cyan-to-teal cat paw and M mark" width="120"/>
</p>

<h1 align="center">meow-starter</h1>

<p align="center">
  <strong>An AI-native, desktop-first, Web-capable cross-platform app scaffold</strong><br/>
  An extensible <b>Tauri 2 + Vue 3</b> foundation: desktop is primary, with Beta-level Web and mobile adaptation.<br/>
  The stable core covers local data, tray integration, and a design system; sync, updater, Agent, MCP, and local inference are enabled according to maturity.
</p>

<p align="center">
  <a href="https://github.com/Shiaoming123/meow-starter/actions/workflows/ci.yml"><img src="https://github.com/Shiaoming123/meow-starter/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
  <a href="https://github.com/Shiaoming123/meow-starter/releases"><img src="https://img.shields.io/github/v/release/Shiaoming123/meow-starter" alt="Release"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/Shiaoming123/meow-starter" alt="License"/></a>
  <img src="https://img.shields.io/badge/Tauri-2-24C8D8?logo=tauri&logoColor=white" alt="Tauri 2"/>
  <img src="https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/platforms-Web%20%7C%20macOS%20%7C%20Windows%20%7C%20Linux%20%7C%20iOS%20%7C%20Android-blue" alt="Platforms"/>
</p>

<p align="center">
  <img src="docs/preview.png" alt="meow-starter desktop demo" width="640"/>
  &nbsp;&nbsp;&nbsp;
  <img src="docs/mobile-concept.png" alt="meow-starter mobile concept" width="280"/>
</p>

---

## What is this

`meow-starter` is a **modular, AI-native** cross-platform app scaffold. It takes care of the repetitive engineering behind desktop and multi-runtime products—data access, system tray behavior, updates, and a design system—while exposing Agent, local inference, and MCP capabilities as **pluggable modules** that can be enabled only when a product needs them.

**Core philosophy:** keep the core small, make capabilities optional, and add them on demand. Without any Agent code it remains a clean desktop scaffold. A Preview capability becomes a product feature only after the downstream project explicitly configures and verifies it.

## 🌱 Template ecosystem · Case study

### [Shixue · 拾学](https://github.com/Shiaoming123/shixue)

> Turn something you want to learn into a small step you can finish, prove, and revisit.

Shixue is a personal learning record assistant built from `meow-starter` and the first public reference application in this ecosystem. It demonstrates how the general scaffold can be shaped into a focused product without bypassing its data, module, security, or release boundaries.

| From scaffold to product | Shixue implementation |
| --- | --- |
| Domain and data | A capture → organize → schedule → focus → evidence-backed completion → review loop, with IndexedDB on Web and SQLite on desktop |
| UI / UX | An iOS-inspired warm-paper, deep-ink, and sage visual language with desktop drawers, mobile full-screen flows, bottom sheets, and responsive four-tab navigation |
| Windows delivery | Tauri-based x64 NSIS, localized MSI, and Portable EXE packaging, checksums, install-and-launch smoke checks, and an updater release path |

[Explore the Shixue source, screenshots, and setup guide →](https://github.com/Shiaoming123/shixue)

> Shixue v0.2.3 publishes Windows installers, a Portable EXE, updater metadata, and signed updater payloads. Its Windows binaries are not Authenticode-signed, so code-signing identity, SmartScreen reputation, and end-to-end upgrade validation remain separate work. Every downstream app must configure and protect its own updater endpoint and signing key.

### Web + five platform targets

| Platform | Status | Scope |
| --- | --- | --- |
| Web | Beta | Vite static build + IndexedDB persistence; native-only modules are skipped by runtime capability checks |
| macOS | Stable | Default desktop capabilities have automated gates; a real endpoint, signing, and notarization are still project-specific release work |
| Windows | Stable | Default desktop capabilities have automated gates; a local unsigned NSIS lifecycle smoke is available |
| Linux | Stable | Default desktop capabilities have automated gates; the Ubuntu release build template still requires downstream validation |
| iOS | Beta | Responsive behavior and desktop-capability fallback are implemented; continuous Xcode/device validation is not yet available |
| Android | Beta | Emulator `android dev` plus local debug APK/AAB builds have been verified; signing, real-device testing, and store delivery are not complete |

> Android has local debug evidence, but that is not evidence of signing, real-device behavior, store acceptance, or production update delivery. See [docs/delivery-path.md](./docs/delivery-path.md) for the full boundary and next steps.

## ✨ Features

- **Frontend:** Vue 3.5 + TypeScript 5.6 + Vite 8, with system-aware dark mode
- **Data layer:** one domain interface; SQLite on Tauri and IndexedDB on Web
- **System integration:** system tray, single-instance behavior, and close-to-tray instead of quit
- **Auto-update (Beta):** signing, download, install, and relaunch code paths; requires a downstream endpoint and signing keys before release validation
- **Design system:** complete design tokens, six base components, and four themes
- **Modularity:** four gates—configuration, dynamic import, runtime capability, and native Cargo feature
- **Sync foundation (Preview):** opt-in outbox engine, collection allowlist, and HTTP transport without vendor lock-in
- **Agent (Preview):** Vercel AI SDK inline adapter and extension interfaces; off by default
- **Secret safety (Preview):** stored keys cannot be read back by the WebView; OpenAI and Anthropic calls use a fixed-target Rust proxy
- **Local inference (Preview):** Ollama/OpenAI-compatible presets that require verification on the developer's machine
- **MCP (Preview):** HTTP/SSE client adapter; the complete Agent tool loop is still being verified
- **Engineering:** GitHub Actions CI gates plus a three-desktop-platform draft-release template that stays blocked until real updater and signing configuration is supplied
- **No Electron:** application bundles are typically around 3–20 MB instead of roughly 300 MB

## 🗺 Start here

**New to the project? Follow this path:**

| I want to… | Go to |
| --- | --- |
| 🚀 Run the project | [Quick start](#-quick-start) → [Rename checklist](#-create-a-new-project-rename-checklist) |
| 🛠 Configure local development / an exFAT workspace | [docs/development.md](./docs/development.md) |
| 🧭 Define product intent, capabilities, and data boundaries | [docs/application-protocol.md](./docs/application-protocol.md) |
| 📦 Understand the Release Kit and release boundary | [docs/release-kit.md](./docs/release-kit.md) |
| 🪟 Build a Portable EXE / choose an Authenticode path | [docs/windows-distribution.md](./docs/windows-distribution.md) |
| 🛤️ Move from a local scaffold to services and release | [docs/delivery-path.md](./docs/delivery-path.md) |
| 🎯 Decide whether the scaffold fits | [docs/project-guide.md](./docs/project-guide.md) |
| 🧭 Build a first application from the scaffold | [docs/blueprints/README.md](./docs/blueprints/README.md) |
| 🌱 Explore a real application built from the template | [Shixue · 拾学](https://github.com/Shiaoming123/shixue) |
| 🏗 Understand the architecture | [Architecture](#-architecture) + [modular architecture](./docs/modular-architecture.md) |
| 🎨 Use the design system and components | [docs/design-system.md](./docs/design-system.md) |
| 🤖 Integrate an Agent | [docs/agent-integration.md](./docs/agent-integration.md) |
| 🔌 Connect a local model such as Ollama | [docs/local-inference.md](./docs/local-inference.md) |
| 🧩 Connect MCP tools | [docs/mcp.md](./docs/mcp.md) |
| 🌐 Run or deploy the Web build | [docs/web.md](./docs/web.md) |
| 🔄 Add account, cloud, or LAN sync | [docs/sync.md](./docs/sync.md) |
| 📱 Adapt Android / iOS | [docs/mobile.md](./docs/mobile.md) |
| 🧠 Review the full AI capability roadmap | [docs/ai-capabilities.md](./docs/ai-capabilities.md) |
| 🤝 Contribute / ask questions | [CONTRIBUTING.md](./CONTRIBUTING.md) · [Discussions](https://github.com/Shiaoming123/meow-starter/discussions) |

**For AI agents:** this repository has explicit module boundaries and a routed documentation set. Read the relevant document before changing a feature.

## 🚀 Quick start

```bash
# Option 1: clone the repository
git clone https://github.com/Shiaoming123/meow-starter.git my-app
cd my-app && npm install && npm run tauri dev

# Option 2: use degit for a clean copy without Git history (recommended)
npx degit Shiaoming123/meow-starter my-app
cd my-app && npm install && npm run tauri dev
```

Web only:

```bash
npm run dev:web
```

**Prerequisites:** Node.js 22+, Rust 1.77.2+, and platform dependencies. macOS requires Xcode Command Line Tools, Windows requires MSVC and WebView2, and Linux requires webkit2gtk and related packages. See the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## 🧩 Create a new project (rename checklist)

Missing any of these items can break the build or collide with another application's identity:

1. `name` in `package.json`
2. `name` and `[lib] name` in `src-tauri/Cargo.toml` (`lib` name = underscored package name + `_lib`)
3. `productName` and `identifier` in `src-tauri/tauri.conf.json` (⚠️ treat the identifier as immutable after release)
4. Replace `public/meow-mark.svg`, then run `npm run tauri -- icon public/meow-mark.svg -o src-tauri/icons`
5. Regenerate the updater signing key with `npm run tauri:signer`
6. Replace `OWNER/REPO` in `plugins.updater.endpoints` with the downstream repository
7. Update repository, homepage, and author metadata in `package.json` and `src-tauri/Cargo.toml`
8. Replace UI branding, the tray tooltip, and the keychain namespace in `src-tauri/src/agent/secrets.rs`
9. Keep versions synchronized across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`

## 🧱 Modules

Each capability is a **pluggable module** controlled by `src/modules/config.ts`:

| Module | Type | Default | Description |
| --- | --- | --- | --- |
| `core` | core | always | Design system, components, themes, and icons |
| `storage` | core | always | Domain storage contract and safe in-memory fallback |
| `sqlite` | platform adapter | on | Tauri SQLite data layer; assembled only in native runtimes |
| `indexedDb` | platform adapter | on | IndexedDB persistence; assembled only in Web runtimes |
| `sync` | optional | off | Local-first contracts, outbox engine, and transport |
| `tray` | core | on | System tray integration |
| `updater` | core | on | Automatic update module |
| `themes` | core | on | Four visual themes |
| `agent` | optional | off | Agent runtime; requires `npm run add:agent` |
| `mcp` | optional | off | MCP integration; requires `npm run add:mcp` |
| `shortcut` | optional | off | Global shortcut capability (P1) |
| `clipboard` | optional | off | Clipboard capability (P1) |
| `notification` | optional | off | Notification capability (P1) |
| `autostart` | optional | off | Launch-at-login capability (P1) |

> See [docs/modular-architecture.md](./docs/modular-architecture.md) for the complete design. Disabled modules are not loaded by the default runtime path. Use the lockfile and actual build output—not this table—to assess dependency and bundle size.

### Executable compatibility contract

`src/modules/contract.ts` is the static catalog for module platforms, runtime capabilities, dependencies, and native build requirements. The assembler filters this catalog before dynamic import and rejects loaded modules whose declarations differ from their contract before setup begins.

Native build configuration is a separate plane: a frontend toggle never enables a Cargo feature or grants a Tauri permission. After changing default module configuration, validate the intended target:

```bash
npm run check:modules          # desktop target (default)
npm run check:modules -- web   # Web target
```

This validates checked-in configuration consistency only. It does not change Cargo features or permissions, and it is not evidence of plugin behavior, installable packages, signing, or device behavior.

### Maturity model

| Level | Meaning | Current capabilities |
| --- | --- | --- |
| Stable | Automated gates cover the default path | core, SQLite, themes, desktop tray/single-instance |
| Beta | The code path exists, but release-environment evidence is limited | Web IndexedDB, updater, responsive mobile adaptation, and desktop-feature fallback |
| Preview | Off by default; interfaces or safety boundaries may change | Sync, Agent, Ollama, MCP, and optional system plugins |
| Roadmap | Design or placeholder only | sidecar, RAG, speech, and OCR |

## 🏗 Architecture

![Architecture](docs/architecture.svg)

The Vue frontend communicates with the Rust runtime through `invoke` and `listen`. The module loader assembles enabled capabilities in dependency order. Agent, Ollama, cloud-provider, and MCP integrations live in the Preview extension layer and are not loaded on the default path.

### Web + five platform targets

![Cross-platform coverage](docs/cross-platform.png)

The same Vue codebase targets **Web / macOS / Windows / Linux / Android / iOS**. Desktop is the primary validation target. Web uses IndexedDB and skips native-only modules, while mobile uses responsive layouts and degrades desktop-specific capabilities.

## 📂 Project structure

```text
.
├── .github/               # CI gates and a three-desktop-platform release template
├── docs/                  # Documentation hub
│   ├── architecture.svg        # Architecture diagram
│   ├── development.md          # Local development, verification, and exFAT guidance
│   ├── release-kit.md          # Release Kit and release maturity boundaries
│   ├── windows-distribution.md # Windows Portable and Authenticode guidance
│   ├── design-system.md        # Tokens, components, themes, performance, accessibility
│   ├── project-guide.md        # Project fit and product-type guidance
│   ├── modular-architecture.md # Four module gates and the compatibility contract
│   ├── ai-capabilities.md      # AI-native capability roadmap
│   ├── agent-integration.md    # Agent integration and security architecture
│   ├── local-inference.md      # Ollama and local inference
│   ├── web.md                  # Web runtime, persistence, and deployment
│   ├── sync.md                 # Account, cloud, and LAN sync boundaries
│   └── mcp.md                  # MCP integration guide
├── src/
│   ├── assets/themes/     # Theme tokens and global styles
│   ├── components/        # Icon.vue and reusable UI components
│   ├── modules/           # Configuration, loader, and capability modules
│   ├── agent/             # Agent runtime, providers, tools, memory, hooks, and UI
│   ├── storage/           # Domain ports plus IndexedDB, SQLite, and memory adapters
│   ├── sync/              # SyncProvider, outbox, and HTTP transport
│   ├── lib/               # db.ts and updater.ts
│   └── App.vue            # Demonstration application
├── src-tauri/
│   ├── src/lib.rs         # Application assembly and feature gating
│   ├── src/tray.rs        # System tray behavior
│   ├── src/db.rs          # SQLite migrations
│   ├── src/agent/         # Native secret and provider proxy boundary
│   ├── capabilities/      # Tauri permission allowlist
│   └── tauri.conf.json    # Tauri application configuration
├── agent.config.ts        # Agent model, provider, and tool configuration
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE
```

## ⚙️ Core capabilities

### Local data layer (SQLite / IndexedDB)

The frontend accesses domain interfaces through `src/lib/db.ts`. Tauri SQLite migrations are defined in `src-tauri/src/db.rs` and run during startup; the Web runtime stores data in IndexedDB. See [docs/web.md](./docs/web.md).

> 📌 Each migration must contain **one SQL statement only** because the underlying sqlx `execute` call does not support multiple statements.

The Todo example also exposes an optional, versioned JSON data port. `await exportTodos()` emits application-domain data, while `await importTodos(json)` validates the complete payload before appending records and returning the imported count. It does not export database files, keys, Agent state, or sync state. Import does not overwrite existing data, and repeated imports intentionally create duplicate records. Product UI should request explicit user confirmation before import.

### System tray

`src-tauri/src/tray.rs` registers left-click window toggling and a right-click menu for showing or hiding the window, checking for updates, and exiting. Together with single-instance handling, reopening the app focuses the existing window.

### Automatic updates

`src/lib/updater.ts` wraps `check()` → `downloadAndInstall()` → `relaunch()`. Tauri verifies updater signatures. Configure a downstream application before its first release:

```bash
npm run tauri:signer
# Put the public key in plugins.updater.pubkey in tauri.conf.json
# Store the private key as the TAURI_SIGNING_PRIVATE_KEY GitHub secret
# Replace OWNER/REPO in plugins.updater.endpoints with the downstream repository
```

> 🔑 Losing the updater private key prevents future releases from updating existing installations. Back it up securely and never commit it.
>
> A template placeholder endpoint is treated as unconfigured at build time, so the application does not request an invalid update URL.

### Agent capability

The Agent module is off by default. To enable its dependencies:

```bash
npm run add:agent
# Set enabled: true in agent.config.ts, then configure providers and a default model
```

Cloud providers such as OpenAI and Anthropic, as well as local Ollama-compatible models, are supported by the extension layer. Cloud secrets are stored in the operating system keychain; the WebView can write, delete, and test whether a key exists but cannot read the plaintext value back. Rust injects secrets only for fixed official provider targets. See [docs/agent-integration.md](./docs/agent-integration.md) and [docs/local-inference.md](./docs/local-inference.md).

> ⚠️ **The cloud proxy uses an allowlist:** by default only `api.openai.com` and `api.anthropic.com` are allowed. Local Ollama or vLLM endpoints use the direct path. DeepSeek, Moonshot, Groq, and other OpenAI-compatible cloud services are rejected when configured with keychain-backed secrets until the allowlist is extended deliberately. See [docs/agent-integration.md §3.4.1](./docs/agent-integration.md).

### MCP integration

MCP is off by default. To add its dependencies:

```bash
npm run add:mcp
# Enable mcp in modules/config.ts and connect a server with connectMcpServer
```

See [docs/mcp.md](./docs/mcp.md).

## 🎨 Design system

The design system provides spacing, radius, typography, shadow, motion, and layer tokens; six base components; and four themes. Components consume CSS variables, so themes can change without rewriting component styles. See [docs/design-system.md](./docs/design-system.md).

## 🛠 Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the frontend development server |
| `npm run dev:web` | Start explicit Web development mode |
| `npm run build` | Type-check and build the frontend |
| `npm run build:web` | Type-check and create the Web static build |
| `npm run smoke:web-persistence` | Optional: add a Todo in a real browser and verify IndexedDB persistence after reload |
| `npm run smoke:windows-package` | Optional: build an unsigned NSIS package, install it in an isolated directory, and verify process liveness on Windows |
| `npm test` | Run behavior tests without an additional test framework |
| `npm run typecheck` | Run TypeScript/Vue type checking only |
| `npm run check:modules` | Validate module catalog, defaults, and native build requirements |
| `npm run check:protocol` | Validate the application protocol against modules, data ports, acceptance commands, and delivery boundaries |
| `npm run check:csp` | Validate the production Tauri CSP |
| `npm run check:layout` | Validate the mobile layout contract in the production CSS |
| `npm run check:docs` | Check relative Markdown links |
| `npm run tauri dev` | Run the desktop application with Rust hot reload |
| `npm run tauri build` | Package for the current platform |
| `npm run tauri:signer` | Generate an updater signing key pair |
| `npm run add:agent` | Install Agent dependencies |
| `npm run add:mcp` | Install MCP dependencies |

The two smoke commands are local acceptance checks and are not part of default CI or `npm run verify`. The Web smoke does not download a browser; it uses an installed Edge or Chrome and honors `MEOW_BROWSER_PATH` when automatic discovery fails. The Windows smoke temporarily disables updater artifacts, constrains installation and app data to `src-tauri/target/meow-windows-package-smoke-*`, terminates only the process it started, and removes only its validated temporary directory.

These checks do not prove code signing, hosted updater delivery, offline installation, graceful tray exit, store approval, or release readiness on any platform.

## 🛡 Security notes

- The production Tauri CSP permits same-origin resources and Tauri IPC only. Declare each required external source precisely; do not relax it with wildcards.
- Treat the application `identifier` as immutable after release.
- API keys belong in the operating system keychain, not source code or localStorage; stored keys have no plaintext read command.
- Sync uses a collection allowlist. API keys, tokens, cookies, MCP credentials, and local paths must never enter the generic sync layer.
- A new plugin requires coordinated changes to `Cargo.toml`, `lib.rs`, and `capabilities/default.json`.

## 🤝 Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md). Report security vulnerabilities through [SECURITY.md](./SECURITY.md).

- 🐛 Bugs and feature requests → [Issues](https://github.com/Shiaoming123/meow-starter/issues)
- 💬 Questions and ideas → [Discussions](https://github.com/Shiaoming123/meow-starter/discussions)
- ❤️ Support the project → [GitHub Sponsors](https://github.com/sponsors/Shiaoming123)

## 📄 License

[MIT](./LICENSE) © 2026 Shiaoming123

## 🙏 Acknowledgements

[Tauri](https://tauri.app) · [Vue.js](https://vuejs.org) · [Lucide](https://lucide.dev) · [Vercel AI SDK](https://ai-sdk.dev) · [Model Context Protocol](https://modelcontextprotocol.io)
