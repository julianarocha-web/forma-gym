-- Forma. / PostgreSQL + RLS. Run once on a Supabase project, then run the seed.
-- Creates only forma_* objects. Does not read, delete or overwrite browser data.
begin;

create table public.forma_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  avatar jsonb,
  primary_goal text not null default 'Bienestar general' check (primary_goal in ('Ganar músculo','Perder grasa','Recomposición corporal','Mejorar fuerza','Mejorar resistencia','Bienestar general')),
  secondary_goals text[] not null default '{}' check (secondary_goals <@ array['Ganar músculo','Perder grasa','Recomposición corporal','Mejorar fuerza','Mejorar resistencia','Bienestar general']::text[] and cardinality(secondary_goals) <= 6),
  unit text not null default 'kg' check (unit in ('kg','lb')),
  theme text check (theme in ('light','dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.forma_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0)
);
create table public.forma_shared_exercises (
  id text primary key,
  name text not null,
  activity_type text not null check (activity_type in ('strength','cardio','mobility')),
  tags text[] not null default '{}',
  image jsonb
);
create table public.forma_exercises (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 128),
  shared_id text references public.forma_shared_exercises(id),
  name text not null check (length(trim(name)) between 1 and 120),
  activity_type text not null check (activity_type in ('strength','cardio','mobility')),
  tags text[] not null default '{}',
  legacy_ids text[] not null default '{}',
  image jsonb,
  has_image boolean not null default false,
  primary key (owner_id,id)
);
create index forma_exercises_shared_idx on public.forma_exercises(owner_id,shared_id);
create table public.forma_routines (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 128),
  name text not null check (length(trim(name)) between 1 and 100),
  position integer not null check (position >= 0),
  record jsonb not null check (jsonb_typeof(record)='object' and record->>'id'=id and record->>'name'=name),
  primary key (owner_id,id)
);
create table public.forma_routine_exercises (
  owner_id uuid not null,
  routine_id text not null,
  id text not null,
  exercise_id text not null,
  position integer not null check (position >= 0),
  record jsonb not null check (jsonb_typeof(record)='object' and record->>'id'=id and record->>'exerciseId'=exercise_id),
  planned_sets integer generated always as ((record->>'sets')::integer) stored,
  planned_reps integer generated always as ((record->>'reps')::integer) stored,
  planned_weight_kg numeric generated always as ((record->>'weight')::numeric) stored,
  primary key (owner_id,routine_id,id),
  foreign key (owner_id,routine_id) references public.forma_routines(owner_id,id) on delete cascade,
  foreign key (owner_id,exercise_id) references public.forma_exercises(owner_id,id),
  check (planned_sets >= 0 and planned_reps >= 0 and planned_weight_kg >= 0)
);
create index forma_routine_exercises_exercise_idx on public.forma_routine_exercises(owner_id,exercise_id);
create table public.forma_calendar_entries (
  owner_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  status text not null check (status in ('planned','rest')),
  -- Historical/deleted routine IDs remain meaningful; deliberately no live-routine FK.
  routine_id text,
  record jsonb not null check (record->>'date'=local_date::text and record->>'status'=status),
  primary key (owner_id,local_date),
  check (status <> 'planned' or routine_id is not null)
);
create table public.forma_workout_sessions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  local_date date not null,
  routine_id text not null,
  name text not null,
  demo boolean not null default false,
  position integer not null check (position >= 0),
  record jsonb not null check (record->>'id'=id and record->>'date'=local_date::text and record->>'routineId'=routine_id),
  primary key (owner_id,id)
);
create unique index forma_workout_once_idx on public.forma_workout_sessions(owner_id,local_date,routine_id) where not demo;
create index forma_sessions_date_idx on public.forma_workout_sessions(owner_id,local_date desc);
create table public.forma_session_exercises (
  owner_id uuid not null,
  session_id text not null,
  id text not null,
  exercise_id text not null,
  position integer not null check (position >= 0),
  record jsonb not null check (record->>'id'=id and record->>'exerciseId'=exercise_id),
  has_performed_sets boolean not null default false,
  primary key (owner_id,session_id,id),
  foreign key (owner_id,session_id) references public.forma_workout_sessions(owner_id,id) on delete cascade,
  foreign key (owner_id,exercise_id) references public.forma_exercises(owner_id,id)
);
create index forma_session_exercise_history_idx on public.forma_session_exercises(owner_id,exercise_id,session_id);
create table public.forma_workout_sets (
  owner_id uuid not null,
  session_id text not null,
  session_exercise_id text not null,
  set_index integer not null check (set_index >= 0),
  weight_kg numeric not null check (weight_kg >= 0),
  reps integer not null check (reps >= 0),
  primary key (owner_id,session_id,session_exercise_id,set_index),
  foreign key (owner_id,session_id,session_exercise_id) references public.forma_session_exercises(owner_id,session_id,id) on delete cascade
);
create table public.forma_cardio_records (
  owner_id uuid not null,
  session_id text not null,
  session_exercise_id text not null,
  duration_minutes numeric check (duration_minutes >= 0),
  distance_km numeric check (distance_km >= 0),
  resistance numeric check (resistance >= 0),
  primary key (owner_id,session_id,session_exercise_id),
  foreign key (owner_id,session_id,session_exercise_id) references public.forma_session_exercises(owner_id,session_id,id) on delete cascade
);
create table public.forma_workout_drafts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  draft_key text not null check (length(draft_key) between 1 and 300),
  exercises jsonb not null check (jsonb_typeof(exercises)='array'),
  primary key (owner_id,draft_key)
);
create table public.forma_local_imports (
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  primary key(owner_id,source_hash)
);

