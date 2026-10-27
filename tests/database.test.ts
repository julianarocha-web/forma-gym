import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  initialData,
  completeSession,
  dateKey,
  type AppData,
} from "../src/data";

async function bootstrap(db: PGlite, a: string, b: string) {
  await db.exec(`
      create role authenticated; create role anon; create role authenticator;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
      grant usage on schema auth,storage,public to authenticated,anon;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
      create function storage.filename(text) returns text language sql immutable as $$ select (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)] $$;
      insert into auth.users values('${a}'),('${b}');
  `);
}

test("PostgreSQL: instalación nueva 001 → 002 → 003 → 004, transacciones y RLS", async (t) => {
  const db = new PGlite();
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  try {
    await bootstrap(db, a, b);
    await db.exec(
      await readFile("supabase/migrations/202610270001_forma.sql", "utf8"),
    );
    const preflight = await readFile("supabase/checks/before_003.sql", "utf8");
    const beforeUpgrade = await readFile(
      "supabase/checks/before_004.sql",
      "utf8",
    );
    const postflight = (
      await readFile("supabase/checks/after_004.sql", "utf8")
    ).replace(
      "expected_audit_count bigint := null",
      "expected_audit_count bigint := 0",
    );
    await t.test(
      "preflight rechaza 002 faltante y no modifica la base",
      async () => {
        await assert.rejects(() => db.exec(preflight), /catalogo de 002/);
        await db.exec("rollback");
      },
    );
    await db.exec(
      await readFile("supabase/migrations/202610270002_catalog.sql", "utf8"),
    );
    await t.test(
      "preflight acepta 001 y 002 instaladas sin historial CLI",
      async () => {
        await db.exec(preflight);
      },
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202610270003_session_corrections.sql",
        "utf8",
      ),
    );
    await t.test(
      "instalación nueva: 003 conserva el SQL original y 004 protege sin auditorías previas",
      async () => {
        await db.exec(beforeUpgrade);
        const legacy = await db.query<{
          invoker: boolean;
          direct_insert: boolean;
        }>(`select not prosecdef as invoker,
        has_table_privilege('authenticated','public.forma_session_corrections','INSERT') as direct_insert
        from pg_proc where oid='public.forma_correct_session(jsonb,text,bigint,text)'::regprocedure`);
        assert.deepEqual(legacy.rows[0], {
          invoker: true,
          direct_insert: true,
        });
        await db.exec(
          await readFile(
            "supabase/migrations/202610270004_protect_session_audit.sql",
            "utf8",
          ),
        );
      },
    );
    await t.test(
      "postflight valida 004 y detecta permisos directos inseguros",
      async () => {
        await db.exec(postflight);
        await assert.rejects(() => db.exec(preflight), /hay objetos de 003/);
        await db.exec("rollback");
        await db.exec(
          "grant insert on public.forma_session_corrections to authenticated",
        );
        await assert.rejects(() => db.exec(postflight), /permisos inesperados/);
        await db.exec(
          "rollback; revoke insert on public.forma_session_corrections from authenticated",
        );
        await db.exec(postflight);
      },
    );
    async function asUser(id: string) {
      await db.exec(
        `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
      );
      await db.query("select public.forma_initialize_account()");
    }
    async function load() {
      return (
        await db.query<{ value: { revision: number; data: AppData } }>(
          "select public.forma_load_workspace() as value",
        )
      ).rows[0].value;
    }
    async function save(
      data: AppData,
      revision: number,
      hash: string | null = null,
    ) {
      return (
        await db.query<{ value: { revision: number; data: AppData } }>(
          "select public.forma_save_workspace($1::jsonb,$2::bigint,$3::text) as value",
          [JSON.stringify(data), revision, hash],
        )
      ).rows[0].value;
    }
    let fixture = initialData();
    const routine = fixture.routines[0];
    routine.exercises[0].plannedSets = Array.from(
      { length: routine.exercises[0].sets },
      (_, i) => ({ weight: i * 5, reps: 10 - i }),
    );
    fixture = completeSession(
      fixture,
      routine,
      dateKey(),
      routine.exercises.map((e, i) => ({
        ...e,
        performedSets:
          i === 0
            ? [
                { weight: 30, reps: 12 },
                { weight: 35, reps: 8 },
              ]
            : [{ weight: e.weight, reps: e.reps }],
      })),
      "Real",
    );
    await asUser(a);
    await t.test(
      "la auditoría no admite inserciones inventadas ni cambios directos del cliente",
      async () => {
        for (const owner of [a, b]) {
          await assert.rejects(
            () =>
              db.query(
                "insert into public.forma_session_corrections(owner_id,action_id,session_id,operation,before_session,base_revision,request_fingerprint) values($1,$2,'inventado','edit','{}',0,'inventado')",
                [owner, "0".repeat(64)],
              ),
            /permission denied/,
          );
        }
        await assert.rejects(
          () =>
            db.query(
              "update public.forma_session_corrections set before_session='{}'",
            ),
          /permission denied/,
        );
        await assert.rejects(
          () => db.query("delete from public.forma_session_corrections"),
          /permission denied/,
        );
        const roles = await db.query<{ safe: boolean }>(`select
        not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole
        and not rolcreatedb and not rolreplication and rolinherit
        and not pg_has_role('authenticated',oid,'MEMBER')
        and not pg_has_role('anon',oid,'MEMBER') as safe
        from pg_roles where rolname='forma_session_corrector'`);
        assert.equal(roles.rows[0].safe, true);
        const rpc = await db.query<{ safe: boolean }>(`select prosecdef
        and proowner='forma_session_corrector'::regrole
        and 'row_security=on'=any(proconfig)
        and 'search_path=""'=any(proconfig) as safe
        from pg_proc where oid='public.forma_correct_session(jsonb,text,bigint,text)'::regprocedure`);
        assert.equal(rpc.rows[0].safe, true);
      },
    );
    await t.test(
      "catálogo general disponible con permisos de solo lectura",
      async () => {
        assert.equal(
          (await db.query("select * from public.forma_shared_exercises")).rows
            .length,
          17,
        );
        await assert.rejects(
          () =>
            db.query(
              "update public.forma_shared_exercises set name='Intruso' where id='squat'",
            ),
          /permission denied/,
        );
      },
    );
    const first = await save(fixture, 0);
    await t.test(
      "round-trip conserva historial y pesos/repeticiones distintos por serie",
      async () => {
        assert.equal(first.revision, 1);
        assert.deepEqual(first.data.routines, fixture.routines);
        assert.deepEqual(first.data.sessions, fixture.sessions);
        const sets = await db.query<{ weight_kg: string; reps: number }>(
          "select weight_kg,reps from public.forma_workout_sets where session_exercise_id=$1 order by set_index",
          [routine.exercises[0].id],
        );
        assert.deepEqual(
          sets.rows.map((s) => [Number(s.weight_kg), s.reps]),
          [
            [30, 12],
            [35, 8],
          ],
        );
      },
    );
    await t.test(
      "B no puede leer, modificar, borrar ni insertar filas del propietario A",
      async () => {
        await asUser(b);
        assert.equal((await load()).data.sessions.length, 0);
        for (const table of [
          "forma_profiles",
          "forma_exercises",
          "forma_routines",
          "forma_routine_exercises",
          "forma_calendar_entries",
          "forma_workout_sessions",
          "forma_session_exercises",
          "forma_workout_sets",
          "forma_cardio_records",
          "forma_workout_drafts",
          "forma_local_imports",
        ]) {
          assert.equal(
            (
              await db.query(
                `select * from public.${table} where owner_id=$1`,
                [a],
              )
            ).rows.length,
            0,
            table,
          );
          assert.equal(
            (
              await db.query(
                `delete from public.${table} where owner_id=$1 returning *`,
                [a],
              )
            ).rows.length,
            0,
            table,
          );
        }
        assert.equal(
          (
            await db.query(
              "update public.forma_profiles set display_name=$1 where owner_id=$2 returning *",
              ["intruso", a],
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          () =>
            db.query(
              "insert into public.forma_exercises(owner_id,id,name,activity_type) values($1,$2,$3,$4)",
              [a, "forged", "Intruso", "strength"],
            ),
          /row-level security/,
        );
        await db.query(
          "insert into public.forma_routines(owner_id,id,name,position,record) values($1,$2,$3,0,$4::jsonb)",
          [b, "b-routine", "B", JSON.stringify({ id: "b-routine", name: "B" })],
        );
        await assert.rejects(
          () =>
            db.query(
              "insert into public.forma_routine_exercises(owner_id,routine_id,id,exercise_id,position,record) values($1,$2,$3,$4,0,$5::jsonb)",
              [
                b,
                "b-routine",
                "b-row",
                fixture.catalog[0].id,
                JSON.stringify({
                  id: "b-row",
                  exerciseId: fixture.catalog[0].id,
                }),
              ],
            ),
          /foreign key/,
        );
      },
    );
    await t.test(
      "editar rutinas no altera el historial; se rechazan revisiones obsoletas y cambios históricos",
      async () => {
        await asUser(a);
        const next = await load();
        next.data.routines[0].name = "Nueva rutina";
        const saved = await save(next.data, 1);
        assert.deepEqual(saved.data.sessions, fixture.sessions);
        await assert.rejects(() => save(next.data, 1), /FORMA_CONFLICT/);
        const corrupt = structuredClone(saved.data);
        corrupt.sessions = [];
        await assert.rejects(() => save(corrupt, 2), /historial anterior/);
        assert.equal((await load()).revision, 2);
      },
    );
    await t.test(
      "una transacción fallida no borra las rutinas previas; importación repetida es idempotente",
      async () => {
        const before = await load();
        const bad = structuredClone(before.data);
        bad.routines[0].exercises[0].exerciseId = "no-existe";
        await assert.rejects(() => save(bad, 2), /foreign key/);
        assert.deepEqual(await load(), before);
        const imported = await save(before.data, 2, "a".repeat(64));
        assert.equal(imported.revision, 3);
        assert.deepEqual(await save(before.data, 0, "a".repeat(64)), imported);
      },
    );
    await t.test(
      "corrección explícita conserva copia, series, idempotencia y aislamiento; fallo revierte todo",
      async () => {
        await asUser(a);
        const before = await load();
        const id = before.data.sessions[0].id;
        const next = structuredClone(before.data);
        next.sessions[0].exercises[0].performedSets = [
          { weight: 80, reps: 6 },
          { weight: 85, reps: 4 },
        ];
        async function correct(
          data: AppData,
          revision: number,
          action: string,
        ) {
          return (
            await db.query<{ value: { data: AppData; revision: number } }>(
              "select public.forma_correct_session($1::jsonb,$2,$3::bigint,$4) as value",
              [JSON.stringify(data), id, revision, action],
            )
          ).rows[0].value;
        }
        await assert.rejects(
          () => save(next, before.revision),
          /historial anterior/,
        );
        const saved = await correct(next, before.revision, "c".repeat(64));
        assert.deepEqual(saved.data.sessions, next.sessions);
        assert.deepEqual(
          (
            await db.query<{ before_session: unknown }>(
              "select before_session from public.forma_session_corrections where owner_id=$1",
              [a],
            )
          ).rows[0].before_session,
          before.data.sessions[0],
        );
        assert.deepEqual(
          await correct(next, before.revision, "c".repeat(64)),
          saved,
        );
        assert.equal(
          (await db.query("select * from public.forma_session_corrections"))
            .rows.length,
          1,
        );
        const invalid = structuredClone(saved.data);
        invalid.sessions[0].exercises[0].exerciseId = "missing-exercise";
        await assert.rejects(
          () => correct(invalid, saved.revision, "d".repeat(64)),
          /foreign key/,
        );
        assert.deepEqual(await load(), saved);
        assert.equal(
          (await db.query("select * from public.forma_session_corrections"))
            .rows.length,
          1,
        );
        await asUser(b);
        assert.equal(
          (
            await db.query(
              "select * from public.forma_session_corrections where owner_id=$1",
              [a],
            )
          ).rows.length,
          0,
        );
        const ownB = await load();
        await assert.rejects(
          () => correct(ownB.data, ownB.revision, "e".repeat(64)),
          /no está disponible/,
        );
        await asUser(a);
        const removed = {
          ...saved.data,
          sessions: saved.data.sessions.filter((s) => s.id !== id),
        };
        const deleted = await correct(removed, saved.revision, "f".repeat(64));
        assert.equal(deleted.data.sessions.length, 0);
        assert.equal(
          (
            await db.query(
              "select * from public.forma_workout_sets where owner_id=$1",
              [a],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.forma_session_corrections where owner_id=$1",
              [a],
            )
          ).rows.length,
          2,
        );
        assert.deepEqual(deleted.data.routines, saved.data.routines);
        let appended = completeSession(
          deleted.data,
          routine,
          dateKey(),
          routine.exercises,
          "Nueva sesión",
        );
        let current = await save(appended, deleted.revision);
        appended = completeSession(
          current.data,
          routine,
          "2026-01-01",
          routine.exercises,
          "Otra fecha",
        );
        current = await save(appended, current.revision);
        const firstId = current.data.sessions[0].id;
        const withoutFirst = {
          ...current.data,
          sessions: current.data.sessions.filter((s) => s.id !== firstId),
        };
        const afterDelete = (
          await db.query<{ value: { data: AppData; revision: number } }>(
            "select public.forma_correct_session($1::jsonb,$2,$3::bigint,$4) as value",
            [
              JSON.stringify(withoutFirst),
              firstId,
              current.revision,
              "1".repeat(64),
            ],
          )
        ).rows[0].value;
        const third = completeSession(
          afterDelete.data,
          routine,
          "2026-01-02",
          routine.exercises,
          "Después de borrar",
        );
        const final = await save(third, afterDelete.revision);
        assert.deepEqual(final.data.sessions, third.sessions);
      },
    );
    await t.test(
      "Storage privado impide lecturas, escrituras y cambios de carpeta ajenos",
      async () => {
        await asUser(a);
        await db.query(
          "insert into storage.objects(bucket_id,name) values($1,$2)",
          ["forma-private", `${a}/photo.webp`],
        );
        await asUser(b);
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          0,
        );
        await assert.rejects(
          () =>
            db.query(
              "insert into storage.objects(bucket_id,name) values($1,$2)",
              ["forma-private", `${a}/intruso.webp`],
            ),
          /row-level security/,
        );
        await db.query(
          "insert into storage.objects(bucket_id,name) values($1,$2)",
          ["forma-private", `${b}/photo.webp`],
        );
        await assert.rejects(
          () =>
            db.query("update storage.objects set name=$1 where name=$2", [
              `${a}/renamed.webp`,
              `${b}/photo.webp`,
            ]),
          /row-level security/,
        );
      },
    );
    await t.test(
      "anónimo no puede consultar ni ejecutar operaciones privadas",
      async () => {
        await db.exec(
          "reset role; select set_config('request.jwt.claim.sub','',false); set role anon;",
        );
        await assert.rejects(
          () => db.query("select * from public.forma_profiles"),
          /permission denied/,
        );
        await assert.rejects(
          () => db.query("select public.forma_load_workspace()"),
          /permission denied/,
        );
        await assert.rejects(
          () => db.query("select * from public.forma_session_corrections"),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            db.query(
              "select public.forma_correct_session('{}'::jsonb,'x',0,'x')",
            ),
          /permission denied/,
        );
      },
    );
  } catch (error) {
    throw new Error((error as Error).message);
  } finally {
    await db.close();
  }
});

test("PostgreSQL: actualizar 003 antigua con datos y auditorías existentes conserva todas las filas", async (t) => {
  const db = new PGlite();
  const a = "33333333-3333-4333-8333-333333333333";
  const b = "44444444-4444-4444-8444-444444444444";
  const upgrade = await readFile(
    "supabase/migrations/202610270004_protect_session_audit.sql",
    "utf8",
  );
  const preflight = await readFile("supabase/checks/before_004.sql", "utf8");
  const postflight = await readFile("supabase/checks/after_004.sql", "utf8");
  const historyReport = await readFile(
    "supabase/checks/migration_history.sql",
    "utf8",
  );
  async function asUser(id: string) {
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`,
    );
    await db.query("select public.forma_initialize_account()");
  }
  async function load() {
    return (
      await db.query<{ value: { data: AppData; revision: number } }>(
        "select public.forma_load_workspace() as value",
      )
    ).rows[0].value;
  }
  async function snapshotRows() {
    await db.exec("reset role");
    const tables = (
      await db.query<{ name: string }>(
        "select tablename as name from pg_tables where schemaname='public' and tablename like 'forma_%' order by tablename",
      )
    ).rows;
    const result: Record<string, unknown[]> = {};
    for (const { name } of tables) {
      assert.match(name, /^forma_[a-z_]+$/);
      result[name] = (
        await db.query(
          `select to_jsonb(t) as row from public.${name} t order by to_jsonb(t)::text`,
        )
      ).rows;
    }
    return result;
  }
  const checkedPostflight = (count: number) =>
    postflight.replace(
      "expected_audit_count bigint := null",
      `expected_audit_count bigint := ${count}`,
    );
  try {
    await bootstrap(db, a, b);
    for (const migration of [
      "202610270001_forma.sql",
      "202610270002_catalog.sql",
      "202610270003_session_corrections.sql",
    ]) {
      await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
    }
    for (const owner of [a, b]) {
      await asUser(owner);
      let fixture = initialData();
      const routine = fixture.routines[0];
      fixture = completeSession(
        fixture,
        routine,
        dateKey(),
        routine.exercises.map((e) => ({
          ...e,
          performedSets: [{ weight: e.weight, reps: e.reps }],
        })),
        "Conservar",
      );
      await db.query("select public.forma_save_workspace($1::jsonb,0,null)", [
        JSON.stringify(fixture),
      ]);
      await db.query(
        "update public.forma_profiles set display_name='Perfil existente',theme='dark',unit='lb' where owner_id=$1",
        [owner],
      );
      const old = await load();
      const corrected = structuredClone(old.data);
      corrected.sessions[0].exercises[0].performedSets![0].weight += 2.5;
      await db.query(
        "select public.forma_correct_session($1::jsonb,$2,$3,$4)",
        [
          JSON.stringify(corrected),
          corrected.sessions[0].id,
          old.revision,
          (owner === a ? "a" : "b").repeat(64),
        ],
      );
    }
    // Reproduce the old INSERT vulnerability, then preserve even this unverified legacy row.
    await asUser(a);
    await db.query(
      "insert into public.forma_session_corrections(owner_id,action_id,session_id,operation,before_session,base_revision,request_fingerprint) values($1,$2,'legacy-unverified','edit',$3::jsonb,0,'legacy')",
      [a, "0".repeat(64), JSON.stringify({ legacyUnverified: true })],
    );
    const stateA = await load();
    await asUser(b);
    const stateB = await load();
    const beforeRows = await snapshotRows();
    const beforeCount = beforeRows.forma_session_corrections.length;
    assert.equal(beforeCount, 3);
    const beforeOid = (
      await db.query<{ oid: number }>(
        "select 'public.forma_correct_session(jsonb,text,bigint,text)'::regprocedure::oid as oid",
      )
    ).rows[0].oid;

    await t.test(
      "chequeos de solo lectura aceptan 003 antigua y reportan historial ausente/existente",
      async () => {
        await db.exec(historyReport);
        await db.exec(preflight);
        await db.exec(`create schema supabase_migrations;
        create table supabase_migrations.schema_migrations(version text primary key,name text);
        insert into supabase_migrations.schema_migrations values('202610270001','forma'),('202610270002','catalog'),('202610270003','session_corrections');`);
        await db.exec(historyReport);
        await db.exec(preflight);
      },
    );
    await t.test(
      "un permiso heredado inesperado revierte atómicamente toda la 004",
      async () => {
        await db.exec(
          "create role legacy_audit_writer; grant legacy_audit_writer to authenticated; grant insert on public.forma_session_corrections to legacy_audit_writer",
        );
        await assert.rejects(
          () => db.exec(upgrade),
          /Permisos heredados inesperados/,
        );
        await db.exec("rollback");
        assert.deepEqual(await snapshotRows(), beforeRows);
        assert.equal(
          (
            await db.query(
              "select 1 from pg_roles where rolname='forma_session_corrector'",
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query<{ prosecdef: boolean }>(
              "select prosecdef from pg_proc where oid='public.forma_correct_session(jsonb,text,bigint,text)'::regprocedure",
            )
          ).rows[0].prosecdef,
          false,
        );
        await db.exec(
          "revoke insert on public.forma_session_corrections from legacy_audit_writer",
        );
        await db.exec(preflight);
      },
    );
    await t.test(
      "004 conserva cantidad, contenido, fechas y propietarios; no cambia OID ni ejecuta correcciones",
      async () => {
        await db.exec(upgrade);
        assert.deepEqual(await snapshotRows(), beforeRows);
        assert.equal(
          (
            await db.query<{ oid: number }>(
              "select 'public.forma_correct_session(jsonb,text,bigint,text)'::regprocedure::oid as oid",
            )
          ).rows[0].oid,
          beforeOid,
        );
        await db.exec(checkedPostflight(beforeCount));
        await asUser(a);
        assert.deepEqual(await load(), stateA);
        await asUser(b);
        assert.deepEqual(await load(), stateB);
      },
    );
    await t.test(
      "postflight exige la cantidad previa y detecta un valor diferente",
      async () => {
        await db.exec("reset role");
        await assert.rejects(() => db.exec(postflight), /reemplazar null/);
        await db.exec("rollback");
        await assert.rejects(
          () => db.exec(checkedPostflight(beforeCount + 1)),
          /auditorias antes/,
        );
        await db.exec("rollback");
        await db.exec(checkedPostflight(beforeCount));
      },
    );
    await t.test(
      "repetir 004 falla sin modificar registros y no altera el historial por su cuenta",
      async () => {
        await assert.rejects(() => db.exec(upgrade), /funcion original de 003/);
        await db.exec("rollback");
        assert.deepEqual(await snapshotRows(), beforeRows);
        assert.deepEqual(
          (
            await db.query(
              "select version from supabase_migrations.schema_migrations order by version",
            )
          ).rows.map((v) => v.version),
          ["202610270001", "202610270002", "202610270003"],
        );
        // Simulate only the CLI's history receipt; never rerun an old migration.
        await db.exec(
          "insert into supabase_migrations.schema_migrations values('202610270004','protect_session_audit')",
        );
        await db.exec(historyReport);
      },
    );
    await t.test(
      "después de actualizar, rechaza falsificación y permite una corrección auténtica con RLS",
      async () => {
        await asUser(a);
        await assert.rejects(
          () =>
            db.query(
              "insert into public.forma_session_corrections(owner_id,action_id,session_id,operation,before_session,base_revision,request_fingerprint) values($1,$2,'inventado','edit','{}',0,'inventado')",
              [a, "f".repeat(64)],
            ),
          /permission denied/,
        );
        const next = structuredClone(stateA.data);
        next.sessions[0].exercises[0].performedSets![0] = {
          weight: 42.5,
          reps: 7,
        };
        const args = [
          JSON.stringify(next),
          next.sessions[0].id,
          stateA.revision,
          "c".repeat(64),
        ];
        await db.query(
          "select public.forma_correct_session($1::jsonb,$2,$3,$4)",
          args,
        );
        const audit = (
          await db.query<{ before_session: unknown; after_session: unknown }>(
            "select before_session,after_session from public.forma_session_corrections where action_id=$1",
            ["c".repeat(64)],
          )
        ).rows[0];
        assert.deepEqual(audit.before_session, stateA.data.sessions[0]);
        assert.deepEqual(audit.after_session, next.sessions[0]);
        const result = await load();
        assert.deepEqual(result.data, next);
        await db.query(
          "select public.forma_correct_session($1::jsonb,$2,$3,$4)",
          args,
        );
        assert.deepEqual(await load(), result);
        await asUser(b);
        assert.deepEqual(await load(), stateB);
        assert.equal(
          (
            await db.query(
              "select * from public.forma_session_corrections where owner_id=$1",
              [a],
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          () =>
            db.query(
              "select public.forma_correct_session($1::jsonb,$2,$3,$4)",
              [
                JSON.stringify(stateB.data),
                next.sessions[0].id,
                stateB.revision,
                "d".repeat(64),
              ],
            ),
          /no está disponible/,
        );
        await db.exec("reset role");
        await db.exec(checkedPostflight(beforeCount + 1));
      },
    );
  } finally {
    await db.close();
  }
});
