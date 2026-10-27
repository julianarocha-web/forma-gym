-- Upgrade the ORIGINAL 003. Do not rewrite/reapply 001, 002 or 003.
-- Metadata/privileges only: no row INSERT, UPDATE, DELETE or table recreation.
begin;
-- Prevent concurrent audit writes while counting and changing privileges.
lock table public.forma_session_corrections in share row exclusive mode;
do $upgrade$
declare
  audit_table oid := 'public.forma_session_corrections'::regclass;
  correction_rpc oid := to_regprocedure('public.forma_correct_session(jsonb,text,bigint,text)');
  audits_before bigint; audits_after bigint; p record; client_role text;
begin
  if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
    raise exception 'FORMA004: Ejecutar como administrador postgres para contar todas las auditorias.';
  end if;
  if correction_rpc is null or not exists(select 1 from pg_proc where oid=correction_rpc
    and not prosecdef and md5(replace(prosrc,chr(13),''))='3618f5c29ed4c881beb71f3fdb0eeb06'
    and 'search_path=""'=any(proconfig)) then
    raise exception 'FORMA004: Se requiere la funcion original de 003. No repetir ni sobrescribir otra version.';
  end if;
  if exists(select 1 from pg_roles where rolname='forma_session_corrector') then
    raise exception 'FORMA004: El rol ya existe. Revisar instalacion/historial antes de continuar.';
  end if;
  if not exists(select 1 from pg_class where oid=audit_table and relrowsecurity and relforcerowsecurity)
    or (select count(*) from pg_policy where polrelid=audit_table) <> 2 then
    raise exception 'FORMA004: RLS de auditoria diferente a 003; revisar sin borrar datos.';
  end if;
  for p in select * from pg_policy where polrelid=audit_table loop
    if not p.polpermissive or p.polroles <> array['authenticated'::regrole::oid]
      or not ((p.polname='own_select' and p.polcmd='r') or (p.polname='own_insert' and p.polcmd='a'))
      or regexp_replace(replace(pg_get_expr(case when p.polcmd='r' then p.polqual else p.polwithcheck end,audit_table),' AS uid',''),'[[:space:]()]','','g')
        is distinct from 'owner_id=SELECTauth.uid' then
      raise exception 'FORMA004: Politica inesperada: %. No se modifico.',p.polname;
    end if;
  end loop;
  select count(*) into audits_before from public.forma_session_corrections;

  -- This role can never log in or bypass RLS. Clients are NOT its members.
  create role forma_session_corrector nologin inherit nosuperuser nocreatedb
    nocreaterole noreplication nobypassrls;
  grant authenticated to forma_session_corrector;
  execute format('grant forma_session_corrector to %I',current_user);
  -- CREATE is needed only while transferring ownership of the existing function.
  grant usage,create on schema public to forma_session_corrector;
  revoke all on public.forma_session_corrections from public,anon,authenticated;
  grant select on public.forma_session_corrections to authenticated;
  grant select,insert on public.forma_session_corrections to forma_session_corrector;
  alter policy own_insert on public.forma_session_corrections to forma_session_corrector;
  alter policy own_insert on public.forma_session_corrections rename to server_insert;

  -- Keep the function's signature, OID and validated original body unchanged.
  -- Only its execution context changes; the caller's JWT still supplies auth.uid().
  alter function public.forma_correct_session(jsonb,text,bigint,text) security definer;
  alter function public.forma_correct_session(jsonb,text,bigint,text) set row_security=on;
  alter function public.forma_correct_session(jsonb,text,bigint,text) owner to forma_session_corrector;
  revoke create on schema public from forma_session_corrector;
  revoke all on function public.forma_correct_session(jsonb,text,bigint,text) from public,anon;
  grant execute on function public.forma_correct_session(jsonb,text,bigint,text) to authenticated;

  -- Fail atomically if inherited or column-level grants still permit forgery.
  if has_table_privilege('authenticated',audit_table,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('authenticated',audit_table,'INSERT,UPDATE,REFERENCES')
    or has_table_privilege('anon',audit_table,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_any_column_privilege('anon',audit_table,'SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception 'FORMA004: Permisos heredados inesperados. Se revierte toda la actualizacion.';
  end if;
  foreach client_role in array array['authenticated','anon','authenticator'] loop
    if exists(select 1 from pg_roles where rolname=client_role) then
      if pg_has_role(client_role,'forma_session_corrector','MEMBER') then
        raise exception 'FORMA004: Un cliente puede asumir el rol interno. Se revierte la actualizacion.';
      end if;
    end if;
  end loop;
  select count(*) into audits_after from public.forma_session_corrections;
  if audits_before <> audits_after then
    raise exception 'FORMA004: Cambio inesperado en auditorias (% -> %).',audits_before,audits_after;
  end if;
  raise notice 'FORMA004: auditorias antes=%, despues=%. No se modificaron filas.',audits_before,audits_after;
end $upgrade$;
commit;
