import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import App from "../src/App";
import { dateKey, initialData, STORAGE_KEY, type AppData } from "../src/data";
import TrainingCalendar from "../src/components/TrainingCalendar";
import userEvent from "@testing-library/user-event";
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AppData;
function start() {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData()));
  render(<App />);
}
function addNewExercise(name: string, type = "strength") {
  let dialog = screen.getByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Agregar ejercicio",
      exact: true,
    }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Crear ejercicio",
      exact: true,
    }),
  );
  fireEvent.change(within(dialog).getByLabelText("Nombre del ejercicio"), {
    target: { value: name },
  });
  fireEvent.change(within(dialog).getByLabelText("Tipo de actividad"), {
    target: { value: type },
  });
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Guardar ejercicio",
      exact: true,
    }),
  );
}
afterEach(() => {
  cleanup();
  localStorage.clear();
});
test("modal mantiene foco, se cierra con Escape y devuelve el foco al botón", async () => {
  start();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Rutinas" }));
  const create = screen.getByRole("button", { name: "Crear rutina" });
  await user.click(create);
  const dialog = screen.getByRole("dialog");
  assert.equal(document.activeElement, dialog);
  await user.tab({ shift: true });
  assert.equal(
    document.activeElement,
    within(dialog).getByRole("button", { name: "Guardar rutina" }),
  );
  await user.keyboard("{Escape}");
  assert.equal(screen.queryByRole("dialog"), null);
  assert.equal(document.activeElement, create);
});
test("crear, editar, duplicar, filtrar y asignar la misma rutina a dos fechas desde la interfaz", () => {
  start();
  assert.equal(screen.queryByText("Volumen total"), null);
  fireEvent.click(screen.getByRole("button", { name: "Rutinas" }));
  fireEvent.click(screen.getByRole("button", { name: "Crear rutina" }));
  let dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Nombre"), {
    target: { value: "Mi plan libre" },
  });
  fireEvent.change(within(dialog).getByLabelText("Descripción · opcional"), {
    target: { value: "Sin día fijo" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Piernas", exact: true }),
  );
  addNewExercise("Sentadilla propia");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar rutina" }),
  );
  let routine = stored().routines.find((r) => r.name === "Mi plan libre")!;
  assert.ok(routine);
  assert.deepEqual(routine.tags, ["Piernas"]);
  assert.equal(screen.queryByRole("dialog"), null);
  fireEvent.change(screen.getByLabelText("Filtrar rutinas por etiqueta"), {
    target: { value: "Piernas" },
  });
  assert.equal(
    screen.queryByRole("heading", { name: "Glúteos", exact: true }),
    null,
  );
  fireEvent.click(screen.getByLabelText("Acciones de Mi plan libre"));
  fireEvent.click(
    screen.getByRole("button", { name: "Duplicar", exact: true }),
  );
  assert.ok(stored().routines.some((r) => r.name === "Mi plan libre (copia)"));

  fireEvent.click(screen.getByLabelText("Acciones de Mi plan libre"));
  fireEvent.click(screen.getByRole("button", { name: "Editar", exact: true }));
  dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Nombre"), {
    target: { value: "Plan editado" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar rutina" }),
  );
  assert.ok(
    stored().routines.some(
      (r) => r.id === routine.id && r.name === "Plan editado",
    ),
  );
  fireEvent.click(screen.getByLabelText("Acciones de Plan editado"));
  fireEvent.click(
    screen.getByRole("button", { name: "Asignar fecha", exact: true }),
  );
  dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Fecha de la asignación"), {
    target: { value: "2026-01-02" },
  });
  dialog = screen.getByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Planificar rutina" }),
  );
  assert.equal(stored().sessions.length, 0);
  assert.equal(stored().plans[0].routineId, routine.id);
  fireEvent.change(within(dialog).getByLabelText("Fecha de la asignación"), {
    target: { value: "2026-01-08" },
  });
  dialog = screen.getByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Planificar rutina" }),
  );
  assert.equal(stored().plans.length, 2);
  assert.equal(stored().routines.filter((r) => r.id === routine.id).length, 1);
  fireEvent.click(within(dialog).getByLabelText("Cerrar"));
});
test("registrar cargas reales, editar y eliminar la rutina conserva el historial y el gráfico", () => {
  start();
  fireEvent.change(screen.getByLabelText("Elegí qué querés entrenar"), {
    target: { value: "legs" },
  });
  fireEvent.change(screen.getByLabelText("Sentadilla con barra: Peso (kg)"), {
    target: { value: "57.5" },
  });
  fireEvent.change(screen.getByLabelText("Sentadilla con barra: notas"), {
    target: { value: "Buen control" },
  });
  assert.equal(stored().drafts[`${dateKey()}-legs`][0].weight, 57.5);
  fireEvent.click(
    screen.getByRole("button", { name: "Completar entrenamiento" }),
  );
  const snapshot = JSON.stringify(stored().sessions);
  assert.equal(stored().sessions[0].exercises[0].weight, 57.5);
  assert.equal(stored().routines[0].exercises[0].weight, 40);
  fireEvent.click(screen.getByRole("button", { name: "Rutinas" }));
  fireEvent.click(screen.getByLabelText("Acciones de Piernas"));
  fireEvent.click(screen.getByRole("button", { name: "Editar", exact: true }));
  let dialog = screen.getByRole("dialog");
  fireEvent.change(
    within(dialog).getByLabelText("Sentadilla con barra: Peso (kg)"),
    { target: { value: "90" } },
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar rutina" }),
  );
  assert.equal(JSON.stringify(stored().sessions), snapshot);
  fireEvent.click(screen.getByLabelText("Acciones de Piernas"));
  fireEvent.click(
    screen.getByRole("button", { name: "Eliminar", exact: true }),
  );
  dialog = screen.getByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Eliminar rutina" }),
  );
  assert.equal(JSON.stringify(stored().sessions), snapshot);
  assert.ok(!stored().routines.some((r) => r.id === "legs"));
  fireEvent.click(screen.getByRole("button", { name: "Progreso" }));
  assert.ok(
    within(screen.getByLabelText("Ejercicio del gráfico")).getByRole("option", {
      name: "Sentadilla con barra",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Piernas.*ejercicios/ }));
  assert.ok(within(screen.getByRole("dialog")).getByText(/57.5 kg × 10/));
  assert.ok(within(screen.getByRole("dialog")).getByText("Buen control"));
});
test("registro aeróbico usa minutos, distancia y resistencia sin exigir kilos ni repeticiones", () => {
  start();
  fireEvent.click(screen.getByRole("button", { name: "Rutinas" }));
  fireEvent.click(screen.getByRole("button", { name: "Crear rutina" }));
  let dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Nombre"), {
    target: { value: "Bici libre" },
  });
  addNewExercise("Bici fija", "cardio");
  assert.equal(within(dialog).queryByLabelText("Bici fija: Peso (kg)"), null);
  assert.equal(
    within(dialog).queryByLabelText("Bici fija: Repeticiones"),
    null,
  );
  fireEvent.change(within(dialog).getByLabelText("Bici fija: Minutos"), {
    target: { value: "32" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar rutina" }),
  );
  fireEvent.click(screen.getByLabelText("Acciones de Bici libre"));
  fireEvent.click(
    screen.getByRole("button", { name: "Asignar fecha", exact: true }),
  );
  dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Bici fija: Minutos"), {
    target: { value: "35" },
  });
  fireEvent.change(within(dialog).getByLabelText("Bici fija: Distancia (km)"), {
    target: { value: "12.5" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Completar entrenamiento" }),
  );
  assert.equal(stored().sessions[0].exercises[0].duration, 35);
  assert.equal(stored().sessions[0].exercises[0].distance, 12.5);
  assert.equal(
    stored().routines.find((r) => r.name === "Bici libre")!.exercises[0]
      .duration,
    32,
  );
});
test("calendario muestra estados accesibles, permite descanso y quitarlo, y navega meses", () => {
  start();
  fireEvent.click(
    screen.getByRole("button", { name: "Calendario", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: `${dateKey()}: Sin registro`,
      exact: true,
    }),
  );
  let dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Nota del día · opcional"), {
    target: { value: "Recuperar energía" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Descanso", exact: true }),
  );
  assert.equal(stored().plans[0].status, "rest");
  fireEvent.click(within(dialog).getByLabelText("Cerrar"));
  assert.ok(
    screen.getByRole("button", { name: `${dateKey()}: Descanso`, exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: `${dateKey()}: Descanso`, exact: true }),
  );
  dialog = screen.getByRole("dialog");
  assert.equal(
    (
      within(dialog).getByLabelText(
        "Nota del día · opcional",
      ) as HTMLTextAreaElement
    ).value,
    "Recuperar energía",
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Quitar asignación" }),
  );
  assert.equal(stored().plans.length, 0);
  fireEvent.click(within(dialog).getByLabelText("Cerrar"));
  const before = screen.getByRole("button", {
    name: `${dateKey()}: Sin registro`,
  });
  assert.equal(before.getAttribute("aria-current"), "date");
  fireEvent.click(screen.getByLabelText("Mes siguiente"));
  assert.equal(
    screen.queryByRole("button", { name: `${dateKey()}: Sin registro` }),
    null,
  );
  fireEvent.click(screen.getByLabelText("Mes anterior"));
  assert.ok(screen.getByRole("button", { name: `${dateKey()}: Sin registro` }));
});
test("calendario distingue completado, plan y descanso con texto e iconos", () => {
  const d = initialData();
  const today = dateKey();
  const base = today.slice(0, 8);
  d.sessions = [
    {
      id: "s",
      date: `${base}01`,
      routineId: "legs",
      name: "Piernas",
      exercises: d.routines[0].exercises,
    },
  ];
  d.plans = [
    { date: `${base}02`, status: "planned", routineId: "upper", note: "" },
    { date: `${base}03`, status: "rest", note: "" },
  ];
  render(<TrainingCalendar data={d} onSelect={() => {}} />);
  assert.ok(
    screen
      .getByRole("button", { name: `${base}01: Completado, Piernas` })
      .querySelector("svg"),
  );
  assert.ok(
    screen
      .getByRole("button", { name: `${base}02: Planificado, Tren superior` })
      .querySelector("svg"),
  );
  assert.ok(
    screen
      .getByRole("button", { name: `${base}03: Descanso` })
      .querySelector("svg"),
  );
  assert.equal(
    screen
      .getByRole("button", { name: `${base}04: Sin registro` })
      .querySelector("svg"),
    null,
  );
});
test("datos corruptos se informan y no se sobrescriben al intentar guardar", () => {
  localStorage.setItem(STORAGE_KEY, "{broken");
  render(<App />);
  assert.ok(
    screen.getByRole("alert").textContent?.includes("No se sobrescribirá"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Rutinas" }));
  fireEvent.click(screen.getByRole("button", { name: "Crear rutina" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Nombre"), {
    target: { value: "No guardar" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Agregar ejercicio",
      exact: true,
    }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Seleccionar Sentadilla con barra",
    }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar rutina" }),
  );
  assert.equal(localStorage.getItem(STORAGE_KEY), "{broken");
});

test("modales no compiten por el ancho del contenido y conservan su grupo de controles", () => {
  start();
  const shell = document.querySelector(".app-shell")!;
  const main = shell.querySelector(":scope > main")!;
  assert.ok(main.querySelector(".home-overview"));
  assert.deepEqual(
    [...shell.children].map((node) => node.tagName),
    ["ASIDE", "MAIN"],
  );
  const modalControls = document.querySelector("fieldset.modal-fields")!;
  assert.equal(shell.contains(modalControls), false);
  const before = stored();
  fireEvent.click(screen.getByRole("button", { name: "Rutinas" }));
  fireEvent.click(screen.getByRole("button", { name: "Crear rutina" }));
  const dialog = screen.getByRole("dialog");
  assert.ok(modalControls.contains(dialog));
  assert.equal(shell.contains(dialog), false);
  assert.ok(main.querySelector(".routine-grid"));
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Cerrar", exact: true }),
  );
  assert.equal(screen.queryByRole("dialog"), null);
  assert.deepEqual(stored(), before);
});

test("corregir y eliminar un entrenamiento completado actualiza valores, conserva plantilla y pide confirmar", () => {
  start();
  fireEvent.change(screen.getByLabelText("Elegí qué querés entrenar"), {
    target: { value: "legs" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Completar entrenamiento" }),
  );
  const original = stored();
  const id = original.sessions[0].id;
  fireEvent.click(
    screen.getByRole("button", { name: "Corregir registro de Piernas" }),
  );
  let form = screen.getByRole("form", {
    name: "Corregir entrenamiento Piernas",
  });
  fireEvent.change(
    within(form).getByLabelText("Sentadilla con barra: serie 1 peso (kg)"),
    { target: { value: "65" } },
  );
  fireEvent.click(within(form).getByRole("button", { name: "Cancelar" }));
  assert.deepEqual(stored(), original);
  fireEvent.click(
    screen.getByRole("button", { name: "Corregir registro de Piernas" }),
  );
  form = screen.getByRole("form", { name: "Corregir entrenamiento Piernas" });
  fireEvent.change(
    within(form).getByLabelText("Sentadilla con barra: serie 1 peso (kg)"),
    { target: { value: "65" } },
  );
  fireEvent.change(
    within(form).getByLabelText("Nota del registro · opcional"),
    { target: { value: "Carga corregida" } },
  );
  fireEvent.click(
    within(form).getByRole("button", { name: "Guardar corrección" }),
  );
  assert.equal(stored().sessions[0].id, id);
  assert.equal(stored().sessions[0].exercises[0].performedSets![0].weight, 65);
  assert.equal(stored().sessions[0].note, "Carga corregida");
  assert.deepEqual(stored().routines, original.routines);
  assert.deepEqual(
    JSON.parse(localStorage.getItem("forma-session-corrections-v1")!)[0].before,
    original.sessions[0],
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Eliminar registro de Piernas" }),
  );
  assert.equal(stored().sessions.length, 1);
  fireEvent.click(
    screen.getByRole("button", { name: "Cancelar", exact: true }),
  );
  assert.equal(stored().sessions.length, 1);
  fireEvent.click(
    screen.getByRole("button", { name: "Eliminar registro de Piernas" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar eliminación" }),
  );
  assert.equal(stored().sessions.length, 0);
  assert.deepEqual(stored().routines, original.routines);
  assert.equal(
    JSON.parse(localStorage.getItem("forma-session-corrections-v1")!).length,
    2,
  );
  cleanup();
  render(<App />);
  assert.equal(stored().sessions.length, 0);
});
