import { useState } from "react";
import { ArrowLeft, Pencil, Plus, Search } from "lucide-react";
import {
  activityLabel,
  newDefinition,
  tagGroups,
  type ExerciseDefinition,
} from "../data";
import { Chips, TagPicker } from "./Tags";
import { ImagePicker, Photo } from "./Media";
import { defaultExerciseImage } from "../media";
import { afterCommit, reportCommit, type CommitResult } from "../cloud/types";

export function ExerciseDefinitionForm({
  definition,
  catalog,
  onSave,
  onCancel,
}: {
  definition: ExerciseDefinition;
  catalog: ExerciseDefinition[];
  onSave: (def: ExerciseDefinition) => CommitResult;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(definition));
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const similar = catalog.filter(
    (e) =>
      e.id !== draft.id &&
      e.type === draft.type &&
      e.name.trim().toLocaleLowerCase() ===
        draft.name.trim().toLocaleLowerCase(),
  );
  return (
    <form
      className="catalog-definition"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.name.trim()) {
          setError("Indicá el nombre del ejercicio.");
          return;
        }
        reportCommit(
          onSave({
            ...draft,
            name: draft.name.trim(),
            tags: draft.tags.filter(
              (t) => !tagGroups["Tipo de actividad"].includes(t),
            ),
          }),
          setError,
          setSubmitting,
          "No se pudo guardar el ejercicio. Revisá el mensaje de guardado e intentá de nuevo.",
        );
      }}
    >
      <p className="form-help">
        Estos datos pertenecen al catálogo y se comparten entre rutinas. Los
        valores planificados de cada rutina y el historial se conservan.
      </p>
      <label className="field-label">
        Nombre del ejercicio
        <input
          autoFocus
          required
          maxLength={120}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <label className="field-label">
        Tipo de actividad
        <select
          value={draft.type}
          onChange={(e) =>
            setDraft({
              ...draft,
              type: e.target.value as ExerciseDefinition["type"],
            })
          }
        >
          <option value="strength">Musculación</option>
          <option value="cardio">Aeróbico</option>
          <option value="mobility">Movilidad</option>
        </select>
      </label>
      <ImagePicker
        value={draft.image}
        fallback={defaultExerciseImage(draft.id, draft.legacyIds, draft.name)}
        onChange={(image) => setDraft({ ...draft, image })}
        onBusyChange={setUploading}
        kind="exercise"
        type={draft.type}
        label="Imagen del ejercicio"
      />
      {Object.entries(tagGroups)
        .filter(([label]) => label !== "Tipo de actividad")
        .map(([label, options]) => (
          <TagPicker
            key={label}
            label={label}
            options={options}
            allowCustom={label === "Equipamiento"}
            value={draft.tags.filter(
              (t) =>
                options.includes(t) ||
                (label === "Equipamiento" &&
                  !Object.values(tagGroups).flat().includes(t)),
            )}
            onChange={(tags) => {
              const previous = draft.tags.filter(
                (t) =>
                  options.includes(t) ||
                  (label === "Equipamiento" &&
                    !Object.values(tagGroups).flat().includes(t)),
              );
              setDraft({
                ...draft,
                tags: [
                  ...new Set([
                    ...draft.tags.filter((t) => !previous.includes(t)),
                    ...tags,
                  ]),
                ],
              });
            }}
          />
        ))}
      {similar.length > 0 && (
        <p className="catalog-notice">
          Ya existe un ejercicio con ese nombre y tipo. Podés volver al catálogo
          para reutilizarlo. Guardá uno distinto solo si representa otra
          variante.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Volver
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={uploading || submitting}
        >
          {similar.length ? "Guardar ejercicio distinto" : "Guardar ejercicio"}
        </button>
      </div>
    </form>
  );
}

