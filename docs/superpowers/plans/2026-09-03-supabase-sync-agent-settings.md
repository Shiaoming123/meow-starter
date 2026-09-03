# Supabase Sync and Agent Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an optional, revision-safe Supabase sync path for account Agent preferences and a secure multi-provider Agent settings/usage experience.

**Architecture:** The local-first sync core owns durable outbox/checkpoint/conflict state and exposes a vendor-neutral HTTP contract. Supabase is one optional implementation of that contract. Provider configuration is a trusted endpoint/protocol catalog shared by TypeScript and Rust; only non-secret preference data can be synchronized, while credentials and raw usage remain device-local.

**Tech Stack:** Vue 3, TypeScript, Tauri 2/Rust, AI SDK, IndexedDB/SQLite, Supabase Auth/Postgres/RLS/Edge Functions.

**Spec:** `docs/superpowers/specs/2026-09-03-supabase-sync-agent-settings-design.md`

## Global Constraints

- `sync` and `agent` stay disabled by default and perform no network work at module setup.
- The local-only application needs no Supabase account, Docker, or environment value.
- Sync only `agent_preferences`; never synchronize credentials, credential references, keys, tokens, custom cloud URLs, local paths, prompts, completions, raw usage, or raw provider errors.
- A cloud provider is usable only if TypeScript and Rust both enforce its exact HTTPS host and protocol.
- A user-entered endpoint is permitted only for a local/no-key OpenAI-compatible profile.
- RLS applies to all exposed Supabase tables; public WebView code never contains a secret/service-role key.
- Offline tests, local Supabase integration, and real-provider smoke are separate evidence tiers.

---

### Task 1: Revision-aware sync contracts and conflict-safe engine

**Files:**
- Modify: `src/sync/types.ts`
- Modify: `src/sync/engine.ts`
- Modify: `src/sync/in-memory-store.ts`
- Modify: `src/sync/index.ts`
- Modify: `tests/sync-engine.test.ts`

**Interfaces:**
- Produces `PendingSyncMutation` with `baseRevision: string | null`, canonical `SyncMutation` with server `revision`, `SyncConflict`, and `SyncPushResult`.
- Extends `SyncStateStore` with `recordConflict`, `listConflicts`, and `hasAppliedOperation`/`markAppliedOperation`.
- `createOutboxSyncEngine()` accepts `applyRemote(change)` and returns `SyncResult` containing `conflicts`.

- [ ] **Step 1: Write failing contract tests**

Add tests showing that a push conflict is not acknowledged, its canonical remote
change is passed to `applyRemote`, and it remains in `listConflicts()`; add a
test that applying the same remote `operationId` twice invokes `applyRemote`
once. Use literal fixtures with `baseRevision: '1'` and canonical
`revision: '2'`.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/sync-engine.test.ts`

Expected: FAIL because the conflict result/state methods do not exist.

- [ ] **Step 3: Implement the minimal contracts and store**

Use the following public shapes:

```ts
export interface PendingSyncMutation extends Omit<SyncMutation, 'revision'> {
  baseRevision: string | null
}
export interface SyncConflict {
  operationId: string
  current: SyncMutation
}
export interface SyncPushResult {
  accepted: SyncMutation[]
  conflicts: SyncConflict[]
}
```

In the engine, acknowledge only `accepted.map(({ operationId }) => operationId)`;
for every conflict, call `applyRemote(conflict.current)` once and then
`recordConflict(conflict)`. Before applying any pulled operation, skip it if
`hasAppliedOperation(operationId)` is true; otherwise apply then mark it.
Advance the checkpoint only after all new remote changes and conflicts succeed.

- [ ] **Step 4: Verify GREEN and regressions**

Run:

```bash
node --experimental-strip-types --test tests/sync-engine.test.ts
npm test
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/sync tests/sync-engine.test.ts
git commit -m "feat: handle revision conflicts in sync engine"
```

### Task 2: Durable desktop and Web sync state

**Files:**
- Create: `src/sync/indexeddb-store.ts`
- Create: `src/sync/tauri-sqlite-store.ts`
- Modify: `src/sync/index.ts`
- Modify: `src-tauri/src/db.rs`
- Test: `tests/sync-state-store.test.ts`

**Interfaces:**
- Produces `createIndexedDbSyncStateStore(options?: { databaseName?: string })` and `createTauriSqliteSyncStateStore()` implementing the Task 1 `SyncStateStore`.
- Stores pending mutations, conflicts, checkpoints, and applied operation IDs locally only.

- [ ] **Step 1: Write failing persistence tests**

Create a behavior suite for the IndexedDB store that enqueues a mutation,
records a conflict, sets a checkpoint, marks an operation as applied, creates a
second store with the same database name, and asserts all four values persist.
Use `fake-indexeddb/auto` and delete the named database after the test.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/sync-state-store.test.ts`

