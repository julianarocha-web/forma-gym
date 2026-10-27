import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppData, ExerciseDefinition } from "../data";
import type { ImageRef } from "../media";

export type ThemePreference = "light" | "dark" | null;
export const goals = [
  "Ganar músculo",
  "Perder grasa",
  "Recomposición corporal",
  "Mejorar fuerza",
  "Mejorar resistencia",
  "Bienestar general",
] as const;
export type Profile = {
  owner_id: string;
  display_name: string;
  avatar: ImageRef | null;
  primary_goal: string;
  secondary_goals: string[];
  unit: "kg" | "lb";
  theme: ThemePreference;
  created_at: string;
  updated_at: string;
};
export type WorkspaceSnapshot = {
  data: AppData;
  revision: number;
  warning?: string;
};
export type CommitResult = boolean | Promise<boolean>;
export function afterCommit(
  result: CommitResult,
  onSuccess: () => void,
): CommitResult {
  const finish = (saved: boolean) => {
    if (saved) onSuccess();
    return saved;
  };
  return typeof result === "boolean" ? finish(result) : result.then(finish);
}
export function reportCommit(
  result: CommitResult,
  setError: (message: string) => void,
  setBusy: (busy: boolean) => void,
  message: string,
) {
  const finish = (saved: boolean) => {
    setBusy(false);
    setError(saved ? "" : message);
  };
  if (typeof result === "boolean") finish(result);
  else {
    setBusy(true);
    void result.then(finish).catch(() => finish(false));
  }
}
export type WorkspaceRepository = {
  userId: string;
  load: () => Promise<WorkspaceSnapshot>;
  save: (
    data: AppData,
    revision: number,
    importHash?: string,
  ) => Promise<WorkspaceSnapshot>;
  imported: (hash: string) => Promise<boolean>;
};
export type AccountRuntime = {
  client: SupabaseClient;
  user: User;
  profile: Profile;
  sharedCatalog: ExerciseDefinition[];
  repository: WorkspaceRepository;
  saveProfile: (
    changes: Partial<
      Pick<
        Profile,
        | "display_name"
        | "avatar"
        | "primary_goal"
        | "secondary_goals"
        | "unit"
        | "theme"
      >
    >,
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  error: string;
};
export const emptyData = (): AppData => ({
  version: 3,
  catalog: [],
  routines: [],
  sessions: [],
  plans: [],
  drafts: {},
});
