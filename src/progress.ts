import { dateKey, type AppData, type Exercise } from "./data";
export type ProgressMetric =
  "weightRange" | "weight" | "reps" | "sets" | "duration" | "distance";
export type ProgressPeriod = "month" | "quarter" | "all";
export const metricDetails = {
  weightRange: {
    label: "Peso mínimo y máximo por sesión",
    unit: "kg",
    explanation:
      "Menor y mayor carga positiva registrada en cada sesión. Las sesiones con solo 0 kg quedan sin punto en este gráfico. Los indicadores muestran todo el historial; el peso mínimo registrado considera solo cargas mayores a 0 kg. En caso de empate, se muestra la primera fecha registrada.",
  },
  weight: {
    label: "Peso máximo por sesión",
    unit: "kg",
    explanation:
      "La mayor carga registrada entre las series de esa sesión. No resume el rendimiento completo.",
  },
  reps: {
    label: "Repeticiones totales registradas",
    unit: "reps",
    explanation:
      "Suma de las repeticiones de las series. En registros anteriores con un valor común: series × repeticiones guardadas.",
  },
  sets: {
    label: "Historial completo de series",
    unit: "",
    explanation:
      "Cada serie con su peso y repeticiones. Los registros anteriores sin desglose se muestran como valores comunes.",
  },
  duration: {
    label: "Duración registrada",
    unit: "min",
    explanation:
      "Minutos realizados en cada sesión. Las sesiones sin duración quedan sin dato.",
  },
  distance: {
    label: "Distancia registrada",
    unit: "km",
    explanation:
      "Kilómetros registrados en cada sesión. La ausencia de distancia no se convierte en cero.",
  },
} as const;
export type ProgressEntry = {
  key: string;
  sessionId: string;
  date: string;
  routineName: string;
  exercises: Exercise[];
  value: number | null;
  minimum: WeightRecord | null;
  maximum: WeightRecord | null;
};
export type WeightRecord = {
  weight: number;
  exerciseRowId: string;
  setNumber?: number;
};
export function recordedWeights(exercises: Exercise[]): WeightRecord[] {
  return exercises
    .filter((e) => e.type === "strength")
    .flatMap((e) =>
      e.performedSets !== undefined
        ? e.performedSets.flatMap((s, i) =>
            known(s.weight)
              ? [{ weight: s.weight, exerciseRowId: e.id, setNumber: i + 1 }]
              : [],
          )
        : known(e.weight)
          ? [{ weight: e.weight, exerciseRowId: e.id }]
          : [],
    );
}
export function weightExtremes(exercises: Exercise[]) {
  const weights = recordedWeights(exercises);
  return {
    minimum: weights.reduce<WeightRecord | null>(
      (best, row) =>
        row.weight > 0 && (!best || row.weight < best.weight) ? row : best,
      null,
    ),
    maximum: weights.reduce<WeightRecord | null>(
      (best, row) => (!best || row.weight > best.weight ? row : best),
      null,
    ),
  };
}
export function weightRecords(entries: ProgressEntry[]) {
  const rows = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key),
  );
  const all = rows.flatMap((entry) =>
    recordedWeights(entry.exercises).map((record) => ({
      ...record,
      date: entry.date,
      sessionId: entry.sessionId,
    })),
  );
  return {
    minimum: all.reduce<(typeof all)[number] | null>(
      (best, row) =>
        row.weight > 0 && (!best || row.weight < best.weight) ? row : best,
      null,
    ),
    maximum: all.reduce<(typeof all)[number] | null>(
      (best, row) => (!best || row.weight > best.weight ? row : best),
      null,
    ),
  };
}
export function periodStart(period: ProgressPeriod, today = dateKey()): string {
  if (period === "all") return "0000-01-01";
  const d = new Date(`${today}T12:00:00`);
  const month = d.getMonth() - (period === "month" ? 1 : 3);
  const maxDay = new Date(d.getFullYear(), month + 1, 0).getDate();
  return dateKey(
    new Date(d.getFullYear(), month, Math.min(d.getDate(), maxDay)),
  );
}
const known = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export function sessionMetric(
  exercises: Exercise[],
  metric: ProgressMetric,
): number | null {
  if (metric === "sets") return null;
  if (metric === "weight" || metric === "weightRange") {
    const weights = exercises
      .filter((e) => e.type === "strength")
      .flatMap((e) =>
        e.performedSets !== undefined
          ? e.performedSets.map((s) => s.weight)
          : [e.weight],
      )
      .filter(known);
    const eligible =
      metric === "weightRange"
        ? weights.filter((weight) => weight > 0)
        : weights;
    return eligible.length ? Math.max(...eligible) : null;
  }
  if (metric === "reps") {
    const strength = exercises.filter((e) => e.type === "strength");
    if (!strength.length) return null;
    const totals = strength.map((e) =>
      e.performedSets !== undefined
        ? e.performedSets.length && e.performedSets.every((s) => known(s.reps))
          ? e.performedSets.reduce((sum, s) => sum + s.reps, 0)
          : null
        : known(e.sets) && known(e.reps)
          ? e.sets * e.reps
          : null,
    );
    return totals.every(known)
      ? totals.reduce((sum, value) => sum + value, 0)
      : null;
  }
  const rows = exercises.filter((e) =>
    metric === "distance" ? e.type === "cardio" : e.type !== "strength",
  );
  if (!rows.length) return null;
  const values = rows.map((e) => e[metric]);
  return values.every(known) ? values.reduce((sum, v) => sum + v, 0) : null;
}
export function exerciseProgress(
  data: AppData,
  exerciseId: string,
  metric: ProgressMetric,
  period: ProgressPeriod,
  today = dateKey(),
): ProgressEntry[] {
  const start = periodStart(period, today);
  return data.sessions
    .filter((s) => !s.demo && s.date >= start && s.date <= today)
    .map((s) => ({
      key: s.id,
      sessionId: s.id,
      date: s.date,
      routineName: s.name,
      exercises: s.exercises.filter((e) => e.exerciseId === exerciseId),
      value: null as number | null,
    }))
    .filter((row) => row.exercises.length)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      ...weightExtremes(row.exercises),
      value: sessionMetric(row.exercises, metric),
    }));
}
