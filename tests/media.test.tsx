import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  validateImageFile,
  optimizeImage,
  saveImageBlob,
  readImageBlob,
  defaultRoutineImage,
  defaultExerciseImage,
  imageAssets,
} from "../src/media";
import {
  completeSession,
  dateKey,
  duplicateRoutine,
  initialData,
  loadData,
  saveCatalogExercise,
  savePlan,
  saveRoutine,
  STORAGE_KEY,
  validateData,
} from "../src/data";
import { exerciseProgress } from "../src/progress";
import { Photo } from "../src/components/Media";
import { ImagePicker } from "../src/components/Media";
import App from "../src/App";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const realWebp = () => readFile("public/images/cycling.webp");
test("fotografías locales tienen firma válida y se conservan al duplicar una rutina", async () => {
  for (const asset of Object.values(imageAssets)) {
    const bytes = await readFile(`public${asset.src}`);
    if (asset.src.endsWith(".webp")) {
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    } else assert.equal(bytes.toString("hex", 0, 3), "ffd8ff");
    assert.ok(bytes.length < 1_000_000);
  }
  const data = initialData();
  const copy = duplicateRoutine(data.routines[0]);
  assert.deepEqual(copy.image, defaultRoutineImage(data.routines[0].id));
});

test("todos los ejercicios iniciales tienen una foto específica, también con IDs migrados", () => {
  const data = initialData();
  const photos = data.catalog.map((def) =>
    defaultExerciseImage(def.id, def.legacyIds, def.name),
  );
  assert.equal(photos.length, 17);
  assert.ok(photos.every((ref) => ref && imageAssets[ref.id]?.exercise));
  assert.equal(new Set(photos.map((ref) => ref!.id)).size, 17);
  assert.deepEqual(
    defaultExerciseImage("uuid-nuevo", [], "HIP THRUST"),
    defaultExerciseImage("hip"),
  );
  assert.deepEqual(
    defaultExerciseImage("migrated", ["squat"]),
    defaultExerciseImage("squat"),
  );
  assert.equal(
    defaultExerciseImage("squat", [], "Un movimiento diferente"),
    undefined,
  );
  assert.equal(defaultExerciseImage("uuid-nuevo", [], "Press"), undefined);
  assert.notDeepEqual(
    defaultExerciseImage("curl"),
    defaultExerciseImage("extension"),
  );
  assert.notDeepEqual(
    defaultExerciseImage("uuid", [], "Sentadilla Smith"),
    defaultExerciseImage("squat"),
  );
  for (const name of [
    "Sentadilla en Smith",
    "Sentadilla búlgara",
    "Curl femoral sentado",
    "Prensa horizontal",
    "Extensión de tríceps en polea",
  ]) {
    assert.ok(defaultExerciseImage("uuid", [], name), name);
  }
});

