// Opt-in remote test. Keeps all synthetic records for inspection; no cleanup DELETEs.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

if (process.env.FORMA_ALLOW_AUDIT_TEST_WRITES !== "yes") {
  throw new Error(
    "Sin ejecutar: requiere dos cuentas vacías de prueba y FORMA_ALLOW_AUDIT_TEST_WRITES=yes. Leé docs/INSTALAR-004.md.",
  );
}
const text = await readFile(
  new URL("../.env.local", import.meta.url),
  "utf8",
).catch(() => "");
function value(name) {
  const line = text
    .split(/\r?\n/)
    .find(
      (line) =>
        line.trimStart().startsWith(`${name}=`) ||
        new RegExp(`^\\s*${name}\\s*=`).test(line),
    );
  return (
    process.env[name] ||
    line
      ?.slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2")
  );
}
const url = value("VITE_SUPABASE_URL");
const key = value("VITE_SUPABASE_PUBLISHABLE_KEY");
assert.ok(
  url && key?.startsWith("sb_publishable_"),
  "Configurá URL y clave pública publishable. Nunca service_role ni secret.",
);
const clients = ["A", "B"].map((label) => {
  assert.ok(
    process.env[`FORMA_TEST_EMAIL_${label}`] &&
      process.env[`FORMA_TEST_PASSWORD_${label}`],
    `Faltan credenciales de prueba ${label}.`,
  );
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
});
const anonymous = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function ok(result, label) {
  if (result.error)
    throw new Error(
      `${label}: falló (${result.error.code || result.error.status || "servicio"}). Credenciales omitidas.`,
    );
  return result.data;
}
const run = `audit-test-${randomUUID()}`;
const sessionId = `${run}-session`;
const actionId = randomBytes(32).toString("hex");
console.log(
  `Prueba ${run}. Los registros creados se conservarán, incluso si una comprobación falla.`,
);
try {
  const snapshots = [],
    owners = [];
  for (const [index, client] of clients.entries()) {
    const label = index === 0 ? "A" : "B";
    const signed = ok(
      await client.auth.signInWithPassword({
        email: process.env[`FORMA_TEST_EMAIL_${label}`],
        password: process.env[`FORMA_TEST_PASSWORD_${label}`],
      }),
      `Ingreso ${label}`,
    );
    owners.push(signed.user.id);
    ok(await client.rpc("forma_initialize_account"), `Inicialización ${label}`);
    const snapshot = ok(
      await client.rpc("forma_load_workspace"),
      `Lectura ${label}`,
    );
    const d = snapshot.data;
    assert.equal(
      d.catalog.length +
        d.routines.length +
        d.sessions.length +
        d.plans.length +
        Object.keys(d.drafts).length,
      0,
      `La cuenta ${label} contiene datos: se detuvo la prueba sin modificarlos.`,
    );
    snapshots.push(snapshot);
  }
  assert.notEqual(owners[0], owners[1], "Usá dos cuentas diferentes.");
  const [a, b] = clients;
  // This attempt must fail before any synthetic workout is written.
  const forgedId = randomBytes(32).toString("hex");
  const forged = await a.from("forma_session_corrections").insert({
    owner_id: owners[0],
    action_id: forgedId,
    session_id: sessionId,
    operation: "edit",
    before_session: { invented: true },
    after_session: { invented: true },
    base_revision: 0,
    request_fingerprint: "inventado",
  });
  assert.equal(
    forged.error?.code,
    "42501",
    `No se rechazó correctamente la inserción directa. DETENER. action_id=${forgedId}`,
  );
  assert.equal(
    (
      await anonymous
        .from("forma_session_corrections")
        .select("action_id")
        .limit(1)
    ).error?.code,
    "42501",
    "Anon no debe consultar auditorías.",
  );
  const exercise = {
    id: `${run}-exercise`,
    name: "Prueba de auditoría",
    type: "strength",
    tags: [],
    legacyIds: [],
  };
  const row = {
    ...exercise,
    id: `${run}-row`,
    exerciseId: exercise.id,
    sets: 2,
    reps: 12,
    weight: 30,
  };
  const routine = {
    id: `${run}-routine`,
    name: "Prueba de auditoría (conservar)",
    description: "",
    tags: [],
    exercises: [row],
  };
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const data = {
    ...snapshots[0].data,
    catalog: [exercise],
    routines: [routine],
    sessions: [
      {
        id: sessionId,
        routineId: routine.id,
        name: routine.name,
        date,
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
  };
  const saved = ok(
    await a.rpc("forma_save_workspace", {
      p_data: data,
      p_expected_revision: snapshots[0].revision,
      p_import_hash: null,
    }),
    "Crear entrenamiento sintético",
  );
  const corrected = structuredClone(saved.data);
  corrected.sessions[0].exercises[0].performedSets[1] = {
    weight: 32.5,
    reps: 10,
  };
  const args = {
    p_data: corrected,
    p_session_id: sessionId,
    p_expected_revision: saved.revision,
    p_action_id: actionId,
  };
  const result = ok(
    await a.rpc("forma_correct_session", args),
    "Corregir entrenamiento sintético",
  );
  assert.deepEqual(
    result.data,
    corrected,
    "La corrección debe conservar todos los demás datos.",
  );
  assert.equal(result.revision, saved.revision + 1);
  const audits = ok(
    await a
      .from("forma_session_corrections")
      .select("owner_id,session_id,operation,before_session,after_session")
      .eq("action_id", actionId),
    "Auditoría A",
  );
  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0], {
    owner_id: owners[0],
    session_id: sessionId,
    operation: "edit",
    before_session: saved.data.sessions[0],
    after_session: corrected.sessions[0],
  });
  assert.deepEqual(
    ok(await a.rpc("forma_correct_session", args), "Reintento idempotente"),
    result,
  );
  assert.equal(
    ok(
      await a
        .from("forma_session_corrections")
        .select("action_id")
        .eq("action_id", actionId),
      "Sin duplicados",
    ).length,
    1,
  );
  assert.deepEqual(
    ok(
      await b
        .from("forma_session_corrections")
        .select("action_id")
        .eq("owner_id", owners[0]),
      "RLS auditoría B",
    ),
    [],
  );
  assert.deepEqual(
    ok(
      await b
        .from("forma_workout_sessions")
        .select("id")
        .eq("owner_id", owners[0]),
      "RLS entrenamientos B",
    ),
    [],
  );
  const intruder = await b.rpc("forma_correct_session", {
    p_data: snapshots[1].data,
    p_session_id: sessionId,
    p_expected_revision: snapshots[1].revision,
    p_action_id: randomBytes(32).toString("hex"),
  });
  assert.equal(
    intruder.error?.code,
    "P0001",
    "B no debe poder corregir la sesión de A.",
  );
  assert.deepEqual(
    ok(await b.rpc("forma_load_workspace"), "B conservado"),
    snapshots[1],
  );
  assert.deepEqual(
    ok(await a.rpc("forma_load_workspace"), "A conservado"),
    result,
  );
  console.log(
    `OK: inserción falsificada rechazada, corrección real, antes/después, idempotencia y RLS A/B/anon. Sesión=${sessionId}; acción=${actionId}. No se eliminaron registros.`,
  );
} catch (error) {
  process.exitCode = 1;
  // Assertion messages contain test IDs only; never dump Auth responses/tokens.
  console.error(
    error.message || "Falló la prueba; se conservaron los registros.",
  );
} finally {
  await Promise.allSettled(
    clients.map((client) => client.auth.signOut({ scope: "local" })),
  );
}
