import type { SupabaseClient } from "@supabase/supabase-js";
import { imageRefs } from "./import-data";
import { MEDIA_BUCKET } from "./media";
import type { ImageRef } from "../media";

export async function removeUnusedImages(
  client: SupabaseClient,
  userId: string,
  candidates: ImageRef[],
) {
  const owned = candidates.filter(
    (ref) => ref.kind === "cloud" && ref.id.startsWith(`${userId}/`),
  );
  if (!owned.length) return;
  const [workspace, profile, corrections] = await Promise.all([
    client.rpc("forma_load_workspace"),
    client
      .from("forma_profiles")
      .select("avatar")
      .eq("owner_id", userId)
      .single(),
    client
      .from("forma_session_corrections")
      .select("before_session,after_session")
      .eq("owner_id", userId),
  ]);
  if (workspace.error || profile.error || corrections.error)
    throw new Error(
      "FORMA: Los cambios se guardaron, pero no se pudo comprobar si la foto anterior sigue en uso. Se conservó el archivo privado.",
    );
  const used = new Set(
    imageRefs({
      data: workspace.data.data,
      avatar: profile.data.avatar,
      corrections: corrections.data,
    }).map((ref) => ref.id),
  );
  const paths = owned.filter((ref) => !used.has(ref.id)).map((ref) => ref.id);
  if (paths.length) {
    const { error } = await client.storage.from(MEDIA_BUCKET).remove(paths);
    if (error)
      throw new Error(
        "FORMA: Los cambios se guardaron, pero la limpieza de fotos sin uso falló. Los archivos anteriores siguen privados.",
      );
  }
}
