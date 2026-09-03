create function public.sync_agent_preferences_payload_is_safe(
  p_payload jsonb,
  p_root boolean default true
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_child jsonb;
  v_normalized_key text;
begin
  if p_root then
    if jsonb_typeof(p_payload) is distinct from 'object' then
      return false;
    end if;
    if p_payload - array[
      'providerId',
      'modelSlots',
      'modelCapabilities',
      'fallbackPreferences'
    ] <> '{}'::jsonb then
      return false;
    end if;
  end if;

  if jsonb_typeof(p_payload) = 'object' then
    for v_key, v_child in select key, value from jsonb_each(p_payload)
    loop
      v_normalized_key := lower(regexp_replace(v_key, '[^a-zA-Z0-9]', '', 'g'));
      if v_normalized_key = 'key'
        or v_normalized_key like '%apikey%'
        or v_normalized_key like '%credential%'
        or v_normalized_key like '%secret%'
        or v_normalized_key like '%token%'
        or v_normalized_key like '%authorization%'
        or v_normalized_key like '%cookie%'
        or v_normalized_key = 'session'
        or v_normalized_key like '%endpoint%'
        or v_normalized_key like '%url%'
        or v_normalized_key like '%path%'
        or v_normalized_key like '%prompt%'
        or v_normalized_key like '%message%'
        or v_normalized_key like '%response%'
        or v_normalized_key like '%completion%'
        or v_normalized_key like '%usage%'
        or v_normalized_key in ('error', 'errors')
        or v_normalized_key like '%rawerror%'
        or v_normalized_key like '%errorbody%'
        or v_normalized_key like '%providererror%' then
        return false;
      end if;
      if not public.sync_agent_preferences_payload_is_safe(v_child, false) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_payload) = 'array' then
    for v_child in select value from jsonb_array_elements(p_payload)
    loop
      if not public.sync_agent_preferences_payload_is_safe(v_child, false) then
        return false;
      end if;
    end loop;
  end if;

  return true;
end;
$$;

create table public.sync_records (
  owner_id uuid not null references auth.users (id) on delete cascade,
  collection text not null,
  record_id text not null,
  payload jsonb,
  tombstone boolean not null,
  revision bigint not null,
  last_operation_id text not null,
  last_device_id text not null,
  last_occurred_at timestamptz not null,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (owner_id, collection, record_id),
  constraint sync_records_collection_check check (collection = 'agent_preferences'),
  constraint sync_records_record_id_check check (char_length(record_id) between 1 and 256),
  constraint sync_records_revision_check check (revision > 0),
  constraint sync_records_operation_id_check check (char_length(last_operation_id) between 1 and 128),
  constraint sync_records_device_id_check check (char_length(last_device_id) between 1 and 256),
  constraint sync_records_payload_check check (
    (tombstone and payload is null)
    or (
      not tombstone
      and payload is not null
      and public.sync_agent_preferences_payload_is_safe(payload)
    )
  )
);

create table public.sync_operations (
  owner_id uuid not null references auth.users (id) on delete cascade,
  operation_id text not null,
  outcome text not null,
  canonical_change jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (owner_id, operation_id),
  constraint sync_operations_operation_id_check check (char_length(operation_id) between 1 and 128),
  constraint sync_operations_outcome_check check (outcome in ('accepted', 'conflict')),
  constraint sync_operations_canonical_change_check check (
    jsonb_typeof(canonical_change) = 'object'
    and (
      not (canonical_change ? 'payload')
      or public.sync_agent_preferences_payload_is_safe(canonical_change -> 'payload')
    )
  )
);

create table public.sync_change_log (
  owner_id uuid not null references auth.users (id) on delete cascade,
  server_sequence bigint not null,
  operation_id text not null,
  collection text not null,
  record_id text not null,
  kind text not null,
  payload jsonb,
  revision bigint not null,
  device_id text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (owner_id, server_sequence),
  unique (owner_id, operation_id),
  constraint sync_change_log_collection_check check (collection = 'agent_preferences'),
  constraint sync_change_log_kind_check check (kind in ('upsert', 'delete')),
  constraint sync_change_log_record_id_check check (char_length(record_id) between 1 and 256),
  constraint sync_change_log_operation_id_check check (char_length(operation_id) between 1 and 128),
  constraint sync_change_log_revision_check check (revision = server_sequence and revision > 0),
  constraint sync_change_log_device_id_check check (char_length(device_id) between 1 and 256),
  constraint sync_change_log_payload_check check (
    (kind = 'delete' and payload is null)
    or (
      kind = 'upsert'
      and payload is not null
      and public.sync_agent_preferences_payload_is_safe(payload)
    )
  )
);

