import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { initialData, type AppData } from "../src/data";
import { checkPublicConfig } from "../src/cloud/client";
import {
  emptyData,
  type WorkspaceRepository,
  type AccountRuntime,
} from "../src/cloud/types";
import { useCloudData } from "../src/cloud/useCloudData";
import { sameWorkspace } from "../src/cloud/repository";
import {
  inspectLocal,
  mergeImport,
  exportBackup,
  parseBackup,
} from "../src/cloud/import-data";
import { createCloudMedia } from "../src/cloud/media";
import { readImageBlob, saveImageBlob } from "../src/media";
import { ThemeProvider, ThemeToggle, ThemeOptions } from "../src/theme";
import { displayWeight, kilograms, UnitProvider } from "../src/units";
import AuthPanel from "../src/components/AuthPanel";
import ProfilePage from "../src/components/ProfilePage";
import { useAuthSession } from "../src/cloud/auth";
import {
  ExerciseFields,
  ExerciseRecords,
} from "../src/components/ExerciseFields";
import ExerciseCatalog from "../src/components/ExerciseCatalog";
import SessionActions from "../src/components/SessionActions";
import { completeSession, correctSession, dateKey } from "../src/data";
import { createRepository } from "../src/cloud/repository";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

test("configuración rechaza claves secretas y unidades no alteran cargas almacenadas", () => {
  assert.equal(
    checkPublicConfig("https://example.supabase.co", "sb_publishable_test"),
    "",
  );
  assert.ok(
    checkPublicConfig(
      "https://example.supabase.co",
      "sb_secret_NOT_A_REAL_KEY",
    ),
  );
  assert.ok(checkPublicConfig("javascript:alert(1)", "sb_publishable_test"));
  assert.equal(displayWeight(100, "lb"), 220.46);
  assert.ok(Math.abs(kilograms(displayWeight(100, "lb"), "lb") - 100) < 0.003);
});
test("importación antigua tiene IDs repetibles y nunca escribe la copia local", async () => {
  const source = initialData();
  const values = new Map([
    ["forma-data-v2", JSON.stringify({ ...source, version: 2 })],
  ]);
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  const before = [...values];
  const a = await inspectLocal(storage),
    b = await inspectLocal(storage);
  assert.deepEqual(a, b);
  assert.deepEqual([...values], before);
  assert.ok(a!.data.catalog.every((e) => e.id.startsWith("legacy-")));
  assert.equal(mergeImport(emptyData(), a!.data).routines.length, 4);
  assert.equal(mergeImport(a!.data, a!.data).routines.length, 4);
  const conflict = structuredClone(a!.data);
  conflict.routines[0].name = "Otra";
  assert.throws(() => mergeImport(a!.data, conflict), /Conflicto/);
});
test("respaldo incluye fotos y vuelve a leerse; no oculta fotos faltantes", async () => {
  const blob = new Blob([await readFile("public/images/cycling.webp")], {
    type: "image/webp",
  });
  const ref = await saveImageBlob(blob);
  const source = initialData();
  source.catalog[0].image = ref;
  const backup = await exportBackup(source, (r) => readImageBlob(r.id));
  assert.equal(backup.images.length, 1);
  const parsed = await parseBackup(
    new File([JSON.stringify(backup)], "forma.json", {
      type: "application/json",
    }),
  );
  assert.deepEqual(parsed.data, JSON.parse(JSON.stringify(source)));
  assert.equal((await parsed.read(ref))?.size, blob.size);
  await assert.rejects(
    () => exportBackup(source, async () => undefined),
    /Falta una imagen/,
  );
});
test("guardado cloud espera confirmación, conserva pendientes tras fallo y no toca datos locales", async () => {
  const legacy = JSON.stringify(initialData());
  localStorage.setItem("forma-data-v3", legacy);
  let server = emptyData();
  let revision = 0;
  let fail = true;
  const repo: WorkspaceRepository = {
    userId: "user-a",
    load: async () => ({ data: server, revision }),
    imported: async () => false,
    save: async (data) => {
      if (fail) throw new Error("offline");
      server = structuredClone(data);
      revision++;
      return { data: server, revision };
    },
  };
  const view = renderHook(() => useCloudData(repo));
  await waitFor(() => assert.equal(view.result.current.loading, false));
  let saved = true;
  await act(async () => {
    saved = await view.result.current.commit(initialData());
  });
  assert.equal(saved, false);
  assert.equal(view.result.current.data.routines.length, 0);
  assert.ok(view.result.current.pending);
  assert.equal(localStorage.getItem("forma-data-v3"), legacy);
  assert.ok(localStorage.getItem("forma-pending:user-a"));
  fail = false;
  await act(async () => {
    assert.equal(await view.result.current.retry(), true);
  });
  assert.equal(view.result.current.data.routines.length, 4);
  assert.equal(view.result.current.pending, null);
  assert.equal(localStorage.getItem("forma-pending:user-a"), null);
  assert.equal(localStorage.getItem("forma-data-v3"), legacy);
});
test("respuesta perdida se verifica al reintentar; cuenta B no recibe pendientes de A", async () => {
  const candidate = initialData();
  let server = emptyData();
  let calls = 0;
  const a: WorkspaceRepository = {
    userId: "A",
    load: async () => ({ data: server, revision: calls }),
    imported: async () => false,
    save: async (data) => {
      calls++;
      server = structuredClone(data);
      throw new Error("lost response");
    },
  };
  const view = renderHook(() => useCloudData(a));
  await waitFor(() => assert.equal(view.result.current.loading, false));
  await act(async () => {
    assert.equal(await view.result.current.commit(candidate), false);
  });
  await act(async () => {
    assert.equal(await view.result.current.retry(), true);
  });
  assert.equal(calls, 1);
  assert.ok(sameWorkspace(view.result.current.data, candidate));
  localStorage.setItem(
    "forma-pending:A",
    JSON.stringify({ data: candidate, revision: 1 }),
  );
  view.unmount();
  const b = {
    ...a,
    userId: "B",
    load: async () => ({ data: emptyData(), revision: 0 }),
  };
  const second = renderHook(() => useCloudData(b));
  await waitFor(() => assert.equal(second.result.current.loading, false));
  assert.equal(second.result.current.pending, null);
  assert.equal(second.result.current.data.routines.length, 0);
});
test("lectura de fotos privadas rechaza carpetas ajenas antes de consultar Storage", async () => {
  let called = false;
  const client = {
    storage: {
      from: () => {
        called = true;
        throw new Error();
      },
    },
  } as unknown as SupabaseClient;
  const media = createCloudMedia(
    client,
    "11111111-1111-4111-8111-111111111111",
  );
  await assert.rejects(
    () =>
      media.read({
        kind: "cloud",
        id: "22222222-2222-4222-8222-222222222222/photo.webp",
      }),
    /no pertenece/,
  );
  assert.equal(called, false);
});
test("tema sigue al sistema inicialmente, cambia inmediatamente y persiste al recargar", async () => {
  const original = window.matchMedia;
  window.matchMedia = (() => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  try {
    const view = render(
      <ThemeProvider>
        <ThemeToggle />
        <ThemeOptions />
      </ThemeProvider>,
    );
    assert.equal(document.documentElement.dataset.theme, "dark");
    fireEvent.click(screen.getByRole("button", { name: "Activar modo claro" }));
    assert.equal(document.documentElement.dataset.theme, "light");
    assert.equal(localStorage.getItem("forma-theme"), "light");
    view.unmount();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    assert.equal(document.documentElement.dataset.theme, "light");
    assert.ok(screen.getByRole("button", { name: "Activar modo oscuro" }));
  } finally {
    window.matchMedia = original;
  }
});
test("fallo al sincronizar tema conserva elección local y muestra el estado", async () => {
  render(
    <ThemeProvider
      accountId="user-a"
      remotePreference="light"
      onPersist={async () => false}
    >
      <ThemeToggle />
      <ThemeOptions />
    </ThemeProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Activar modo oscuro" }));
  assert.equal(document.documentElement.dataset.theme, "dark");
  await screen.findByText(/No se pudo sincronizar/);
  assert.equal(localStorage.getItem("forma-theme:user-a"), "dark");
  assert.equal(localStorage.getItem("forma-theme:user-a:pending"), "true");
});
test("registro valida contraseñas y solicita confirmación por correo sin almacenarlas", async () => {
  const requests: unknown[] = [];
  const client = {
    auth: {
      signUp: async (body: unknown) => {
        requests.push(body);
        return { data: { user: { id: "test" } }, error: null };
      },
    },
  } as unknown as SupabaseClient;
  render(<AuthPanel client={client} mode="signup" onMode={() => {}} />);
  fireEvent.change(screen.getByLabelText("Cómo querés que te llamemos"), {
    target: { value: "Prueba" },
  });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "prueba@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña", { exact: true }), {
    target: { value: "contraseña-de-prueba" },
  });
  fireEvent.change(screen.getByLabelText("Repetir contraseña"), {
    target: { value: "otra-contraseña" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Crear cuenta", exact: true }),
  );
  assert.equal(requests.length, 0);
  assert.ok(screen.getByRole("alert"));
  fireEvent.change(screen.getByLabelText("Repetir contraseña"), {
    target: { value: "contraseña-de-prueba" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Crear cuenta", exact: true }),
  );
  await screen.findByText(/Revisá tu correo para confirmar/);
  assert.equal(requests.length, 1);
  assert.ok(
    !Object.values(localStorage).join("").includes("contraseña-de-prueba"),
  );
});
test("ingreso presenta errores traducidos; recuperación solicita un enlace y reset exige sesión de recuperación", async () => {
  let resets = 0,
    updates = 0;
  const client = {
    auth: {
      signInWithPassword: async () => ({
        error: { code: "invalid_credentials" },
      }),
      resetPasswordForEmail: async () => {
        resets++;
        return { error: null };
      },
      updateUser: async () => {
        updates++;
        return { error: null };
      },
    },
  } as unknown as SupabaseClient;
  const view = render(
    <AuthPanel client={client} mode="login" onMode={() => {}} />,
  );
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "prueba@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "contraseña-de-prueba" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Iniciar sesión", exact: true }),
  );
  await screen.findByText(/El correo o la contraseña no son correctos/);
  view.unmount();
  const forgot = render(
    <AuthPanel client={client} mode="forgot" onMode={() => {}} />,
  );
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "prueba@example.invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
  await screen.findByText(/Si hay una cuenta asociada/);
  assert.equal(resets, 1);
  forgot.unmount();
  render(
    <AuthPanel
      client={client}
      mode="reset"
      onMode={() => {}}
      canReset={false}
    />,
  );
  assert.ok(screen.getByText(/El enlace no es válido/));
  assert.equal(updates, 0);
});

test("restablecimiento válido actualiza contraseña mediante Auth y cierra sesiones", async () => {
  const calls: string[] = [];
  const client = {
    auth: {
      updateUser: async (value: { password: string }) => {
        assert.equal(value.password, "clave-de-prueba-123");
        calls.push("update");
        return { error: null };
      },
      signOut: async (options: { scope: string }) => {
        calls.push(options.scope);
        return { error: null };
      },
    },
  } as unknown as SupabaseClient;
  sessionStorage.setItem("forma-password-recovery", "marca temporal");
  render(<AuthPanel client={client} mode="reset" canReset onMode={() => {}} />);
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
    target: { value: "clave-de-prueba-123" },
  });
  fireEvent.change(screen.getByLabelText("Repetir contraseña"), {
    target: { value: "clave-de-prueba-123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
  await screen.findByText(/Contraseña actualizada/);
  assert.deepEqual(calls, ["update", "global"]);
  assert.equal(sessionStorage.getItem("forma-password-recovery"), null);
  assert.equal(screen.queryByLabelText("Nueva contraseña"), null);
});

test("restauración de sesión no reemplaza un evento Auth más reciente; logout quita recuperación", async () => {
  type Callback = (event: string, session: Session | null) => void;
  let callback: Callback = () => {};
  let release: (value: unknown) => void = () => {};
  let unsubscribed = false;
  const a = { user: { id: "A" } } as Session,
    b = { user: { id: "B" } } as Session;
  const client = {
    auth: {
      onAuthStateChange: (next: Callback) => {
        callback = next;
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                unsubscribed = true;
              },
            },
          },
        };
      },
      getSession: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
  } as unknown as SupabaseClient;
  const view = renderHook(() => useAuthSession(client));
  act(() => callback("SIGNED_IN", b));
  await act(async () => {
    release({ data: { session: a }, error: null });
  });
  assert.equal(view.result.current.session?.user.id, "B");
  assert.equal(view.result.current.loading, false);
  act(() => callback("PASSWORD_RECOVERY", b));
  assert.equal(view.result.current.recovery, true);
  act(() => callback("SIGNED_OUT", null));
  assert.equal(view.result.current.session, null);
  assert.equal(view.result.current.recovery, false);
  view.unmount();
  assert.equal(unsubscribed, true);
});

