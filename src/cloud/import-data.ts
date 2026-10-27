import type { SupabaseClient } from "@supabase/supabase-js";
import { loadData, validateData, type AppData } from "../data";
import { readImageBlob, validateImageFile, type ImageRef } from "../media";
import { MEDIA_BUCKET } from "./media";
import type { Profile } from "./types";

export const legacyKeys = [
  "forma-data-v3",
  "forma-data-v2",
  "forma-routines-v1",
  "forma-sessions-v1",
  "forma-drafts-v1",
];
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v)
            .filter(([, x]) => x !== undefined)
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export function hasLocalData(storage: Pick<Storage, "getItem"> = localStorage) {
  return legacyKeys.some((key) => storage.getItem(key) !== null);
}
export async function inspectLocal(
  storage: Pick<Storage, "getItem"> = localStorage,
) {
  const raw = Object.fromEntries(
    legacyKeys
      .map((key) => [key, storage.getItem(key)])
      .filter(([, value]) => value !== null),
  );
  if (!Object.keys(raw).length) return null;
  const data = structuredClone(loadData(storage)); // Read only: never invokes the local persistence hook.
  if (!raw["forma-data-v3"]) {
    // v1/v2 migration originally used random catalog UUIDs; imports need repeatable identities.
    const ids = new Map<string, string>();
    for (const def of data.catalog)
      ids.set(
        def.id,
        `legacy-${(await sha256(def.legacyIds?.[0] ?? def.id)).slice(0, 32)}`,
      );
    data.catalog = data.catalog.map((d) => ({ ...d, id: ids.get(d.id)! }));
    for (const e of [
      ...data.routines.flatMap((r) => r.exercises),
      ...data.sessions.flatMap((s) => s.exercises),
      ...Object.values(data.drafts).flat(),
    ])
      e.exerciseId = ids.get(e.exerciseId)!;
  }
  validateData(data);
  return { data, hash: await sha256(canonical(raw)), raw };
}
export function imageRefs(value: unknown): ImageRef[] {
  const result = new Map<string, ImageRef>();
  function visit(item: unknown) {
    if (!item || typeof item !== "object") return;
    if (
      "kind" in item &&
      "id" in item &&
      ["local", "cloud"].includes(String(item.kind))
    ) {
      const ref = item as ImageRef;
      result.set(`${ref.kind}:${ref.id}`, ref);
    } else for (const x of Object.values(item)) visit(x);
  }
  visit(value);
  return [...result.values()];
}
export function mergeImport(current: AppData, incoming: AppData): AppData {
  validateData(current);
  validateData(incoming);
  const merge = <T>(
    before: T[],
    additions: T[],
    id: (x: T) => string,
    label: string,
  ): T[] => {
    const result = structuredClone(before);
    for (const item of additions) {
      const existing = result.find((x) => id(x) === id(item));
      if (!existing) result.push(structuredClone(item));
      else if (canonical(existing) !== canonical(item))
        throw new Error(
          `FORMA: Conflicto en ${label} (${id(item)}). La importación no sobrescribió tus datos. Revisá ambas copias antes de continuar.`,
        );
    }
    return result;
  };
  const catalog = merge(
    current.catalog.map((d) => ({ ...d, legacyIds: d.legacyIds ?? [] })),
    incoming.catalog.map((d) => ({ ...d, legacyIds: d.legacyIds ?? [] })),
    (x) => x.id,
    "ejercicios",
  );
  const drafts = { ...structuredClone(current.drafts) };
  for (const [key, rows] of Object.entries(incoming.drafts)) {
    if (drafts[key] && canonical(drafts[key]) !== canonical(rows))
      throw new Error(
        "FORMA: Hay dos borradores diferentes para la misma fecha y rutina. Conservamos ambas copias sin importar.",
      );
    drafts[key] = structuredClone(rows);
  }
  const sessions = merge(
    current.sessions,
    incoming.sessions,
    (x) => x.id,
    "entrenamientos",
  );
  const completedKeys = sessions
    .filter((s) => !s.demo)
    .map((s) => `${s.date}:${s.routineId}`);
  if (new Set(completedKeys).size !== completedKeys.length)
    throw new Error(
      "FORMA: Dos registros distintos completan la misma rutina en la misma fecha. Revisalos antes de importar.",
    );
  const result = {
    version: 3 as const,
    catalog,
    routines: merge(
      current.routines,
      incoming.routines,
      (x) => x.id,
      "rutinas",
    ),
    sessions,
    plans: merge(current.plans, incoming.plans, (x) => x.date, "calendario"),
    drafts,
  };
  validateData(result);
  return result;
}
export type Backup = {
  format: "forma-backup";
  version: 1;
  exportedAt: string;
  data: AppData;
  profile?: Profile;
  images: {
    kind: ImageRef["kind"];
    id: string;
    type: string;
    base64: string;
  }[];
};
function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function downloadJson(value: unknown, name: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportBackup(
  data: AppData,
  read: (ref: ImageRef) => Promise<Blob | undefined>,
  profile?: Profile,
): Promise<Backup> {
  validateData(data);
  const images: Backup["images"] = [];
  for (const ref of imageRefs({ data, profile })) {
    const blob = await read(ref);
    if (!blob)
      throw new Error(
        "FORMA: Falta una imagen. No se generó una copia incompleta: revisá el almacenamiento antes de continuar.",
      );
    images.push({
      ...ref,
      type: blob.type,
      base64: toBase64(await blob.arrayBuffer()),
    });
  }
  return {
    format: "forma-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: structuredClone(data),
    profile,
    images,
  };
}
export async function parseBackup(file: File) {
  if (file.size > 100_000_000)
    throw new Error(
      "FORMA: El respaldo es demasiado grande para importar desde el navegador.",
    );
  const backup: Backup = JSON.parse(await file.text());
  if (
    backup.format !== "forma-backup" ||
    backup.version !== 1 ||
    !Array.isArray(backup.images)
  )
    throw new Error("FORMA: Este archivo no es un respaldo de Forma. válido.");
  validateData(backup.data);
  const blobs = new Map<string, Blob>();
  for (const image of backup.images) {
    if (typeof image.base64 !== "string" || image.base64.length > 2_100_000)
      throw new Error("FORMA: Una imagen del respaldo no es válida.");
    const blob = new Blob(
      [Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0))],
      { type: image.type },
    );
    await validateImageFile(new File([blob], "respaldo", { type: blob.type }));
    blobs.set(`${image.kind}:${image.id}`, blob);
  }
  return {
    data: backup.data,
    hash: await sha256(canonical(backup.data)),
    read: (ref: ImageRef) =>
      Promise.resolve(blobs.get(`${ref.kind}:${ref.id}`)),
  };
}
export async function migrateImages(
  data: AppData,
  client: SupabaseClient,
  userId: string,
  read: (ref: ImageRef) => Promise<Blob | undefined> = (ref) =>
    readImageBlob(ref.id),
) {
  const replacements = new Map<string, ImageRef>();
  for (const ref of imageRefs(data)) {
    const blob = await read(ref);
    if (!blob)
      throw new Error(
        "FORMA: No encontramos una foto del respaldo. La copia local y los registros anteriores se conservan.",
      );
    await validateImageFile(
      new File([blob], "importación", { type: blob.type }),
    );
    if (blob.size > 1_500_000)
      throw new Error(
        "FORMA: Una foto necesita optimizarse antes de importar.",
      );
    const digest = await sha256(await blob.arrayBuffer());
    const extension =
      blob.type === "image/webp"
        ? "webp"
        : blob.type === "image/png"
          ? "png"
          : "jpg";
    const id =
      ref.kind === "cloud" && ref.id.startsWith(`${userId}/`)
        ? ref.id
        : `${userId}/import-${digest}.${extension}`;
    const { error } = await client.storage
      .from(MEDIA_BUCKET)
      .upload(id, blob, { contentType: blob.type, upsert: false });
    if (error) {
      // Retried imports reuse immutable content-addressed images; verify existing bytes.
      const { data: existing, error: readError } = await client.storage
        .from(MEDIA_BUCKET)
        .download(id);
      if (
        readError ||
        !existing ||
        (await sha256(await existing.arrayBuffer())) !== digest
      )
        throw new Error(
          "FORMA: No se pudieron importar las fotos. Revisá la conexión y los permisos.",
        );
    }
    replacements.set(`${ref.kind}:${ref.id}`, { kind: "cloud", id });
  }
  const migrated = JSON.parse(
    JSON.stringify(data, (_key, value) =>
      value && typeof value === "object" && "kind" in value && "id" in value
        ? (replacements.get(`${value.kind}:${value.id}`) ?? value)
        : value,
    ),
  );
  validateData(migrated);
  return migrated as AppData;
}
