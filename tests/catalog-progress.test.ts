import { test } from "node:test";
import assert from "node:assert/strict";
import { initialData as v2Data } from "../src/legacyV2";
import {
  completeSession,
  duplicateRoutine,
  exerciseFromDefinition,
  initialData,
  loadData,
  migrateV2,
  newRoutine,
  saveCatalogExercise,
  saveRoutine,
  STORAGE_KEY,
  validateData,
  type ExerciseDefinition,
} from "../src/data";
import {
  exerciseProgress,
  periodStart,
  sessionMetric,
  weightExtremes,
  weightRecords,
} from "../src/progress";

test("extremos por serie incluyen cero y conservan primera fecha sin modificar historial", () => {
  const data = initialData();
  const e = data.routines[0].exercises[0];
  const exercise = {
    ...e,
    weight: 999,
    performedSets: [0, 10, 30, 30].map((weight) => ({ weight, reps: 10 })),
  };
  data.sessions = ["2026-10-25", "2026-10-24"].map((date) => ({
    id: date,
    date,
    routineId: "r",
    name: "Hip thrust",
    exercises: [exercise],
  }));
  const snapshot = JSON.stringify(data);
  const entries = exerciseProgress(
    data,
    e.exerciseId,
    "weightRange",
    "all",
    "2026-10-27",
  );
  assert.deepEqual(
    entries.map((row) => [row.minimum?.weight, row.maximum?.weight, row.value]),
    [
      [10, 30, 30],
      [10, 30, 30],
    ],
  );
  const records = weightRecords(entries);
  assert.equal(records.minimum?.date, "2026-10-24");
  assert.equal(records.minimum?.weight, 10);
  assert.equal(records.minimum?.setNumber, 2);
  assert.equal(records.maximum?.date, "2026-10-24");
  assert.equal(records.maximum?.setNumber, 3);
  assert.equal(entries[0].exercises[0].performedSets?.length, 4);
  assert.equal(sessionMetric([exercise], "weight"), 30);
  assert.equal(JSON.stringify(data), snapshot);
});

test("extremos distinguen ausencias, series vacías y peso común histórico", () => {
  const e = initialData().routines[0].exercises[0];
  assert.deepEqual(weightExtremes([{ ...e, performedSets: [] }]), {
    minimum: null,
    maximum: null,
  });
  assert.deepEqual(
    weightExtremes([{ ...e, weight: undefined } as unknown as typeof e]),
    { minimum: null, maximum: null },
  );
  for (const weight of [0, 42.5]) {
    const result = weightExtremes([{ ...e, weight }]);
    assert.equal(result.minimum?.weight, weight > 0 ? weight : undefined);
    assert.equal(result.maximum?.weight, weight);
    assert.equal(result.minimum?.setNumber, undefined);
  }
  assert.deepEqual(weightRecords([]), { minimum: null, maximum: null });
});

test("mínimo histórico excluye cero y conserva pesos comunes positivos", () => {
  const data = initialData();
  const e = data.routines[0].exercises[0];
  data.sessions = [
    {
      id: "zero",
      date: "2026-10-24",
      routineId: "r",
      name: "Sesión",
      exercises: [{ ...e, weight: 0 }],
    },
  ];
  const records = () =>
    weightRecords(
      exerciseProgress(data, e.exerciseId, "weight", "all", "2026-10-27"),
    );
  assert.equal(records().minimum, null);
  assert.equal(records().maximum?.weight, 0);
  const zeroEntry = exerciseProgress(
    data,
    e.exerciseId,
    "weightRange",
    "all",
    "2026-10-27",
  )[0];
  assert.equal(zeroEntry.minimum, null);
  assert.equal(zeroEntry.value, null);
  assert.equal(sessionMetric(data.sessions[0].exercises, "weight"), 0);
  data.sessions.push({
    ...data.sessions[0],
    id: "positive",
    date: "2026-10-25",
    exercises: [{ ...e, weight: 5 }],
  });
  assert.equal(records().minimum?.weight, 5);
  assert.equal(records().minimum?.date, "2026-10-25");
});