test("perfil conserva formulario ante fallo, guarda objetivos y unidad tras confirmación", async () => {
  const requests: unknown[] = [];
  let allow = false,
    signouts = 0;
  const account = {
    user: {
      id: "A",
      email: "prueba@example.invalid",
      created_at: "2026-01-01T12:00:00Z",
    },
    profile: {
      owner_id: "A",
      display_name: "Prueba",
      avatar: null,
      primary_goal: "Bienestar general",
      secondary_goals: [],
      unit: "kg",
      theme: null,
    },
    saveProfile: async (changes: unknown) => {
      requests.push(changes);
      return allow;
    },
    signOut: async () => {
      signouts++;
    },
  } as unknown as AccountRuntime;
  render(
    <ThemeProvider>
      <ProfilePage account={account} data={emptyData()} onImport={() => {}} />
    </ThemeProvider>,
  );
  fireEvent.change(screen.getByLabelText("Nombre o apodo"), {
    target: { value: "Nuevo nombre" },
  });
  fireEvent.change(screen.getByLabelText("Objetivo principal"), {
    target: { value: "Mejorar fuerza" },
  });
  fireEvent.click(screen.getByLabelText("Mejorar resistencia"));
  fireEvent.change(screen.getByLabelText(/Unidad de peso/), {
    target: { value: "lb" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));
  await screen.findByText(/No se confirmó el guardado del perfil/);
  assert.equal(screen.queryByText("Tu perfil quedó guardado."), null);
  assert.equal(
    (screen.getByLabelText("Nombre o apodo") as HTMLInputElement).value,
    "Nuevo nombre",
  );
  allow = true;
  fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));
  await screen.findByText("Tu perfil quedó guardado.");
  assert.deepEqual(requests[1], {
    display_name: "Nuevo nombre",
    avatar: null,
    primary_goal: "Mejorar fuerza",
    secondary_goals: ["Mejorar resistencia"],
    unit: "lb",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Cerrar sesión", exact: true }),
  );
  assert.equal(signouts, 0);
  const dialog = screen.getByRole("dialog");
  const button = [...dialog.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Cerrar sesión"),
  );
  assert.ok(button);
  fireEvent.click(button);
  await waitFor(() => assert.equal(signouts, 1));
});