test("elegir una foto del catálogo conserva la imagen elegida y permite quitarla explícitamente", () => {
  let selected: unknown;
  const view = render(
    <ImagePicker
      kind="exercise"
      label="Imagen"
      onChange={(image) => (selected = image)}
    />,
  );
  fireEvent.click(screen.getByText("Elegir una foto del catálogo"));
  fireEvent.change(screen.getByLabelText("Buscar fotografía"), {
    target: { value: "hip thrust" },
  });
  const choice = screen.getByRole("button", {
    name: "Elegir foto Hip thrust",
    hidden: true,
  });
  fireEvent.click(choice);
  assert.deepEqual(selected, { kind: "asset", id: "exercise-hip" });
  view.rerender(
    <Photo
      image={selected as { kind: "asset"; id: string }}
      fallback={defaultExerciseImage("bench")}
      alt="Personalizada"
    />,
  );
  assert.equal(
    screen.getByRole("img", { name: "Personalizada" }).getAttribute("src"),
    imageAssets["exercise-hip"].src,
  );
  view.rerender(
    <Photo
      image={null}
      fallback={defaultExerciseImage("bench")}
      alt="Quitada"
    />,
  );
  assert.ok(screen.getByRole("img", { name: "Sin foto: Quitada" }));
});
test("valida tamaño, MIME y firma; rechaza archivos disfrazados y formatos no admitidos", async () => {
  const file = new File([await realWebp()], "foto.webp", {
    type: "image/webp",
  });
  await validateImageFile(file);
  await assert.rejects(
    () =>
      validateImageFile(
        new File(["<svg/>"], "foto.svg", { type: "image/svg+xml" }),
      ),
    /JPG, PNG o WebP/,
  );
  await assert.rejects(
    () =>
      validateImageFile(
        new File(["not an image"], "foto.png", { type: "image/png" }),
      ),
    /contenido/,
  );
  await assert.rejects(
    () =>
      validateImageFile(
        new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.jpg", {
          type: "image/jpeg",
        }),
      ),
    /8 MB/,
  );
});
test("IndexedDB conserva el blob y localStorage usa solamente la referencia", async () => {
  const blob = new Blob([await realWebp()], { type: "image/webp" });
  const ref = await saveImageBlob(blob);
  const loaded = await readImageBlob(ref.id);
  assert.ok(loaded);
  assert.equal(loaded!.size, blob.size);
  assert.deepEqual(
    new Uint8Array(await loaded!.arrayBuffer()),
    new Uint8Array(await blob.arrayBuffer()),
  );
  let data = initialData();
  data = saveCatalogExercise(data, { ...data.catalog[0], image: ref });
  const serialized = JSON.stringify(data);
  assert.ok(!serialized.includes("data:image"));
  assert.ok(serialized.length < 40_000);
  assert.deepEqual(
    loadData({ getItem: (key) => (key === STORAGE_KEY ? serialized : null) }),
    JSON.parse(serialized),
  );
  await assert.rejects(() =>
    saveImageBlob(new Blob(["no"], { type: "text/plain" })),
  );
});
test("fotos ausentes o con error muestran placeholder accesible y no rompen la interfaz", async () => {
  const ref = await saveImageBlob(
    new Blob([await realWebp()], { type: "image/webp" }),
  );
  const view = render(<Photo image={ref} alt="Mi foto" />);
  const image = await screen.findByRole("img", { name: "Mi foto" });
  assert.ok(image.getAttribute("src")?.startsWith("blob:"));
  fireEvent.error(image);
  assert.ok(screen.getByRole("img", { name: "Sin foto: Mi foto" }));
  view.rerender(
    <Photo image={{ kind: "local", id: "missing" }} alt="Sin archivo" />,
  );
  await waitFor(() =>
    assert.ok(screen.getByRole("img", { name: "Sin foto: Sin archivo" })),
  );
});
test("cambiar o quitar imágenes conserva sesiones, pesos e identidad de los ejercicios", () => {
  let data = initialData();
  const r = {
    ...data.routines[0],
    image: { kind: "asset" as const, id: "strength" },
  };
  data = saveRoutine(data, r);
  data = completeSession(data, r, dateKey(), r.exercises, "Original");
  const snapshot = JSON.stringify(data.sessions);
  data = saveCatalogExercise(data, {
    ...data.catalog[0],
    image: { kind: "local", id: "photo-id" },
  });
  data = saveRoutine(data, { ...data.routines[0], image: null });
  assert.equal(JSON.stringify(data.sessions), snapshot);
  validateData(data);
  assert.equal(data.routines[0].image, null);
  assert.deepEqual(data.catalog[0].image, { kind: "local", id: "photo-id" });
  assert.throws(() =>
    validateData({
      ...data,
      catalog: [
        {
          ...data.catalog[0],
          image: { kind: "asset", id: "https://fake.example" },
        },
      ],
    }),
  );
});
test("ejemplos anteriores quedan separados y no completan actividad ni progreso real", () => {
  let data = initialData();
  const r = data.routines[0];
  data.sessions = [
    {
      id: "demo",
      date: dateKey(),
      routineId: r.id,
      name: "Ejemplo",
      exercises: r.exercises,
      demo: true,
    },
  ];
  assert.deepEqual(
    exerciseProgress(data, r.exercises[0].exerciseId, "weight", "all"),
    [],
  );
  data = savePlan(data, { date: dateKey(), status: "rest", note: "" });
  data = completeSession(data, r, dateKey(), r.exercises, "Real");
  assert.equal(data.sessions.length, 2);
  assert.equal(
    exerciseProgress(data, r.exercises[0].exerciseId, "weight", "all").length,
    1,
  );
});
test("editor permite elegir y quitar portada y reordenar ejercicios sin cambiar sus IDs", () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData()));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Rutinas" }));
  fireEvent.click(screen.getByLabelText("Acciones de Piernas"));
  fireEvent.click(screen.getByRole("button", { name: "Editar", exact: true }));
  const dialog = screen.getByRole("dialog");
  const ids = initialData().routines[0].exercises.map((e) => e.id);
  fireEvent.click(within(dialog).getByLabelText("Elegir portada Cardio"));
  fireEvent.click(within(dialog).getByLabelText("Bajar Sentadilla con barra"));
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar rutina" }),
  );
  let data = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  assert.deepEqual(data.routines[0].image, { kind: "asset", id: "cycling" });
  assert.equal(data.routines[0].exercises[0].id, ids[1]);
  assert.equal(data.routines[0].exercises[1].id, ids[0]);
  fireEvent.click(screen.getByLabelText("Acciones de Piernas"));
  fireEvent.click(screen.getByRole("button", { name: "Editar", exact: true }));
  fireEvent.click(screen.getByLabelText("Quitar imagen: Portada de la rutina"));
  fireEvent.click(screen.getByRole("button", { name: "Guardar rutina" }));
  data = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  assert.equal(data.routines[0].image, null);
});
test("subir una foto se optimiza, guarda y vuelve a cargar desde IndexedDB", async () => {
  const bytes = await realWebp();
  const originalBitmap = globalThis.createImageBitmap;
  const proto = window.HTMLCanvasElement.prototype;
  const originalContext = proto.getContext;
  const originalToBlob = proto.toBlob;
  let drawn = false;
  let closed = false;
  globalThis.createImageBitmap = async () =>
    ({
      width: 2800,
      height: 1400,
      close() {
        closed = true;
      },
    }) as ImageBitmap;
  proto.getContext = (() => ({
    drawImage() {
      drawn = true;
    },
  })) as typeof proto.getContext;
  proto.toBlob = function (callback) {
    assert.equal(this.width, 1400);
    assert.equal(this.height, 700);
    callback(new Blob([bytes], { type: "image/webp" }));
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData()));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Rutinas" }));
    fireEvent.click(screen.getByLabelText("Acciones de Piernas"));
    fireEvent.click(
      screen.getByRole("button", { name: "Editar", exact: true }),
    );
    const dialog = screen.getByRole("dialog");
    const file = new File([bytes], "mi-foto.webp", { type: "image/webp" });
    fireEvent.change(
      within(dialog).getByLabelText("Subir imagen: Portada de la rutina"),
      { target: { files: [file] } },
    );
    await screen.findByText(
      "Foto preparada. Guardá los cambios del formulario para aplicarla.",
    );
    assert.ok(drawn && closed);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Guardar rutina" }),
    );
    await screen.findByRole("img", { name: "Portada de Piernas" });
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    assert.equal(data.routines[0].image.kind, "local");
    assert.ok(await readImageBlob(data.routines[0].image.id));
    assert.ok(!localStorage.getItem(STORAGE_KEY)!.includes("data:image"));
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    proto.getContext = originalContext;
    proto.toBlob = originalToBlob;
  }
});
