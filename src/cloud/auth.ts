import { useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { userError } from "./client";
import { createRepository } from "./repository";
import type { AccountRuntime, Profile } from "./types";
import type { ExerciseDefinition } from "../data";

export function useAuthSession(client: SupabaseClient | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!client);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!client) return;
    let live = true;
    let eventReceived = false;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      if (!live) return;
      eventReceived = true;
      setSession(next);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY" && next) {
        setRecovery(true);
        try {
          sessionStorage.setItem(
            "forma-password-recovery",
            JSON.stringify({
              userId: next.user.id,
              expires: Date.now() + 30 * 60_000,
            }),
          );
        } catch {}
      }
      if (event === "SIGNED_OUT") {
        setRecovery(false);
        try {
          sessionStorage.removeItem("forma-password-recovery");
        } catch {}
      }
    });
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setError(userError(error));
        if (!eventReceived) setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (live) {
          setLoading(false);
          setError("No se pudo restaurar la sesión. Revisá tu conexión.");
        }
      });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, [client]);
  let persistedRecovery = false;
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("forma-password-recovery") ?? "null",
    );
    persistedRecovery =
      saved?.userId === session?.user.id && saved?.expires > Date.now();
  } catch {}
  return { session, loading, error, recovery: recovery || persistedRecovery };
}
export function useAccount(
  client: SupabaseClient | null,
  session: Session | null,
) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sharedCatalog, setSharedCatalog] = useState<ExerciseDefinition[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const userId = session?.user.id;
  const repository = useMemo(
    () => (client && userId ? createRepository(client, userId) : null),
    [client, userId],
  );
  useEffect(() => {
    let active = true;
    setProfile(null);
    setSharedCatalog([]);
    setError("");
    if (!client || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const initialized = await client.rpc("forma_initialize_account");
      if (initialized.error) throw initialized.error;
      const [p, c] = await Promise.all([
        client
          .from("forma_profiles")
          .select("*")
          .eq("owner_id", userId)
          .single(),
        client.from("forma_shared_exercises").select("*").order("name"),
      ]);
      if (p.error) throw p.error;
      if (c.error) throw c.error;
      if (active) {
        setProfile(p.data as Profile);
        setSharedCatalog(
          c.data.map((row) => ({
            id: `shared-${row.id}`,
            sharedId: row.id,
            legacyIds: [row.id],
            name: row.name,
            type: row.activity_type,
            tags: row.tags,
            image: row.image,
          })),
        );
        setLoading(false);
      }
    })().catch((err) => {
      if (active) {
        setError(userError(err));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [client, userId, attempt]);
  async function saveProfile(
    changes: Parameters<AccountRuntime["saveProfile"]>[0],
  ) {
    if (!client || !userId || !profile) return false;
    try {
      const { data, error } = await client
        .from("forma_profiles")
        .update(changes)
        .eq("owner_id", userId)
        .eq("updated_at", profile.updated_at)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setError(
          "El perfil cambió en otro dispositivo. Recargá tu perfil antes de guardar.",
        );
        return false;
      }
      setProfile(data as Profile);
      setError("");
      return true;
    } catch (err) {
      setError(userError(err));
      return false;
    }
  }
  const account: AccountRuntime | null =
    client && session && profile && profile.owner_id === userId && repository
      ? {
          client,
          user: session.user,
          profile,
          sharedCatalog,
          repository,
          saveProfile,
          error,
          signOut: async () => {
            const { error } = await client.auth.signOut({ scope: "local" });
            if (error) throw error;
          },
        }
      : null;
  return { account, loading, error, retry: () => setAttempt((x) => x + 1) };
}