test("importación ya recibida no anuncia éxito si falla la nueva consulta", async () => {
  let fail = false;
  const repo: WorkspaceRepository = {
    userId: "A",
    imported: async () => true,
    load: async () => {
      if (fail) throw new Error("sin conexión");
      return { data: emptyData(), revision: 0 };
    },
    save: async () => {
      throw new Error("No debe guardar de nuevo");
    },
  };
  const view = renderHook(() => useCloudData(repo));
  await waitFor(() => assert.equal(view.result.current.loading, false));
  fail = true;
  await act(async () =>
    assert.equal(
      await view.result.current.importData(emptyData(), "hash"),
      false,
    ),
  );
  assert.ok(view.result.current.error);
});

test("cargas convertidas a libras permiten enviar formularios sin redondear el registro original", () => {
  const row = { ...initialData().routines[0].exercises[0], weight: 100 };
  let updated = row;
  const view = render(
    <UnitProvider unit="lb">
      <form>
        <ExerciseFields
          exercise={row}
          onChange={(next) => {
            updated = next;
          }}
        />
      </form>
    </UnitProvider>,
  );
  const field = screen.getByLabelText(
    `${row.name}: Peso (lb)`,
  ) as HTMLInputElement;
  assert.equal(field.value, "220.46");
  assert.equal(field.checkValidity(), true);
  assert.equal(row.weight, 100);
  fireEvent.change(field, { target: { value: "22.05" } });
  assert.ok(Math.abs(updated.weight - 10.00171) < 0.001);
  view.unmount();
  render(
    <UnitProvider unit="kg">
      <form>
        <ExerciseRecords
          exercises={[
            {
              ...row,
              weight: updated.weight,
              performedSets: [{ weight: updated.weight, reps: 12 }],
            },
          ]}
          onChange={() => {}}
        />
      </form>
    </UnitProvider>,
  );
  const set = screen.getByLabelText(
    `${row.name}: serie 1 peso (kg)`,
  ) as HTMLInputElement;
  assert.equal(set.checkValidity(), true);
});

