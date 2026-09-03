<p align="center">
  <a href="./README.md">中文</a> · <strong>English</strong>
</p>

<p align="center">
  <img src="./public/meow-mark.svg" alt="meow-starter cyan-to-teal cat paw and M mark" width="120"/>
</p>

<h1 align="center">meow-starter</h1>

<p align="center">
  <strong>An AI-native, desktop-first, Web-capable cross-platform scaffold</strong><br/>
  An extensible <b>Tauri 2 + Vue 3</b> base for desktop, with Beta Web and mobile adaptations.<br/>
  A stable local-data, tray, and design-system core with sync, updater, and AI capabilities enabled by maturity.
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

`meow-starter` is a **modular, AI-native** desktop app scaffold. It handles the boilerplate that makes desktop development tedious — data layer, tray, updater, design system — while packaging AI capabilities (Agent, local inference, MCP) as **pluggable modules** you enable on demand.

**Core philosophy**: lightweight core, optional capabilities, on-demand inclusion. Write zero agent code and it is a clean desktop scaffold; a Preview capability becomes product functionality only after explicit project configuration and verification.

## ✨ Features

- **Frontend**: Vue 3.5 + TypeScript + Vite 6, follows system dark mode
- **Data**: one domain interface with SQLite on Tauri and IndexedDB on Web
- **System**: tray, single-instance, close-to-tray instead of quit
- **Auto-update (Beta)**: sign, download, install, and relaunch code path; signed-release verification is project-specific
- **Design system**: complete design tokens + 6 base components + 4 themes
- **Modular**: config, lazy loading, runtime capabilities, and native Cargo features
- **Sync foundation (Preview)**: opt-in outbox engine, allowlist policy, and HTTP transport without vendor lock-in
- **Agent (Preview)**: Vercel AI SDK inline adapter and extension interfaces; off by default
- **Secret safety (Preview)**: stored keys cannot be read back by the WebView; OpenAI/Anthropic requests use a fixed-target Rust proxy (allowlist: `api.openai.com` / `api.anthropic.com` only — see [docs/agent-integration.md](./docs/agent-integration.md) to extend)
- **Local inference (Preview)**: Ollama/OpenAI-compatible presets requiring local environment verification
- **MCP (Preview)**: HTTP/SSE client adapter; the full Agent tool loop is still being verified
- **Engineering**: GitHub Actions 3-platform build matrix + CI gates
- **No Electron**: ~3–20 MB bundles vs ~300 MB

## 🗺 Start here (full-path guide)

