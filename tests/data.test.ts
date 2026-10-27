import { test } from "node:test";
import assert from "node:assert/strict";
import { initialRoutines } from "../src/legacyData";
import {
  completeSession,
  correctSession,
  deleteSession,
  dateKey,
  dayState,
  deleteRoutine,
  duplicateRoutine,
  initialData,
  loadData,
  savePlan,
  saveRoutine,
  STORAGE_KEY,
  validateData,
} from "../src/data";
const storage = (entries: Record<string, string>) => ({
  getItem: (key: string) => entries[key] ?? null,
});

test("correcciones conservan ID y otras sesiones; rechazan fechas futuras y duplicadas; eliminar recupera el plan", () => {
  let data = initialData();
  const routine = data.routines[0];
  data = completeSession(
    data,
    routine,
    "2026-01-01",
    routine.exercises,
    "Original",
  );
  data = completeSession(
    data,
    routine,
    "2026-01-02",
    routine.exercises,
    "Otra fecha",
  );
  const original = structuredClone(data);
  const corrected = correctSession(data, {
    ...data.sessions[0],
    date: "2026-01-03",
    note: "Corregido",
  });
  assert.equal(corrected.sessions[0].id, data.sessions[0].id);
  assert.equal(corrected.sessions[0].date, "2026-01-03");
  assert.deepEqual(corrected.sessions[1], original.sessions[1]);
  assert.deepEqual(data, original);
  assert.throws(
    () => correctSession(data, { ...data.sessions[0], date: "2026-01-02" }),
    /ya se completó/,
  );
  assert.throws(
    () => correctSession(data, { ...data.sessions[0], date: "2999-01-01" }),
    /futura/,
  );
  const planned = {
    ...data,
    plans: [
      {
        date: "2026-01-01",
        status: "planned" as const,
        routineId: routine.id,
        note: "",
      },
    ],
  };
  assert.equal(dayState(planned, "2026-01-01").status, "completed");
  const removed = deleteSession(planned, data.sessions[0].id);
  assert.equal(dayState(removed, "2026-01-01").status, "planned");
  assert.deepEqual(removed.sessions, [data.sessions[1]]);
  assert.deepEqual(removed.routines, data.routines);
});
test("migración conserva rutinas, ids, borradores e historial sin crear sesiones", () => {
  const oldSession = {
    id: "real-1",
    date: "2026-10-01",
    routineId: "chest",
    name: "Mi entrenamiento real",
    exercises: initialRoutines[1].exercises.map((e) => ({ ...e, weight: 17 })),
  };
  const entries = {
    "forma-routines-v1": JSON.stringify(initialRoutines),
    "forma-sessions-v1": JSON.stringify([oldSession]),
    "forma-drafts-v1": JSON.stringify({
      "2026-10-02-chest": oldSession.exercises,
    }),
  };
  const original = JSON.stringify(entries);
  const data = loadData(storage(entries));
  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0].id, "real-1");
  assert.equal(data.routines[0].id, initialRoutines[0].id);
  assert.ok(!("weekday" in data.routines[0]));
  assert.ok(!("day" in data.routines[0]));
  assert.equal(data.sessions[0].exercises[0].duration, 20);
  assert.equal(data.sessions[0].exercises[0].weight, 17);
  assert.equal(data.drafts["2026-10-02-chest"][0].duration, 20);
  assert.equal(JSON.stringify(entries), original);
  assert.deepEqual(loadData(storage({})).sessions, []);
  assert.deepEqual(
    loadData(storage({ "forma-routines-v1": "[]", "forma-sessions-v1": "[]" }))
      .routines,
    [],
  );
});
test("datos dañados o versiones desconocidas se rechazan sin sustituirlos", () => {
  assert.throws(() => loadData(storage({ [STORAGE_KEY]: "{broken" })));
  assert.throws(() => loadData(storage({ [STORAGE_KEY]: '{"version":3}' })));
  assert.throws(() => loadData(storage({ "forma-sessions-v1": "{}" })));
  assert.throws(() => loadData(storage({ "forma-drafts-v1": '{"a":[{}]}' })));
});
test("crear, duplicar, editar, eliminar y reutilizar rutinas conserva snapshots reales", () => {
  let data = initialData();
  const routine = structuredClone(data.routines[0]);
  const duplicate = duplicateRoutine(routine);
  assert.notEqual(duplicate.id, routine.id);
  assert.notEqual(duplicate.exercises[0].id, routine.exercises[0].id);
  data = saveRoutine(data, duplicate);
  assert.equal(data.routines.length, 5);
  data = savePlan(data, {
    date: "2026-01-01",
    status: "planned",
    routineId: routine.id,
    note: "A",
  });
  data = savePlan(data, {
    date: "2026-01-08",
    status: "planned",
    routineId: routine.id,
    note: "B",
  });
  assert.equal(data.routines.length, 5);
  assert.equal(data.sessions.length, 0);
  assert.equal(dayState(data, "2026-01-01").status, "planned");
  const actual = structuredClone(routine.exercises);
  actual[0].weight = 72.5;
  actual[0].notes = "Valor real";
  data = completeSession(data, routine, "2026-01-01", actual, "Mi nota");
  actual[0].weight = 999;
  assert.equal(data.sessions[0].exercises[0].weight, 72.5);
  const snapshot = JSON.stringify(data.sessions);
  routine.exercises[0].weight = 100;
  routine.name = "Editada";
  data = saveRoutine(data, routine);
  data = deleteRoutine(data, routine.id);
  assert.equal(JSON.stringify(data.sessions), snapshot);
  assert.equal(data.plans.length, 2);
  assert.equal(dayState(data, "2026-01-01").status, "completed");
  assert.equal(dayState(data, "2026-01-08").status, "planned");
  assert.throws(() =>
    savePlan(data, { date: "2026-01-01", status: "rest", note: "" }),
  );
  assert.throws(() => completeSession(data, routine, "2026-01-01", actual, ""));
  validateData(data);
  assert.deepEqual(
    loadData(storage({ [STORAGE_KEY]: JSON.stringify(data) })),
    data,
  );
});
test("estados explícitos: sin registro, descanso, plan y completado; nunca se infieren por el pasado", () => {
  let data = initialData();
  assert.equal(dayState(data, "2020-01-01").status, "empty");
  data = savePlan(data, {
    date: "2020-01-01",
    status: "rest",
    note: "Recuperación",
  });
  assert.equal(dayState(data, "2020-01-01").status, "rest");
  data = savePlan(data, {
    date: "2020-01-01",
    status: "planned",
    routineId: data.routines[0].id,
    note: "",
  });
  assert.equal(dayState(data, "2020-01-01").status, "planned");
  assert.equal(data.sessions.length, 0);
  data = completeSession(
    data,
    data.routines[0],
    "2020-01-01",
    data.routines[0].exercises,
    "",
  );
  assert.equal(dayState(data, "2020-01-01").status, "completed");
  assert.throws(() =>
    completeSession(
      data,
      data.routines[0],
      "2999-01-01",
      data.routines[0].exercises,
      "",
    ),
  );
});
test("fecha local conserva el día y rechaza fechas inválidas", () => {
  assert.equal(dateKey(new Date(2026, 9, 26, 0, 1)), "2026-10-26");
  assert.equal(dateKey(new Date(2026, 9, 26, 23, 59)), "2026-10-26");
  const d = initialData();
  assert.throws(() =>
    completeSession(
      d,
      d.routines[0],
      "2026-02-30",
      d.routines[0].exercises,
      "",
    ),
  );
});
