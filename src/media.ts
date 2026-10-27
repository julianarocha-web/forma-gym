import { exercisePhotos, normalizePhotoName } from "./exercise-photos";
export type ImageRef = { kind: "asset" | "local" | "cloud"; id: string };
export const imageAssets: Record<
  string,
  {
    src: string;
    alt: string;
    label: string;
    position?: string;
    exercise?: boolean;
    credit?: {
      author: string;
      url: string;
      license: string;
      licenseUrl: string;
    };
  }
> = {
  "lower-body": {
    src: "/images/lower-body.webp",
    alt: "Atleta preparando una barra en la zona de pesas",
    label: "Tren inferior",
  },
  strength: {
    src: "/images/strength.webp",
    alt: "Mancuernas y pesas para entrenamiento de fuerza",
    label: "Fuerza",
  },
  cycling: {
    src: "/images/cycling.webp",
    alt: "Persona entrenando en una bicicleta estática",
    label: "Cardio",
  },
  ...Object.fromEntries(
    exercisePhotos.map((photo) => [
      `exercise-${photo.id}`,
      {
        src:
          photo.id === "bike"
            ? "/images/cycling.webp"
            : `/images/exercises/${photo.id}.${"extension" in photo ? photo.extension : "webp"}`,
        alt: `Fotografía de ${photo.label.toLocaleLowerCase()}`,
        label: photo.label,
        position: photo.position,
        exercise: true,
        ...("credit" in photo ? { credit: photo.credit } : {}),
      },
    ]),
  ),
};
export const coverAssetIds = [
  "exercise-squat",
  "exercise-hip",
  "exercise-shoulder",
  "cycling",
  "strength",
  "lower-body",
];
export function defaultRoutineImage(id: string): ImageRef | undefined {
  const image: Record<string, string> = {
    legs: "exercise-squat",
    glutes: "exercise-hip",
    upper: "exercise-shoulder",
    chest: "cycling",
  };
  return image[id] ? { kind: "asset", id: image[id] } : undefined;
}
export const defaultExerciseImage = (
  id: string,
  aliases: string[] = [],
  name?: string,
): ImageRef | undefined => {
  // Exact movement names cover migrated/custom IDs, without guessing from body-part tags.
  const photo = name
    ? exercisePhotos.find((p) =>
        p.names.some((n) => normalizePhotoName(n) === normalizePhotoName(name)),
      )
    : exercisePhotos.find((p) => p.id === id || aliases.includes(p.id));
  return photo ? { kind: "asset", id: `exercise-${photo.id}` } : undefined;
};
const DB_NAME = "forma-media";
const STORE = "images";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no permite guardar imágenes locales."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("No se pudo abrir el almacenamiento de imágenes."));
    request.onblocked = () =>
      reject(new Error("Cerrá otras pestañas de la app e intentá de nuevo."));
  });
}
export async function saveImageBlob(blob: Blob): Promise<ImageRef> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(blob.type) ||
    blob.size > 1_500_000 ||
    blob.size === 0
  )
    throw new Error(
      "La imagen optimizada no tiene un formato o tamaño válido.",
    );
  const db = await openDatabase();
  const id = crypto.randomUUID();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add({ id, blob, createdAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          new Error(
            "No se pudo guardar la imagen. Revisá el espacio disponible.",
          ),
        );
      tx.onabort = () =>
        reject(new Error("Se interrumpió el guardado de la imagen."));
    });
    return { kind: "local", id };
  } finally {
    db.close();
  }
}
export async function readImageBlob(id: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result?.blob);
      request.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    });
  } finally {
    db.close();
  }
}
export async function validateImageFile(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Elegí una imagen JPG, PNG o WebP.");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("La imagen debe pesar como máximo 8 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(
    (file.type === "image/jpeg" && jpeg) ||
    (file.type === "image/png" && png) ||
    (file.type === "image/webp" && webp)
  ))
    throw new Error(
      "El contenido no corresponde a una imagen válida del formato elegido.",
    );
}
export async function optimizeImage(file: File): Promise<Blob> {
  await validateImageFile(file);
  let source: CanvasImageSource;
  let width: number, height: number;
  let cleanup = () => {};
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } else {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("No se pudo leer la imagen."));
        image.src = url;
      });
      source = image;
      width = image.naturalWidth;
      height = image.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  try {
    if (!width || !height || width * height > 40_000_000)
      throw new Error(
        "La resolución de esta imagen es demasiado grande o no es válida.",
      );
    const ratio = Math.min(1, 1400 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("No se pudo optimizar la imagen.")),
        "image/webp",
        0.8,
      ),
    );
    if (blob.size > 1_500_000)
      throw new Error(
        "La imagen sigue siendo demasiado grande. Probá una foto de menor resolución.",
      );
    return blob;
  } finally {
    cleanup();
  }
}