| I want to… | Go to |
| --- | --- |
| 🚀 Get running | [Quick start](#-quick-start) → [Rename checklist](#-create-a-new-project) |
| 🛠 Set up local development / exFAT workspace | [docs/development.md](./docs/development.md) |
| 🧭 Define product intent, capabilities, and data boundaries | [docs/application-protocol.md](./docs/application-protocol.md) |
| 📦 Understand the Release Kit and release boundary | [docs/release-kit.md](./docs/release-kit.md) |
| 🎯 Check project fit | [docs/project-guide.md](./docs/project-guide.md) |
| 🧭 Build a first application from the scaffold | [docs/blueprints/README.md](./docs/blueprints/README.md) |
| 🏗 Understand architecture | [Architecture](#-architecture) + [modular-architecture.md](./docs/modular-architecture.md) |
| 🎨 Use design system/components | [docs/design-system.md](./docs/design-system.md) |
| 🤖 Integrate Agent | [docs/agent-integration.md](./docs/agent-integration.md) |
| 🔌 Use local models (Ollama) | [docs/local-inference.md](./docs/local-inference.md) |
| 🧩 Connect MCP tools | [docs/mcp.md](./docs/mcp.md) |
| 🌐 Run and deploy the Web app | [docs/web.md](./docs/web.md) |
| 🔄 Add account, cloud, or LAN sync | [docs/sync.md](./docs/sync.md) |
| 🧠 See AI capability roadmap | [docs/ai-capabilities.md](./docs/ai-capabilities.md) |
| 🤝 Contribute / feedback | [CONTRIBUTING.md](./CONTRIBUTING.md) · [Discussions](https://github.com/Shiaoming123/meow-starter/discussions) |

## 🚀 Quick start

```bash
# Option 1: clone
git clone https://github.com/Shiaoming123/meow-starter.git my-app
cd my-app && npm install && npm run tauri dev

# Option 2: degit (clean copy without git history, recommended)
npx degit Shiaoming123/meow-starter my-app
cd my-app && npm install && npm run tauri dev
```

Web only:

```bash
npm run dev:web
```

**Prerequisites**: Node.js 22+ / Rust 1.77.2+ / platform deps (see [Tauri docs](https://tauri.app/start/prerequisites/)).

## Runtime smoke checks

These opt-in commands provide local evidence and are not part of CI or `npm run verify`:

```bash
npm run smoke:web-persistence
npm run smoke:windows-package # Windows only
```

The Web command builds Web mode, uses an already installed Edge or Chrome to add a Todo and verify it after reload, and never downloads a browser. Set `MEOW_BROWSER_PATH` when automatic discovery cannot find the executable. The Windows command builds an unsigned NSIS installer with updater artifacts temporarily disabled, installs and redirects app data under `src-tauri/target/meow-windows-package-smoke-*`, then checks that its own child process stays alive briefly before cleanup.

Neither command proves signing, hosted updater delivery, offline installation, graceful tray exit, store acceptance, or release readiness.

## 🧩 Create a new project (rename checklist)

1. `name` in `package.json`
2. `name` and `[lib] name` in `src-tauri/Cargo.toml`
3. `productName` and `identifier` in `src-tauri/tauri.conf.json` (⚠️ identifier is immutable after release)
4. Replace `public/meow-mark.svg`, then run `npm run tauri -- icon public/meow-mark.svg -o src-tauri/icons` to generate your package icons
5. Regenerate the update signing key (`npm run tauri:signer`)
6. Replace `OWNER/REPO` in `plugins.updater.endpoints` with your repository
7. Update repository/homepage/author metadata in `package.json` and `src-tauri/Cargo.toml`
8. Replace UI branding, the tray tooltip, and the keychain namespace in `src-tauri/src/agent/secrets.rs`
9. Keep versions synchronized across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`

Template updater endpoints are treated as unconfigured at build time, so the app will not send a broken update request before this step is complete.

## 🧱 Modules

Each capability is a pluggable module, toggled in `src/modules/config.ts`:

| Module | Type | Default | Description |
| --- | --- | --- | --- |
| `core` | core | always | Design system + components + themes + icons |
| `storage` | core | always | Domain storage contract + memory fallback |
| `sqlite` | adapter | on | Tauri SQLite adapter; native runtimes only |
| `indexedDb` | adapter | on | IndexedDB persistence; Web only |
| `sync` | optional | off | Local-first contracts, outbox engine, and transports |
| `tray` | core | on | System tray |
| `updater` | core | on | Auto-update |
| `themes` | core | on | 4 themes |
| `agent` | optional | off | Agent runtime (`npm run add:agent`) |
| `mcp` | optional | off | MCP (`npm run add:mcp`) |
| `shortcut` | optional | off | Global shortcut |
| `clipboard` | optional | off | Clipboard |
| `notification` | optional | off | Notifications |
| `autostart` | optional | off | Auto-start on boot |

> Full design: [docs/modular-architecture.md](./docs/modular-architecture.md). Disabled modules are not loaded on the default runtime path; use the lockfile and build output to judge install and distribution size.

### Executable compatibility contract

`src/modules/contract.ts` is the static catalog for module platforms, runtime capabilities, dependencies, and native build requirements. The loader filters this catalog before dynamic import and rejects a loaded module whose declaration differs before setup begins.

Native build configuration is a separate plane: a frontend toggle never enables a Cargo feature or grants a Tauri permission. After changing the default module configuration, run the check for the intended target:

```bash
npm run check:modules          # desktop target (default)
npm run check:modules -- web   # Web target
```

This check proves checked-in configuration consistency only. It does not change Cargo or permissions, or prove plugin behavior, packages, signing, or device behavior.

### Versioned local data port

The Todo example exposes an opt-in JSON boundary through `await exportTodos()` and `await importTodos(json)`. It exports only application-owned Todo fields, validates the whole payload before writes, and appends rather than overwrites local data. It does not export database files, keys, Agent state, or sync state; product UI must ask for explicit confirmation before import, and repeated imports intentionally create duplicates.

### Maturity model

| Level | Meaning | Current capabilities |
| --- | --- | --- |
| Stable | Automated gates cover the default path | core, SQLite, themes, desktop tray/single-instance |
| Beta | Code path exists; release-environment evidence is limited | Web IndexedDB, updater, responsive mobile adaptation and desktop-feature fallback |
| Preview | Off by default; interfaces or safety boundaries may change | Sync, Agent, Ollama, MCP, optional system plugins |
| Roadmap | Design or placeholder only | sidecar, RAG, speech, OCR |

## 🏗 Architecture

![architecture](docs/architecture.svg)

The Vue frontend communicates with Rust via `invoke`/`listen`, while the module loader assembles enabled capabilities in dependency order. Agent, Ollama, cloud-provider, and MCP integrations live in the Preview extension layer and are not loaded on the default path.

## 📂 Project structure

```
.
├── .github/               # CI (ci.yml gates + release.yml 3-platform build)
├── docs/                  # 📚 Documentation hub (see table above)
├── src/
│   ├── assets/themes/     # theme tokens + global styles
│   ├── components/        # Icon.vue + ui/ (Button/Card/Input/Badge/Progress/EmptyState)
│   ├── modules/           # ★ modular: config (toggles) + loader + capability modules
│   ├── agent/             # Agent (runtime/providers/tools/memory/hooks/ui)
│   ├── storage/           # domain ports + IndexedDB/SQLite/memory adapters
│   ├── sync/              # SyncProvider + outbox + HTTP transport
│   ├── lib/               # db.ts / updater.ts
│   └── App.vue            # demo page
├── src-tauri/
│   ├── src/lib.rs         # app assembly (core + feature gating)
│   ├── src/tray.rs        # tray
│   ├── src/db.rs          # SQLite migrations
│   ├── src/agent/         # secret proxy (secrets.rs + proxy.rs)
│   ├── capabilities/      # permission whitelist
│   └── tauri.conf.json    # app config
├── agent.config.ts        # Agent config (model/provider/tools)
└── ...
```

## 🤝 Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md). Security issues via [SECURITY.md](./SECURITY.md).

- 🐛 Bugs → [Issues](https://github.com/Shiaoming123/meow-starter/issues)
- 💬 Q&A → [Discussions](https://github.com/Shiaoming123/meow-starter/discussions)
- ❤️ Support → [GitHub Sponsors](https://github.com/sponsors/Shiaoming123)

## 📄 License

[MIT](./LICENSE) © 2026 Shiaoming123
