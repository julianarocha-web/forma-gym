// Development fixture only. Not a build entry and never connects a real account.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import AppShell from "../src/AppShell";
import { ThemeProvider } from "../src/theme";
import { UnitProvider } from "../src/units";
import { initialData, completeSession, dateKey } from "../src/data";
import { localMedia, MediaProvider } from "../src/cloud/media";
import type { AccountRuntime, Profile } from "../src/cloud/types";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import "../src/index.css";
import "../src/enhancements.css";
import "../src/exercise-catalog.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "../src/design-system.css";
import "../src/theme.css";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let fixture = initialData();
const first = fixture.routines[0];
fixture = completeSession(
  fixture,
  first,
  dateKey(),
  first.exercises.map((e) => ({
    ...e,
    performedSets: [
      { weight: e.weight, reps: 12 },
      { weight: e.weight + 5, reps: 8 },
    ],
  })),
  "Registro ficticio",
);
let revision = 1;
const repository = {
  userId,
  load: async () => ({ data: structuredClone(fixture), revision }),
  save: async (data: typeof fixture, expected: number) => {
    if (expected !== revision) throw new Error("FORMA_CONFLICT");
    fixture = structuredClone(data);
    revision++;
    return { data: fixture, revision };
  },
  imported: async () => false,
};
function Preview() {
  const [profile, setProfile] = useState<Profile>({
    owner_id: userId,
    display_name: "Cuenta de prueba",
    avatar: null,
    primary_goal: "Mejorar fuerza",
    secondary_goals: ["Bienestar general"],
    unit: "kg",
    theme: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const saveProfile: AccountRuntime["saveProfile"] = async (changes) => {
    setProfile((p) => ({
      ...p,
      ...changes,
      updated_at: new Date().toISOString(),
    }));
    return true;
  };
  const account: AccountRuntime = {
    profile,
    saveProfile,
    repository,
    user: {
      id: userId,
      email: "prueba@example.invalid",
      created_at: profile.created_at,
    } as User,
    sharedCatalog: [],
    error: "",
    signOut: async () => {},
    client: {} as SupabaseClient,
  };
  return (
    <ThemeProvider
      accountId={userId}
      remotePreference={profile.theme}
      onPersist={(value) => saveProfile({ theme: value })}
    >
      <UnitProvider unit={profile.unit}>
        <MediaProvider service={localMedia}>
          <div className="local-mode-note">
            Vista de prueba · Datos ficticios · Sin conexión a una cuenta real
          </div>
          <AppShell account={account} />
        </MediaProvider>
      </UnitProvider>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