-- Every private relation has its own SELECT/INSERT/UPDATE/DELETE policy.
do $$
declare t text;
begin
  foreach t in array array['forma_profiles','forma_workspaces','forma_exercises','forma_routines','forma_routine_exercises','forma_calendar_entries','forma_workout_sessions','forma_session_exercises','forma_workout_sets','forma_cardio_records','forma_workout_drafts','forma_local_imports'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from anon, public',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
    execute format('create policy own_select on public.%I for select to authenticated using (owner_id = (select auth.uid()))',t);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))',t);
    execute format('create policy own_update on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',t);
    execute format('create policy own_delete on public.%I for delete to authenticated using (owner_id = (select auth.uid()))',t);
  end loop;
end $$;
alter table public.forma_shared_exercises enable row level security;
revoke all on public.forma_shared_exercises from public, anon, authenticated;
grant select on public.forma_shared_exercises to authenticated;
create policy shared_read on public.forma_shared_exercises for select to authenticated using (true);

create function public.forma_touch_profile() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger forma_profile_updated before update on public.forma_profiles for each row execute function public.forma_touch_profile();

create function public.forma_initialize_account() returns void
language plpgsql security invoker set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'FORMA: Iniciá sesión para continuar.' using errcode='42501'; end if;
  insert into public.forma_workspaces(owner_id) values(u) on conflict do nothing;
  insert into public.forma_profiles(owner_id,display_name)
    values(u,left(coalesce(auth.jwt()->'user_metadata'->>'display_name',''),80)) on conflict do nothing;
end $$;

create function public.forma_load_workspace() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare u uuid := auth.uid(); rev bigint; result jsonb;
begin
  if u is null then raise exception 'FORMA: Iniciá sesión para continuar.' using errcode='42501'; end if;
  select revision into rev from public.forma_workspaces where owner_id=u for share;
  if rev is null then raise exception 'FORMA: Inicializá tu cuenta antes de consultar los registros.'; end if;
  -- All subqueries use the same statement snapshot. Sets remain per-session values.
  select jsonb_build_object(
    'version',3,
    'catalog',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'type',e.activity_type,'tags',e.tags,'legacyIds',e.legacy_ids)
      || case when e.shared_id is null then '{}'::jsonb else jsonb_build_object('sharedId',e.shared_id) end
      || case when e.has_image then jsonb_build_object('image',e.image) else '{}'::jsonb end order by e.id)
      from public.forma_exercises e where e.owner_id=u),'[]'::jsonb),
    'routines',coalesce((select jsonb_agg(r.record || jsonb_build_object('exercises',coalesce((
      select jsonb_agg(x.record order by x.position) from public.forma_routine_exercises x where x.owner_id=u and x.routine_id=r.id
    ),'[]'::jsonb)) order by r.position) from public.forma_routines r where r.owner_id=u),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(s.record || jsonb_build_object('exercises',coalesce((
      select jsonb_agg(x.record || case when x.has_performed_sets then jsonb_build_object('performedSets',coalesce((
        select jsonb_agg(jsonb_build_object('weight',w.weight_kg,'reps',w.reps) order by w.set_index)
        from public.forma_workout_sets w where w.owner_id=u and w.session_id=s.id and w.session_exercise_id=x.id
      ),'[]'::jsonb)) else '{}'::jsonb end order by x.position)
      from public.forma_session_exercises x where x.owner_id=u and x.session_id=s.id
    ),'[]'::jsonb)) order by s.position) from public.forma_workout_sessions s where s.owner_id=u),'[]'::jsonb),
    'plans',coalesce((select jsonb_agg(c.record order by c.local_date) from public.forma_calendar_entries c where c.owner_id=u),'[]'::jsonb),
    'drafts',coalesce((select jsonb_object_agg(d.draft_key,d.exercises) from public.forma_workout_drafts d where d.owner_id=u),'{}'::jsonb)
  ) into result;
  return jsonb_build_object('revision',rev,'data',result);
