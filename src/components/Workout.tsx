import { useEffect, useRef, useState } from "react";
import { CheckCheck } from "lucide-react";
import { completeSession, type AppData, type Routine } from "../data";
import { ExerciseRecords } from "./ExerciseFields";
import { type CommitResult } from "../cloud/types";
import SessionActions from "./SessionActions";
export default function Workout({
  data,
  routine,
  date,
  onCommit,
  onDone,
  cloud = false,
}: {
  data: AppData;
  routine: Routine;
  date: string;
  onCommit: (next: AppData) => CommitResult;
  onDone: (message: string) => void;
  cloud?: boolean;
}) {
  const completed = data.sessions.find(
    (s) => !s.demo && s.date === date && s.routineId === routine.id,
  );
  const key = `${date}-${routine.id}`;
  const [rows, setRows] = useState(() =>
    structuredClone(data.drafts[key] ?? routine.exercises).map((e) =>
      e.type === "strength" && e.plannedSets && !e.performedSets
        ? { ...e, performedSets: structuredClone(e.plannedSets) }
        : e,
    ),
  );
  const exercises = completed?.exercises ?? rows;
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const latest = useRef({ data, onCommit });
  latest.current = { data, onCommit };
  const [note, setNote] = useState(
    data.plans.find((p) => p.date === date)?.note ?? "",
  );
  const [error, setError] = useState("");
  function finish(result: CommitResult, done?: () => void) {
    const apply = (saved: boolean) => {
      setBusy(false);
      if (saved) {
        setDirty(false);
        setError("");
        done?.();
      } else {
        setPaused(true);
        setError(
          "No se confirmó el guardado. Tus valores siguen en el formulario; revisá los cambios pendientes antes de continuar.",
        );
      }
    };
    if (typeof result === "boolean") apply(result);
    else {
      setBusy(true);
      void result.then(apply).catch(() => apply(false));
    }
  }
  function saveDraft(next = rows) {
    const actual = latest.current;
    finish(
      actual.onCommit({
        ...actual.data,
        drafts: { ...actual.data.drafts, [key]: next },
      }),
    );
  }
  useEffect(() => {
    if (!cloud || !dirty || paused || busy || completed) return;
    const timer = setTimeout(() => saveDraft(rows), 800);
    return () => clearTimeout(timer);
  }, [rows, dirty, paused, busy, cloud, !!completed]);
  return (
    <>
      <form
        className="workout-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setPaused(true);
            const next = completeSession(
              latest.current.data,
              routine,
              date,
              exercises,
              note,
            );
            finish(onCommit(next), () =>
              onDone(
                "¡Entrenamiento completado! Tus valores reales quedaron guardados.",
              ),
            );
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "No se pudo completar.",
            );
          }
        }}
      >
        <div className="routine-title">
          <div>
            <h3>{routine.name}</h3>
            <p>
              {completed
                ? "Valores realizados · registro conservado"
                : "Registrá lo que hiciste. Tu rutina planificada se conserva."}
            </p>
          </div>
          {completed && (
            <span className="pill">
              <CheckCheck size={15} />
              Completado
            </span>
          )}
        </div>
        <ExerciseRecords
          exercises={exercises}
          disabled={!!completed || busy}
          onChange={(rows) => {
            setRows(rows);
            setDirty(true);
            setPaused(false);
            setError("");
            if (!cloud) saveDraft(rows);
          }}
        />
        <label className="field-label">
          Nota del entrenamiento · opcional
          <textarea
            disabled={!!completed || busy}
            rows={2}
            value={completed?.note ?? note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!completed && (
          <div className="workout-footer">
            <span>
              <span className="save-dot" />{" "}
              {busy
                ? "Guardando borrador…"
                : dirty
                  ? "Cambios todavía sin confirmar"
                  : "Los valores se guardan como borrador"}
            </span>
            {cloud && (
              <button
                className="secondary-button"
                type="button"
                disabled={busy || !dirty}
                onClick={() => saveDraft()}
              >
                Guardar borrador
              </button>
            )}
            <button className="primary-button" type="submit" disabled={busy}>
              <CheckCheck size={18} />
              Completar entrenamiento
            </button>
          </div>
        )}
      </form>
      {completed && (
        <SessionActions
          data={data}
          session={completed}
          onCommit={onCommit}
          notify={onDone}
        />
      )}
    </>
  );
}