Expected: FAIL because the persistent store module is missing.

- [ ] **Step 3: Implement storage adapters**

Create one IndexedDB object store per state category with explicit key paths:
`pending.operationId`, `conflicts.operationId`, `applied.operationId`, and
`metadata.key`. Store `checkpoint` at metadata key `checkpoint`; `acknowledge`
deletes only matching pending IDs. Add SQLite migrations one statement each for
`sync_outbox`, `sync_conflicts`, `sync_applied_operations`, and `sync_metadata`.
The Tauri implementation uses the existing lazy SQL plugin pattern and never
creates a cloud connection.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node --experimental-strip-types --test tests/sync-state-store.test.ts
npm test
npm run typecheck
npm run rust:verify
```

Expected: TypeScript gates pass; Rust output is reported separately if the host
toolchain cannot run it.

- [ ] **Step 5: Commit**

```bash
git add src/sync src-tauri/src/db.rs tests/sync-state-store.test.ts
git commit -m "feat: persist sync state locally"
```

### Task 3: Supabase schema and authenticated sync function

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/<cli-generated>_sync.sql`
- Create: `supabase/functions/sync/index.ts`
- Create: `supabase/functions/sync/deno.json`
- Test: `tests/supabase-sync-contract.test.ts`

**Interfaces:**
- Exposes `POST /functions/v1/sync/push` accepting `{ changes: PendingSyncMutation[] }` and returning `SyncPushResult`.
- Exposes `GET /functions/v1/sync/pull?checkpoint=<server-sequence>` returning canonical changes and next checkpoint.

- [ ] **Step 1: Discover and initialize the local CLI project**

Run `supabase --version` and `supabase --help`; if unavailable, run the
project-scoped `npx supabase --help`. Generate the migration with
`supabase migration new create_sync_backend` and create the function with
`supabase functions new sync`; do not hand-invent the migration filename.

- [ ] **Step 2: Write failing contract tests**

Create tests that validate function request/response JSON with three cases:
accepted first write (`baseRevision: null`), concurrent stale write returning a
conflict with current revision, and repeated `operationId` returning the first
canonical change without a duplicate log entry. Keep test helpers pure so they
can run without a hosted project.

- [ ] **Step 3: Verify RED**

Run: `node --experimental-strip-types --test tests/supabase-sync-contract.test.ts`

Expected: FAIL because the contract parser/function exports do not exist.

- [ ] **Step 4: Implement the migration and function**

Create owner-scoped `sync_records`, `sync_operations`, and `sync_change_log`
tables, required indexes, grants, RLS enabled, and explicit authenticated
ownership policies. Define one transaction/RPC that checks the user identity,
deduplicates `(owner_id, operation_id)`, performs compare-and-swap against
`base_revision`, writes the canonical record or tombstone, and appends a
server-sequenced log entry. Route `/push` and `/pull` in the one `sync`
function, require user JWT verification, use an RLS-scoped client, reject
unknown collections, and cap pull pages at 100 changes.

- [ ] **Step 5: Verify local integration and RLS**

With Docker and the CLI available, run `supabase start`, apply the migration,
then execute an integration script using two signed-in test users. Assert
cross-owner reads/writes fail, duplicate operations create one log row, one of
two same-base writes conflicts, and pull checkpoints are ordered. If Docker or
the CLI is unavailable, run the pure contract test and report the integration
tier as not run.

- [ ] **Step 6: Commit**

```bash
git add supabase tests/supabase-sync-contract.test.ts
git commit -m "feat: add Supabase sync backend"
```

### Task 4: Optional Supabase client and adoption guide

**Files:**
- Create: `src/sync/supabase/client.ts`
- Create: `src/sync/supabase/auth-storage.ts`
- Modify: `src/sync/index.ts`
- Modify: `docs/sync.md`
- Modify: `README.md`
- Test: `tests/supabase-client.test.ts`

