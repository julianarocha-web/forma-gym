-- Legacy 003 inspection ONLY. INSERT=true / security_definer=false is vulnerable.
-- For an installed original 003 use before_004.sql, then the 004 procedure.
begin transaction read only;
select count(*) as auditorias_existentes from public.forma_session_corrections;
select has_table_privilege('authenticated','public.forma_session_corrections','INSERT') as insercion_directa,
  p.prosecdef as security_definer, pg_get_userbyid(p.proowner) as propietario
from pg_proc p where p.oid='public.forma_correct_session(jsonb,text,bigint,text)'::regprocedure;
select policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename='forma_session_corrections' order by policyname;
rollback;
