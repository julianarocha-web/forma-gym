import { createContext, useContext, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readImageBlob, saveImageBlob, type ImageRef } from "../media";

export const MEDIA_BUCKET = "forma-private";
type MediaService = {
  save: (blob: Blob) => Promise<ImageRef>;
  read: (ref: ImageRef) => Promise<Blob | undefined>;
};
export const localMedia: MediaService = {
  save: saveImageBlob,
  read: (ref) =>
    ref.kind === "local"
      ? readImageBlob(ref.id)
      : Promise.reject(
          new Error("FORMA: Esta imagen necesita una sesión iniciada."),
        ),
};
export const MediaContext = createContext<MediaService>(localMedia);
export const useMedia = () => useContext(MediaContext);
export function createCloudMedia(
  client: SupabaseClient,
  userId: string,
): MediaService {
  const ensureOwned = (id: string) => {
    if (
      !id.startsWith(`${userId}/`) ||
      !/^[a-f0-9-]{36}\/[a-zA-Z0-9_-]{1,100}\.(webp|png|jpg|jpeg)$/.test(id)
    )
      throw new Error("FORMA: Esta imagen no pertenece a tu cuenta.");
  };
  return {
    async save(blob) {
      const extension =
        blob.type === "image/webp"
          ? "webp"
          : blob.type === "image/png"
            ? "png"
            : blob.type === "image/jpeg"
              ? "jpg"
              : "";
      if (!extension || !blob.size || blob.size > 1_500_000)
        throw new Error(
          "FORMA: La imagen no tiene un formato o tamaño válido.",
        );
      const id = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await client.storage
        .from(MEDIA_BUCKET)
        .upload(id, blob, {
          contentType: blob.type,
          upsert: false,
          cacheControl: "3600",
        });
      if (error)
        throw new Error(
          "FORMA: No se pudo subir la foto. Revisá la conexión y los permisos de imágenes.",
        );
      return { kind: "cloud", id };
    },
    async read(ref) {
      if (ref.kind === "local") return readImageBlob(ref.id);
      if (ref.kind !== "cloud") return undefined;
      ensureOwned(ref.id);
      const { data, error } = await client.storage
        .from(MEDIA_BUCKET)
        .download(ref.id);
      if (error)
        throw new Error("FORMA: No se pudo cargar una imagen privada.");
      return data;
    },
  };
}
export function MediaProvider({
  service,
  children,
}: {
  service: MediaService;
  children: ReactNode;
}) {
  return (
    <MediaContext.Provider value={service}>{children}</MediaContext.Provider>
  );
}
