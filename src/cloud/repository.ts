import type { SupabaseClient } from "@supabase/supabase-js";
import { validateData, type AppData } from "../data";
import type { WorkspaceRepository, WorkspaceSnapshot } from "./types";
import { canonical, imageRefs, sha256 } from "./import-data";
import { removeUnusedImages } from "./cleanup-images";
import { sessionChanges } from "../session-changes";

export function sameWorkspace(a: AppData, b: AppData) {
  const normalize = (data: AppData) => ({
    ...data,
    catalog: data.catalog
      .map((d) => ({ ...d, legacyIds: d.legacyIds ?? [] }))
      .sort((x, y) => x.id.localeCompare(y.id)),
    plans: [...data.plans].sort((x, y) => x.date.localeCompare(y.date)),
  });
  return canonical(normalize(a)) === canonical(normalize(b));
}

function snapshot(raw: unknown): WorkspaceSnapshot {
  const result = raw as WorkspaceSnapshot;
  if (!result || !Number.isSafeInteger(result.revision) || result.revision < 0)
    throw new Error(
      "FORMA: La respuesta de la nube no es válida. No se reemplazaron tus datos.",
    );
  validateData(result.data);
  return result;
}
export function createRepository(
  client: SupabaseClient,
  userId: string,
): WorkspaceRepository {
  let previous: AppData | undefined;
  return {
    userId,
    async load() {
      const { data, error } = await client.rpc("forma_load_workspace");
      if (error) throw error;
      const loaded = snapshot(data);
      previous = loaded.data;
      return loaded;
    },
    async save(next: AppData, revision: number, importHash?: string) {
      validateData(next);
      const changes = previous ? sessionChanges(previous, next) : [];
      if (changes.length > 1)
        throw new Error(
          "FORMA: Corregí un entrenamiento por vez. No se guardaron cambios.",
        );
      const correction = changes[0];
      if (
        correction &&
        (!previous ||
          !sameWorkspace(
            { ...previous, sessions: [] },
            { ...next, sessions: [] },
          ))
      )
        throw new Error(
          "FORMA: La corrección solo puede cambiar el entrenamiento elegido, sin modificar las rutinas ni otros datos.",
        );
      const { data, error } = correction
        ? await client.rpc("forma_correct_session", {
            p_data: next,
            p_session_id: correction.id,
            p_expected_revision: revision,
            p_action_id: await sha256(
              canonical({ revision, session: correction.id, data: next }),
            ),
          })
        : await client.rpc("forma_save_workspace", {
            p_data: next,
            p_expected_revision: revision,
            p_import_hash: importHash ?? null,
          });
      if (error?.code === "PGRST202" && correction)
        throw new Error(
          "FORMA: Falta habilitar las correcciones en Supabase. Ejecutá únicamente la nueva migración 202610270003_session_corrections.sql; el registro anterior se conserva.",
        );
      if (error) throw error;
      const saved = snapshot(data);
      if (!sameWorkspace(next, saved.data))
        throw new Error(
          "FORMA: La respuesta de la nube no coincide con todos los registros enviados. Conservamos una copia pendiente para revisar.",
        );
      const used = new Set(imageRefs(saved.data).map((ref) => ref.id));
      const removed = previous
        ? imageRefs(previous).filter(
            (ref) => ref.kind === "cloud" && !used.has(ref.id),
          )
        : [];
      previous = saved.data;
      try {
        await removeUnusedImages(client, userId, removed);
      } catch (err) {
        saved.warning = (err as Error).message.replace(/^FORMA:\s*/, "");
      }
      // RPC returns the persisted rows, not an optimistic copy of the request.
      return saved;
    },
    async imported(hash: string) {
      const { data, error } = await client
        .from("forma_local_imports")
        .select("source_hash")
        .eq("owner_id", userId)
        .eq("source_hash", hash)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  };
}