**Interfaces:**
- Produces `createSupabaseSyncClient({ url, publishableKey, storage })` returning `getAccessToken()` and a preconfigured HTTP sync transport.
- Requires only a project URL and publishable key; it does not load unless the application explicitly enables sync.

- [ ] **Step 1: Write failing client tests**

Test that an absent session returns `undefined`, a supplied session returns its
short-lived access token, and client construction rejects non-HTTPS non-local
URLs. Inject a small Auth client facade rather than real credentials.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/supabase-client.test.ts`

Expected: FAIL because the optional Supabase client does not exist.

- [ ] **Step 3: Implement the optional client**

Install a pinned `@supabase/supabase-js` dependency and update the lockfile.
Create a minimal auth facade with explicitly supplied storage: the Web caller
uses browser local storage, and desktop integration supplies a secure storage
adapter. Configure HTTP transport base URL as `${url}/functions/v1/sync`, pass
only `getSession().data.session?.access_token`, and never accept arbitrary
authorization headers or a service-role key.

- [ ] **Step 4: Document all adoption paths**

Add a decision table and separate recipes for local-only, managed Supabase,
self-hosted Supabase, and bring-your-own compatible backend. State that the
CLI local stack is development-only, enumerate the only safe `VITE_` values,
include the user-visible enable/disable path, and distinguish offline, local
integration, and two-device deployed verification.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node --experimental-strip-types --test tests/supabase-client.test.ts
npm test
npm run typecheck
npm run build
npm run build:web
npm run check:docs
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/sync docs/sync.md README.md tests/supabase-client.test.ts
git commit -m "feat: add optional Supabase sync client"
```

### Task 5: Trusted provider protocol catalog and secure adapters

**Files:**
- Create: `src/agent/providers/catalog.ts`
- Modify: `src/agent/config.ts`
- Modify: `src/agent/providers/types.ts`
- Modify: `src/agent/providers/adapter.ts`
- Modify: `src/agent/providers/proxy-policy.ts`
- Modify: `src-tauri/src/agent/proxy.rs`
- Modify: `src-tauri/src/agent/secrets.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `tests/agent-provider-catalog.test.ts`
- Modify: `tests/agent-proxy-policy.test.ts`

**Interfaces:**
- Produces `ProviderProtocol`, `TrustedProviderDefinition`, `listTrustedProviders()`, and `getTrustedProvider(id)`.
- Supports fixed cloud catalog entries for OpenAI, Anthropic, Google, DeepSeek, Groq, Mistral, xAI, OpenRouter, Together AI, Fireworks AI, Perplexity, and Cerebras plus local/no-key OpenAI-compatible profiles.

- [ ] **Step 1: Write failing catalog/policy tests**

Assert every cloud catalog definition has an HTTPS hostname, declared protocol,
model-discovery route, and matching Rust proxy identifier. Assert an OpenAI
Chat Completions endpoint selects the OpenAI-compatible adapter while Anthropic
and Google select their protocol-specific adapters. Assert a key-backed
provider cannot replace its catalog endpoint and localhost/no-key profiles can.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/agent-provider-catalog.test.ts tests/agent-proxy-policy.test.ts`

Expected: FAIL because `ProviderProtocol` and trusted catalog exports are
missing.

- [ ] **Step 3: Implement catalog and adapters**

Represent each endpoint with `id`, `protocol`, `baseUrl`, `allowedHost`,
`credentialHeader`, and `modelsPath`. Use the OpenAI adapter for
`openai-responses` and `openai-chat-completions` only where the catalog says it
is compatible; add `@ai-sdk/google` for `google-generative-ai` and preserve
the Anthropic adapter. Generate proxy requests from the catalog rather than
from user-provided host strings. Extend Rust's closed enum and request builder
with exactly the same catalog provider IDs/host/header rules, HTTPS-only,
no redirects, no URL credentials, and method-aware GET model discovery.

- [ ] **Step 4: Verify GREEN and Rust policy tests**

Run:

```bash
node --experimental-strip-types --test tests/agent-provider-catalog.test.ts tests/agent-proxy-policy.test.ts
npm test
npm run typecheck
npm run rust:verify
```

