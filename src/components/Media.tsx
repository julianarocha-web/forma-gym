import { useEffect, useRef, useState } from "react";
import {
  Bike,
  Dumbbell,
  ImageOff,
  StretchHorizontal,
  Upload,
  UserRound,
} from "lucide-react";
import {
  imageAssets,
  coverAssetIds,
  optimizeImage,
  readImageBlob,
  saveImageBlob,
  type ImageRef,
} from "../media";
import type { ActivityType } from "../data";
import { normalizePhotoName } from "../exercise-photos";
import { useMedia } from "../cloud/media";

export function Photo({
  image,
  fallback,
  alt,
  type = "strength",
  variant = "thumb",
  eager = false,
}: {
  image?: ImageRef | null;
  fallback?: ImageRef;
  alt: string;
  type?: ActivityType;
  variant?: "thumb" | "cover" | "detail" | "hero" | "avatar";
  eager?: boolean;
}) {
  const ref = image === undefined ? fallback : image;
  const media = useMedia();
  const key = ref ? `${ref.kind}:${ref.id}` : "none";
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(
    null,
  );
  const [failed, setFailed] = useState("");
  useEffect(() => {
    if (!ref || ref.kind === "asset") return;
    let live = true;
    let url: string | undefined;
    media
      .read(ref)
      .then((blob) => {
        if (blob && live) {
          url = URL.createObjectURL(blob);
          setLoaded({ key, url });
        }
      })
      .catch(() => {});
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, media]);
  const url =
    ref?.kind === "asset"
      ? imageAssets[ref.id]?.src
      : loaded?.key === key
        ? loaded.url
        : undefined;
  const asset = ref?.kind === "asset" ? imageAssets[ref.id] : undefined;
  const Icon =
    variant === "avatar"
      ? UserRound
      : type === "cardio"
        ? Bike
        : type === "mobility"
          ? StretchHorizontal
          : Dumbbell;
  return (
    <div
      className={`photo photo-${variant} activity-${type} ${asset?.exercise ? "exercise-photo" : ""} ${url && failed !== key ? "has-photo" : "is-placeholder"}`}
    >
      {url && failed !== key ? (
        <img
          src={url}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          style={{ objectPosition: asset?.position }}
          onError={() => setFailed(key)}
        />
      ) : (
        <div
          className="photo-placeholder"
          role="img"
          aria-label={`Sin foto: ${alt}`}
        >
          <Icon size={variant === "thumb" ? 24 : 48} strokeWidth={1.35} />
          {variant !== "thumb" && variant !== "avatar" && (
            <span>Tu espacio para una foto</span>
          )}
        </div>
      )}
      {asset?.credit && url && failed !== key && variant === "detail" && (
        <span className="photo-credit">
          <a href={asset.credit.url} target="_blank" rel="noreferrer">
            {asset.credit.author}
          </a>{" "}
          ·{" "}
          <a href={asset.credit.licenseUrl} target="_blank" rel="noreferrer">
            {asset.credit.license}
          </a>
        </span>
      )}
    </div>
  );
}
export function ImagePicker({
  value,
  fallback,
  onChange,
  onBusyChange,
  kind,
  label,
  type = "strength",
}: {
  value?: ImageRef | null;
  fallback?: ImageRef;
  onChange: (value: ImageRef | null | undefined) => void;
  onBusyChange?: (busy: boolean) => void;
  kind: "routine" | "exercise" | "profile";
  label: string;
  type?: ActivityType;
}) {
  const input = useRef<HTMLInputElement>(null);
  const media = useMedia();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photoSearch, setPhotoSearch] = useState("");
  const photoOptions = Object.entries(imageAssets).filter(
    ([, asset]) =>
      asset.exercise &&
      normalizePhotoName(asset.label).includes(normalizePhotoName(photoSearch)),
  );
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    setNotice("");
    onBusyChange?.(true);
    try {
      const blob = await optimizeImage(file);
      const ref = await media.save(blob);
      if (live.current) {
        onChange(ref);
        setNotice(
          "Foto preparada. Guardá los cambios del formulario para aplicarla.",
        );
      }
    } catch (error) {
      if (live.current)
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo preparar la foto.",
        );
    } finally {
      if (live.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }
  return (
    <fieldset className="image-picker">
      <legend>{label}</legend>
      <Photo
        image={value}
        fallback={fallback}
        alt={label}
        type={type}
        variant={
          kind === "profile"
            ? "avatar"
            : kind === "exercise"
              ? "detail"
              : "cover"
        }
      />
      <div className="image-picker-actions">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={`Subir imagen: ${label}`}
          hidden
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload size={16} />
          {busy ? "Preparando…" : "Subir foto"}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Quitar imagen: ${label}`}
          disabled={busy}
          onClick={() => {
            onChange(null);
            setNotice("Se mostrará el placeholder al guardar.");
          }}
        >
          <ImageOff size={18} />
        </button>
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={() => {
            onChange(undefined);
            setNotice(
              "Se restauró la imagen predeterminada. Guardá para aplicar.",
            );
          }}
        >
          Usar predeterminada
        </button>
      </div>
      {kind === "routine" && (
        <div className="image-presets" aria-label="Portadas por actividad">
          {coverAssetIds.map((id) => {
            const asset = imageAssets[id];
            return (
              <button
                type="button"
                key={id}
                aria-label={`Elegir portada ${asset.label}`}
                disabled={busy}
                onClick={() => {
                  onChange({ kind: "asset", id });
                  setNotice("Portada seleccionada. Guardá para aplicar.");
                }}
              >
                <img
                  src={asset.src}
                  alt=""
                  style={{ objectPosition: asset.position }}
                  loading="lazy"
                />
                <span>{asset.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {kind === "exercise" && (
        <details className="exercise-photo-library">
          <summary>Elegir una foto del catálogo</summary>
          <label className="field-label">
            Buscar fotografía
            <input
              value={photoSearch}
              onChange={(event) => setPhotoSearch(event.target.value)}
              placeholder="Ej.: hip thrust, sentadilla…"
            />
          </label>
          <div className="image-presets exercise-photo-presets">
            {photoOptions.map(([id, asset]) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                aria-label={`Elegir foto ${asset.label}`}
                aria-pressed={value?.kind === "asset" && value.id === id}
                onClick={() => {
                  onChange({ kind: "asset", id });
                  setNotice("Foto seleccionada. Guardá para aplicar.");
                }}
              >
                <img
                  src={asset.src}
                  alt={asset.alt}
                  style={{ objectPosition: asset.position }}
                  loading="lazy"
                />
                <span>{asset.label}</span>
              </button>
            ))}
          </div>
          {photoOptions.length === 0 && (
            <p className="form-help">
              No hay una foto de ese movimiento. Podés buscar otro nombre o
              subir una propia.
            </p>
          )}
        </details>
      )}
      <p className="form-help">
        JPG, PNG o WebP · Máximo 8 MB. Se optimiza y guarda en este navegador.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="image-notice">
          {notice}
        </p>
      )}
    </fieldset>
  );
}