alter table public.sync_records enable row level security;
alter table public.sync_operations enable row level security;
alter table public.sync_change_log enable row level security;

create policy "sync_records_select_own"
  on public.sync_records
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "sync_records_insert_own"
  on public.sync_records
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "sync_records_update_own"
  on public.sync_records
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "sync_operations_select_own"
  on public.sync_operations
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "sync_operations_insert_own"
  on public.sync_operations
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "sync_change_log_select_own"
  on public.sync_change_log
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "sync_change_log_insert_own"
  on public.sync_change_log
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

revoke all on table public.sync_records from public, anon, authenticated;
revoke all on table public.sync_operations from public, anon, authenticated;
revoke all on table public.sync_change_log from public, anon, authenticated;

grant select, insert, update on table public.sync_records to authenticated;
grant select, insert on table public.sync_operations to authenticated;
grant select, insert on table public.sync_change_log to authenticated;

create function public.sync_push(p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_change jsonb;
  v_operation_id text;
  v_collection text;
  v_record_id text;
  v_kind text;
  v_payload jsonb;
  v_base_revision bigint;
  v_device_id text;
  v_occurred_at timestamptz;
  v_current public.sync_records%rowtype;
  v_stored public.sync_operations%rowtype;
  v_canonical jsonb;
  v_revision bigint;
  v_accepted jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Expected a changes array';
  end if;
  if jsonb_array_length(p_changes) > 100 then
    raise exception using errcode = '22023', message = 'Push is limited to 100 changes';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':sync', 0));

  for v_change in select value from jsonb_array_elements(p_changes)
  loop
    if jsonb_typeof(v_change) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'Invalid change';
    end if;

    v_operation_id := v_change ->> 'operationId';
    v_collection := v_change ->> 'collection';
    v_record_id := v_change ->> 'recordId';
    v_kind := v_change ->> 'kind';
    v_payload := v_change -> 'payload';
    v_device_id := v_change ->> 'deviceId';

    if v_operation_id is null or char_length(v_operation_id) not between 1 and 128
      or v_collection is distinct from 'agent_preferences'
      or v_record_id is null or char_length(v_record_id) not between 1 and 256
      or v_kind is null or v_kind not in ('upsert', 'delete')
      or v_device_id is null or char_length(v_device_id) not between 1 and 256
      or (v_change ->> 'occurredAt') is null
      or char_length(v_change ->> 'occurredAt') not between 1 and 64
      or not (v_change ? 'baseRevision') then
      raise exception using errcode = '22023', message = 'Invalid change fields';
    end if;
    if (v_kind = 'upsert' and jsonb_typeof(v_payload) is distinct from 'object')
      or (v_kind = 'delete' and v_change ? 'payload') then
      raise exception using errcode = '22023', message = 'Invalid change payload';
    end if;
    if v_kind = 'upsert'
      and not public.sync_agent_preferences_payload_is_safe(v_payload) then
      raise exception using errcode = '22023', message = 'Unsafe agent preferences payload';
    end if;

    begin
      v_occurred_at := (v_change ->> 'occurredAt')::timestamptz;
      if jsonb_typeof(v_change -> 'baseRevision') = 'null' then
        v_base_revision := null;
      elsif jsonb_typeof(v_change -> 'baseRevision') = 'string'
        and (v_change ->> 'baseRevision') ~ '^[1-9][0-9]*$' then
        v_base_revision := (v_change ->> 'baseRevision')::bigint;
      else
        raise exception using errcode = '22023', message = 'Invalid base revision';
      end if;
    exception
      when datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
        raise exception using errcode = '22023', message = 'Invalid change metadata';
    end;

    select *
      into v_stored
      from public.sync_operations
      where owner_id = v_owner and operation_id = v_operation_id;

    if found then
      if v_stored.outcome = 'accepted' then
        v_accepted := v_accepted || jsonb_build_array(v_stored.canonical_change);
      else
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
          'operationId', v_operation_id,
          'current', v_stored.canonical_change
        ));
      end if;
      continue;
    end if;

    select *
      into v_current
      from public.sync_records
      where owner_id = v_owner
        and collection = v_collection
        and record_id = v_record_id
      for update;

    if (found and v_current.revision is distinct from v_base_revision)
      or (not found and v_base_revision is not null) then
      if not found then
        raise exception using errcode = '22023', message = 'Base revision has no canonical record';
      end if;

      v_canonical := jsonb_build_object(
        'operationId', v_current.last_operation_id,
        'collection', v_current.collection,
        'recordId', v_current.record_id,
        'kind', case when v_current.tombstone then 'delete' else 'upsert' end,
        'revision', v_current.revision::text,
        'deviceId', v_current.last_device_id,
        'occurredAt', v_current.last_occurred_at
      ) || case
        when v_current.tombstone then '{}'::jsonb
        else jsonb_build_object('payload', v_current.payload)
      end;

      insert into public.sync_operations (
        owner_id, operation_id, outcome, canonical_change
      ) values (
        v_owner, v_operation_id, 'conflict', v_canonical
      );
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
        'operationId', v_operation_id,
        'current', v_canonical
      ));
      continue;
    end if;

    select coalesce(max(server_sequence), 0) + 1
      into v_revision
      from public.sync_change_log
      where owner_id = v_owner;
    v_canonical := jsonb_build_object(
      'operationId', v_operation_id,
      'collection', v_collection,
      'recordId', v_record_id,
      'kind', v_kind,
      'revision', v_revision::text,
      'deviceId', v_device_id,
      'occurredAt', v_occurred_at
    ) || case
      when v_kind = 'delete' then '{}'::jsonb
      else jsonb_build_object('payload', v_payload)
    end;

    insert into public.sync_records (
      owner_id,
      collection,
      record_id,
      payload,
      tombstone,
      revision,
      last_operation_id,
      last_device_id,
      last_occurred_at
    ) values (
      v_owner,
      v_collection,
      v_record_id,
      case when v_kind = 'delete' then null else v_payload end,
      v_kind = 'delete',
      v_revision,
      v_operation_id,
      v_device_id,
      v_occurred_at
    )
    on conflict (owner_id, collection, record_id) do update set
      payload = excluded.payload,
      tombstone = excluded.tombstone,
      revision = excluded.revision,
      last_operation_id = excluded.last_operation_id,
      last_device_id = excluded.last_device_id,
      last_occurred_at = excluded.last_occurred_at,
      updated_at = statement_timestamp();

    insert into public.sync_change_log (
      owner_id,
      server_sequence,
      operation_id,
      collection,
      record_id,
      kind,
      payload,
      revision,
      device_id,
      occurred_at
    ) values (
      v_owner,
      v_revision,
      v_operation_id,
      v_collection,
      v_record_id,
      v_kind,
      case when v_kind = 'delete' then null else v_payload end,
      v_revision,
      v_device_id,
      v_occurred_at
    );

    insert into public.sync_operations (
      owner_id, operation_id, outcome, canonical_change
    ) values (
      v_owner, v_operation_id, 'accepted', v_canonical
    );
    v_accepted := v_accepted || jsonb_build_array(v_canonical);
  end loop;

  return jsonb_build_object('accepted', v_accepted, 'conflicts', v_conflicts);
