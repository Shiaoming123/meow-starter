# Secure Agent Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the existing default-off Agent skeleton into a conservative Preview vertical slice: configured providers are discoverable, cloud credentials never have a read-back command, cloud requests can only reach fixed provider origins through Rust, tool execution obeys a deterministic approval policy, and session memory participates in subsequent turns.

**Architecture:** Preserve `src/agent` and the public `loadAgent`/registry/runtime contracts. Local providers with `apiKeyRef.kind === 'none'` continue to use the provider SDK fetch path. Keychain-backed OpenAI/Anthropic providers use a custom AI SDK fetch adapter that sends body-only requests through a Rust command; Rust validates the provider origin, injects the key, disables redirects, and streams bytes back over a Tauri channel. No fallback may return a stored key to JavaScript. Approval and conversation assembly remain framework-independent pure functions so they can be verified with Node's built-in test runner.

**Tech Stack:** TypeScript 5.6, Vue 3.5, Vercel AI SDK 7, Tauri 2 IPC channels, Rust 2021, reqwest 0.12, keyring 4.

**Spec:** `docs/superpowers/specs/2026-09-02-meow-starter-hardening-design.md`

## Global constraints

- Keep Agent, MCP, and local inference at Preview maturity and disabled by default.
- Never expose a command that returns a stored secret to the WebView.
- Never accept an arbitrary proxy authentication header or redirect.
- Only `https://api.openai.com/v1/**` and `https://api.anthropic.com/v1/**` are valid keychain-backed cloud targets in this phase.
- OpenAI-compatible custom cloud endpoints with credentials are rejected until an explicit Rust-side allowlist mechanism exists.
- Local endpoints without credentials remain the extension path for Ollama/vLLM.
- Do not add dependencies.
- Each TypeScript behavior change starts with an observed failing test. Rust unit tests are added before Rust implementation; because Cargo is unavailable locally, compilation and execution are mandatory in the CI Rust job before this branch is considered merge-ready.

---

### Task 1: Configuration bootstrap and fail-fast model validation

**Files:**
- Create: `src/agent/bootstrap.ts`
- Create: `tests/agent-bootstrap.test.ts`
- Modify: `src/agent/index.ts`
- Modify: `src/agent/providers/registry.ts`

**Behavior:**
- `bootstrapProviders(config)` replaces stale registry state with `config.providers`.
- Duplicate provider IDs are rejected instead of silently overwritten.
- An enabled configuration must have a valid `provider/model` default whose provider exists.
- `loadAgent(config)` performs bootstrap before creating the runtime.

**Verification:** `npm test`, `npm run typecheck`, `npm run build`.

**Commit:** `fix: bootstrap configured agent providers`

---

### Task 2: Deterministic approval policy

**Files:**
- Create: `src/agent/tools/approval.ts`
- Create: `tests/agent-approval.test.ts`
- Modify: `src/agent/runtime/inline.ts`

**Behavior:**
- `decideToolApproval(config, name, args)` returns `allow`, `confirm`, or `deny`.
- First matching explicit rule wins; invalid regular expressions fail closed as `deny`.
- Without a matching rule, the config mode applies; a tool's own `needsApproval` upgrades `allow` to `confirm`.
- `deny` never calls the tool; `confirm` calls `HookBus.requestApproval`, whose no-handler default remains deny.

**Verification:** `npm test`, `npm run typecheck`, `npm run build`.

**Commit:** `feat: enforce agent tool approval policy`

---

### Task 3: Session memory in the inline conversation path

**Files:**
- Create: `src/agent/memory/conversation.ts`
- Create: `tests/agent-conversation.test.ts`
- Modify: `src/agent/runtime/inline.ts`
- Modify: `src/agent/ui/ChatPanel.vue`

**Behavior:**
- `conversationMessages(history, prompt, maxTurns)` selects the last bounded user/assistant turns and appends the new user message.
- A request with `sessionId` loads the configured memory backend, sends message history to the model, and persists the user/assistant turn after completion.
- Browser fallback remains process-lifetime memory; SQLite initialization happens only for the SQLite backend.
- ChatPanel reuses one session ID for all turns in the mounted panel.

**Verification:** `npm test`, `npm run typecheck`, `npm run build`.

**Commit:** `feat: connect agent turns to session memory`

---

### Task 4: Secret-safe TypeScript proxy transport

**Files:**
- Create: `src/agent/providers/proxy-policy.ts`
- Create: `src/agent/providers/secure-fetch.ts`
- Create: `tests/agent-proxy-policy.test.ts`
- Modify: `src/agent/providers/adapter.ts`
- Modify: `src/agent/providers/types.ts`

**Behavior:**
- Pure policy parsing accepts POST JSON requests only for the fixed OpenAI/Anthropic HTTPS origins and rejects credentials, non-default ports, malformed bodies, and oversized payloads.
- Keychain-backed providers require `secureProxy: true` and use the secure fetch adapter with a non-secret placeholder key.
- `secureProxy: false` with keychain credentials fails closed; it never reads a key into JavaScript.
- `apiKeyRef.kind === 'none'` remains direct for local providers.
- Tauri channel chunks become a `ReadableStream<Uint8Array>` response used by the AI SDK streaming path.

**Verification:** `npm test`, `npm run typecheck`, `npm run build`, and a distribution scan showing no `get_api_key` string in frontend output.

**Commit:** `feat: route cloud agent traffic through secure fetch`

---

### Task 5: Restrict the Rust proxy and remove secret read-back

**Files:**
- Modify: `src-tauri/src/agent/mod.rs`
- Modify: `src-tauri/src/agent/proxy.rs`
- Modify: `src-tauri/src/agent/secrets.rs`
- Modify: `src-tauri/src/lib.rs`

**Behavior:**
- Replace `get_api_key` with `has_api_key`; only set/delete/existence operations are exposed.
- `ProxyProvider` is a closed enum (`openai`, `anthropic`).
- The Rust proxy validates exact scheme, host, port, and `/v1` path before reading a secret.
- Rust, not JavaScript, selects the authentication header.
- Redirects are disabled, timeouts and request-body limits are enforced, and provider error bodies are not reflected to the WebView.
- Unit tests cover accepted and rejected URL/provider combinations and secret identifier validation.

**Verification:** GitHub CI must run `cargo fmt`, `cargo clippy --all-targets --all-features -D warnings`, and `cargo test --all-features`; local Cargo is unavailable and must be reported explicitly until CI evidence exists.

**Commit:** `security: restrict agent secret proxy boundary`

---

### Task 6: Documentation and CI evidence

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `agent.config.ts`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `docs/agent-integration.md`
- Modify: `docs/local-inference.md`
- Modify: `docs/mcp.md`

**Behavior:**
- Add `cargo test --manifest-path src-tauri/Cargo.toml --all-features` to CI.
- Explain the supported transport matrix: local/no-key direct; OpenAI/Anthropic/keychain via Rust; arbitrary credentialed endpoints unsupported.
- State that entering a secret in settings necessarily occurs in the WebView, but stored secrets cannot be read back and are absent from requests sent by frontend JavaScript.
- Keep Agent/MCP/Ollama labeled Preview until real provider and Ollama smoke tests exist.

**Verification:** full frontend suite, doc links, distribution scan, `git diff --check`, and clean worktree after commit.

**Commit:** `docs: define the secure agent preview contract`
