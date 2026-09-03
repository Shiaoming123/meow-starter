# Application Protocol Specification

## Goal

Give a starter-derived application one small, checked-in protocol document that
both people and AI agents can read to understand its product intent, platform
targets, capability choices, data boundaries, degradation behaviour, release
evidence, and compatibility promises before changing code.

## Scope

- Add a JSON application protocol at the repository root. It is product
  metadata, not a runtime service and is never sent over the network.
- Keep the existing module configuration and module compatibility contract as
  the facts that determine enabled modules, dependency order, platform support,
  and native build requirements. The protocol declares the product-facing
  policy and a checker rejects drift from those facts.
- Validate schema version, product name, module policy coverage, declared data
  port format/version, acceptance commands, and release evidence boundaries.
- Document how an adopter changes the protocol together with an intentional
  module or data-boundary change.
- Add the protocol check to the normal frontend verification and CI path.

## Non-goals

- No event bus, plugin registry, runtime discovery mechanism, cloud account,
  remote manifest, or generated configuration.
- No automatic synchronization, online update delivery, signing, notarization,
  store submission, Web-host selection, mobile project generation, or device
  validation.
- No new default-enabled module and no change to the local-first Todo path.

## Protocol invariants

1. `app.protocol.json` is valid JSON and declares schema version `1`.
2. Its product name matches `package.json`.
3. Its module policy covers every `ModuleId` exactly once and agrees with
   `defaultModuleConfig`; module dependencies remain in `moduleContracts`.
4. The data-port declaration stays limited to the Todo format/version already
   implemented by `src/storage/todos/data-port.ts`; it never implies database,
   secret, Agent, sync-state, or full-backup export.
5. Every listed acceptance command is a real package script. Commands that
   require a platform/toolchain remain marked as conditional evidence.
6. Release boundaries state evidence rather than claiming unverified signing,
   hosted updates, stores, deployed Web hosts, or real devices.

## Acceptance criteria

1. A valid starter protocol passes `npm run check:protocol`.
2. A missing module policy entry, config mismatch, invalid data-port version,
   absent package command, or unsupported release-evidence state fails with a
   field-specific error.
3. Focused tests exercise the checker against in-memory fixtures, then
   `npm test`, `npm run verify`, `npm run check:modules`, and
   `npm run rust:verify` provide fresh evidence.
4. README and docs index link to a concise human guide without upgrading any
   maturity label.

## Evolution rules

- Additive fields may be introduced in a new schema version only after the
  checker understands both versions or explicitly rejects the old one with a
  migration note.
- Renaming/removing a module, data format, or declared compatibility promise is
  breaking: change its contract/port first, update the protocol in the same
  change, and document a consumer migration path.
- A capability may become default-enabled only when its module contract,
  platform boundary, data/privacy impact, and target-specific verification all
  change together.
