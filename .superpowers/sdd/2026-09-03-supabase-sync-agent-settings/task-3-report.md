# Task 3 report: Supabase schema and authenticated sync function

## Status

Implementation is complete at the offline/source-validation tier. The pure HTTP
contract suite and repository gates pass. Local Supabase database application,
two-user RLS integration, database lint, and database advisors were **not run**
because the Docker client is installed but its daemon is not reachable. No
Supabase project was linked, deployed, or otherwise mutated.

## Scope delivered

- Initialized the versioned local project with Supabase CLI v2.116.0.
- Generated `20260903030347_create_sync_backend.sql` with
  `supabase migration new create_sync_backend`; the timestamp was not invented.
- Generated the `sync` Edge Function with `supabase functions new sync --auth user`.
- Added owner-scoped `sync_records`, `sync_operations`, and `sync_change_log`
  tables. Their primary/unique indexes cover record lookup, operation
  deduplication, and ordered per-owner checkpoints.
- Enabled RLS on every public table and added explicit `TO authenticated`
  ownership policies using `(select auth.uid()) = owner_id`. The update policy
  has both `USING` and `WITH CHECK`, and the corresponding select policy exists.
- Revoked default table/function access, then granted only the operations needed
  by the authenticated, security-invoker RPC path. No `anon` DML/SELECT grants
  are present.
- Added `sync_push(jsonb)`, a `SECURITY INVOKER` transaction/RPC that derives the
  owner from `auth.uid()`, serializes each owner's push transactions with a
  transaction advisory lock, deduplicates `(owner_id, operation_id)`, performs
  compare-and-swap on `baseRevision`, writes records/tombstones, and appends one
  canonical per-owner sequence entry atomically.
- Added `sync_pull(text)`, a `SECURITY INVOKER` RPC that reads only the RLS-visible
  owner's ordered change log and caps each page at 100 changes.
- Routed `POST .../sync/push` and `GET .../sync/pull` through a user-authenticated
  `@supabase/server` handler. It uses only `context.supabase`, the caller-scoped
  RLS client; it never references `context.supabaseAdmin`, a service-role key,
  or a secret key.
- Restricted the collection allowlist to `agent_preferences`, validated request
  and database result shapes, and returned sanitized error bodies.
- Pinned Deno dependencies and committed the generated `deno.lock`.

## TDD record

### RED

Command:

```text
node --experimental-strip-types --test tests/supabase-sync-contract.test.ts
```

Result: exit 1, `ERR_MODULE_NOT_FOUND` for
`supabase/functions/sync/contract.ts`, which was the expected missing contract
surface before implementation.

### GREEN

The same command then passed 3/3 tests:

1. A first write with `baseRevision: null` returns one accepted canonical change.
2. A stale concurrent write returns a conflict with the current canonical revision.
3. Repeating an `operationId` returns the first canonical change and the pure
   fixture records only one change-log entry.

These are offline request/response contract tests. They do not prove Postgres
transaction behavior or RLS enforcement.

## Current Supabase guidance checked

