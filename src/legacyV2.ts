import { initialRoutines as legacyDefaults } from "./legacyData";
// Compatibility reader for previously persisted v1/v2 documents.
// Current application models and operations live in data.ts.

export type ActivityType = "strength" | "cardio" | "mobility";
export type Exercise = {
  id: string;
  name: string;
  type: ActivityType;
  tags: string[];
  sets: number;
  reps: number;
  weight: number;
  duration?: number;
  distance?: number;
  resistance?: number;
  notes?: string;
};
export type Routine = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  exercises: Exercise[];
};
export type Session = {
  id: string;
  date: string;
  routineId: string;
  name: string;
  exercises: Exercise[];
  demo?: boolean;
  note?: string;
};
export type DayPlan = {
  date: string;
  status: "planned" | "rest";
  routineId?: string;
  note: string;
};
export type AppData = {
  version: 2;
  routines: Routine[];
  sessions: Session[];
  plans: DayPlan[];
  drafts: Record<string, Exercise[]>;
};
export const STORAGE_KEY = "forma-data-v2";
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const formatDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
export const tagGroups = {
  "Tipo de actividad": ["Musculación", "Aeróbico", "Movilidad"],
  "Grupo muscular": [
    "Glúteos",
    "Cuádriceps",
    "Isquiotibiales",
    "Espalda",
    "Pecho",
    "Hombros",
    "Bíceps",
    "Tríceps",
    "Abdomen",
  ],
  Equipamiento: [
    "Máquina",
    "Polea",
    "Mancuernas",
    "Barra",
    "Smith",
    "Peso corporal",
    "Bicicleta",
  ],
};
export const routineTags = [
  "Musculación",
  "Aeróbico",
  "Piernas",
  "Glúteos",
  "Tren superior",
  "Cuerpo completo",
  "Movilidad",
  "Abdomen",
];
export const newExercise = (): Exercise => ({
  id: crypto.randomUUID(),
  name: "",
  type: "strength",
  tags: [],
  sets: 3,
  reps: 12,
  weight: 0,
});
export const newRoutine = (): Routine => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  tags: [],
  exercises: [newExercise()],
});
type LegacyExercise = {
  id: string;
  name: string;
  muscle?: string;
  sets: number;
  reps: number;
  weight: number;
};
function migrateExercise(e: LegacyExercise): Exercise {
  const cardio = e.id === "bike" || /bicicleta|cardio/i.test(e.name);
  const tags = (e.muscle ?? "")
    .split(" · ")
    .filter((t) => Object.values(tagGroups).flat().includes(t));
  return {
    ...e,
    type: cardio ? "cardio" : "strength",
    tags: [
      cardio ? "Aeróbico" : "Musculación",
      ...tags,
      ...(cardio ? ["Bicicleta"] : []),
    ],
    ...(cardio ? { duration: e.reps } : {}),
  };
}
const defaultTags: Record<string, string[]> = {
  legs: ["Musculación", "Piernas"],
  chest: ["Musculación", "Aeróbico", "Abdomen"],
  upper: ["Musculación", "Tren superior"],
  glutes: ["Musculación", "Glúteos"],
};
export function initialData(): AppData {
  return {
    version: 2,
    routines: legacyDefaults.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.subtitle,
      tags: defaultTags[r.id] ?? [],
      exercises: r.exercises.map(migrateExercise),
    })),
    sessions: [],
    plans: [],
    drafts: {},
  };
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T12:00:00`);
  return Number.isFinite(d.getTime()) && dateKey(d) === value;
}
function validateExercise(e: unknown, legacy = false) {
  assert(
    object(e) && typeof e.id === "string" && typeof e.name === "string",
    "Ejercicio inválido",
  );
  for (const f of ["sets", "reps", "weight"])
    assert(
      typeof e[f] === "number" &&
        Number.isFinite(e[f]) &&
        (e[f] as number) >= 0,
      "Valores de ejercicio inválidos",
    );
  if (!legacy) {
    assert(
      e.notes === undefined || typeof e.notes === "string",
      "Notas de ejercicio inválidas",
    );
    assert(
      ["strength", "cardio", "mobility"].includes(e.type as string) &&
        Array.isArray(e.tags) &&
        e.tags.every((t) => typeof t === "string"),
      "Tipo o etiquetas inválidas",
    );
    for (const f of ["duration", "distance", "resistance"])
      assert(
        e[f] === undefined ||
          (typeof e[f] === "number" &&
            Number.isFinite(e[f]) &&
            (e[f] as number) >= 0),
        "Registro aeróbico inválido",
      );
  }
}
function validateRows(
  rows: unknown,
  kind: "routines" | "sessions",
  legacy = false,
) {
  assert(Array.isArray(rows), "Lista inválida");
  const ids = new Set();
  for (const row of rows) {
    assert(
      object(row) &&
        typeof row.id === "string" &&
        typeof row.name === "string" &&
        Array.isArray(row.exercises),
      "Registro inválido",
    );
    assert(!ids.has(row.id), "Identificadores duplicados");
    ids.add(row.id);
    row.exercises.forEach((e) => validateExercise(e, legacy));
    if (kind === "sessions")
      assert(
        validDate(row.date) &&
          typeof row.routineId === "string" &&
          (row.note === undefined || typeof row.note === "string"),
        "Fecha inválida",
      );
    else if (!legacy)
      assert(
        typeof row.description === "string" &&
          Array.isArray(row.tags) &&
          row.tags.every((t) => typeof t === "string"),
        "Rutina inválida",
      );
  }
}
export function validateData(value: unknown): asserts value is AppData {
  assert(object(value) && value.version === 2, "Versión desconocida");
  validateRows(value.routines, "routines");
  validateRows(value.sessions, "sessions");
  assert(
    Array.isArray(value.plans) && object(value.drafts),
    "Calendario o borradores inválidos",
  );
  const dates = new Set();
  for (const p of value.plans) {
    assert(
      object(p) &&
        validDate(p.date) &&
        ["rest", "planned"].includes(p.status as string) &&
        typeof p.note === "string",
      "Asignación inválida",
    );
    assert(!dates.has(p.date), "Fechas duplicadas");
    dates.add(p.date);
    if (p.status === "planned")
      assert(typeof p.routineId === "string", "Falta la rutina");
  }
  for (const rows of Object.values(value.drafts)) {
    assert(Array.isArray(rows), "Borrador inválido");
    rows.forEach((e) => validateExercise(e));
  }
}
export function loadData(storage: Pick<Storage, "getItem">): AppData {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const parsed: unknown = JSON.parse(raw);
    validateData(parsed);
    return parsed;
  }
  const data = initialData();
  const rawR = storage.getItem("forma-routines-v1"),
    rawS = storage.getItem("forma-sessions-v1"),
    rawD = storage.getItem("forma-drafts-v1");
  if (rawR !== null) {
    const rows = JSON.parse(rawR);
    validateRows(rows, "routines", true);
    data.routines = rows.map((r: (typeof legacyDefaults)[number]) => ({
      id: r.id,
      name: r.name,
      description: r.subtitle ?? "",
      tags: defaultTags[r.id] ?? [],
      exercises: r.exercises.map(migrateExercise),
    }));
  }
  if (rawS !== null) {
    const rows = JSON.parse(rawS);
    validateRows(rows, "sessions", true);
    data.sessions = rows.map((s: Session) => ({
      ...s,
      exercises: s.exercises.map(migrateExercise),
    }));
  }
  if (rawD !== null) {
    const drafts = JSON.parse(rawD);
    assert(object(drafts), "Borradores anteriores inválidos");
    for (const [key, rows] of Object.entries(drafts)) {
      assert(Array.isArray(rows), "Borrador anterior inválido");
      rows.forEach((e) => validateExercise(e, true));
      data.drafts[key] = rows.map(migrateExercise);
    }
  }
  validateData(data);
  return data;
}
export function saveRoutine(data: AppData, r: Routine): AppData {
  return {
    ...data,
    routines: data.routines.some((x) => x.id === r.id)
      ? data.routines.map((x) => (x.id === r.id ? structuredClone(r) : x))
      : [...data.routines, structuredClone(r)],
  };
}
export function duplicateRoutine(r: Routine): Routine {
  return {
    ...structuredClone(r),
    id: crypto.randomUUID(),
    name: `${r.name} (copia)`,
    exercises: r.exercises.map((e) => ({
      ...structuredClone(e),
      id: crypto.randomUUID(),
    })),
  };
}
export function deleteRoutine(data: AppData, id: string): AppData {
  return { ...data, routines: data.routines.filter((r) => r.id !== id) };
}
export function savePlan(data: AppData, plan: DayPlan): AppData {
  if (data.sessions.some((s) => s.date === plan.date) && plan.status === "rest")
    throw new Error(
      "Este día tiene entrenamientos completados. Su historial se conserva.",
    );
  return {
    ...data,
    plans: [...data.plans.filter((p) => p.date !== plan.date), plan],
  };
}
export function completeSession(
  data: AppData,
  r: Routine,
  date: string,
  exercises: Exercise[],
  note: string,
): AppData {
  assert(validDate(date), "Fecha inválida");
  assert(date <= dateKey(), "No se puede completar una fecha futura");
  assert(exercises.length > 0, "Agregá al menos un ejercicio");
  exercises.forEach((e) => {
    validateExercise(e);
    if (e.type === "strength")
      assert(
        Number.isInteger(e.sets) &&
          e.sets > 0 &&
          Number.isInteger(e.reps) &&
          e.reps > 0,
        "Series y repeticiones deben ser enteros positivos",
      );
    else
      assert(
        typeof e.duration === "number" && e.duration > 0,
        "Indicá la duración realizada",
      );
  });
  assert(
    !data.sessions.some((s) => s.date === date && s.routineId === r.id),
    "Esta rutina ya se completó en esta fecha",
  );
  const session: Session = {
    id: crypto.randomUUID(),
    date,
    routineId: r.id,
    name: r.name,
    exercises: structuredClone(exercises),
    note,
  };
  const drafts = { ...data.drafts };
  delete drafts[`${date}-${r.id}`];
  return {
    ...data,
    sessions: [...data.sessions, session],
    drafts,
    plans: data.plans.filter((p) => !(p.date === date && p.status === "rest")),
  };
}
export function dayState(data: AppData, date: string) {
  const sessions = data.sessions.filter((s) => s.date === date);
  const plan = data.plans.find((p) => p.date === date);
  return {
    status: sessions.length ? "completed" : (plan?.status ?? "empty"),
    sessions,
    plan,
  } as const;
}