Expected: all available gates pass; no test accepts a key-backed arbitrary host.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/agent src-tauri tests
git commit -m "feat: add trusted multi-provider catalog"
```

### Task 6: Agent preferences, local usage ledger, and settings UI

**Files:**
- Create: `src/agent/preferences/types.ts`
- Create: `src/agent/preferences/store.ts`
- Create: `src/agent/usage/types.ts`
- Create: `src/agent/usage/store.ts`
- Create: `src/agent/usage/summary.ts`
- Create: `src/agent/ui/AgentSettingsPanel.vue`
- Create: `src/agent/ui/UsagePanel.vue`
- Modify: `src/agent/runtime/inline.ts`
- Modify: `src/agent/ui/ChatPanel.vue`
- Modify: `src-tauri/src/db.rs`
- Test: `tests/agent-preferences.test.ts`
- Test: `tests/agent-usage.test.ts`

**Interfaces:**
- Produces a serializable `AgentPreferences` DTO containing provider ID, model slots, and non-secret fallback settings only.
- Produces `recordUsageEvent(event)` and `summarizeUsage(events, range)` with daily/monthly provider/model aggregates.

- [ ] **Step 1: Write failing preference and usage tests**

Assert preference serialization rejects `apiKeyRef`, `baseUrl`, `token`, and
unknown provider IDs. Feed two successful and one failed event into the summary
and assert total requests, success rate, nullable token total, and estimated
cost are grouped by provider/model/day without prompt text. Add a test that a
runtime finish event produces a sanitized usage record.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/agent-preferences.test.ts tests/agent-usage.test.ts`

Expected: FAIL because preferences and usage modules do not exist.

- [ ] **Step 3: Implement local data and runtime extraction**

Use a strict DTO parser that accepts catalog IDs and stable model IDs only. Add
one local SQLite migration per preferences/usage table and an IndexedDB/browser
fallback consistent with existing storage style. In `inline.ts`, time each
attempt, extract the AI SDK `finish` usage fields when present, map failures to
an error category, and persist only the specified metadata. Do not change the
request prompt, memory, tool approval, or streaming behavior.

- [ ] **Step 4: Implement minimal settings/usage panels**

Render a curated provider list with key-presence status, model discovery/manual
model ID fallback, default/fast/advanced slots, and a no-tool connection-test
button. Render today/month usage totals and label cost estimates as estimates.
Do not show credentials, raw request content, raw errors, or a cloud balance.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node --experimental-strip-types --test tests/agent-preferences.test.ts tests/agent-usage.test.ts
npm test
npm run typecheck
npm run build
npm run build:web
```

- [ ] **Step 6: Commit**

```bash
git add src/agent src-tauri/src/db.rs tests/agent-preferences.test.ts tests/agent-usage.test.ts
git commit -m "feat: add agent settings and usage ledger"
```

### Task 7: Explicit real-provider smoke and final documentation

**Files:**
- Create: `scripts/provider-smoke.mjs`
- Modify: `package.json`
- Modify: `docs/agent-integration.md`
- Modify: `docs/local-inference.md`
- Test: `tests/provider-smoke.test.ts`

**Interfaces:**
- Produces `npm run provider:smoke`; it exits with a distinct explicit skip
status/message unless `RUN_PROVIDER_SMOKE=1` and a target credential/runtime exists.

- [ ] **Step 1: Write failing smoke-gate tests**

Inject a fake runtime and assert the command refuses to call a provider without
`RUN_PROVIDER_SMOKE=1`, runs exactly one no-tool request when enabled, accepts
a terminal stream event, and redacts credential-like strings from failure
output.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test tests/provider-smoke.test.ts`

Expected: FAIL because the script and its gate are missing.

- [ ] **Step 3: Implement the gate and documentation**

Add a `provider:smoke` script that selects only configured OpenAI, Anthropic,
Google, or local Ollama profiles; it makes one minimal no-tool request and
records provider/model, terminal status, latency, and returned usage fields.
It must never print secrets, prompts, completions, raw headers, or raw error
bodies. Document prerequisite keychain/local runtime setup, explicit skip
semantics, and the distinction from policy/unit tests.

- [ ] **Step 4: Verify all feasible evidence tiers**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run build:web
npm run check:docs
npm run provider:smoke
```

Run `RUN_PROVIDER_SMOKE=1 npm run provider:smoke` only when an existing
credential or local Ollama runtime is available; report each selected provider
as passed, failed, or explicitly skipped.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/provider-smoke.mjs docs tests/provider-smoke.test.ts
git commit -m "test: add opt-in provider smoke"
```