test("seleccionar ejercicio general espera que se confirme la copia privada", async () => {
  const shared = {
    ...initialData().catalog[0],
    id: "shared-squat",
    sharedId: "squat",
  };
  let saved = false,
    selected = 0;
  render(
    <ExerciseCatalog
      catalog={[shared]}
      usedIds={[]}
      onSave={async () => saved}
      onSelect={() => {
        selected++;
      }}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: `Seleccionar ${shared.name}` }),
  );
  await act(async () => {});
  assert.equal(selected, 0);
  saved = true;
  fireEvent.click(
    screen.getByRole("button", { name: `Seleccionar ${shared.name}` }),
  );
  await waitFor(() => assert.equal(selected, 1));
});

test("correcciones usan RPC específica, sin modificar el guardado normal ni confirmar errores", async () => {
  const base = initialData();
  const before = completeSession(
    base,
    base.routines[0],
    dateKey(),
    base.routines[0].exercises,
    "",
  );
  const session = structuredClone(before.sessions[0]);
  session.note = "Corrección explícita";
  const next = correctSession(before, session);
  const calls: string[] = [];
  const client = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push(name);
      if (name === "forma_load_workspace")
        return { data: { data: before, revision: 7 }, error: null };
      assert.equal(name, "forma_correct_session");
      assert.equal(args?.p_session_id, session.id);
      assert.match(String(args?.p_action_id), /^[a-f0-9]{64}$/);
      return { data: { data: next, revision: 8 }, error: null };
    },
  } as unknown as SupabaseClient;
  const repo = createRepository(client, "A");
  await repo.load();
  assert.deepEqual((await repo.save(next, 7)).data.sessions, next.sessions);
  assert.deepEqual(calls, ["forma_load_workspace", "forma_correct_session"]);
  let notices = 0;
  render(
    <SessionActions
      data={before}
      session={before.sessions[0]}
      onCommit={async () => false}
      notify={() => {
        notices++;
      }}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Corregir registro de Piernas" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar corrección" }));
  await screen.findByText(/No se confirmó el cambio/);
  assert.equal(notices, 0);
  assert.ok(screen.getByRole("button", { name: "Guardar corrección" }));
});
