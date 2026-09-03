# Supabase Sync and Agent Settings Design

## Goal

Make account-level Agent preferences the first production sync domain, add a
real Supabase-backed sync service with optimistic concurrency, and make the
Preview Agent configuration useful without weakening the existing key boundary.

## Scope and delivery order

The work is deliberately split into independently usable increments:

1. A revision-aware, persistent local sync core.
2. Supabase schema and authenticated Edge Function implementing that contract.
3. Safe Agent profile/model settings, local usage aggregation, and opt-in
   provider smoke tests.

The first synchronized collection is `agent_preferences`. It contains selected
provider/model slots, declared model capabilities, and non-secret fallback
preferences. It never contains API keys, refresh/session tokens, credential
references, custom cloud endpoints, local paths, prompts, responses, raw usage
events, or error bodies. Existing Todo data remains local-only because its
current schema does not have globally stable IDs, owners, tombstones, or
revisions.

## Sync contract

Outbound mutations use `baseRevision: string | null`: the server revision the
client observed before writing. A new record uses `null`. Canonical remote
mutations use a server-issued monotonically increasing `revision`. These values
must not share a field or be derived from wall-clock time.

`SyncTransport.push()` returns accepted canonical changes and explicit
conflicts. A conflict contains the pending `operationId` and the current
canonical remote mutation. The engine acknowledges only accepted operations.
It records conflicts durably, applies the canonical remote state, and leaves
the local operation available for an explicit resolver decision. The default
resolver is fail-closed: it never silently overwrites a concurrent remote
value. A resolver may accept remote state, discard the local operation, or
generate a new operation with a fresh ID and `baseRevision` equal to the
canonical revision.

The state store persists pending operations, conflicts, checkpoint, and applied
remote operation IDs. Remote application is idempotent by operation ID. The
engine advances the pull checkpoint only after every remote application and
conflict-record operation succeeds.

## Supabase backend

The repository includes a versioned Supabase project configuration, migration,
and one `sync` Edge Function. The function is invoked below
`/functions/v1/sync/{push,pull}` and requires a user JWT. It uses the caller's
RLS-scoped database client; `service_role` and secret keys are never sent to or
embedded in the WebView.

The migration creates three owner-scoped tables:

- `sync_records`: canonical record payload, tombstone, canonical revision, and
  last device metadata. Primary key: `(owner_id, collection, record_id)`.
- `sync_operations`: deduplication key `(owner_id, operation_id)`.
- `sync_change_log`: append-only canonical changes with a per-owner checkpoint
  sequence.

All exposed tables enable RLS and have explicit `TO authenticated` ownership
policies using `(select auth.uid()) = owner_id`. Update policies include both
`USING` and `WITH CHECK`, and corresponding select policies are present. The
sync write path is a transaction/RPC that records an operation exactly once,
compares the expected revision, writes the canonical record/tombstone, and
appends the change log atomically. A mismatched revision returns a conflict,
not a successful update. Pull reads only the authenticated owner's records after
its checkpoint with a fixed page limit.

The client gets the short-lived user access token from Supabase Auth and passes
it only to the existing HTTP transport. Authentication/session persistence uses
an explicitly selected local secure-storage adapter on desktop and follows the
Web platform's documented storage boundary. Supabase publishable URL/key are
the only `VITE_` values; no `.env` value is committed.

## Adoption paths and operator guide

Supabase is an optional reference backend, not a runtime prerequisite. The
starter continues to work in local-only mode when `sync` and `agent` are
disabled; users do not need an account, Docker, a cloud project, or any
environment value to run the base application.

The user guide presents four explicitly separate paths, all using the same
revision-aware `SyncTransport` contract:

1. **Local-only (default):** no account and no network. Agent profile and
   usage remain device-local; this is the recommended first-run experience.
2. **Managed Supabase (recommended cloud path):** create a hosted project,
   apply the tracked migration, deploy the `sync` function, configure only the
   project URL and publishable key locally, then sign in. The guide provides a
   copyable prerequisite check, commands discovered from the installed CLI,
   and a two-device verification checklist. Secret/service-role keys never
   appear in the app configuration.
3. **Self-hosted Supabase:** use the same tracked migration and Edge Function
   against a production-hardened Docker deployment. The guide distinguishes a
   local CLI stack (development/testing only) from a public self-hosted server,
   and calls out operator-owned TLS, backups, upgrades, monitoring, and
   incident response. It does not imply that `supabase start` is production.
4. **Bring-your-own backend:** implement the documented `POST /push` and
   `GET /pull` contract, including user authentication, owner isolation,
   operation idempotency, compare-and-swap revisions, tombstones, and ordered
   checkpoints. Firebase, a private API, or another Postgres host can use this
   route without importing Supabase packages.

