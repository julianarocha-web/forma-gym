import { dateKey, type AppData, type Exercise } from "./data";
export type ProgressMetric =
  "weight" | "reps" | "sets" | "duration" | "distance";
export type ProgressPeriod = "month" | "quarter" | "all";
export const metricDetails = {
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
};
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
  if (metric === "weight") {
    const weights = exercises
      .filter((e) => e.type === "strength")
      .flatMap((e) =>
        e.performedSets !== undefined
          ? e.performedSets.map((s) => s.weight)
          : [e.weight],
      )
      .filter(known);
    return weights.length ? Math.max(...weights) : null;
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
    .map((row) => ({ ...row, value: sessionMetric(row.exercises, metric) }));
}