test("migración v2 reúne copias coincidentes por metadatos, conserva snapshots y no une variantes distintas", () => {
  const old = v2Data();
  const hip = old.routines[3].exercises[0];
  const copy = { ...structuredClone(hip), id: "copied-hip", weight: 80 };
  old.routines[0].exercises.push(copy);
  old.routines[1].exercises.push({
    ...structuredClone(hip),
    id: "smith-hip",
    tags: [...hip.tags, "Smith"],
  });
  old.sessions = [
    {
      id: "historical",
      date: "2026-01-01",
      routineId: "deleted-routine",
      name: "Anterior",
      exercises: [{ ...copy, weight: 62.5, reps: 9, notes: "Dato original" }],
    },
  ];
  old.drafts["2026-01-02-legs"] = [copy];
  const original = JSON.stringify(old);
  const data = migrateV2(old);
  const catalogId = data.routines[3].exercises[0].exerciseId;
  assert.equal(data.routines[0].exercises.at(-1)!.exerciseId, catalogId);
  assert.equal(data.sessions[0].exercises[0].exerciseId, catalogId);
  assert.equal(data.drafts["2026-01-02-legs"][0].exerciseId, catalogId);
  assert.notEqual(data.routines[1].exercises.at(-1)!.exerciseId, catalogId);
  assert.equal(data.sessions[0].id, "historical");
  assert.equal(data.sessions[0].exercises[0].id, "copied-hip");
  assert.equal(data.sessions[0].exercises[0].weight, 62.5);
  assert.equal(data.sessions[0].exercises[0].notes, "Dato original");
  assert.equal(data.sessions[0].exercises[0].performedSets, undefined);
  assert.equal(data.sessions[0].exercises[0].uniformLegacy, true);
  assert.equal(JSON.stringify(old), original);
  validateData(data);
  const entries = { "forma-data-v2": JSON.stringify(old) };
  assert.deepEqual(
    loadData({
      getItem: (key) => (entries as Record<string, string>)[key] ?? null,
    }),
    data,
  );
  assert.deepEqual(
    loadData({
      getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(data) : null),
    }),
    data,
  );
});
test("un ejercicio comparte identidad y conserva valores por rutina e historial al renombrarlo", () => {
  let data = initialData();
  const def: ExerciseDefinition = {
    id: "stable-exercise",
    name: "Ejercicio compartido",
    type: "strength",
    tags: ["Glúteos", "Barra"],
  };
  data = saveCatalogExercise(data, def);
  const a = {
    ...newRoutine(),
    name: "A",
    exercises: [{ ...exerciseFromDefinition(def), weight: 30 }],
  };
  const b = {
    ...newRoutine(),
    name: "B",
    exercises: [{ ...exerciseFromDefinition(def), weight: 50 }],
  };
  data = saveRoutine(saveRoutine(data, a), b);
  assert.notEqual(a.exercises[0].id, b.exercises[0].id);
  assert.equal(a.exercises[0].exerciseId, b.exercises[0].exerciseId);
  const copied = duplicateRoutine(a);
  assert.notEqual(copied.id, a.id);
  assert.equal(copied.exercises[0].exerciseId, def.id);
  data = completeSession(
    data,
    a,
    "2026-01-01",
    [
      {
        ...a.exercises[0],
        performedSets: [
          { weight: 30, reps: 12 },
          { weight: 40, reps: 8 },
        ],
      },
    ],
    "",
  );
  const snapshot = JSON.stringify(data.sessions);
  data = saveCatalogExercise(data, {
    ...def,
    name: "Nombre actualizado",
    tags: ["Glúteos", "Smith"],
  });
  assert.equal(JSON.stringify(data.sessions), snapshot);
  assert.equal(
    data.routines.find((r) => r.id === a.id)!.exercises[0].weight,
    30,
  );
  assert.equal(
    data.routines.find((r) => r.id === b.id)!.exercises[0].weight,
    50,
  );
  assert.ok(
    data.routines
      .filter((r) => [a.id, b.id].includes(r.id))
      .every((r) => r.exercises[0].name === "Nombre actualizado"),
  );
  validateData(data);
});
test("métricas de series usan valores reales y reúnen sesiones de distintas rutinas", () => {
  let data = initialData();
  const a = data.routines[3];
  const b = { ...duplicateRoutine(a), name: "Otra rutina" };
  data = saveRoutine(data, b);
  data = completeSession(
    data,
    a,
    "2026-01-01",
    [
      {
        ...a.exercises[0],
        performedSets: [
          { weight: 50, reps: 12 },
          { weight: 60, reps: 8 },
          { weight: 55, reps: 10 },
        ],
      },
    ],
    "",
  );
  data = completeSession(
    data,
    b,
    "2026-01-02",
    [
      {
        ...b.exercises[0],
        performedSets: [
          { weight: 70, reps: 5 },
          { weight: 65, reps: 6 },
        ],
      },
    ],
    "",
  );
  const id = a.exercises[0].exerciseId;
  const weight = exerciseProgress(data, id, "weight", "all", "2026-01-03");
  assert.deepEqual(
    weight.map((e) => e.value),
    [60, 70],
  );
  assert.deepEqual(
    weight.map((e) => e.routineName),
    [a.name, b.name],
  );
  assert.deepEqual(
    exerciseProgress(data, id, "reps", "all", "2026-01-03").map((e) => e.value),
    [30, 11],
  );
  assert.equal(weight[0].exercises[0].performedSets![1].reps, 8);
  assert.equal(weight[0].exercises[0].performedSets![2].weight, 55);
});
test("mediciones ausentes no se convierten en cero; cero explícito sí se conserva", () => {
  const e = initialData().routines[1].exercises[0];
  assert.equal(
    sessionMetric([{ ...e, distance: undefined }], "distance"),
    null,
  );
  assert.equal(sessionMetric([{ ...e, distance: 0 }], "distance"), 0);
  assert.equal(
    sessionMetric([{ ...e, duration: undefined }], "duration"),
    null,
  );
  assert.equal(
    sessionMetric(
      [
        { ...e, distance: 2 },
        { ...e, distance: undefined },
      ],
      "distance",
    ),
    null,
  );
  assert.equal(
    sessionMetric(
      [
        { ...e, distance: 2 },
        { ...e, distance: 3 },
      ],
      "distance",
    ),
    5,
  );
});
test("filtros temporales usan meses locales, no incluyen futuro ni planes y conservan vacío", () => {
  assert.equal(periodStart("month", "2026-03-31"), "2026-02-28");
  assert.equal(periodStart("quarter", "2026-05-31"), "2026-02-28");
  const data = initialData();
  const e = data.routines[0].exercises[0];
  data.sessions = ["2026-01-01", "2026-03-01", "2026-03-31", "2026-04-01"].map(
    (date, i) => ({
      id: `s${i}`,
      date,
      routineId: "legs",
      name: "Sesión",
      exercises: [e],
    }),
  );
  data.plans = [
    { date: "2026-03-30", status: "planned", routineId: "legs", note: "" },
  ];
  assert.deepEqual(
    exerciseProgress(data, e.exerciseId, "weight", "month", "2026-03-31").map(
      (e) => e.date,
    ),
    ["2026-03-01", "2026-03-31"],
  );
  assert.equal(
    exerciseProgress(data, e.exerciseId, "weight", "quarter", "2026-03-31")
      .length,
    3,
  );
  assert.deepEqual(exerciseProgress(data, "unknown", "weight", "all"), []);
});
