// Opt-in integration test. Never use personal accounts; never requires admin keys.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

if (process.env.FORMA_ALLOW_TEST_WRITES !== "yes") {
  throw new Error(
    "Prueba no ejecutada. Requiere dos cuentas vacías de prueba y FORMA_ALLOW_TEST_WRITES=yes. Leé docs/SUPABASE.md.",
  );
}
const envText = await readFile(
  new URL("../.env.local", import.meta.url),
  "utf8",
).catch(() => "");
function value(name) {
  const found = envText
    .match(new RegExp(`^${name}\\s*=\\s*([^\\r\\n]+)`, "m"))?.[1]
    ?.trim();
  return process.env[name] || found?.replace(/^(['"])(.*)\1$/, "$2");
}
const url = value("VITE_SUPABASE_URL"),
  key = value("VITE_SUPABASE_PUBLISHABLE_KEY");
if (!url || !key?.startsWith("sb_publishable_"))
  throw new Error("Configurá únicamente URL y clave pública publishable.");
const clients = ["A", "B"].map((label) => {
  if (
    !process.env[`FORMA_TEST_EMAIL_${label}`] ||
    !process.env[`FORMA_TEST_PASSWORD_${label}`]
  )
    throw new Error(`Faltan credenciales de la cuenta de prueba ${label}.`);
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
});
function ok(result, label) {
  if (result.error)
    throw new Error(
      `Falló: ${label} (${result.error.code || result.error.status || "servicio"}). No se imprimieron credenciales.`,
    );
  return result.data;
}
const run = `smoke-${randomUUID()}`;
const exerciseId = `${run}-exercise`,
  routineId = `${run}-routine`,
  sessionId = `${run}-session`,
  rowId = `${run}-row`;
let owner,
  path,
  wrote = false,
  failure = false;
try {
  for (const [index, client] of clients.entries()) {
    const label = index === 0 ? "A" : "B";
    ok(
      await client.auth.signInWithPassword({
        email: process.env[`FORMA_TEST_EMAIL_${label}`],
        password: process.env[`FORMA_TEST_PASSWORD_${label}`],
      }),
      `ingreso ${label}`,
    );
    ok(await client.rpc("forma_initialize_account"), `inicializar ${label}`);
    const snapshot = ok(
      await client.rpc("forma_load_workspace"),
      `consultar ${label}`,
    );
    const d = snapshot.data;
    assert.equal(
      d.catalog.length +
        d.routines.length +
        d.sessions.length +
        d.plans.length +
        Object.keys(d.drafts).length,
      0,
      `La cuenta ${label} contiene datos: no se modificará.`,
    );
  }
  const [a, b] = clients;
  owner = ok(await a.auth.getUser(), "identidad A").user.id;
  const other = ok(await b.auth.getUser(), "identidad B").user.id;
  assert.notEqual(owner, other, "Usá dos cuentas diferentes.");
  const original = ok(await a.rpc("forma_load_workspace"), "revisión A");
  const definition = {
    id: exerciseId,
    name: "Prueba aislada",
    type: "strength",
    tags: [],
  };
  const row = {
    ...definition,
    id: rowId,
    exerciseId,
    sets: 2,
    reps: 12,
    weight: 30,
  };
  const data = {
    version: 3,
    catalog: [definition],
    routines: [
      {
        id: routineId,
        name: "Prueba temporal",
        description: "",
        tags: [],
        exercises: [row],
      },
    ],
    sessions: [
      {
        id: sessionId,
        routineId,
        date: "2026-01-02",
        name: "Prueba temporal",
        exercises: [
          {
            ...row,
            performedSets: [
              { weight: 30, reps: 12 },
              { weight: 35, reps: 8 },
            ],
          },
        ],
      },
    ],
    plans: [],
    drafts: {},
  };
  // Mark before requesting: a lost response must still trigger cleanup of our exact IDs.
  wrote = true;
  ok(
    await a.rpc("forma_save_workspace", {
      p_data: data,
      p_expected_revision: original.revision,
      p_import_hash: null,
    }),
    "guardar sesión A",
  );
  const reload = ok(await a.rpc("forma_load_workspace"), "recuperar sesión A");
  assert.deepEqual(reload.data.sessions, data.sessions);
  const sets = ok(
    await a
      .from("forma_workout_sets")
      .select("weight_kg,reps,set_index")
      .eq("session_id", sessionId)
      .order("set_index"),
    "series A",
  );
  assert.deepEqual(
    sets.map((s) => [Number(s.weight_kg), s.reps]),
    [
      [30, 12],
      [35, 8],
    ],
  );
  for (const table of [
    "forma_profiles",
    "forma_workspaces",
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
      ok(
        await b.from(table).select("*").eq("owner_id", owner),
        `RLS lectura ${table}`,
      ).length,
      0,
    );
  }
  assert.equal(
    ok(
      await b
        .from("forma_routines")
        .update({ name: "Intruso" })
        .eq("owner_id", owner)
        .eq("id", routineId)
        .select("id"),
      "RLS update",
    ).length,
    0,
  );
  assert.equal(
    ok(
      await b
        .from("forma_routines")
        .delete()
        .eq("owner_id", owner)
        .eq("id", routineId)
        .select("id"),
      "RLS delete",
    ).length,
    0,
  );
  assert.ok(
    (
      await b
        .from("forma_exercises")
        .insert({
          owner_id: owner,
          id: `${run}-forged`,
          name: "Intruso",
          activity_type: "strength",
        })
    ).error,
    "RLS debe impedir INSERT ajeno",
  );
  assert.ok(
    (
      await a.rpc("forma_save_workspace", {
        p_data: data,
        p_expected_revision: original.revision,
        p_import_hash: null,
      })
    ).error,
    "Debe rechazar revisión antigua",
  );
  const general = ok(
    await b.from("forma_shared_exercises").select("id").limit(1),
    "catálogo general",
  );
  assert.ok(general.length, "Falta aplicar la migración del catálogo.");
  assert.ok(
    (
      await b
        .from("forma_shared_exercises")
        .update({ name: "Intruso" })
        .eq("id", general[0].id)
    ).error,
    "Catálogo general de solo lectura",
  );
  path = `${owner}/${run}.png`;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=",
    "base64",
  );
  ok(
    await a.storage
      .from("forma-private")
      .upload(path, png, { contentType: "image/png", upsert: false }),
    "subir foto privada",
  );
  assert.equal(
    ok(await a.storage.from("forma-private").download(path), "leer foto propia")
      .size,
    png.length,
  );
  assert.ok(
    (await b.storage.from("forma-private").download(path)).error,
    "B no debe descargar foto A",
  );
  assert.ok(
    (
      await b.storage
        .from("forma-private")
        .upload(path, png, { upsert: true, contentType: "image/png" })
    ).error,
    "B no debe reemplazar foto A",
  );
  await b.storage.from("forma-private").remove([path]); // RLS may return success with no affected objects.
  assert.equal(
    ok(
      await a.storage.from("forma-private").download(path),
      "foto conservada tras intento B",
    ).size,
    png.length,
  );
  // A fresh SDK client restores the same user's server workspace after signing in again.
  const fresh = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    ok(
      await fresh.auth.signInWithPassword({
        email: process.env.FORMA_TEST_EMAIL_A,
        password: process.env.FORMA_TEST_PASSWORD_A,
      }),
      "nuevo ingreso A",
    );
    assert.deepEqual(
      ok(
        await fresh.rpc("forma_load_workspace"),
        "restaurar desde otro cliente",
      ).data.sessions,
      data.sessions,
    );
  } finally {
    await fresh.auth.signOut({ scope: "local" });
  }
  console.log(
    "Correcto: persistencia, series reales, revisión, catálogo, RLS de dos cuentas y Storage privado. No comprueba entrega de correos, layout ni eliminación de cuentas.",
  );
} catch (error) {
  failure = true;
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : error.message || "Falló la prueba.",
  );
} finally {
  const a = clients[0];
  try {
    if (path)
      ok(
        await a.storage.from("forma-private").remove([path]),
        "limpiar foto temporal",
      );
    if (owner && wrote) {
      for (const [table, id] of [
        ["forma_workout_sessions", sessionId],
        ["forma_routines", routineId],
        ["forma_exercises", exerciseId],
      ])
        ok(
          await a.from(table).delete().eq("owner_id", owner).eq("id", id),
          `limpiar ${table}`,
        );
      console.log(
        "Se retiraron únicamente los registros temporales de esta ejecución; cuentas y perfiles se conservan.",
      );
    }
  } catch {
    failure = true;
    console.error(
      `No se completó la limpieza. Revisá exclusivamente los IDs con prefijo ${run}. No se borró información ajena a la prueba.`,
    );
  }
  await Promise.allSettled(
    clients.map((client) => client.auth.signOut({ scope: "local" })),
  );
}
process.exitCode = failure ? 1 : 0;
