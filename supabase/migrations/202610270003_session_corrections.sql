-- Apply after 001 and 002. Adds explicit session corrections, without changing
-- the normal workspace guard or modifying any existing workout on installation.
begin;

create table public.forma_session_corrections (
  owner_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null check (action_id ~ '^[a-f0-9]{64}$'),
  session_id text not null,
  operation text not null check (operation in ('edit','delete')),
  before_session jsonb not null check (jsonb_typeof(before_session)='object'),
  after_session jsonb,
  base_revision bigint not null,
  request_fingerprint text not null,
  created_at timestamptz not null default now(),
  primary key(owner_id, action_id)
);
create index forma_corrections_session_idx on public.forma_session_corrections(owner_id,session_id,created_at desc);
alter table public.forma_session_corrections enable row level security;
alter table public.forma_session_corrections force row level security;
revoke all on public.forma_session_corrections from public,anon,authenticated;
grant select,insert on public.forma_session_corrections to authenticated;
create policy own_select on public.forma_session_corrections for select to authenticated
  using (owner_id=(select auth.uid()));
create policy own_insert on public.forma_session_corrections for insert to authenticated
  with check (owner_id=(select auth.uid()));

create function public.forma_correct_session(p_data jsonb,p_session_id text,p_expected_revision bigint,p_action_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  u uuid := auth.uid(); rev bigint; before_data jsonb; original jsonb;
  replacement jsonb; receipt public.forma_session_corrections%rowtype;
  fingerprint text := md5(p_data::text); result jsonb;
begin
  if u is null then raise exception 'FORMA: Iniciá sesión para continuar.' using errcode='42501'; end if;
  if p_action_id is null or p_action_id !~ '^[a-f0-9]{64}$' or p_session_id is null then
    raise exception 'FORMA: La corrección no es válida.';
  end if;
  select revision into rev from public.forma_workspaces where owner_id=u for update;
  if rev is null then raise exception 'FORMA: La cuenta no está inicializada.'; end if;
  select * into receipt from public.forma_session_corrections where owner_id=u and action_id=p_action_id;
  if found then
    if receipt.request_fingerprint is distinct from fingerprint or receipt.session_id is distinct from p_session_id then
      raise exception 'FORMA: Este intento de corrección ya se utilizó con otros datos.';
    end if;
    return public.forma_load_workspace();
  end if;
  if rev <> p_expected_revision then raise exception 'FORMA_CONFLICT' using errcode='40001'; end if;
  if jsonb_typeof(p_data->'sessions') is distinct from 'array' then
    raise exception 'FORMA: Los registros enviados no son válidos.';
  end if;
  before_data := public.forma_load_workspace()->'data';
  if (p_data-'sessions') is distinct from (before_data-'sessions') then
    raise exception 'FORMA: Corregí el entrenamiento sin cambiar las rutinas ni otros datos.';
  end if;
  select value into original from jsonb_array_elements(before_data->'sessions') where value->>'id'=p_session_id;
  if original is null or coalesce((original->>'demo')::boolean,false) then
    raise exception 'FORMA: Ese entrenamiento no está disponible para corregir.';
  end if;
  if (select count(*) from jsonb_array_elements(p_data->'sessions') where value->>'id'=p_session_id)>1 then
    raise exception 'FORMA: Hay identificadores duplicados.';
  end if;
  select value into replacement from jsonb_array_elements(p_data->'sessions') where value->>'id'=p_session_id;
  if replacement is not null then
    if replacement->>'routineId' is distinct from original->>'routineId'
      or coalesce((replacement->>'demo')::boolean,false)
      or jsonb_typeof(replacement->'exercises') is distinct from 'array'
      or jsonb_array_length(replacement->'exercises')=0 then
      raise exception 'FORMA: Conservá la identidad del entrenamiento y al menos un ejercicio.';
    end if;
  end if;
  -- All other sessions must be exactly identical, including their order.
  if (select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) from jsonb_array_elements(p_data->'sessions') with ordinality as x(value,ord) where value->>'id'<>p_session_id)
    is distinct from
    (select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) from jsonb_array_elements(before_data->'sessions') with ordinality as x(value,ord) where value->>'id'<>p_session_id) then
    raise exception 'FORMA: Solo se puede corregir un entrenamiento por operación.';
  end if;
  -- Copy first. If any following statement fails, the whole transaction rolls back.
  insert into public.forma_session_corrections(owner_id,action_id,session_id,operation,before_session,after_session,base_revision,request_fingerprint)
    values(u,p_action_id,p_session_id,case when replacement is null then 'delete' else 'edit' end,original,replacement,rev,fingerprint);
  delete from public.forma_workout_sessions where owner_id=u and id=p_session_id;
  if replacement is null then
    -- Keep ordering contiguous so later completions cannot reuse an occupied
    -- position after deleting an earlier session.
    with ordered as (
      select id,row_number() over(order by position,id)-1 as new_position
      from public.forma_workout_sessions where owner_id=u
    )
    update public.forma_workout_sessions s set position=ordered.new_position
      from ordered where s.owner_id=u and s.id=ordered.id;
  end if;
  -- The existing transaction normalizes sets/cardio, validates FKs and increments
  -- the revision. Its immutable-history guard still protects every other session.
  result := public.forma_save_workspace(p_data,p_expected_revision,null);
  return result;
end $$;
revoke all on function public.forma_correct_session(jsonb,text,bigint,text) from public,anon;
grant execute on function public.forma_correct_session(jsonb,text,bigint,text) to authenticated;
commit;
