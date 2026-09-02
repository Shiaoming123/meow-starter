<p align="center">
  <a href="./README.md">中文</a> · <strong>English</strong>
</p>

<h1 align="center">🐾 meow-starter</h1>

<p align="center">
  <strong>An AI-native, full-platform desktop & mobile scaffold</strong><br/>
  A ready-to-use <b>Tauri 2 + Vue 3</b> base covering <b>macOS / Windows / Linux / Android / iOS</b>.<br/>
  Bundles SQLite, system tray, auto-updater, a design system, and pluggable Agent / MCP / local-inference capabilities.
</p>

<p align="center">
  <a href="https://github.com/Shiaoming123/meow-starter/actions/workflows/ci.yml"><img src="https://github.com/Shiaoming123/meow-starter/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
  <a href="https://github.com/Shiaoming123/meow-starter/releases"><img src="https://img.shields.io/github/v/release/Shiaoming123/meow-starter" alt="Release"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/Shiaoming123/meow-starter" alt="License"/></a>
  <img src="https://img.shields.io/badge/Tauri-2-24C8D8?logo=tauri&logoColor=white" alt="Tauri 2"/>
  <img src="https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux%20%7C%20iOS%20%7C%20Android-blue" alt="Platforms"/>
</p>

<p align="center">
  <img src="docs/preview.png" alt="meow-starter desktop demo" width="640"/>
  &nbsp;&nbsp;&nbsp;
  <img src="docs/mobile-concept.png" alt="meow-starter mobile concept" width="280"/>
</p>

---

## What is this

`meow-starter` is a **modular, AI-native** desktop app scaffold. It handles the boilerplate that makes desktop development tedious — data layer, tray, updater, design system — while packaging AI capabilities (Agent, local inference, MCP) as **pluggable modules** you enable on demand.

**Core philosophy**: lightweight core, optional capabilities, on-demand inclusion. Write zero agent code and it's a clean desktop scaffold; flip a switch and it becomes an AI app.

## ✨ Features

- **Frontend**: Vue 3.5 + TypeScript + Vite 6, follows system dark mode
- **Data**: SQLite (`tauri-plugin-sql`) with auto-migration and type-safe CRUD
- **System**: tray, single-instance, close-to-tray instead of quit
- **Auto-update**: sign → download → install → relaunch, full pipeline
- **Design system**: complete design tokens + 6 base components + 4 themes
- **Modular**: three-layer gating (config + dynamic import + Cargo feature)
- **Agent**: Vercel AI SDK (default) + Pi RPC (advanced), behind an anti-corruption layer
- **Secret safety**: API keys in OS keychain, proxied through Rust, never in frontend
- **Local inference**: adapts Ollama, models run on-device
- **MCP**: connect external MCP servers, merge tools into the Agent
- **Engineering**: GitHub Actions 3-platform build matrix + CI gates
- **No Electron**: ~3–20 MB bundles vs ~300 MB

## 🗺 Start here (full-path guide)

| I want to… | Go to |
| --- | --- |
| 🚀 Get running | [Quick start](#-quick-start) → [Rename checklist](#-create-a-new-project) |
| 🎯 Check project fit | [docs/project-guide.md](./docs/project-guide.md) |
| 🏗 Understand architecture | [Architecture](#-architecture) + [modular-architecture.md](./docs/modular-architecture.md) |
| 🎨 Use design system/components | [docs/design-system.md](./docs/design-system.md) |
| 🤖 Integrate Agent | [docs/agent-integration.md](./docs/agent-integration.md) |
| 🔌 Use local models (Ollama) | [docs/local-inference.md](./docs/local-inference.md) |
| 🧩 Connect MCP tools | [docs/mcp.md](./docs/mcp.md) |
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

**Prerequisites**: Node.js 22+ / Rust 1.77.2+ / platform deps (see [Tauri docs](https://tauri.app/start/prerequisites/)).

## 🧩 Create a new project (rename checklist)

1. `name` in `package.json`
2. `name` and `[lib] name` in `src-tauri/Cargo.toml`
3. `productName` and `identifier` in `src-tauri/tauri.conf.json` (⚠️ identifier is immutable after release)
4. Your own icons in `src-tauri/icons/`
5. Regenerate the update signing key (`npm run tauri:signer`)

## 🧱 Modules

Each capability is a pluggable module, toggled in `src/modules/config.ts`:

| Module | Type | Default | Description |
| --- | --- | --- | --- |
| `core` | core | always | Design system + components + themes + icons |
| `sqlite` | core | on | SQLite data layer |
| `tray` | core | on | System tray |
| `updater` | core | on | Auto-update |
| `themes` | core | on | 4 themes |
| `agent` | optional | off | Agent runtime (`npm run add:agent`) |
| `mcp` | optional | off | MCP (`npm run add:mcp`) |
| `shortcut` | optional | off | Global shortcut |
| `clipboard` | optional | off | Clipboard |
| `notification` | optional | off | Notifications |
| `autostart` | optional | off | Auto-start on boot |

> Full design: [docs/modular-architecture.md](./docs/modular-architecture.md). Disabled modules = zero deps, zero size.

## 🏗 Architecture

![architecture](docs/architecture.svg)

The frontend (Vue 3) communicates with Rust via `invoke`/`listen`; the modular loader loads capabilities on demand; Agent secrets are proxied through Rust (keychain); external services include Ollama, cloud models, and MCP servers.

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
