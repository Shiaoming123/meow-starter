import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { after, before } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migrationUrl = new URL(
  '../supabase/migrations/20260903030347_create_sync_backend.sql',
  import.meta.url,
)
const migration = await readFile(migrationUrl, 'utf8')
const ownerId = '11111111-1111-4111-8111-111111111111'

function functionDefinition(name: 'sync_push' | 'sync_pull'): string {
  const start = migration.indexOf(`create function public.${name}`)
  assert.notEqual(start, -1, `${name} definition is missing`)
  const end = migration.indexOf('$$;', start)
  assert.notEqual(end, -1, `${name} definition is unterminated`)
  return migration.slice(start, end)
}

test('migration exposes sync RPCs without authenticated table mutation grants', () => {
  for (const table of ['sync_records', 'sync_operations', 'sync_change_log']) {
    assert.match(
      migration,
      new RegExp(`revoke all on table public[.]${table} from public, anon, authenticated`, 'i'),
    )
    assert.doesNotMatch(
      migration,
      new RegExp(`grant\\s+[^;]*on table public[.]${table} to authenticated`, 'i'),
    )
  }
  assert.match(functionDefinition('sync_push'), /security definer/i)
  assert.match(functionDefinition('sync_pull'), /security definer/i)
  assert.match(
    migration,
    /grant execute on function public[.]sync_push\(jsonb\) to authenticated/i,
  )
  assert.match(
    migration,
    /grant execute on function public[.]sync_pull\(text\) to authenticated/i,
  )
  assert.doesNotMatch(
    migration,
    /grant execute on function public[.]sync_agent_preferences_payload_is_safe\(jsonb\)\s+to authenticated/i,
  )
  assert.doesNotMatch(
    migration,
    /grant execute on function public[.]sync_metadata_identifier_is_safe\(text, integer\)\s+to authenticated/i,
  )
})

let database: PGlite