end;
$$;

create function public.sync_pull(p_checkpoint text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_checkpoint bigint := 0;
  v_changes jsonb;
  v_next_checkpoint bigint;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_checkpoint is not null then
    if p_checkpoint !~ '^(0|[1-9][0-9]*)$' then
      raise exception using errcode = '22023', message = 'Invalid checkpoint';
    end if;
    begin
      v_checkpoint := p_checkpoint::bigint;
    exception
      when numeric_value_out_of_range then
        raise exception using errcode = '22023', message = 'Invalid checkpoint';
    end;
  end if;

  with page as (
    select *
      from public.sync_change_log
      where owner_id = v_owner and server_sequence > v_checkpoint
      order by server_sequence
      limit 100
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'operationId', operation_id,
        'collection', collection,
        'recordId', record_id,
        'kind', kind,
        'revision', revision::text,
        'deviceId', device_id,
        'occurredAt', occurred_at
      ) || case
        when kind = 'delete' then '{}'::jsonb
        else jsonb_build_object('payload', payload)
      end order by server_sequence
    ), '[]'::jsonb),
    max(server_sequence)
  into v_changes, v_next_checkpoint
  from page;

  if v_next_checkpoint is null and p_checkpoint is null then
    return jsonb_build_object('changes', v_changes);
  end if;
  return jsonb_build_object(
    'changes', v_changes,
    'checkpoint', coalesce(v_next_checkpoint, v_checkpoint)::text
  );
end;
$$;

revoke all on function public.sync_push(jsonb) from public, anon, authenticated;
revoke all on function public.sync_pull(text) from public, anon, authenticated;
revoke all on function public.sync_agent_preferences_payload_is_safe(jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.sync_push(jsonb) to authenticated;
grant execute on function public.sync_pull(text) to authenticated;
grant execute on function public.sync_agent_preferences_payload_is_safe(jsonb, boolean)
  to authenticated;
