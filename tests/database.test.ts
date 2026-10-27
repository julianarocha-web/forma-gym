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

test("PostgreSQL: migración, transacciones, series e aislamiento RLS entre A, B y anónimo", async (t) => {
  const db = new PGlite();
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`
      create role authenticated; create role anon;
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
    await db.exec(
      await readFile("supabase/migrations/202610270001_forma.sql", "utf8"),
    );
    await db.exec(
      await readFile("supabase/migrations/202610270002_catalog.sql", "utf8"),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202610270003_session_corrections.sql",
        "utf8",
      ),
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
