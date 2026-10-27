import {
  loadData as loadV2,
  initialData as initialV2,
  validateData as validateV2,
  type AppData as V2Data,
  type Exercise as V2Exercise,
} from "./legacyV2";
export { dateKey, formatDate, tagGroups, routineTags } from "./legacyV2";
import { dateKey, tagGroups } from "./legacyV2";
import { imageAssets, defaultRoutineImage, type ImageRef } from "./media";

export type ActivityType = V2Exercise["type"];
export type ExerciseDefinition = {
  id: string;
  name: string;
  type: ActivityType;
  tags: string[];
  legacyIds?: string[];
  sharedId?: string;
  image?: ImageRef | null;
};
export type StrengthSet = { weight: number; reps: number };
// Routine values and session snapshots refer to the same catalog identity.
// General fields are cached for display; sessions always keep their original snapshot.
export type Exercise = V2Exercise & {
  exerciseId: string;
  performedSets?: StrengthSet[];
  plannedSets?: StrengthSet[];
  uniformLegacy?: boolean;
  image?: ImageRef | null;
};
export type Routine = Omit<V2Data["routines"][number], "exercises"> & {
  exercises: Exercise[];
  image?: ImageRef | null;
};
export type Session = Omit<V2Data["sessions"][number], "exercises"> & {
  exercises: Exercise[];
};
export type DayPlan = V2Data["plans"][number];
export type AppData = {
  version: 3;
  catalog: ExerciseDefinition[];
  routines: Routine[];
  sessions: Session[];
  plans: DayPlan[];
  drafts: Record<string, Exercise[]>;
};
export const STORAGE_KEY = "forma-data-v3";
// Expand legacy uniform prescriptions lazily, without rewriting existing history.
export function routineSets(e: Exercise): StrengthSet[] {
  return structuredClone(
    e.plannedSets ??
      Array.from({ length: Math.min(100, Math.max(1, e.sets)) }, () => ({
        reps: e.reps,
        weight: e.weight,
      })),
  );
}
export function withRoutineSets(e: Exercise, sets: StrengthSet[]): Exercise {
  return {
    ...e,
    plannedSets: sets,
    sets: sets.length,
    reps: sets[0].reps,
    weight: sets[0].weight,
  };
}
export const newDefinition = (): ExerciseDefinition => ({
  id: crypto.randomUUID(),
  name: "",
  type: "strength",
  tags: [],
});
export function exerciseFromDefinition(def: ExerciseDefinition): Exercise {
  return {
    id: crypto.randomUUID(),
    exerciseId: def.id,
    name: def.name,
    type: def.type,
    tags: [...def.tags],
    sets: 3,
    reps: 12,
    weight: 0,
    ...(def.image !== undefined ? { image: def.image } : {}),
    ...(def.type !== "strength" ? { duration: 20 } : {}),
  };
}
export const newRoutine = (): Routine => ({
  id: crypto.randomUUID(),
  name: "",
  description: "",
  tags: [],
  exercises: [],
});
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const fingerprint = (e: Pick<ExerciseDefinition, "name" | "type" | "tags">) =>
  JSON.stringify([
    normalize(e.name),
    e.type,
    [...new Set(e.tags.map(normalize))].sort(),
  ]);