- Fetched the current [Supabase changelog](https://supabase.com/changelog.md).
  The relevant 2026-04-28 Data API breaking change says new tables are no longer
  automatically exposed by default; the local config therefore sets
  `auto_expose_new_tables = false`, and the migration uses explicit grants.
- Checked [Function Configuration](https://supabase.com/docs/guides/functions/function-configuration)
  and [Authorization headers](https://supabase.com/docs/guides/functions/auth-headers):
  `verify_jwt` remains enabled, and requests must carry a user JWT rather than a
  publishable/secret key as the bearer credential.
- Checked [Which package to use](https://supabase.com/docs/guides/auth/choosing-a-server-package):
  `@supabase/server` is the current header-auth package, and `ctx.supabase` is
  the caller-scoped client that respects RLS.
- Checked [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security):
  raw-SQL public tables need explicit RLS/grants, ownership predicates, a select
  policy for update, and both `USING`/`WITH CHECK` for owner-preserving updates.

No changelog breaking change applied to this implementation beyond explicit
Data API exposure/grants. The Management API logs and self-hosted gateway/Auth
changes are outside this task's code path.

## Validation tiers and exact evidence

| Tier | Command/evidence | Result |
| --- | --- | --- |
| CLI discovery | `supabase --version` | Not available on shell `PATH` (`command not found`). |
| CLI fallback | `npx --yes supabase@2.116.0 --version` plus top-level/init/migration/functions help | Passed; reported `2.116.0`. |
| Pure contract | `node --experimental-strip-types --test tests/supabase-sync-contract.test.ts` | Passed: 3 tests, 0 failures. |
| Repository unit suite | `npm test` | Passed: 76 tests, 0 failures, 0 skipped. |
| Edge type check | `npx --yes deno@2 check --config supabase/functions/sync/deno.json supabase/functions/sync/index.ts` | Passed with Deno 2.9.6. |
| Frontend type check | `npm run typecheck` | Passed. |
| Default build | `npm run build` | Passed. Rollup emitted existing dependency-comment warnings from Zod. |
| Web build | `npm run build:web` | Passed. The same Zod warnings were emitted. |
| Documentation links | `npm run check:docs` | Passed: Markdown relative links are valid. |
| Secret/source scan | scoped `rg` for service-role/secret/private-key/JWT patterns | No credential value found. One generated config comment mentions the role name `service_role`. |
| Local Docker stack | `npx --yes supabase@2.116.0 start` | Not run successfully: exit 1, `LegacyDockerLifecycleInspectError`, cannot connect to `/Users/wuling/.docker/run/docker.sock`. |
| Migration apply / DB lint / advisors | Requires the local stack | Not run because the Docker daemon is unavailable. |
| Two signed-in users / RLS / CAS / idempotency / ordered pull | Requires migrated local stack and Auth | Not run because the Docker daemon is unavailable. |
| Hosted/two-device proof | Requires an authorized external project and deployment | Not run; explicitly outside this task and no project was linked/deployed. |

## Tool limitations encountered

- Global Supabase CLI: absent from `PATH`; the allowed project-scoped fallback
  `npx --yes supabase@2.116.0` was used without changing `package.json` or the npm
  lockfile.
- Docker: client v29.7.2 is installed, but the daemon socket is unreachable.
- Global Deno: absent. `npx --yes deno@2` provided Deno 2.9.6 for a source type
  check and produced the committed Deno lockfile.
- The initially selected current `@supabase/functions-js` 2.114.0 was blocked by
  Deno's 24-hour minimum-dependency-age safeguard on 2026-09-03. The import was
  pinned to 2.112.4, matching the exact Supabase JS dependency selected by
  `@supabase/server` 1.5.2; the subsequent Deno check passed.
- `psql`/`pg_isready` are not installed. A one-off `npm exec` attempt to load
  `libpg-query` also failed module resolution, so it provided no SQL evidence.
  SQL validation remains correctly classified as not run rather than inferred
  from TypeScript or unit tests.

## Security notes and residual concerns

- No WebView/public application code contains a service-role or secret key. The
  tracked config contains only generated `env(...)` placeholders.
- `@supabase/server` can expose an admin client in its context, but this function
  never reads or invokes it; all queries use `context.supabase`.
- Because the write RPC is deliberately `SECURITY INVOKER`, authenticated table
  grants are required. RLS limits those grants to the caller's own rows, but an
  authenticated caller can technically issue direct Data API mutations against
  its own sync rows. That does not permit cross-owner access; validating the
  exact local Data API behavior is part of the blocked RLS integration tier.
- Migration syntax, RLS isolation, concurrent Postgres locking, exact-once log
  insertion, and ordered checkpoints remain unverified until the Docker daemon
  is available and the local integration tier is executed.

## Files

- `supabase/config.toml`
- `supabase/.gitignore`
- `supabase/migrations/20260903030347_create_sync_backend.sql`
- `supabase/functions/sync/index.ts`
- `supabase/functions/sync/contract.ts`
- `supabase/functions/sync/deno.json`
- `supabase/functions/sync/deno.lock`
- `supabase/functions/sync/.npmrc`
- `tests/supabase-sync-contract.test.ts`

## Review fix round 1: payload boundary and lossless nulls

Two P1 review findings were addressed without changing the Task 1 sync types:

1. `agent_preferences` now has an explicit top-level payload allowlist:
   `providerId`, `modelSlots`, `modelCapabilities`, and
   `fallbackPreferences`. The Edge contract parser recursively rejects keys
   associated with API keys/secrets/tokens, credential references,
   authorization/session/cookies, endpoints/URLs, paths, prompts/messages/
   responses/completions, usage, and raw/provider error content.
2. The migration applies the same validation inside
   `sync_agent_preferences_payload_is_safe(jsonb, boolean)`. `sync_push`
   rejects unsafe payloads before deduplication or writes, while CHECK
   constraints protect `sync_records`, `sync_operations`, and
   `sync_change_log` from direct authenticated Data API writes.
3. Canonical accepted/conflict and pull JSON now conditionally adds only the
   top-level `payload` member. All recursive `jsonb_strip_nulls` calls were
   removed, so nested null preference values are retained while tombstones
   still omit the payload field.

### Review-fix TDD evidence

RED command:

```text
node --experimental-strip-types --test tests/supabase-sync-contract.test.ts
```

Result: exit 1, 4 passed and 1 failed. The new security regression received
HTTP 200 instead of the required HTTP 400, proving that the existing function
parser accepted an unknown `selectedModel` key and recursively nested sensitive
keys.

GREEN and regression results after the fix:

| Check | Result |
| --- | --- |
| Focused Supabase contract test | Passed: 5 tests, 0 failures. |
| Full `npm test` | Passed: 78 tests, 0 failures, 0 skipped. |
| Deno Edge check | Passed with the pinned import map/lockfile. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed with the previously recorded Zod/Rollup comment warnings. |
| `npm run build:web` | Passed with the same warnings. |
| `npm run check:docs` | Passed. |

The nested-null regression exercises accepted, conflict, duplicate-operation
replay, and pull JSON at the pure function contract boundary. The PostgreSQL
migration mirrors that construction without recursive null stripping. Docker
remains unavailable (`docker info` cannot connect to
`/Users/wuling/.docker/run/docker.sock`), so executing the CHECK constraints,
RPC validation, and database round-trip remains explicitly not run rather than
being inferred from the pure tests.