before(async () => {
  database = new PGlite()
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `)
  await database.exec(migration)
  await database.query('insert into auth.users (id) values ($1)', [ownerId])
  await database.exec(`
    set role authenticated;
    set request.jwt.claim.sub = '${ownerId}';
  `)
})

after(async () => {
  await database.close()
})

test('authenticated PGlite role cannot directly mutate sync tables', async () => {
  const mutations = [
    {
      table: 'sync_records',
      sql: `insert into public.sync_records (
        owner_id, collection, record_id, payload, tombstone, revision,
        last_operation_id, last_device_id, last_occurred_at
      ) values ($1, 'agent_preferences', 'direct-record', $2::jsonb, false, 1,
        'direct-record-operation', 'direct-device', '2026-09-03T00:00:00Z')`,
      params: [ownerId, JSON.stringify(validPayload())],
    },
    {
      table: 'sync_operations',
      sql: `insert into public.sync_operations (
        owner_id, operation_id, outcome, canonical_change
      ) values ($1, 'direct-operation', 'accepted', $2::jsonb)`,
      params: [ownerId, JSON.stringify(canonicalChange('direct-operation', 'direct-record'))],
    },
    {
      table: 'sync_change_log',
      sql: `insert into public.sync_change_log (
        owner_id, server_sequence, operation_id, collection, record_id, kind,
        payload, revision, device_id, occurred_at
      ) values ($1, 1, 'direct-log-operation', 'agent_preferences', 'direct-log-record',
        'upsert', $2::jsonb, 1, 'direct-device', '2026-09-03T00:00:00Z')`,
      params: [ownerId, JSON.stringify(validPayload())],
    },
  ]

  for (const mutation of mutations) {
    await assert.rejects(
      database.query(mutation.sql, mutation.params),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === '42501' &&
        error.message.includes(`table ${mutation.table}`),
      `authenticated directly mutated ${mutation.table}`,
    )
  }
})

test('PGlite sync RPC preserves atomic CAS, deduplication, log, and pull behavior', async () => {
  const firstChange = pendingChange()
  const first = await push([firstChange])
  const repeated = await push([firstChange])
  const conflict = await push([
    pendingChange({
      operationId: 'operation-2',
      payload: validPayload('gpt-5.7'),
    }),
  ])
  const pulled = await database.query<{ result: { changes: unknown[]; checkpoint: string } }>(
    'select public.sync_pull(null) as result',
  )
  await database.exec('reset role')
  const counts = await database.query<{ records: number; operations: number; changes: number }>(
    `select
      (select count(*)::int from public.sync_records where record_id = 'profile-1') as records,
      (select count(*)::int from public.sync_operations
        where operation_id in ('operation-1', 'operation-2')) as operations,
      (select count(*)::int from public.sync_change_log
        where operation_id = 'operation-1') as changes`,
  )
  await database.exec(`
    set role authenticated;
    set request.jwt.claim.sub = '${ownerId}';
  `)

  assert.deepEqual(repeated, first)
  assert.equal(first.accepted[0]?.revision, '1')
  assert.equal(conflict.conflicts[0]?.current.revision, '1')
  assert.equal(pulled.rows[0]?.result.changes.length, 1)
  assert.equal(pulled.rows[0]?.result.checkpoint, '1')
  assert.deepEqual(counts.rows[0], { records: 1, operations: 2, changes: 1 })
})

test('PGlite sync RPC scopes security-definer reads and writes to auth.uid()', async () => {
  const secondOwnerId = '22222222-2222-4222-8222-222222222222'
  await database.exec('reset role')
  await database.query('insert into auth.users (id) values ($1)', [secondOwnerId])
  await database.exec(`
    set role authenticated;
    set request.jwt.claim.sub = '${secondOwnerId}';
  `)

  const initiallyPulled = await database.query<{ result: { changes: unknown[] } }>(
    'select public.sync_pull(null) as result',
  )
  const secondOwnerPush = await push([
    pendingChange({ operationId: 'operation-owner-2', deviceId: 'device-owner-2' }),
  ])

  await database.exec(`set request.jwt.claim.sub = '${ownerId}';`)
  const firstOwnerPulled = await database.query<{ result: { changes: unknown[] } }>(
    'select public.sync_pull(null) as result',
  )

  assert.deepEqual(initiallyPulled.rows[0]?.result.changes, [])
  assert.equal(secondOwnerPush.accepted[0]?.revision, '1')
  assert.equal(firstOwnerPulled.rows[0]?.result.changes.length, 1)
})

test('PGlite sync_push rejects credential, URL, and path patterns in metadata IDs', async () => {
  for (const [index, value] of [
    'sk-live-1234567890abcdef',
    'https://private.example/sync',
    '/Users/example/private-sync-data',
  ].entries()) {
    for (const field of ['operationId', 'recordId', 'deviceId'] as const) {
      await assert.rejects(
        push([
          pendingChange({
            operationId: `unsafe-operation-${index}-${field}`,
            [field]: value,
          }),
        ]),
        (error: unknown) => error instanceof Error && 'code' in error && error.code === '22023',
        `sync_push accepted ${field}=${value}`,
      )
    }
  }
})

function validPayload(model = 'gpt-5.6') {
  return {
    providerId: 'openai',
    modelSlots: { default: model, fast: null, advanced: null },
    modelCapabilities: { [model]: { toolCalling: true, vision: false } },
    fallbackPreferences: { enabled: false, strategy: 'manual', maxAttempts: 0 },
  }
}

function pendingChange(overrides: Record<string, unknown> = {}) {
  return {
    operationId: 'operation-1',
    collection: 'agent_preferences',
    recordId: 'profile-1',
    kind: 'upsert',
    payload: validPayload(),
    baseRevision: null,
    deviceId: 'device-a',
    occurredAt: '2026-09-03T00:00:00.000Z',
    ...overrides,
  }
}

function canonicalChange(operationId: string, recordId: string) {
  const { baseRevision: _, ...canonical } = pendingChange({ operationId, recordId })
  return { ...canonical, revision: '1' }
}

async function push(changes: unknown[]) {
  const result = await database.query<{
    result: {
      accepted: Array<{ revision: string }>
      conflicts: Array<{ current: { revision: string } }>
    }
  }>('select public.sync_push($1::jsonb) as result', [JSON.stringify(changes)])
  return result.rows[0]!.result
}