export function migrateV2(old: V2Data): AppData {
  validateV2(old);
  const catalog: ExerciseDefinition[] = [];
  const byOldId = new Map<string, ExerciseDefinition>();
  const byFingerprint = new Map<string, ExerciseDefinition>();
  // Current definitions first; exact metadata matches can join copied exercise IDs.
  const ordered = [
    ...old.routines.flatMap((r) => r.exercises),
    ...old.sessions.flatMap((s) => s.exercises),
    ...Object.values(old.drafts).flat(),
  ];
  for (const ex of ordered) {
    let def = byOldId.get(ex.id) ?? byFingerprint.get(fingerprint(ex));
    if (!def) {
      def = {
        id: ex.id,
        name: ex.name,
        type: ex.type,
        tags: [...ex.tags],
        legacyIds: [ex.id],
      };
      catalog.push(def);
      byFingerprint.set(fingerprint(ex), def);
    } else if (!def.legacyIds!.includes(ex.id)) def.legacyIds!.push(ex.id);
    byOldId.set(ex.id, def);
  }
  const convert = (e: V2Exercise, history = false): Exercise => ({
    ...structuredClone(e),
    exerciseId: byOldId.get(e.id)!.id,
    ...(history && e.type === "strength" ? { uniformLegacy: true } : {}),
  });
  return {
    version: 3,
    catalog,
    routines: old.routines.map((r) => ({
      ...structuredClone(r),
      exercises: r.exercises.map((e) => convert(e)),
    })),
    sessions: old.sessions.map((s) => ({
      ...structuredClone(s),
      exercises: s.exercises.map((e) => convert(e, true)),
    })),
    plans: structuredClone(old.plans),
    drafts: Object.fromEntries(
      Object.entries(old.drafts).map(([key, rows]) => [
        key,
        rows.map((e) => convert(e)),
      ]),
    ),
  };
}
export const initialData = (): AppData => migrateV2(initialV2());
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function object(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function validateDefinition(def: unknown): asserts def is ExerciseDefinition {
  assert(
    object(def) &&
      typeof def.id === "string" &&
      !!def.id &&
      typeof def.name === "string" &&
      !!def.name.trim() &&
      ["strength", "cardio", "mobility"].includes(def.type as string) &&
      Array.isArray(def.tags) &&
      def.tags.every((t) => typeof t === "string"),
    "Ejercicio de catálogo inválido",
  );
  validateImageRef(def.image);
  assert(
    def.legacyIds === undefined ||
      (Array.isArray(def.legacyIds) &&
        def.legacyIds.every((i) => typeof i === "string")),
    "Referencias anteriores inválidas",
  );
}
function validateImageRef(value: unknown) {
  assert(
    value === undefined ||
      value === null ||
      (object(value) &&
        ["asset", "local", "cloud"].includes(value.kind as string) &&
        typeof value.id === "string" &&
        (value.kind === "cloud"
          ? /^[a-f0-9-]{36}\/[a-zA-Z0-9_-]{1,100}\.(webp|png|jpg|jpeg)$/.test(
              value.id,
            )
          : /^[a-zA-Z0-9_-]+$/.test(value.id)) &&
        (value.kind !== "asset" || Object.hasOwn(imageAssets, value.id))),
    "Referencia de imagen inválida",
  );
}
export function validateData(value: unknown): asserts value is AppData {
  assert(
    object(value) && value.version === 3 && Array.isArray(value.catalog),
    "Versión o catálogo inválidos",
  );
  validateV2({ ...value, version: 2 });
  for (const routine of value.routines as Routine[])
    validateImageRef(routine.image);
  const ids = new Set<string>();
  for (const def of value.catalog) {
    validateDefinition(def);
    assert(!ids.has(def.id), "Identificadores de catálogo duplicados");
    ids.add(def.id);
  }
  const all = [
    ...(value.routines as Routine[]).flatMap((r) => r.exercises),
    ...(value.sessions as Session[]).flatMap((s) => s.exercises),
    ...Object.values(value.drafts as AppData["drafts"]).flat(),
  ];
  for (const e of all) {
    validateImageRef(e.image);
    assert(
      typeof e.exerciseId === "string" && ids.has(e.exerciseId),
      "Referencia de ejercicio inválida",
    );
    assert(
      e.uniformLegacy === undefined || typeof e.uniformLegacy === "boolean",
      "Origen inválido",
    );
    if (e.performedSets !== undefined) {
      assert(
        Array.isArray(e.performedSets) &&
          e.performedSets.every(
            (s) =>
              object(s) &&
              typeof s.weight === "number" &&
              Number.isFinite(s.weight) &&
              s.weight >= 0 &&
              typeof s.reps === "number" &&
              Number.isInteger(s.reps) &&
              s.reps >= 0,
          ),
        "Series registradas inválidas",
      );
    }
    if (e.plannedSets !== undefined) {
      assert(
        Array.isArray(e.plannedSets) &&
          e.plannedSets.length > 0 &&
          e.plannedSets.length <= 100 &&
          e.plannedSets.length === e.sets &&
          e.plannedSets.every(
            (s) =>
              object(s) &&
              Number.isFinite(s.weight) &&
              s.weight >= 0 &&
              Number.isInteger(s.reps) &&
              s.reps > 0,
          ),
        "Series planificadas inválidas",
      );
    }
  }
}
export function loadData(storage: Pick<Storage, "getItem">): AppData {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw !== null) {
    const data: unknown = JSON.parse(raw);
    validateData(data);
    return data;
  }
  const data = migrateV2(loadV2(storage));
  validateData(data);
  return data;
}
export function saveCatalogExercise(
  data: AppData,
  def: ExerciseDefinition,
): AppData {
  validateDefinition(def);
  const stored = data.catalog.find((e) => e.id === def.id);
  const definition = {
    ...structuredClone(def),
    legacyIds: stored?.legacyIds ?? def.legacyIds,
  };
  const update = (row: Exercise) =>
    row.exerciseId === def.id ? withGeneral(row, def) : row;
  return {
    ...data,
    catalog: stored
      ? data.catalog.map((e) => (e.id === def.id ? definition : e))
      : [...data.catalog, definition],
    routines: data.routines.map((r) => ({
      ...r,
      exercises: r.exercises.map(update),
    })),
  };
}
function withGeneral(row: Exercise, def: ExerciseDefinition): Exercise {
  const { image: previousImage, ...rest } = row;
  return {
    ...rest,
    name: def.name,
    type: def.type,
    tags: [...def.tags],
    ...(def.image !== undefined ? { image: def.image } : {}),
  };
}
export function saveRoutine(data: AppData, r: Routine): AppData {
  assert(r.exercises.length > 0, "Agregá al menos un ejercicio");
  const routine = {
    ...structuredClone(r),
    exercises: r.exercises.map((e) => {
      const def = data.catalog.find((d) => d.id === e.exerciseId);
      assert(def, "Elegí un ejercicio del catálogo");
      const row = withGeneral(e, def);
      return row.type === "strength"
        ? withRoutineSets(row, routineSets(row))
        : row;
    }),
  };
  return {
    ...data,
    routines: data.routines.some((x) => x.id === r.id)
      ? data.routines.map((x) => (x.id === r.id ? routine : x))
      : [...data.routines, routine],
  };
}
export function duplicateRoutine(r: Routine): Routine {
  return {
    ...structuredClone(r),
    ...(r.image === undefined && defaultRoutineImage(r.id)
      ? { image: defaultRoutineImage(r.id) }
      : {}),
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
  if (
    data.sessions.some((s) => !s.demo && s.date === plan.date) &&
    plan.status === "rest"
  )
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
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      dateKey(new Date(`${date}T12:00:00`)) === date,
    "Fecha inválida",
  );
  assert(date <= dateKey(), "No se puede completar una fecha futura");
  assert(exercises.length > 0, "Agregá al menos un ejercicio");
  assert(
    !data.sessions.some(
      (s) => !s.demo && s.date === date && s.routineId === r.id,
    ),
    "Esta rutina ya se completó en esta fecha",
  );
  const actual = exercises.map((e) => {
    if (e.type === "strength") {
      assert(
        e.performedSets !== undefined
          ? e.performedSets.length > 0 &&
              e.performedSets.every(
                (s) => Number.isInteger(s.reps) && s.reps > 0,
              )
          : Number.isInteger(e.sets) &&
              e.sets > 0 &&
              Number.isInteger(e.reps) &&
              e.reps > 0,
        "Completá las series y repeticiones",
      );
      return {
        ...structuredClone(e),
        uniformLegacy: false,
        performedSets:
          e.performedSets || e.plannedSets
            ? structuredClone(e.performedSets ?? e.plannedSets!)
            : Array.from({ length: e.sets }, () => ({
                weight: e.weight,
                reps: e.reps,
              })),
      };
    }
    assert(
      e.duration !== undefined && e.duration > 0,
      "Indicá la duración realizada",
    );
    return structuredClone(e);
  });
  const drafts = { ...data.drafts };
  delete drafts[`${date}-${r.id}`];
  const next: AppData = {
    ...data,
    sessions: [
      ...data.sessions,
      {
        id: crypto.randomUUID(),
        date,
        routineId: r.id,
        name: r.name,
        exercises: actual,
        note,
      },
    ],
    drafts,
    plans: data.plans.filter((p) => !(p.date === date && p.status === "rest")),
  };
  validateData(next);
  return next;
}
export function dayState(data: AppData, date: string) {
  const sessions = data.sessions.filter((s) => !s.demo && s.date === date);
  const plan = data.plans.find((p) => p.date === date);
  return {
    status: sessions.length ? "completed" : (plan?.status ?? "empty"),
    sessions,
    plan,
  } as const;
}

