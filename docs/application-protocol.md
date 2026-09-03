# Application protocol

`app.protocol.json` is the lightweight, versioned product declaration for a
starter-derived application. Read it before changing a module, data boundary,
or delivery claim: it states what the application is trying to do, what it
explicitly does not do, its platform priorities, default capabilities, local
data boundary, fallback behaviour, acceptance commands, and compatibility
rules.

It is static metadata. It is not a runtime event bus, a plugin system, a
network manifest, or a replacement for platform configuration.

## Sources of truth

The protocol deliberately summarizes rather than replaces implementation facts:

| Concern | Source of truth | Protocol responsibility |
| --- | --- | --- |
| Enabled modules | `src/modules/config.ts` | Declare the matching product policy |
| Dependencies, platforms, capabilities, native requirements | `src/modules/contract.ts` | Point readers to the compatibility boundary |
| Runtime selection | `src/modules/loader.ts` and `src/lib/platform.ts` | State target and fallback expectations |
| Todo import/export | `src/storage/todos/data-port.ts` | State the public format/version and exclusions |
| Sync | `src/sync/` and `docs/sync.md` | State whether a provider is enabled by default |
| Release configuration | `scripts/release-check.mjs` and `docs/release-kit.md` | State evidence, never infer delivery proof |

`npm run check:protocol` reads the JSON and cross-checks the product name,
module policy, Todo data-port version, default local-first/sync boundary,
acceptance commands, maturity labels, and current delivery evidence. It does
not alter configuration, load modules, contact a network endpoint, or read
secrets.

## Evidence vocabulary

`delivery` distinguishes evidence from intent:

- `local-smoke`: an explicit local smoke command exists; it is not signing or
  distribution proof.
- `template-only`: code/configuration exists but an adopter must configure and
  verify their own delivery path.
- `unverified`: no platform delivery claim has been demonstrated here.

The current protocol intentionally says nothing stronger about signing, hosted
updates, deployed Web hosting, or mobile-native execution. Runtime maturity is
a separate statement: desktop is the primary stable runtime path; Web and
mobile are Beta adaptations with documented capability degradation.

## Changing an application safely

1. Change the implementation source of truth first: module contract/config,
   data-port, or release boundary.
2. Update `app.protocol.json` in the same change, including product goal,
   non-goal, platform fallback, or data/privacy boundary when applicable.
3. Add a focused behavioural test before implementation changes. Keep protocol
   checker tests fixture-based; do not test JSON text with grep.
4. Run the corresponding checks:

```bash
npm run check:protocol
npm run check:modules
npm run check:modules -- web
npm run check:modules -- mobile
npm run verify
```

Run `npm run rust:verify` for Rust/Tauri changes. Web and Windows smoke checks
remain opt-in local evidence; see [web.md](./web.md) and
[release-kit.md](./release-kit.md).

## Compatibility

Schema version `1` is intentionally small. Additive fields require a checker
change that explicitly understands the new schema version. Renaming or
removing a module, data format, or compatibility promise is breaking: keep the
old consumer boundary working where feasible or document a migration before
raising the schema version. A protocol update alone never enables a module,
Cargo feature, Tauri permission, sync provider, or release channel.
