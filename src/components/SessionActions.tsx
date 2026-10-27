import { useState } from "react";
import { Pencil, Trash2, Save } from "lucide-react";
import {
  correctSession,
  deleteSession,
  dateKey,
  formatDate,
  type AppData,
  type Session,
} from "../data";
import { afterCommit, reportCommit, type CommitResult } from "../cloud/types";
import { ExerciseRecords } from "./ExerciseFields";

export default function SessionActions({
  data,
  session,
  onCommit,
  notify,
}: {
  data: AppData;
  session: Session;
  onCommit: (next: AppData) => CommitResult;
  notify: (message: string) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [draft, setDraft] = useState(() => structuredClone(session));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function commit(next: AppData, message: string) {
    const result = afterCommit(onCommit(next), () => {
      setMode("view");
      setError("");
      notify(message);
    });
    reportCommit(
      result,
      setError,
      setBusy,
      "No se confirmó el cambio. El registro anterior sigue visible; revisá el mensaje de guardado antes de volver a intentar.",
    );
  }
  if (mode === "view")
    return (
      <div className="session-actions">
        <button
          type="button"
          className="secondary-button"
          aria-label={`Corregir registro de ${session.name}`}
          onClick={() => {
            setDraft(structuredClone(session));
            setError("");
            setMode("edit");
          }}
        >
          <Pencil size={16} /> Corregir registro
        </button>
        <button
          type="button"
          className="danger-link"
          aria-label={`Eliminar registro de ${session.name}`}
          onClick={() => {
            setError("");
            setMode("delete");
          }}
        >
          <Trash2 size={16} /> Eliminar registro
        </button>
      </div>
    );
  if (mode === "delete")
    return (
      <div
        className="session-correction"
        role="group"
        aria-label="Confirmar eliminación del registro"
      >
        <div className="session-correction-heading">
          <h4>¿Eliminar este entrenamiento?</h4>
          <p className="session-correction-context">
            {session.name} · {formatDate(session.date)}
          </p>
        </div>
        <p>
          Este registro se quitará de tu historial, calendario y gráficos. La
          rutina y los entrenamientos de otras fechas se conservan.
        </p>
        <p className="form-help">
          Se conservará una copia de seguridad del registro anterior. Si había
          una planificación para ese día, volverá a aparecer como pendiente.
        </p>
        <div className="session-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => setMode("view")}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button danger-button"
            disabled={busy}
            onClick={() => {
              try {
                commit(
                  deleteSession(data, session.id),
                  "Registro eliminado. El calendario y el progreso se actualizaron.",
                );
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            {busy ? "Eliminando…" : "Confirmar eliminación"}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <form
      className="session-correction"
      aria-label={`Corregir entrenamiento ${session.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          commit(
            correctSession(data, draft),
            "Corrección guardada. El calendario y el progreso se actualizaron.",
          );
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <fieldset className="plain-fieldset" disabled={busy}>
        <h4>Corregir entrenamiento</h4>
        <p className="form-help">
          Estos cambios afectan solo este registro. La plantilla de tu rutina y
          las demás fechas se conservan.
        </p>
        <label className="field-label">
          Nombre del entrenamiento
          <input
            required
            maxLength={100}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="field-label">
          Fecha del entrenamiento
          <input
            required
            type="date"
            max={dateKey()}
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </label>
        <ExerciseRecords
          exercises={draft.exercises}
          onChange={(exercises) => setDraft({ ...draft, exercises })}
        />
        <label className="field-label">
          Nota del registro · opcional
          <textarea
            rows={2}
            value={draft.note ?? ""}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
        <p className="form-help">
          Al guardar se conservará una copia de los valores anteriores. Para
          reemplazar la rutina o sus ejercicios, eliminá este registro y cargá
          el entrenamiento correcto.
        </p>
        <div className="session-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setMode("view")}
          >
            Cancelar
          </button>
          <button type="submit" className="primary-button">
            <Save size={16} />
            {busy ? "Guardando…" : "Guardar corrección"}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </fieldset>
    </form>
  );
}
