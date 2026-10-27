-- SQL Editor, postgres administrative role. Read-only.
-- Replace ONLY the NULL baseline below with auditorias_antes from before_004.sql.
-- Run before new corrections/tests; counts must match exactly.

begin transaction read only;

do $$
declare
  obj oid := to_regclass('public.forma_session_corrections');
  f oid;
  role_id oid;
  p record;
  normalized text;
  expected_audit_count bigint := null;
  actual_audit_count bigint;
begin
  if expected_audit_count is null or expected_audit_count < 0 then
    raise exception 'STOP: reemplazar null por auditorias_antes en expected_audit_count';
  end if;

  if not exists(
    select 1
    from pg_roles
    where rolname = current_user
      and (rolsuper or rolbypassrls)
  ) then
    raise exception 'STOP: usar postgres administrativo para contar sin RLS';
  end if;

  if obj is null then
    raise exception 'STOP: falta tabla de 004';
  end if;

  if not exists(
    select 1
    from pg_class
    where oid = obj
      and relrowsecurity
      and relforcerowsecurity
  ) then
    raise exception 'STOP: falta RLS/FORCE RLS en auditoria';
  end if;

  select oid
  into role_id
  from pg_roles
  where rolname = 'forma_session_corrector'
    and not rolcanlogin
    and not rolsuper
    and not rolbypassrls
    and not rolcreatedb
    and not rolcreaterole
    and not rolreplication
    and rolinherit;

  if role_id is null then
    raise exception 'STOP: propietario RPC inseguro o faltante';
  end if;

  if not pg_has_role(
    'forma_session_corrector',
    'authenticated',
    'USAGE'
  ) then
    raise exception 'STOP: el propietario no hereda las politicas authenticated';
  end if;

  for p in
    select rolname
    from pg_roles
    where rolname in ('authenticated', 'anon', 'authenticator')
  loop
    if pg_has_role(p.rolname, role_id, 'MEMBER') then
      raise exception 'STOP: % puede asumir el rol de auditoria', p.rolname;
    end if;
  end loop;

  if not has_table_privilege('authenticated', obj, 'SELECT')
    or has_table_privilege(
      'authenticated',
      obj,
      'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    )
    or has_any_column_privilege(
      'authenticated',
      obj,
      'INSERT,UPDATE,REFERENCES'
    )
    or has_table_privilege(
      'anon',
      obj,
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    )
    or has_any_column_privilege(
      'anon',
      obj,
      'SELECT,INSERT,UPDATE,REFERENCES'
    )
  then
    raise exception 'STOP: cliente con permisos inesperados sobre auditoria';
  end if;

  if not has_table_privilege(
    'forma_session_corrector',
    obj,
    'INSERT'
  )
    or has_table_privilege(
      'forma_session_corrector',
      obj,
      'UPDATE,DELETE,TRUNCATE'
    )
  then
    raise exception 'STOP: permisos del escritor de auditoria incorrectos';
  end if;

  if (
    select count(*)
    from pg_policy
    where polrelid = obj
  ) <> 2 then
    raise exception 'STOP: politicas adicionales en auditoria';
  end if;

  for p in
    select *
    from pg_policy
    where polrelid = obj
  loop
    if not p.polpermissive or not (
      (
        p.polname = 'own_select'
        and p.polcmd = 'r'
        and p.polroles = array['authenticated'::regrole::oid]
      )
      or
      (
        p.polname = 'server_insert'
        and p.polcmd = 'a'
        and p.polroles = array[role_id]
      )
    ) then
      raise exception 'STOP: politica de auditoria inesperada: %', p.polname;
    end if;

    normalized := regexp_replace(
      replace(
        pg_get_expr(
          case
            when p.polcmd = 'r' then p.polqual
            else p.polwithcheck
          end,
          obj
        ),
        ' AS uid',
        ''
      ),
      '[[:space:]()]',
      '',
      'g'
    );

    if normalized is distinct from 'owner_id=SELECTauth.uid' then
      raise exception 'STOP: filtro de propietario incorrecto en auditoria';
    end if;
  end loop;

  f := to_regprocedure(
    'public.forma_correct_session(jsonb,text,bigint,text)'
  );

  if f is null then
    raise exception 'STOP: falta RPC de 004';
  end if;

  if not exists(
    select 1
    from pg_proc
    where oid = f
      and prosecdef
      and proowner = role_id
      and 'search_path=""' = any(proconfig)
      and 'row_security=on' = any(proconfig)
      and md5(replace(prosrc, chr(13), '')) =
        '3618f5c29ed4c881beb71f3fdb0eeb06'
  )
    or has_function_privilege('anon', f, 'EXECUTE')
    or not has_function_privilege('authenticated', f, 'EXECUTE')
  then
    raise exception 'STOP: propietario/configuracion/permisos RPC incorrectos';
  end if;

  select count(*)
  into actual_audit_count
  from public.forma_session_corrections;

  if actual_audit_count <> expected_audit_count then
    raise exception
      'STOP: auditorias antes=%, despues=%. Revisar actividad concurrente y estado; no borrar ni reinstalar.',
      expected_audit_count,
      actual_audit_count;
  end if;
end $$;

select
  'OK: 004 protegida; cantidad de auditorias conservada; RPC y RLS verificados'
  as resultado;

select
  count(*) as auditorias_despues
from public.forma_session_corrections;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'forma_session_corrections'
order by policyname;

rollback;