// Explicit corrections are separate from editing the reusable routine template.
export function correctSession(data: AppData, session: Session): AppData {
  const previous = data.sessions.find((s) => s.id === session.id);
  assert(previous && !previous.demo, "No encontramos ese entrenamiento");
  assert(
    session.routineId === previous.routineId && !session.demo,
    "La identidad del entrenamiento debe conservarse",
  );
  const other = {
    ...data,
    sessions: data.sessions.filter((s) => s.id !== session.id),
  };
  const checked = completeSession(
    other,
    {
      id: previous.routineId,
      name: session.name.trim(),
      description: "",
      tags: [],
      exercises: session.exercises,
    },
    session.date,
    session.exercises,
    session.note ?? "",
  );
  const replacement = {
    ...previous,
    ...checked.sessions.at(-1)!,
    id: previous.id,
  };
  const next = {
    ...data,
    sessions: data.sessions.map((s) => (s.id === session.id ? replacement : s)),
  };
  validateData(next);
  return next;
}
export function deleteSession(data: AppData, id: string): AppData {
  assert(
    data.sessions.some((s) => s.id === id && !s.demo),
    "No encontramos ese entrenamiento",
  );
  return { ...data, sessions: data.sessions.filter((s) => s.id !== id) };
}
export const activityLabel = (type: ActivityType) =>
  type === "strength"
    ? "Musculación"
    : type === "cardio"
      ? "Aeróbico"
      : "Movilidad";
export const catalogTagOptions = (data: AppData) => [
  ...new Set([
    ...Object.values(tagGroups).flat(),
    ...data.catalog.flatMap((e) => e.tags),
  ]),
];