export default function ExerciseCatalog({
  catalog,
  onSave,
  onSelect,
  onBack,
  usedIds = [],
}: {
  catalog: ExerciseDefinition[];
  onSave: (def: ExerciseDefinition) => CommitResult;
  onSelect?: (def: ExerciseDefinition) => void;
  onBack?: () => void;
  usedIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [editing, setEditing] = useState<ExerciseDefinition | null>(null);
  const [viewing, setViewing] = useState<ExerciseDefinition | null>(null);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const filtered = catalog.filter(
    (e) =>
      normalize(e.name).includes(normalize(query)) &&
      (!tag || e.tags.includes(tag) || activityLabel(e.type) === tag),
  );
  const tags = [
    ...new Set(catalog.flatMap((e) => [activityLabel(e.type), ...e.tags])),
  ].sort();
  if (editing)
    return (
      <ExerciseDefinitionForm
        key={editing.id}
        definition={editing}
        catalog={catalog}
        onCancel={() => setEditing(null)}
        onSave={(def) =>
          afterCommit(onSave(def), () => {
            setEditing(null);
            if (onSelect && !catalog.some((e) => e.id === def.id))
              onSelect(def);
          })
        }
      />
    );
  if (viewing)
    return (
      <div className="exercise-detail">
        <button
          className="text-link"
          type="button"
          onClick={() => setViewing(null)}
        >
          <ArrowLeft size={17} />
          Volver al catálogo
        </button>
        <Photo
          image={viewing.image}
          fallback={defaultExerciseImage(
            viewing.id,
            viewing.legacyIds,
            viewing.name,
          )}
          alt={viewing.name}
          type={viewing.type}
          variant="detail"
        />
        <h3>{viewing.name}</h3>
        <Chips
          tags={[...new Set([activityLabel(viewing.type), ...viewing.tags])]}
        />
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setEditing(viewing);
              setViewing(null);
            }}
          >
            <Pencil size={16} />
            Editar ejercicio
          </button>
          {onSelect && (
            <button
              type="button"
              className="primary-button"
              disabled={usedIds.includes(viewing.id)}
              onClick={() =>
                viewing.sharedId
                  ? void afterCommit(onSave(viewing), () => onSelect(viewing))
                  : onSelect(viewing)
              }
            >
              Agregar a la rutina
            </button>
          )}
        </div>
      </div>
    );
  return (
    <div className="exercise-catalog">
      {onBack && (
        <button type="button" className="text-link" onClick={onBack}>
          <ArrowLeft size={17} />
          Volver a la rutina
        </button>
      )}
      <div className="catalog-search">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Buscar ejercicios"
          placeholder="Buscá por nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="catalog-toolbar">
        <label className="field-label">
          Etiqueta
          <select
            aria-label="Filtrar ejercicios por etiqueta"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">Todas las etiquetas</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="primary-button"
          onClick={() => setEditing({ ...newDefinition(), name: query.trim() })}
        >
          <Plus size={17} />
          Crear ejercicio
        </button>
      </div>
      <p className="form-help">
        {onSelect
          ? "Seleccioná un ejercicio. Sus valores se configuran en esta rutina."
          : "Los mismos ejercicios pueden usarse en todas tus rutinas."}
      </p>
      <div className="catalog-results">
        {filtered.map((def) => (
          <article className="catalog-item" key={def.id}>
            <Photo
              image={def.image}
              fallback={defaultExerciseImage(def.id, def.legacyIds, def.name)}
              alt={def.name}
              type={def.type}
            />
            <div>
              <button
                type="button"
                className="catalog-title"
                onClick={() => setViewing(def)}
                aria-label={`Ver ejercicio ${def.name}`}
              >
                <h3>{def.name}</h3>
              </button>
              <Chips
                tags={[...new Set([activityLabel(def.type), ...def.tags])]}
              />
            </div>
            <div className="catalog-item-actions">
              <button
                type="button"
                className="icon-button"
                aria-label={`Editar ejercicio ${def.name}`}
                onClick={() => setEditing(def)}
              >
                <Pencil size={17} />
              </button>
              {onSelect && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={usedIds.includes(def.id)}
                  onClick={() =>
                    def.sharedId
                      ? void afterCommit(onSave(def), () => onSelect(def))
                      : onSelect(def)
                  }
                  aria-label={`Seleccionar ${def.name}`}
                >
                  {usedIds.includes(def.id) ? "Agregado" : "Agregar"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <Search size={27} />
          <h3>No encontramos ese ejercicio.</h3>
          <p>Probá otro nombre, quitá el filtro o creá un ejercicio nuevo.</p>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setQuery("");
              setTag("");
            }}
          >
            Limpiar búsqueda
          </button>
        </div>
      )}
    </div>
  );
}
