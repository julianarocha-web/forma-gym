import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  completeSession,
  dateKey,
  initialData,
  loadData,
  savePlan,
  STORAGE_KEY,
  type AppData,
} from "../src/data";
import { daySchedule, weekSchedule } from "../src/schedule";
import HomeOverview from "../src/components/HomeOverview";
import TrainingCalendar from "../src/components/TrainingCalendar";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
const noop = () => {};
function home(data: AppData, onDate = (_date: string) => {}) {
  return (
    <HomeOverview
      data={data}
      onDate={onDate}
      onRegister={noop}
      onRoutines={noop}
      onCalendar={noop}
      onProgress={noop}
    />
  );
}

test("semana local de lunes a domingo cruza mes/año sin desplazar fechas", () => {
  const data = initialData();
  const expected = [
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04",
  ];
  for (const today of ["2025-12-29", "2026-01-01", "2026-01-04"]) {
    assert.deepEqual(
      weekSchedule(data, today).map((d) => d.key),
      expected,
    );
  }
});

test("cuatro estados, pendientes y varias sesiones sin confundir la rutina realizada", () => {
  let data = initialData();
  data.sessions = [];
  data.plans = [];
  const [a, b] = data.routines;
  data = savePlan(data, {
    date: "2026-01-01",
    status: "planned",
    routineId: a.id,
    note: "",
  });
  data = savePlan(data, { date: "2026-01-02", status: "rest", note: "" });
  data = savePlan(data, {
    date: "2026-01-04",
    status: "planned",
    routineId: a.id,
    note: "",
  });
  data = completeSession(data, b, "2026-01-01", b.exercises, "");
  let day = daySchedule(data, "2026-01-01", "2026-01-03");
  assert.equal(day.status, "completed");
  assert.deepEqual(
    day.activities.map((a) => a.label),
    ["Completada", "Pendiente"],
  );
  assert.ok(
    day.description.includes(a.name) && day.description.includes(b.name),
  );
  data = completeSession(data, a, "2026-01-01", a.exercises, "");
  day = daySchedule(data, "2026-01-01", "2026-01-03");
  assert.equal(day.activities.length, 2);
  assert.ok(day.activities.every((a) => a.status === "completed"));
  assert.equal(daySchedule(data, "2026-01-02", "2026-01-03").status, "rest");
  assert.equal(daySchedule(data, "2026-01-03", "2026-01-03").status, "empty");
  assert.equal(
    daySchedule(data, "2026-01-04", "2026-01-03").activities[0].label,
    "Planificada",
  );
  assert.equal(
    weekSchedule(data, "2026-01-03").filter((d) => d.sessions.length).length,
    1,
  );
  data.routines = data.routines.filter((r) => r.id !== a.id);
  assert.match(
    daySchedule(data, "2026-01-04", "2026-01-03").description,
    /Rutina eliminada/,
  );
});

test("inicio y calendario leen planes persistidos y se sincronizan al completar, cambiar o quitar", () => {
  let data = initialData();
  data.sessions = [];
  data.plans = [];
  const today = dateKey();
  const days = weekSchedule(data);
  const rest = days.find((d) => d.key !== today)!;
  const empty = days.find((d) => d.key !== today && d.key !== rest.key)!;
  const [a, b] = data.routines;
  data = savePlan(data, {
    date: today,
    status: "planned",
    routineId: a.id,
    note: "Plan real",
  });
  data = savePlan(data, { date: rest.key, status: "rest", note: "Recuperar" });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  data = loadData(localStorage);
  let selected = "";
  const onDate = (date: string) => {
    selected = date;
  };
  const view = render(
    <>
      {home(data, onDate)}
      <TrainingCalendar data={data} onSelect={onDate} />
    </>,
  );
  const card = () =>
    within(screen.getByRole("region", { name: "Tu constancia · Esta semana" }));
  const dayButton = (date: string) =>
    card().getByRole("button", { name: new RegExp(`^Organizar ${date}:`) });
  assert.ok(dayButton(today).classList.contains("week-planned"));
  assert.ok(dayButton(rest.key).classList.contains("week-rest"));
  assert.ok(dayButton(empty.key).classList.contains("week-empty"));
  assert.match(
    card().getByText("/ 7 días activos").parentElement!.textContent!,
    /^0/,
  );
  fireEvent.click(dayButton(today));
  assert.equal(selected, today);
  const snapshot = JSON.stringify(data.plans);
  data = completeSession(data, b, today, b.exercises, "Otra rutina realizada");
  view.rerender(
    <>
      {home(data, onDate)}
      <TrainingCalendar data={data} onSelect={onDate} />
    </>,
  );
  assert.ok(dayButton(today).classList.contains("week-complete"));
  assert.ok(dayButton(today).getAttribute("aria-label")!.includes(a.name));
  assert.ok(dayButton(today).getAttribute("aria-label")!.includes(b.name));
  assert.match(
    card().getByText("/ 7 días activos").parentElement!.textContent!,
    /^1/,
  );
  assert.equal(JSON.stringify(data.plans), snapshot);
  const calendarDay = screen.getByRole("button", {
    name: new RegExp(`^${today}: Completado`),
  });
  assert.ok(calendarDay.getAttribute("aria-label")!.includes(a.name));
  assert.ok(calendarDay.getAttribute("aria-label")!.includes(b.name));
  data = completeSession(data, a, today, a.exercises, "Plan cumplido");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  data = loadData(localStorage);
  view.rerender(home(data, onDate));
  assert.match(
    card().getByText("/ 7 días activos").parentElement!.textContent!,
    /^1/,
  );
  assert.equal(
    daySchedule(data, today).activities.filter((a) => a.status === "planned")
      .length,
    0,
  );
  data = savePlan(data, {
    date: rest.key,
    status: "planned",
    routineId: b.id,
    note: "Cambio",
  });
  view.rerender(home(data, onDate));
  assert.ok(dayButton(rest.key).classList.contains("week-planned"));
  data = { ...data, plans: data.plans.filter((p) => p.date !== rest.key) };
  view.rerender(home(data, onDate));
  assert.ok(dayButton(rest.key).classList.contains("week-empty"));
});

test("sesiones demo o futuras no aumentan los días activos", () => {
  const data = initialData();
  const e = data.routines[0];
  data.plans = [];
  data.sessions = [
    {
      id: "demo",
      date: "2026-01-01",
      routineId: e.id,
      name: e.name,
      exercises: e.exercises,
      demo: true,
    },
    {
      id: "future",
      date: "2026-01-04",
      routineId: e.id,
      name: e.name,
      exercises: e.exercises,
    },
  ];
  assert.equal(
    weekSchedule(data, "2026-01-02").filter((d) => d.sessions.length).length,
    0,
  );
});
