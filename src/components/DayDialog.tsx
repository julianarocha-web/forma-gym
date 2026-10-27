import { useState } from "react";
import { CalendarDays, Moon, Trash2 } from "lucide-react";
import { dayState, dateKey, formatDate, savePlan, type AppData } from "../data";
import Modal from "./Modal";
import Workout from "./Workout";
import { stateLabels } from "./TrainingCalendar";
import { exerciseSummary } from "./ExerciseFields";
import { afterCommit, reportCommit, type CommitResult } from "../cloud/types";
import { useUnits } from "../units";
import SessionActions from "./SessionActions";
export default function DayDialog({
  data,
  date,
  initialRoutine,
  onDateChange,
  onCommit,
  onClose,
  notify,
  cloud = false,
}: {
  data: AppData;
  date: string;
  initialRoutine?: string;
  onDateChange: (date: string) => void;
  onCommit: (next: AppData) => CommitResult;
  cloud?: boolean;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const state = dayState(data, date);
  const [routineId, setRoutineId] = useState(
    initialRoutine ?? state.plan?.routineId ?? "",
  );
  const [note, setNote] = useState(state.plan?.note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unit = useUnits();
  const routine = data.routines.find((r) => r.id === routineId);
  function plan(status: "planned" | "rest") {
    try {
      if (status === "planned" && !routine) {
        setError("Elegí una rutina disponible.");
        return;
      }
      const result = afterCommit(
        onCommit(
          savePlan(data, {
            date,
            status,
            routineId: status === "planned" ? routineId : undefined,
            note,
          }),
        ),
        () => {
          setError("");
          notify(
            status === "rest"
              ? "Día de descanso guardado."
              : "Asignación guardada.",
          );
        },
      );
      reportCommit(
        result,
        setError,
        setBusy,
        "No se pudo guardar la asignación. Revisá el mensaje de guardado.",
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <Modal title={formatDate(date)} onClose={onClose}>
      <label className="field-label">
        Fecha
        <input
          aria-label="Fecha de la asignación"
          type="date"
          required
          value={date}
          onChange={(e) => {
            if (e.target.value) onDateChange(e.target.value);
          }}
        />
      </label>
      <div className={`day-status state-${state.status}`}>
        {stateLabels[state.status]}
      </div>
      {state.sessions.map((s) => (
        <details className="completed-detail" key={s.id} open>
          <summary>
            {s.name} · Completado {s.demo ? "· Ejemplo" : ""}
          </summary>
          {s.exercises.map((e) => (
            <div key={e.id}>
              <strong>{e.name}</strong>
              <span>{exerciseSummary(e, unit)}</span>
              {e.notes && <p>{e.notes}</p>}
            </div>
          ))}
          {s.note && <p className="session-note">{s.note}</p>}
          <SessionActions
            data={data}
            session={s}
            onCommit={onCommit}
            notify={notify}
          />
        </details>
      ))}
      <div className="day-editor">
        <label className="field-label">
          Rutina para esta fecha
          <select
            value={routineId}
            onChange={(e) => setRoutineId(e.target.value)}
          >
            <option value="">Elegí una rutina</option>
            {state.plan?.routineId &&
              !data.routines.some((r) => r.id === state.plan?.routineId) && (
                <option value={state.plan.routineId}>
                  Rutina eliminada · reasigná o quitá el plan
                </option>
              )}
            {data.routines.map((r) => (
              <option value={r.id} key={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Nota del día · opcional
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="day-actions">
          <button
            className="primary-button"
            disabled={!routine}
            onClick={() => plan("planned")}
          >
            <CalendarDays size={17} />
            {state.plan ? "Guardar asignación" : "Planificar rutina"}
          </button>
          <button
            className="secondary-button"
            disabled={state.sessions.length > 0}
            onClick={() => plan("rest")}
          >
            <Moon size={16} />
            Descanso
          </button>
          {state.plan && (
            <button
              className="danger-link"
              onClick={() => {
                const result = afterCommit(
                  onCommit({
                    ...data,
                    plans: data.plans.filter((p) => p.date !== date),
                  }),
                  () => {
                    notify("Asignación quitada. El historial se conserva.");
                    setNote("");
                  },
                );
                reportCommit(
                  result,
                  setError,
                  setBusy,
                  "No se pudo quitar la asignación.",
                );
              }}
            >
              <Trash2 size={16} />
              Quitar asignación
            </button>
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {state.sessions.length > 0 && (
          <p className="calendar-hint">
            Los entrenamientos completados conservan sus ejercicios y cargas,
            aunque cambies o quites la asignación.
          </p>
        )}
      </div>
      {routine &&
        !state.sessions.some((s) => s.routineId === routine.id) &&
        (date <= dateKey() ? (
          <>
            <h3 className="form-section-title">Registrar valores realizados</h3>
            <Workout
              key={`${date}-${routine.id}`}
              data={data}
              routine={routine}
              date={date}
              onCommit={onCommit}
              cloud={cloud}
              onDone={notify}
            />
          </>
        ) : (
          <p className="calendar-hint">
            Esta fecha está en el futuro. Podrás completar el entrenamiento
            cuando lo realices.
          </p>
        ))}
      {!routine && !data.routines.length && (
        <p className="empty-state">
          Creá una rutina en Mis rutinas para planificar tu entrenamiento.
        </p>
      )}
    </Modal>
  );
}
