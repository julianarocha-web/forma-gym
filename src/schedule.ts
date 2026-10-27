import { dateKey, dayState, type AppData } from "./data";

export type DayActivity = {
  key: string;
  name: string;
  status: "completed" | "planned" | "rest";
  label: string;
};

// Read the persisted plan and actual sessions together; never infer completion
// from an assignment or from another routine completed on the same date.
export function daySchedule(data: AppData, date: string, today = dateKey()) {
  const { plan, sessions: records } = dayState(data, date);
  const sessions = records.filter((s) => s.date <= today);
  const activities: DayActivity[] = sessions.map((s) => ({
    key: s.id,
    name: s.name,
    status: "completed",
    label: "Completada",
  }));
  if (plan?.status === "rest") {
    activities.push({
      key: "rest",
      name: "Descanso programado",
      status: "rest",
      label: "Descanso",
    });
  } else if (plan && !sessions.some((s) => s.routineId === plan.routineId)) {
    activities.push({
      key: "plan",
      name:
        data.routines.find((r) => r.id === plan.routineId)?.name ??
        "Rutina eliminada · reasignar",
      status: "planned",
      label: date < today ? "Pendiente" : "Planificada",
    });
  }
  const status = sessions.length ? "completed" : (plan?.status ?? "empty");
  const description =
    activities.map((a) => `${a.name} · ${a.label}`).join("; ") ||
    "Sin planificación";
  return { status, sessions, plan, activities, description };
}

export function weekSchedule(data: AppData, today = dateKey()) {
  const monday = new Date(`${today}T12:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    const key = dateKey(date);
    return {
      key,
      number: date.getDate(),
      label: date.toLocaleDateString("es-AR", { weekday: "short" }).slice(0, 2),
      ...daySchedule(data, key, today),
    };
  });
}
