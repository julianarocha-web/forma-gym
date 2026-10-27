import { useState } from "react";
import { ArrowUp, ArrowDown, Pencil, Plus, Trash2 } from "lucide-react";
import { ImagePicker, Photo } from "./Media";
import { defaultRoutineImage, defaultExerciseImage } from "../media";
import {
  activityLabel,
  exerciseFromDefinition,
  routineTags,
  type ExerciseDefinition,
  type Routine,
} from "../data";
import Modal from "./Modal";
import { Chips, TagPicker } from "./Tags";
import { ExerciseFields } from "./ExerciseFields";
import ExerciseCatalog, { ExerciseDefinitionForm } from "./ExerciseCatalog";
import { afterCommit, reportCommit, type CommitResult } from "../cloud/types";

export default function RoutineEditor({
  routine,
  catalog,
  onSaveExercise,
  onSave,
  onClose,
}: {
  routine: Routine;
  catalog: ExerciseDefinition[];
  onSaveExercise: (def: ExerciseDefinition) => CommitResult;
  onSave: (r: Routine) => CommitResult;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(routine));
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<ExerciseDefinition | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  function reorder(index: number, offset: number) {
    const rows = [...draft.exercises];
    const other = index + offset;
    if (other < 0 || other >= rows.length) return;
    [rows[index], rows[other]] = [rows[other], rows[index]];
    setDraft({ ...draft, exercises: rows });
  }
  const close = () => {
    if (editing) setEditing(null);
    else if (picking) setPicking(false);
    else onClose();
  };
  return (
    <Modal
      title={
        editing
          ? "Editar ejercicio del catálogo"
          : picking
            ? "Agregar ejercicio"
            : routine.name
              ? "Editar rutina"
              : "Crear rutina"
      }
      onClose={close}
    >
      {editing ? (
        <ExerciseDefinitionForm
          key={editing.id}
          definition={editing}
          catalog={catalog}
          onCancel={() => setEditing(null)}
          onSave={(def) =>
            afterCommit(onSaveExercise(def), () => setEditing(null))
          }
        />
      ) : picking ? (
        <ExerciseCatalog
          catalog={catalog}
          onSave={onSaveExercise}
          usedIds={draft.exercises.map((e) => e.exerciseId)}
          onBack={() => setPicking(false)}
          onSelect={(def) => {
            setDraft({
              ...draft,
              exercises: [...draft.exercises, exerciseFromDefinition(def)],
            });
            setPicking(false);
            setError("");
          }}
        />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.name.trim() || !draft.exercises.length) {
              setError("Indicá un nombre y agregá al menos un ejercicio.");
              return;
            }
            reportCommit(
              onSave({ ...draft, name: draft.name.trim() }),
              setError,
              setSubmitting,
              "No se pudo guardar la rutina. Revisá el mensaje de guardado e intentá de nuevo.",
            );
          }}
        >
          <label className="field-label">
            Nombre
            <input
              required
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="field-label">
            Descripción · opcional
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <TagPicker
            label="Etiquetas de la rutina"
            options={routineTags}
            value={draft.tags}
            onChange={(tags) => setDraft({ ...draft, tags })}
          />
          <ImagePicker
            value={draft.image}
            fallback={defaultRoutineImage(draft.id)}
            onChange={(image) => setDraft({ ...draft, image })}
            onBusyChange={setUploading}
            kind="routine"
            label="Portada de la rutina"
          />
          <h3 className="form-section-title">
            Ejercicios · valores de esta rutina
          </h3>
          {draft.exercises.map((row, i) => {
            const def = catalog.find((d) => d.id === row.exerciseId);
            const ex = def
              ? { ...row, name: def.name, type: def.type, tags: def.tags }
              : row;
            return (
              <section className="edit-exercise" key={row.id}>
                <div className="routine-exercise-title">
                  <Photo
                    image={def?.image}
                    fallback={defaultExerciseImage(
                      ex.exerciseId,
                      def?.legacyIds,
                      ex.name,
                    )}
                    alt={ex.name}
                    type={ex.type}
                  />
                  <span className="exercise-index">{i + 1}</span>
                  <h3>{ex.name}</h3>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Editar datos generales de ${ex.name}`}
                    onClick={() => def && setEditing(def)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Eliminar ejercicio ${i + 1}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        exercises: draft.exercises.filter(
                          (e) => e.id !== row.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="reorder-actions">
                  <span>
                    Posición {i + 1} de {draft.exercises.length}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Subir ${ex.name}`}
                    disabled={i === 0}
                    onClick={() => reorder(i, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Bajar ${ex.name}`}
                    disabled={i === draft.exercises.length - 1}
                    onClick={() => reorder(i, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
                <Chips
                  tags={[...new Set([activityLabel(ex.type), ...ex.tags])]}
                />
                <ExerciseFields
                  perSeries
                  notes={false}
                  exercise={ex}
                  onChange={(next) =>
                    setDraft({
                      ...draft,
                      exercises: draft.exercises.map((e) =>
                        e.id === row.id ? next : e,
                      ),
                    })
                  }
                />
                <p className="form-help">
                  Estos valores son exclusivos de esta rutina.
                </p>
              </section>
            );
          })}
          {!draft.exercises.length && (
            <p className="calendar-hint">
              Agregá ejercicios del catálogo o creá uno nuevo.
            </p>
          )}
          <button
            type="button"
            className="secondary-button add-exercise-button"
            onClick={() => setPicking(true)}
          >
            <Plus size={18} />
            Agregar ejercicio
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={uploading || submitting}
            >
              Guardar rutina
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