The guide includes a decision table, "what this enables" explanation, a
credential-safe setup checklist, common failures (missing RLS/select policy,
unexposed Data API tables, wrong Edge Function route, expired session), and
an uninstall/rollback section that disables sync locally without deleting
device data. It labels Supabase CLI/Docker checks, local integration tests,
and a deployed two-device test as distinct evidence tiers.

## Provider and model settings

Provider definitions are a curated catalog. A provider's trusted endpoint and
`protocol` determine the adapter; `type` is not sufficient. The initial catalog
has OpenAI Responses, Anthropic Messages, Google Gemini, and the following
fixed-domain OpenAI Chat Completions-compatible providers: DeepSeek, Groq,
Mistral, xAI, OpenRouter, Together AI, Fireworks AI, Perplexity, and Cerebras.
The catalog also has a local no-key OpenAI-compatible protocol for Ollama, LM
Studio, vLLM, and llama.cpp. Each cloud catalog entry is added in TypeScript and
Rust together: fixed host, HTTPS-only validation, credential-header style,
model-discovery route, security tests, and an AI SDK adapter.

The catalog explicitly records which API protocol an endpoint implements:
`openai-responses`, `openai-chat-completions`, `anthropic-messages`,
`google-generative-ai`, or `openai-compatible-local`. This makes the provider
selection deterministic and allows one adapter to safely cover multiple
providers only when their documented protocol is genuinely compatible. A
provider may be displayed only after its endpoint/protocol policy and adapter
test pass. Azure OpenAI and other tenant-specific cloud endpoints are not
treated as generic compatible URLs: they require a later server-side gateway
or a customer-owned fixed-domain policy, so their API key can never be routed
by a WebView-selected arbitrary host.

Only localhost/local-network profiles with `apiKeyRef.kind === 'none'` may use
a user-entered OpenAI-compatible endpoint. A key-backed profile cannot select
an arbitrary endpoint. Model discovery runs through the same trusted Rust
proxy, returns only sanitized model metadata, and has manual model-ID fallback.

An Agent profile stores label, catalog provider ID, model catalog metadata, and
default/fast/advanced model slots. Credential state is queried as presence-only
from the keychain and never becomes profile data. The settings UI supports a
curated profile, active model selection, discovery/manual model entry, and a
minimal connection test. Google is shown as unavailable until its SDK adapter,
Rust allowlist, and tests are present; it is never a misleading configuration
option.

## Usage and provider smoke

Every terminal runtime attempt emits a local `agent_usage_events` row with
timestamp, provider/model IDs, nullable token categories, latency, terminal
status, sanitized error category, and optional estimated cost/version. It never
stores prompt, completion, token, authorization value, or raw provider error.
Daily and monthly aggregates show request count, success rate, tokens, latency,
and estimated cost. Estimated price is explicitly labeled non-authoritative.
Raw usage events are device-local and excluded from sync.

An opt-in real provider smoke command is gated by `RUN_PROVIDER_SMOKE=1` and
only uses an existing desktop keychain credential or a locally running Ollama
instance. It performs one minimal, no-tool request and asserts a terminal
stream event plus sanitized usage when supplied. Missing credentials or local
runtime produce an explicit skip, not a pass. Offline/unit tests remain a
separate evidence tier from real-provider smoke and Supabase RLS integration.

Automatic provider failover is excluded from this delivery. In particular, an
Agent run that has tools or any potentially side-effecting operation is never
automatically replayed with a different provider.

## Failure behavior

- Network failures retain all outbox entries and do not move the checkpoint.
- Conflicts retain the original operation and become visible state; no default
  last-write-wins overwrite occurs.
- Unauthorized Supabase requests fail before data access; cross-owner reads and
  writes are rejected by RLS.
- Provider discovery, settings, and smoke errors are sanitized and never expose
  a key, token, full request, or full provider response.
- Unavailable packages, credentials, or native capability leave the Agent
  module disabled/unchanged rather than activating a partial cloud route.

## Verification

Unit tests cover CAS acceptance, conflict non-acknowledgement, resolver paths,
tombstones, operation idempotency, persistent-store restart, and safe protocol
selection. Supabase integration tests use two authenticated test users to prove
RLS isolation, duplicate-operation idempotency, concurrent revision conflict,
and ordered pull checkpoints. Provider tests cover catalog/proxy policy,
adapter selection, sanitized usage recording, and smoke gating.

Required repository gates are `npm test`, `npm run typecheck`, `npm run build`,
`npm run build:web`, and `npm run check:docs`. Supabase integration and real
provider smoke are reported separately with their preconditions and are never
presented as results of offline tests.
