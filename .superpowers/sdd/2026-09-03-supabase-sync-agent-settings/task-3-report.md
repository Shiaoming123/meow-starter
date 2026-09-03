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

## Review fix round 2: structural schema and credential-like values

The payload boundary is now structural rather than a recursive key-name scan.
The Edge validator and PostgreSQL helper accept only this schema:

- all four top-level members are required;
- `providerId` is a bounded identifier string;
- `modelSlots` has exactly `default`, `fast`, and `advanced`, each a bounded
  identifier string or JSON null;
- `modelCapabilities` is keyed by bounded model IDs; each value is an object
  containing only boolean `toolCalling`, `vision`, `reasoning`, or
  `structuredOutput`, non-negative safe-integer `contextWindow` or
  `maxOutputTokens`, and bounded identifier-string arrays `inputModalities` or
  `outputModalities`;
- `fallbackPreferences` contains only boolean `enabled`, bounded identifier
  string `strategy`, and non-negative safe-integer `maxAttempts` or
  `retryDelayMs`.

Unknown nested members, missing required sections/slots, wrong types, unsafe
identifier text, and credential-shaped values are rejected. Credential patterns
cover `sk-live`/`sk-test`/`sk-proj` and long `sk-` values, Supabase key prefixes,
GitHub tokens, Slack tokens, bearer values, JWT-shaped strings, and private-key
headers. The identifier grammar independently excludes whitespace-bearing
values such as bearer/private-key text.

The SQL helper has a single `jsonb` signature, so callers cannot bypass the
root schema with the former internal recursion flag. The same helper remains in
the `sync_records`, `sync_operations`, and `sync_change_log` CHECK constraints,
and `sync_push` calls it before deduplication or writes. The canonical JSON
builders were not changed; nullable model slots still survive accepted,
conflict, retry, and pull results.

### Review-fix round 2 TDD and validation evidence

RED 1:

```text
node --experimental-strip-types --test tests/supabase-sync-contract.test.ts
```

Result: exit 1, 5 passed and 1 failed. A payload containing
`modelSlots.backup` reached the backend and returned HTTP 200 instead of 400.

RED 2, after the structural-key fix:

```text
node --experimental-strip-types --test tests/supabase-sync-contract.test.ts
```

Result: exit 1, 6 passed and 1 failed. A credential-shaped
`sk-live-1234567890abcdef` value in the allowed `providerId` field reached the
backend and returned HTTP 200 instead of 400.

GREEN focused result: 8 tests passed, 0 failed. The added cases cover unknown
nested keys in all sections, credential-like values in allowed provider/model/
capability/fallback positions, missing sections/slots, and wrong nested types.

Fresh regression gates after the round 2 implementation:

| Check | Result |
| --- | --- |
| Focused Supabase contract test | Passed: 8 tests, 0 failures. |
| Full `npm test` | Passed: 81 tests, 0 failures, 0 skipped. |
| Deno Edge check | Passed with the pinned import map/lockfile. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed with the previously recorded Zod/Rollup comment warnings. |
| `npm run build:web` | Passed with the same warnings. |
| `npm run check:docs` | Passed. |
| `git diff --check` | Passed. |

An ephemeral `@electric-sql/pglite@0.3.14` PostgreSQL-compatible runtime was
used without changing repository dependencies. It parsed and applied the full
migration against minimal local `auth` fixtures, then produced:

```text
helper 3/3; CHECK 1/1; RPC 3/3; nested null preserved
```

This proves the migration parses in that runtime and that valid, `backup`, and
`sk-live` fixtures take the intended helper/CHECK/RPC branches. It is a
PostgreSQL-compatible source/behavior check, not Supabase local integration and
not RLS isolation evidence. Docker remains unavailable: a fresh `docker info`
exited 1 with `Cannot connect to the Docker daemon at
unix:///Users/wuling/.docker/run/docker.sock`. Therefore Supabase migration
application, database lint/advisors, two-user Auth/RLS isolation, and concurrent
transaction behavior remain not run.

Current Supabase guidance was refreshed on 2026-09-03. The changelog still has
no breaking change specific to this validation path; the 2026-04-28 Data API
exposure change remains relevant to the explicit grants. Current RLS guidance
still requires RLS plus explicit grants/policies, and current Edge Function Auth
guidance still says `verify_jwt = true` with `auth: 'user'` yields the caller's
RLS-scoped client. The documentation web fetcher rejected Supabase's Markdown
content type with HTTP 400, so the same official URLs were fetched successfully
with `curl`. A one-off `npm exec --package=pgsql-parser` attempt could not expose
the package to Node's module resolver; PGlite provided the successful local SQL
evidence instead.
