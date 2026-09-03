create function public.sync_metadata_identifier_is_safe(p_value text, p_max_length integer)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select char_length(p_value) between 1 and p_max_length
    and p_value ~ '^[A-Za-z0-9][-A-Za-z0-9._+]*$'
    and lower(p_value) !~ '^sk[-_](live|test|proj)([-_]|[a-z0-9])'
    and lower(p_value) !~ '^sk-[a-z0-9_-]{16,}$'
    and lower(p_value) !~ '^sb_(secret|publishable)_'
    and lower(p_value) !~ '^ghp_[a-z0-9]{20,}$'
    and lower(p_value) !~ '^github_pat_'
    and lower(p_value) !~ '^xox[baprs]-'
    and p_value !~ '^eyJ[A-Za-z0-9_-]+[.]eyJ[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$'
$$;

create function public.sync_agent_preferences_payload_is_safe(p_payload jsonb)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_text text;
  v_model_id text;
  v_capabilities jsonb;
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
    or not (p_payload ?& array[
      'providerId',
      'modelSlots',
      'modelCapabilities',
      'fallbackPreferences'
    ])
    or p_payload - array[
      'providerId',
      'modelSlots',
      'modelCapabilities',
      'fallbackPreferences'
    ] <> '{}'::jsonb then
    return false;
  end if;

  if jsonb_typeof(p_payload -> 'providerId') is distinct from 'string' then
    return false;
  end if;
  v_text := p_payload ->> 'providerId';
  if char_length(v_text) not between 1 and 128
    or v_text !~ '^[A-Za-z0-9][-A-Za-z0-9._:/+]*$'
    or lower(v_text) ~ '^sk[-_](live|test|proj)([-_]|[a-z0-9])'
    or lower(v_text) ~ '^sk-[a-z0-9_-]{16,}$'
    or lower(v_text) ~ '^sb_(secret|publishable)_'
    or lower(v_text) ~ '^ghp_[a-z0-9]{20,}$'
    or lower(v_text) ~ '^github_pat_'
    or lower(v_text) ~ '^xox[baprs]-'
    or v_text ~ '^eyJ[A-Za-z0-9_-]+[.]eyJ[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' then
    return false;
  end if;

  if jsonb_typeof(p_payload -> 'modelSlots') is distinct from 'object'
    or not (p_payload -> 'modelSlots') ?& array['default', 'fast', 'advanced']
    or (p_payload -> 'modelSlots') - array['default', 'fast', 'advanced'] <> '{}'::jsonb then
    return false;
  end if;
  foreach v_key in array array['default', 'fast', 'advanced']
  loop
    v_value := p_payload -> 'modelSlots' -> v_key;
    if jsonb_typeof(v_value) = 'null' then
      continue;
    end if;
    if jsonb_typeof(v_value) is distinct from 'string' then
      return false;
    end if;
    v_text := v_value #>> '{}';
    if char_length(v_text) not between 1 and 256
      or v_text !~ '^[A-Za-z0-9][-A-Za-z0-9._:/+]*$'
      or lower(v_text) ~ '^sk[-_](live|test|proj)([-_]|[a-z0-9])'
      or lower(v_text) ~ '^sk-[a-z0-9_-]{16,}$'
      or lower(v_text) ~ '^sb_(secret|publishable)_'
      or lower(v_text) ~ '^ghp_[a-z0-9]{20,}$'
      or lower(v_text) ~ '^github_pat_'
      or lower(v_text) ~ '^xox[baprs]-'
      or v_text ~ '^eyJ[A-Za-z0-9_-]+[.]eyJ[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' then
      return false;
    end if;
  end loop;

  if jsonb_typeof(p_payload -> 'modelCapabilities') is distinct from 'object' then
    return false;
  end if;
  for v_model_id, v_capabilities in
    select key, value from jsonb_each(p_payload -> 'modelCapabilities')
  loop
    if char_length(v_model_id) not between 1 and 256
      or v_model_id !~ '^[A-Za-z0-9][-A-Za-z0-9._:/+]*$'
      or lower(v_model_id) ~ '^sk[-_](live|test|proj)([-_]|[a-z0-9])'
      or lower(v_model_id) ~ '^sk-[a-z0-9_-]{16,}$'
      or lower(v_model_id) ~ '^sb_(secret|publishable)_'
      or lower(v_model_id) ~ '^ghp_[a-z0-9]{20,}$'
      or lower(v_model_id) ~ '^github_pat_'
      or lower(v_model_id) ~ '^xox[baprs]-'
      or v_model_id ~ '^eyJ[A-Za-z0-9_-]+[.]eyJ[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$'
      or jsonb_typeof(v_capabilities) is distinct from 'object'
      or v_capabilities - array[
        'toolCalling',
        'vision',
        'reasoning',
        'structuredOutput',
        'contextWindow',
        'maxOutputTokens',
        'inputModalities',
        'outputModalities'
      ] <> '{}'::jsonb then
      return false;
    end if;

    foreach v_key in array array['toolCalling', 'vision', 'reasoning', 'structuredOutput']
    loop
      if v_capabilities ? v_key
        and jsonb_typeof(v_capabilities -> v_key) is distinct from 'boolean' then
        return false;
      end if;
    end loop;
    foreach v_key in array array['contextWindow', 'maxOutputTokens']
    loop
      if not (v_capabilities ? v_key) then
        continue;
      end if;
      if jsonb_typeof(v_capabilities -> v_key) is distinct from 'number' then
        return false;
      end if;
      v_text := v_capabilities ->> v_key;
      if v_text !~ '^(0|[1-9][0-9]*)$'
        or v_text::numeric > 9007199254740991 then
        return false;
      end if;
    end loop;
    foreach v_key in array array['inputModalities', 'outputModalities']
    loop
      if not (v_capabilities ? v_key) then
        continue;
      end if;
      v_value := v_capabilities -> v_key;
      if jsonb_typeof(v_value) is distinct from 'array'
        or jsonb_array_length(v_value) > 32 then
        return false;
      end if;
      for v_value in select value from jsonb_array_elements(v_value)
      loop
        if jsonb_typeof(v_value) is distinct from 'string' then
          return false;
        end if;
        v_text := v_value #>> '{}';
        if char_length(v_text) not between 1 and 64
          or v_text !~ '^[A-Za-z0-9][-A-Za-z0-9._:/+]*$'
          or lower(v_text) ~ '^sk[-_](live|test|proj)([-_]|[a-z0-9])'
          or lower(v_text) ~ '^sk-[a-z0-9_-]{16,}$'
          or lower(v_text) ~ '^sb_(secret|publishable)_'
          or lower(v_text) ~ '^ghp_[a-z0-9]{20,}$'
          or lower(v_text) ~ '^github_pat_'
          or lower(v_text) ~ '^xox[baprs]-'
          or v_text ~ '^eyJ[A-Za-z0-9_-]+[.]eyJ[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' then
          return false;
        end if;
      end loop;
    end loop;
  end loop;

  if jsonb_typeof(p_payload -> 'fallbackPreferences') is distinct from 'object'
    or (p_payload -> 'fallbackPreferences') - array[
      'enabled',
      'strategy',
      'maxAttempts',
      'retryDelayMs'
    ] <> '{}'::jsonb then
    return false;
  end if;
  v_value := p_payload -> 'fallbackPreferences';
  if v_value ? 'enabled'
    and jsonb_typeof(v_value -> 'enabled') is distinct from 'boolean' then
    return false;
  end if;
  if v_value ? 'strategy' then
    if jsonb_typeof(v_value -> 'strategy') is distinct from 'string' then
      return false;
    end if;
    v_text := v_value ->> 'strategy';
    if char_length(v_text) not between 1 and 64
      or v_text !~ '^[A-Za-z0-9][-A-Za-z0-9._:/+]*$'
      or lower(v_text) ~ '^sk[-_](live|test|proj)([-_]|[a-z0-9])'
      or lower(v_text) ~ '^sk-[a-z0-9_-]{16,}$'
      or lower(v_text) ~ '^sb_(secret|publishable)_'
      or lower(v_text) ~ '^ghp_[a-z0-9]{20,}$'
      or lower(v_text) ~ '^github_pat_'
      or lower(v_text) ~ '^xox[baprs]-'
      or v_text ~ '^eyJ[A-Za-z0-9_-]+[.]eyJ[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$' then
      return false;
    end if;
  end if;
  foreach v_key in array array['maxAttempts', 'retryDelayMs']
  loop
    if not (v_value ? v_key) then
      continue;
    end if;
    if jsonb_typeof(v_value -> v_key) is distinct from 'number' then
      return false;
    end if;
    v_text := v_value ->> v_key;
    if v_text !~ '^(0|[1-9][0-9]*)$'
      or v_text::numeric > 9007199254740991 then
        return false;
    end if;
  end loop;

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
  constraint sync_records_record_id_check check (
    public.sync_metadata_identifier_is_safe(record_id, 256)
  ),
  constraint sync_records_revision_check check (revision > 0),
  constraint sync_records_operation_id_check check (
    public.sync_metadata_identifier_is_safe(last_operation_id, 128)
  ),
  constraint sync_records_device_id_check check (
    public.sync_metadata_identifier_is_safe(last_device_id, 256)
  ),
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
  constraint sync_operations_operation_id_check check (
    public.sync_metadata_identifier_is_safe(operation_id, 128)
  ),
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
  constraint sync_change_log_record_id_check check (
    public.sync_metadata_identifier_is_safe(record_id, 256)
  ),
  constraint sync_change_log_operation_id_check check (
    public.sync_metadata_identifier_is_safe(operation_id, 128)
  ),
  constraint sync_change_log_revision_check check (revision = server_sequence and revision > 0),
  constraint sync_change_log_device_id_check check (
    public.sync_metadata_identifier_is_safe(device_id, 256)
  ),
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

create function public.sync_push(p_changes jsonb)
returns jsonb
language plpgsql
security definer
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

    if public.sync_metadata_identifier_is_safe(v_operation_id, 128) is not true
      or v_collection is distinct from 'agent_preferences'
      or public.sync_metadata_identifier_is_safe(v_record_id, 256) is not true
      or v_kind is null or v_kind not in ('upsert', 'delete')
      or public.sync_metadata_identifier_is_safe(v_device_id, 256) is not true
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
security definer
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
revoke all on function public.sync_agent_preferences_payload_is_safe(jsonb)
  from public, anon, authenticated;
revoke all on function public.sync_metadata_identifier_is_safe(text, integer)
  from public, anon, authenticated;
grant execute on function public.sync_push(jsonb) to authenticated;
grant execute on function public.sync_pull(text) to authenticated;
