-- Administrative SQL Editor, read-only. Absence is possible after manual SQL installs.
-- Reports metadata only; NEVER marks a migration as applied.
begin transaction read only;
select to_regclass('supabase_migrations.schema_migrations') is not null as existe_historial_cli;
do $$ declare m record; expected text; found_version boolean; begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'Sin historial CLI. Verificar esquema con before_004.sql antes de reparar SOLO versiones ya instaladas.';
  else
    for m in execute 'select version::text as version, to_jsonb(h)->>''name'' as name from supabase_migrations.schema_migrations h order by version' loop
      raise notice 'REMOTE: % (%)',m.version,coalesce(m.name,'sin nombre');
    end loop;
    foreach expected in array array['202610270001','202610270002','202610270003','202610270004'] loop
      execute 'select exists(select 1 from supabase_migrations.schema_migrations where version::text=$1)' into found_version using expected;
      raise notice 'Version % registrada: %',expected,found_version;
    end loop;
  end if;
end $$;
rollback;
