# Module Compatibility Contract

## Goal

Make the existing platform boundary executable: a module that cannot run on the current runtime must not be dynamically imported, and a developer must be able to verify the relationship between a module's frontend declaration and its native build requirements.

## Scope

- Keep the current default modules, product UI, runtime capability names, and maturity labels unchanged.
- Introduce a small static module contract containing each module's identity, dependencies, supported runtime platforms, required runtime capabilities, and native build requirement.
- Have the module loader select contracts before it calls a dynamic loader, then reject a dynamically loaded module whose contract declaration differs.
- Provide a read-only module-contract audit that checks the checked-in Rust feature and Tauri permission declarations required by enabled optional native modules.
- Document the distinction between a frontend runtime switch and an application build configuration. The audit must report configuration gaps; it must not modify Cargo features or permissions.

## Non-goals

- Do not add plugins, cloud services, Agent providers, permissions, or platform release claims.
- Do not make the demonstration `App.vue` a fully configuration-driven product shell.
- Do not automatically synchronize TypeScript configuration with Cargo features. Cargo configuration is a build-time developer decision and must remain explicit.
- Do not claim that a Web build validates desktop packaging, mobile native projects, signing, or release delivery.

## Acceptance criteria

1. On a Web runtime, an enabled desktop-only module's dynamic loader is not invoked and its setup function cannot run.
2. The loader rejects a loaded module whose id, dependencies, platform list, or capability list does not match its static contract.
3. Tests assert the real module catalog is complete, has no incompatible dependency for the Web, desktop, or mobile runtime profiles, and has the expected native-build requirement metadata.
4. The audit identifies optional native modules whose Cargo feature or Tauri permission declaration is absent, without changing configuration files.
5. `npm test`, `npm run typecheck`, `npm run build`, `npm run build:web`, and `npm run check:docs` pass on this checkout.

## Verification boundary

The audit proves source-configuration consistency only. It is not proof of native plugin runtime behavior, signed builds, or device testing.