end $$;

create function public.forma_save_workspace(p_data jsonb, p_expected_revision bigint, p_import_hash text default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  u uuid := auth.uid(); rev bigint; before_data jsonb; item jsonb; row_item jsonb;
  old_session jsonb; rpos integer; xpos integer; spos integer; setpos integer; set_item jsonb; entry record;
begin
  if u is null then raise exception 'FORMA: Iniciá sesión para guardar.' using errcode='42501'; end if;
  select revision into rev from public.forma_workspaces where owner_id=u for update;
  if rev is null then raise exception 'FORMA: La cuenta todavía no está inicializada.'; end if;
  if p_import_hash is not null and exists(select 1 from public.forma_local_imports where owner_id=u and source_hash=p_import_hash) then
    return public.forma_load_workspace();
  end if;
  if rev <> p_expected_revision then raise exception 'FORMA_CONFLICT' using errcode='40001'; end if;
  if p_data->>'version' is distinct from '3' or jsonb_typeof(p_data->'catalog') is distinct from 'array'
    or jsonb_typeof(p_data->'routines') is distinct from 'array' or jsonb_typeof(p_data->'sessions') is distinct from 'array'
    or jsonb_typeof(p_data->'plans') is distinct from 'array' or jsonb_typeof(p_data->'drafts') is distinct from 'object'
    or octet_length(p_data::text)>20000000 then raise exception 'FORMA: La información enviada no es válida.'; end if;
  before_data := public.forma_load_workspace()->'data';
  -- Routine edits and imports may append history, never silently erase/rewrite it.
  for old_session in select value from jsonb_array_elements(before_data->'sessions') loop
    select value into item from jsonb_array_elements(p_data->'sessions') where value->>'id'=old_session->>'id';
    if item is null or item <> old_session then raise exception 'FORMA: El historial anterior debe conservarse sin cambios.'; end if;
  end loop;
  if exists(select 1 from public.forma_exercises e where e.owner_id=u and not exists(
    select 1 from jsonb_array_elements(p_data->'catalog') x where x->>'id'=e.id
  )) then raise exception 'FORMA: No se pueden quitar ejercicios vinculados al historial.'; end if;
  if exists(select 1 from jsonb_array_elements(p_data->'catalog') x group by x->>'id' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(p_data->'routines') x group by x->>'id' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(p_data->'sessions') x group by x->>'id' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(p_data->'plans') x group by x->>'date' having count(*)>1)
    then raise exception 'FORMA: Hay identificadores duplicados en la importación.'; end if;
  for item in select value from jsonb_array_elements(p_data->'catalog') loop
    insert into public.forma_exercises(owner_id,id,shared_id,name,activity_type,tags,legacy_ids,image,has_image)
    values(u,item->>'id',item->>'sharedId',item->>'name',item->>'type',array(select jsonb_array_elements_text(item->'tags')),
      array(select jsonb_array_elements_text(coalesce(item->'legacyIds','[]'::jsonb))),item->'image',item ? 'image')
    on conflict(owner_id,id) do update set name=excluded.name,activity_type=excluded.activity_type,tags=excluded.tags,
      legacy_ids=excluded.legacy_ids,image=excluded.image,has_image=excluded.has_image,shared_id=excluded.shared_id;
  end loop;
  delete from public.forma_routines where owner_id=u and id not in (select x->>'id' from jsonb_array_elements(p_data->'routines') x);
  rpos := 0;
  for item in select value from jsonb_array_elements(p_data->'routines') loop
    insert into public.forma_routines(owner_id,id,name,position,record) values(u,item->>'id',item->>'name',rpos,item-'exercises')
    on conflict(owner_id,id) do update set name=excluded.name,position=excluded.position,record=excluded.record;
    delete from public.forma_routine_exercises where owner_id=u and routine_id=item->>'id';
    xpos := 0;
    for row_item in select value from jsonb_array_elements(item->'exercises') loop
      insert into public.forma_routine_exercises(owner_id,routine_id,id,exercise_id,position,record)
        values(u,item->>'id',row_item->>'id',row_item->>'exerciseId',xpos,row_item);
      xpos := xpos+1;
    end loop;
    rpos := rpos+1;
  end loop;
  spos := 0;
  for item in select value from jsonb_array_elements(p_data->'sessions') loop
    if not exists(select 1 from public.forma_workout_sessions where owner_id=u and id=item->>'id') then
      insert into public.forma_workout_sessions(owner_id,id,local_date,routine_id,name,demo,position,record)
        values(u,item->>'id',(item->>'date')::date,item->>'routineId',item->>'name',coalesce((item->>'demo')::boolean,false),spos,item-'exercises');
      xpos := 0;
      for row_item in select value from jsonb_array_elements(item->'exercises') loop
        insert into public.forma_session_exercises(owner_id,session_id,id,exercise_id,position,record,has_performed_sets)
          values(u,item->>'id',row_item->>'id',row_item->>'exerciseId',xpos,row_item-'performedSets',row_item ? 'performedSets');
        setpos := 0;
        for set_item in select value from jsonb_array_elements(coalesce(row_item->'performedSets','[]'::jsonb)) loop
          insert into public.forma_workout_sets(owner_id,session_id,session_exercise_id,set_index,weight_kg,reps)
            values(u,item->>'id',row_item->>'id',setpos,(set_item->>'weight')::numeric,(set_item->>'reps')::integer);
          setpos := setpos+1;
        end loop;
        if row_item->>'type' in ('cardio','mobility') then
          insert into public.forma_cardio_records(owner_id,session_id,session_exercise_id,duration_minutes,distance_km,resistance)
            values(u,item->>'id',row_item->>'id',(row_item->>'duration')::numeric,(row_item->>'distance')::numeric,(row_item->>'resistance')::numeric);
        end if;
        xpos := xpos+1;
      end loop;
    end if;
    spos := spos+1;
  end loop;
  delete from public.forma_calendar_entries where owner_id=u;
  for item in select value from jsonb_array_elements(p_data->'plans') loop
    if item->>'status'='rest' and exists(select 1 from public.forma_workout_sessions where owner_id=u and local_date=(item->>'date')::date and not demo)
      then raise exception 'FORMA: Un día completado no puede convertirse en descanso.'; end if;
    insert into public.forma_calendar_entries(owner_id,local_date,status,routine_id,record)
      values(u,(item->>'date')::date,item->>'status',item->>'routineId',item);
  end loop;
  delete from public.forma_workout_drafts where owner_id=u;
  for entry in select key,value from jsonb_each(p_data->'drafts') loop
    if exists(select 1 from jsonb_array_elements(entry.value) x where not exists(
      select 1 from public.forma_exercises e where e.owner_id=u and e.id=x->>'exerciseId'
    )) then raise exception 'FORMA: Un borrador apunta a un ejercicio inexistente.'; end if;
    insert into public.forma_workout_drafts(owner_id,draft_key,exercises) values(u,entry.key,entry.value);
  end loop;
  update public.forma_workspaces set revision=revision+1 where owner_id=u;
  if p_import_hash is not null then insert into public.forma_local_imports(owner_id,source_hash) values(u,p_import_hash); end if;
  return public.forma_load_workspace();
end $$;

revoke all on function public.forma_touch_profile() from public,anon,authenticated;
revoke all on function public.forma_initialize_account() from public,anon;
revoke all on function public.forma_load_workspace() from public,anon;
revoke all on function public.forma_save_workspace(jsonb,bigint,text) from public,anon;
grant execute on function public.forma_initialize_account(),public.forma_load_workspace(),public.forma_save_workspace(jsonb,bigint,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('forma-private','forma-private',false,1500000,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
do $$ begin if exists(select 1 from storage.buckets where id='forma-private' and public) then
  raise exception 'FORMA: El bucket forma-private debe ser privado. Revisalo antes de continuar.'; end if; end $$;
create policy forma_images_select on storage.objects for select to authenticated
  using (bucket_id='forma-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy forma_images_insert on storage.objects for insert to authenticated
  with check (bucket_id='forma-private' and (storage.foldername(name))[1]=(select auth.uid())::text and storage.filename(name) ~ '^[a-zA-Z0-9_-]{1,100}\.(webp|png|jpg|jpeg)$');
create policy forma_images_update on storage.objects for update to authenticated
  using (bucket_id='forma-private' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='forma-private' and (storage.foldername(name))[1]=(select auth.uid())::text and storage.filename(name) ~ '^[a-zA-Z0-9_-]{1,100}\.(webp|png|jpg|jpeg)$');
create policy forma_images_delete on storage.objects for delete to authenticated
  using (bucket_id='forma-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
