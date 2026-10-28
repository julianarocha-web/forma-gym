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
import Progress from "../src/components/Progress";
import RoutineEditor from "../src/components/RoutineEditor";
import {
  saveRoutine,
  loadData,
  completeSession,
  routineSets,
} from "../src/data";
import { sessionMetric } from "../src/progress";
import {
  dateKey,
  formatDate,
  initialData,
  STORAGE_KEY,
  type AppData,
} from "../src/data";
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as AppData;
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function start() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData()));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Rutinas" }));
}
test("rutina por serie: adapta valores anteriores, copia, aplica y persiste al reabrir", () => {
  let data = initialData();
  const routine = structuredClone(data.routines[0]);
  routine.exercises = [routine.exercises[0]];
  const name = routine.exercises[0].name;
  function editor() {
    return render(
      <RoutineEditor
        routine={data.routines.find((r) => r.id === routine.id)!}
        catalog={data.catalog}
        onSaveExercise={() => true}
        onClose={() => {}}
        onSave={(r) => {
          data = saveRoutine(data, r);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          return true;
        }}
      />,
    );
  }
  data.routines = [routine];
  let view = editor();
  assert.equal(
    screen.getByLabelText(`${name}: serie 1 peso (kg)`).getAttribute("value"),
    String(routine.exercises[0].weight),
  );
  fireEvent.change(screen.getByLabelText(`${name}: Series`), {
    target: { value: "4" },
  });
  for (const [i, weight] of [0, 10, 15, 15].entries()) {
    fireEvent.change(
      screen.getByLabelText(`${name}: serie ${i + 1} peso (kg)`),
      { target: { value: String(weight) } },
    );
    fireEvent.change(
      screen.getByLabelText(`${name}: serie ${i + 1} repeticiones`),
      { target: { value: "10" } },
    );
  }
  fireEvent.change(screen.getByLabelText(`${name}: Series`), {
    target: { value: "5" },
  });
  assert.equal(
    (screen.getByLabelText(`${name}: serie 5 peso (kg)`) as HTMLInputElement)
      .value,
    "15",
  );
  fireEvent.change(screen.getByLabelText(`${name}: Series`), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar rutina" }));
  view.unmount();
  data = loadData(localStorage);
  const expected = [0, 10, 15, 15].map((weight) => ({ weight, reps: 10 }));
  assert.deepEqual(routineSets(data.routines[0].exercises[0]), expected);
  const completed = completeSession(
    data,
    data.routines[0],
    dateKey(),
    data.routines[0].exercises,
    "",
  );
  assert.deepEqual(
    completed.sessions.at(-1)!.exercises[0].performedSets,
    expected,
  );
  assert.equal(sessionMetric(completed.sessions.at(-1)!.exercises, "reps"), 40);
  assert.equal(
    sessionMetric(completed.sessions.at(-1)!.exercises, "weight"),
    15,
  );
  view = editor();
  assert.equal(
    (screen.getByLabelText(`${name}: serie 3 peso (kg)`) as HTMLInputElement)
      .value,
    "15",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Aplicar a todas las series" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar rutina" }));
  assert.deepEqual(
    data.routines[0].exercises[0].plannedSets,
    Array.from({ length: 4 }, () => ({ weight: 0, reps: 10 })),
  );
});
function addHipRoutine(name: string, weight: number) {
  fireEvent.click(screen.getByRole("button", { name: "Crear rutina" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Nombre"), {
    target: { value: name },
  });
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Agregar ejercicio",
      exact: true,
    }),
  );
  fireEvent.change(within(dialog).getByLabelText("Buscar ejercicios"), {
    target: { value: "hip" },
  });
  fireEvent.change(
    within(dialog).getByLabelText("Filtrar ejercicios por etiqueta"),
    { target: { value: "Glúteos" } },
  );
  assert.equal(
    within(dialog).queryByRole("button", {
      name: "Seleccionar Sentadilla con barra",
    }),
    null,
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Seleccionar Hip thrust" }),
  );
  fireEvent.change(
    within(dialog).getByLabelText("Hip thrust: serie 1 peso (kg)"),
    {
      target: { value: String(weight) },
    },
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar rutina" }),
  );
}
test("buscador y etiquetas reutilizan el mismo ejercicio en dos rutinas con valores independientes", () => {
  start();
  const count = stored().catalog.length;
  addHipRoutine("Plan A", 40);
  addHipRoutine("Plan B", 65);
  const a = stored().routines.find((r) => r.name === "Plan A")!,
    b = stored().routines.find((r) => r.name === "Plan B")!;
  assert.equal(a.exercises[0].exerciseId, b.exercises[0].exerciseId);
  assert.notEqual(a.exercises[0].id, b.exercises[0].id);
  assert.equal(a.exercises[0].weight, 40);
  assert.equal(b.exercises[0].weight, 65);
  assert.equal(stored().catalog.length, count);
  fireEvent.click(
    screen.getByRole("button", { name: "Catálogo de ejercicios" }),
  );
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Buscar ejercicios"), {
    target: { value: "hip" },
  });
  fireEvent.click(within(dialog).getByLabelText("Editar ejercicio Hip thrust"));
  fireEvent.change(within(dialog).getByLabelText("Nombre del ejercicio"), {
    target: { value: "Hip thrust compartido" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Smith", exact: true }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar ejercicio" }),
  );
  const after = stored();
  assert.ok(
    after.routines
      .filter((r) => ["Plan A", "Plan B"].includes(r.name))
      .every(
        (r) =>
          r.exercises[0].name === "Hip thrust compartido" &&
          r.exercises[0].tags.includes("Smith"),
      ),
  );
  assert.equal(
    after.routines.find((r) => r.name === "Plan A")!.exercises[0].weight,
    40,
  );
  assert.equal(
    after.routines.find((r) => r.name === "Plan B")!.exercises[0].weight,
    65,
  );
});
test("crear ejercicio en catálogo permite seleccionarlo después y registrar series distintas", () => {
  start();
  fireEvent.click(
    screen.getByRole("button", { name: "Catálogo de ejercicios" }),
  );
  let dialog = screen.getByRole("dialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Crear ejercicio" }),
  );
  fireEvent.change(within(dialog).getByLabelText("Nombre del ejercicio"), {
    target: { value: "Peso libre propio" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Espalda", exact: true }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Mancuernas", exact: true }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar ejercicio" }),
  );
  const def = stored().catalog.find((e) => e.name === "Peso libre propio")!;
  assert.ok(def.tags.includes("Espalda") && def.tags.includes("Mancuernas"));
  fireEvent.click(within(dialog).getByLabelText("Cerrar"));
  fireEvent.click(screen.getByRole("button", { name: "Crear rutina" }));
  dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Nombre"), {
    target: { value: "Rutina propia" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Agregar ejercicio",
      exact: true,
    }),
  );
  fireEvent.change(within(dialog).getByLabelText("Buscar ejercicios"), {
    target: { value: "Peso libre propio" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Seleccionar Peso libre propio",
    }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar rutina" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Inicio" }));
  const r = stored().routines.find((r) => r.name === "Rutina propia")!;
  fireEvent.change(screen.getByLabelText("Elegí qué querés entrenar"), {
    target: { value: r.id },
  });
  fireEvent.change(
    screen.getByLabelText("Peso libre propio: serie 1 peso (kg)"),
    { target: { value: "20" } },
  );
  fireEvent.change(
    screen.getByLabelText("Peso libre propio: serie 2 peso (kg)"),
    { target: { value: "25" } },
  );
  fireEvent.change(
    screen.getByLabelText("Peso libre propio: serie 2 repeticiones"),
    { target: { value: "8" } },
  );
  fireEvent.click(screen.getByLabelText("Quitar serie 3 de Peso libre propio"));
  fireEvent.click(
    screen.getByRole("button", { name: "Completar entrenamiento" }),
  );
  const actual = stored().sessions[0].exercises[0];
  assert.equal(actual.exerciseId, def.id);
  assert.deepEqual(actual.performedSets, [
    { weight: 20, reps: 12 },
    { weight: 25, reps: 8 },
  ]);
  assert.equal(
    stored().routines.find((x) => x.id === r.id)!.exercises[0].weight,
    0,
  );
});
test("progreso filtra períodos y métricas, muestra series reales y responde a tocar un punto", () => {
  const data = initialData();
  const e = data.routines[3].exercises[0];
  const past = new Date();
  past.setDate(past.getDate() - 110);
  const recent = new Date();
  recent.setDate(recent.getDate() - 3);
  const oldDate = dateKey(past),
    newDate = dateKey(recent);
  data.sessions = [
    {
      id: "a",
      date: oldDate,
      routineId: "a",
      name: "Rutina A",
      exercises: [
        {
          ...e,
          performedSets: [
            { weight: 40, reps: 12 },
            { weight: 45, reps: 10 },
          ],
        },
      ],
    },
    {
      id: "b",
      date: newDate,
      routineId: "b",
      name: "Rutina B",
      exercises: [
        {
          ...e,
          performedSets: [
            { weight: 50, reps: 8 },
            { weight: 55, reps: 6 },
          ],
        },
      ],
    },
  ];
  render(<Progress data={data} />);
  fireEvent.change(screen.getByLabelText("Ejercicio del gráfico"), {
    target: { value: e.exerciseId },
  });
  assert.ok(screen.getByText("Rutina A"));
  assert.ok(screen.getByText("Rutina B"));
  assert.ok(screen.getByText("Peso mínimo registrado"));
  assert.ok(screen.getByText("Peso máximo registrado"));
  fireEvent.click(
    screen.getByRole("button", {
      name: `${formatDate(newDate)}, Rutina B: 50 kg · Mínimo · Serie 1`,
    }),
  );
  assert.ok(
    screen.getByRole("status").textContent?.includes("Mínimo: 50 kg · Serie 1"),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: `${formatDate(newDate)}, Rutina B: 55 kg · Máximo · Serie 2`,
    }),
  );
  assert.ok(
    screen.getByRole("status").textContent?.includes("Máximo: 55 kg · Serie 2"),
  );
  fireEvent.change(screen.getByLabelText("Métrica del progreso"), {
    target: { value: "weight" },
  });
  fireEvent.click(
    screen.getByRole("button", {
      name: `${formatDate(newDate)}, Rutina B: 55 kg · Máximo · Serie 2`,
    }),
  );
  assert.ok(
    screen
      .getByRole("status")
      .textContent?.includes("Peso máximo por sesión: 55 kg"),
  );
  assert.ok(screen.getByRole("cell", { name: "50 kg" }));
  assert.ok(screen.getByRole("cell", { name: "6 reps" }));
  fireEvent.change(screen.getByLabelText("Métrica del progreso"), {
    target: { value: "reps" },
  });
  fireEvent.click(
    screen.getByRole("button", {
      name: `${formatDate(newDate)}, Rutina B: 14 reps`,
    }),
  );
  assert.ok(screen.getByRole("status").textContent?.includes("14 reps"));
  fireEvent.click(screen.getByRole("button", { name: "Último mes" }));
  assert.equal(screen.queryByText("Rutina A"), null);
  assert.ok(screen.getByText("Rutina B"));
  fireEvent.change(screen.getByLabelText("Métrica del progreso"), {
    target: { value: "sets" },
  });
  assert.ok(screen.getByRole("cell", { name: "50 kg" }));
  assert.equal(screen.queryByText("Primer valor del período"), null);
});
test("aeróbico mantiene huecos de distancia ausente y muestra el registro previo sin inventar series", () => {
  const data = initialData();
  const cardio = data.routines[1].exercises[0];
  data.sessions = [
    {
      id: "c1",
      date: dateKey(),
      routineId: "chest",
      name: "Bicicleta A",
      exercises: [{ ...cardio, duration: 25 }],
    },
    {
      id: "c2",
      date: dateKey(),
      routineId: "other",
      name: "Bicicleta B",
      exercises: [{ ...cardio, duration: 30, distance: 9.5 }],
    },
  ];
  render(<Progress data={data} />);
  fireEvent.change(screen.getByLabelText("Ejercicio del gráfico"), {
    target: { value: cardio.exerciseId },
  });
  fireEvent.change(screen.getByLabelText("Métrica del progreso"), {
    target: { value: "distance" },
  });
  const firstRecord = screen.getByText("Bicicleta A").closest("article")!;
  assert.ok(within(firstRecord).getAllByText("Sin registrar").length);
  assert.equal(within(firstRecord).queryByText("0 km"), null);
  fireEvent.click(
    screen.getByRole("button", {
      name: `${formatDate(dateKey())}, Bicicleta B: 9,5 km`,
    }),
  );
  assert.ok(screen.getByRole("status").textContent?.includes("9,5 km"));
  cleanup();
  const strength = data.routines[0].exercises[0];
  data.sessions = [
    {
      id: "legacy",
      date: dateKey(),
      routineId: "legs",
      name: "Anterior",
      exercises: [{ ...strength, uniformLegacy: true }],
    },
  ];
  render(<Progress data={data} />);
  assert.ok(
    screen.getByText(
      "Registro anterior con valores comunes. No se guardó un desglose por serie.",
    ),
  );
  assert.equal(screen.queryByRole("table"), null);
});
