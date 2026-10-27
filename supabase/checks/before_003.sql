-- Legacy check ONLY for a database without 003. If original 003 exists, use before_004.sql.
-- SQL Editor, administrative role. Read-only. Run BEFORE repairing history.
-- Any exception means STOP: do not mark 001/002 as applied or install 003.
begin transaction read only;
do $$
declare t text; p record; f record; obj oid; expected text;
begin
  foreach t in array array['forma_profiles','forma_workspaces','forma_exercises',
    'forma_routines','forma_routine_exercises','forma_calendar_entries',
    'forma_workout_sessions','forma_session_exercises','forma_workout_sets',
    'forma_cardio_records','forma_workout_drafts','forma_local_imports'] loop
    obj := to_regclass('public.'||t);
    if obj is null then raise exception 'STOP: falta tabla de 001: %',t; end if;
    if not exists(select 1 from pg_class where oid=obj and relrowsecurity and relforcerowsecurity)
      then raise exception 'STOP: RLS/FORCE RLS incorrecto: %',t; end if;
    if not exists(select 1 from pg_constraint where conrelid=obj and contype='p')
      or not exists(select 1 from pg_attribute where attrelid=obj and attname='owner_id' and attnotnull)
      then raise exception 'STOP: falta identidad/propietario: %',t; end if;
    if has_table_privilege('anon',obj,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      then raise exception 'STOP: acceso anon inesperado: %',t; end if;
    foreach expected in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if not has_table_privilege('authenticated',obj,expected)
        then raise exception 'STOP: falta permiso authenticated % en %',expected,t; end if;
    end loop;
    if (select count(*) from pg_policy where polrelid=obj) <> 4
      then raise exception 'STOP: cantidad de politicas inesperada: %',t; end if;
    for p in select * from pg_policy where polrelid=obj loop
      if p.polroles <> array['authenticated'::regrole::oid] or not p.polpermissive
        or p.polname <> (case p.polcmd when 'r' then 'own_select' when 'a' then 'own_insert'
          when 'w' then 'own_update' when 'd' then 'own_delete' else '' end)
        then raise exception 'STOP: politica inesperada: %.%',t,p.polname; end if;
      -- Normalize only formatting emitted by pg_get_expr; do not accept OR true.
      if (p.polcmd in ('r','w','d') and
        regexp_replace(replace(pg_get_expr(p.polqual,obj),' AS uid',''),'[[:space:]()]','','g')
          is distinct from 'owner_id=SELECTauth.uid')
        or (p.polcmd in ('a','w') and
        regexp_replace(replace(pg_get_expr(p.polwithcheck,obj),' AS uid',''),'[[:space:]()]','','g')
          is distinct from 'owner_id=SELECTauth.uid')
        then raise exception 'STOP: filtro de propietario incorrecto: %.%',t,p.polname; end if;
    end loop;
  end loop;
  -- Composite FKs must include the owner on both sides.
  foreach t in array array['forma_routine_exercises','forma_session_exercises','forma_workout_sets','forma_cardio_records'] loop
    obj := to_regclass('public.'||t);
    if not exists(select 1 from pg_constraint c where c.conrelid=obj and c.contype='f')
      or exists(select 1 from pg_constraint c where c.conrelid=obj and c.contype='f' and
        (not exists(select 1 from pg_attribute a where a.attrelid=obj and a.attname='owner_id' and a.attnum=any(c.conkey))
        or not exists(select 1 from pg_attribute a where a.attrelid=c.confrelid and a.attname='owner_id' and a.attnum=any(c.confkey))))
      then raise exception 'STOP: FK sin aislamiento de propietario: %',t; end if;
  end loop;
  -- Source fingerprints from the checked-in 001, ignoring Windows CRLF only.
  for f in select * from (values
    ('public.forma_touch_profile()','b3eadeda82f2c43bf8e450434ea42a7a'),
    ('public.forma_initialize_account()','5f75c8c94af4724ccc1276be1fb4209a'),
    ('public.forma_load_workspace()','03e018aca2aed5cad280377f84fc0a19'),
    ('public.forma_save_workspace(jsonb,bigint,text)','e632feed91a4563b52ac54cc6e611666')
  ) as v(signature,body_md5) loop
    obj := to_regprocedure(f.signature);
    if obj is null then raise exception 'STOP: falta funcion de 001: %',f.signature; end if;
    if not exists(select 1 from pg_proc where oid=obj and not prosecdef
      and md5(replace(prosrc,chr(13),''))=f.body_md5 and 'search_path=""'=any(proconfig))
      then raise exception 'STOP: funcion diferente a 001: %',f.signature; end if;
    if has_function_privilege('anon',obj,'EXECUTE')
      then raise exception 'STOP: funcion accesible por anon: %',f.signature; end if;
    if f.signature <> 'public.forma_touch_profile()' and not has_function_privilege('authenticated',obj,'EXECUTE')
      then raise exception 'STOP: falta permiso RPC: %',f.signature; end if;
  end loop;
  obj := to_regclass('public.forma_shared_exercises');
  if obj is null then raise exception 'STOP: falta catalogo de 001'; end if;
  if not exists(select 1 from pg_class where oid=obj and relrowsecurity)
    or not has_table_privilege('authenticated',obj,'SELECT')
    or has_table_privilege('authenticated',obj,'INSERT,UPDATE,DELETE,TRUNCATE')
    or has_table_privilege('anon',obj,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    or (select count(*) from pg_policy where polrelid=obj) <> 1
    or not exists(select 1 from pg_policy where polrelid=obj and polcmd='r'
      and polroles=array['authenticated'::regrole::oid] and pg_get_expr(polqual,obj)='true')
    then raise exception 'STOP: permisos del catalogo incorrectos'; end if;
  if not exists(select 1 from storage.buckets where id='forma-private' and not public
    and file_size_limit=1500000 and allowed_mime_types @> array['image/jpeg','image/png','image/webp']
    and allowed_mime_types <@ array['image/jpeg','image/png','image/webp'])
    then raise exception 'STOP: bucket privado/configuracion de 001 faltante'; end if;
  if (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
    and policyname in ('forma_images_select','forma_images_insert','forma_images_update','forma_images_delete')
    and roles=array['authenticated']::name[]) <> 4
    then raise exception 'STOP: faltan politicas Storage de 001'; end if;
  if exists(select 1 from (values
    ('squat','Sentadilla con barra','strength',array['Cuádriceps','Glúteos','Barra'],'exercise-squat'),
    ('press','Prensa de piernas','strength',array['Cuádriceps','Máquina'],'exercise-press'),
    ('romanian','Peso muerto rumano','strength',array['Isquiotibiales','Glúteos','Barra'],'exercise-romanian'),
    ('extension','Extensión de cuádriceps','strength',array['Cuádriceps','Máquina'],'exercise-extension'),
    ('curl','Curl femoral','strength',array['Isquiotibiales','Máquina'],'exercise-curl'),
    ('bike','Bicicleta fija','cardio',array['Aeróbico','Bicicleta'],'exercise-bike'),
    ('bench','Press de banca','strength',array['Pecho','Tríceps','Barra'],'exercise-bench'),
    ('fly','Aperturas con mancuernas','strength',array['Pecho','Mancuernas'],'exercise-fly'),
    ('crunch','Crunch abdominal','strength',array['Abdomen','Peso corporal'],'exercise-crunch'),
    ('row','Remo con barra','strength',array['Espalda','Barra'],'exercise-row'),
    ('pulldown','Jalón al pecho','strength',array['Espalda','Bíceps','Polea'],'exercise-pulldown'),
    ('shoulder','Press de hombros','strength',array['Hombros','Mancuernas'],'exercise-shoulder'),
    ('biceps','Curl de bíceps','strength',array['Bíceps','Mancuernas'],'exercise-biceps'),
    ('hip','Hip thrust','strength',array['Glúteos','Barra'],'exercise-hip'),
    ('sumo','Sentadilla sumo','strength',array['Glúteos','Aductores'],'exercise-sumo'),
    ('kick','Patada de glúteo','strength',array['Glúteos','Peso corporal'],'exercise-kick'),
    ('abduction','Abducción de cadera','strength',array['Glúteos','Máquina'],'exercise-abduction')
  ) as v(id,name,activity_type,tags,asset) left join public.forma_shared_exercises e using(id)
    where e.id is null or e.name is distinct from v.name or e.activity_type is distinct from v.activity_type
      or e.tags is distinct from v.tags or e.image is distinct from jsonb_build_object('kind','asset','id',v.asset))
    then raise exception 'STOP: catalogo de 002 incompleto o diferente'; end if;
  if to_regclass('public.forma_session_corrections') is not null
    or to_regprocedure('public.forma_correct_session(jsonb,text,bigint,text)') is not null
    or exists(select 1 from pg_roles where rolname='forma_session_corrector')
    then raise exception 'STOP: hay objetos de 003. No repetir ni borrar: revisar estado.'; end if;
  if not exists(select 1 from pg_roles where rolname=current_user and (rolcreaterole or rolsuper))
    then raise exception 'STOP: ejecutar como administrador con CREATEROLE'; end if;
end $$;
select 'OK: requisitos esenciales de 001/002 y ausencia de 003 verificados; no se modificaron datos' as resultado;
-- History is reported separately: its absence is normal for manual installs.
do $$ declare versions text; begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'Historial CLI ausente. Sincronizar SOLO despues de este chequeo.';
  else
    execute 'select string_agg(version::text,'', '' order by version) from supabase_migrations.schema_migrations' into versions;
    raise notice 'Versiones registradas: %',coalesce(versions,'(vacio)');
  end if;
end $$;
rollback;
