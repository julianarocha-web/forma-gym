import { Plus, Trash2 } from "lucide-react";
import { routineSets, withRoutineSets, type Exercise } from "../data";
import { Chips } from "./Tags";
import { Photo } from "./Media";
import { defaultExerciseImage } from "../media";
import { useUnits, displayWeight, kilograms, type WeightUnit } from "../units";
export function ExerciseFields({
  exercise: e,
  onChange,
  disabled = false,
  notes = true,
  perSeries = false,
}: {
  exercise: Exercise;
  onChange: (e: Exercise) => void;
  disabled?: boolean;
  notes?: boolean;
  perSeries?: boolean;
}) {
  const unit = useUnits();
  if (perSeries && e.type === "strength") {
    const sets = routineSets(e);
    return (
      <div className="routine-sets">
        <label className="field-label">
          Series
          <input
            aria-label={`${e.name}: Series`}
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={100}
            step={1}
            value={e.sets}
            disabled={disabled}
            onChange={(event) => {
              const count = Number(event.target.value);
              if (!Number.isInteger(count) || count < 1 || count > 100) return;
              onChange(
                withRoutineSets(
                  e,
                  Array.from({ length: count }, (_, i) => ({
                    ...(sets[i] ?? sets.at(-1)!),
                  })),
                ),
              );
            }}
          />
        </label>
        <table className="routine-sets-table">
          <caption>Series de {e.name}</caption>
          <thead>
            <tr>
              <th scope="col">Serie</th>
              <th scope="col">Repeticiones</th>
              <th scope="col">Peso ({unit})</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((set, index) => (
              <tr key={index}>
                <th scope="row">{index + 1}</th>
                {(["reps", "weight"] as const).map((key) => (
                  <td key={key}>
                    <input
                      type="number"
                      required
                      disabled={disabled}
                      inputMode={key === "reps" ? "numeric" : "decimal"}
                      min={key === "reps" ? 1 : 0}
                      step={key === "reps" ? 1 : "any"}
                      aria-label={`${e.name}: serie ${index + 1} ${key === "reps" ? "repeticiones" : `peso (${unit})`}`}
                      value={
                        key === "weight"
                          ? displayWeight(set.weight, unit)
                          : set.reps
                      }
                      onChange={(event) =>
                        onChange(
                          withRoutineSets(
                            e,
                            sets.map((s, i) =>
                              i === index
                                ? {
                                    ...s,
                                    [key]:
                                      key === "weight"
                                        ? kilograms(
                                            Number(event.target.value),
                                            unit,
                                          )
                                        : Number(event.target.value),
                                  }
                                : s,
                            ),
                          ),
                        )
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="text-link"
          disabled={disabled}
          onClick={() =>
            onChange(
              withRoutineSets(
                e,
                sets.map(() => ({ ...sets[0] })),
              ),
            )
          }
        >
          Aplicar a todas las series
        </button>
        <p className="form-help">
          Copia las repeticiones y el peso de la primera serie a las demás.
        </p>
      </div>
    );
  }
  const fields =
    e.type === "cardio"
      ? [
          { key: "duration", label: "Minutos", required: true, step: 0.5 },
          {
            key: "distance",
            label: "Distancia (km)",
            required: false,
            step: 0.1,
          },
          {
            key: "resistance",
            label: "Nivel / resistencia",
            required: false,
            step: 1,
          },
        ]
      : e.type === "mobility"
        ? [{ key: "duration", label: "Minutos", required: true, step: 0.5 }]
        : [
            { key: "sets", label: "Series", required: true, step: 1 },
            { key: "reps", label: "Repeticiones", required: true, step: 1 },
            {
              key: "weight",
              label: `Peso (${unit})`,
              required: true,
              step: 0.5,
            },
          ];
  return (
    <>
      <div className="record-fields">
        {fields.map((f) => (
          <label key={f.key}>
            <span className="record-field-heading">
              <span>{f.label}</span>
              {!f.required && <small>Opcional</small>}
            </span>
            <input
              aria-label={`${e.name || "Ejercicio"}: ${f.label}`}
              type="number"
              inputMode="decimal"
              required={f.required}
              disabled={disabled}
              min={["sets", "reps", "duration"].includes(f.key) ? f.step : 0}
              step={f.key === "weight" ? "any" : f.step}
              value={
                f.key === "weight"
                  ? displayWeight(e.weight, unit)
                  : ((e[f.key as keyof Exercise] as number) ?? "")
              }
              onChange={(event) =>
                onChange({
                  ...e,
                  [f.key]:
                    event.target.value === ""
                      ? f.required
                        ? 0
                        : undefined
                      : f.key === "weight"
                        ? kilograms(Number(event.target.value), unit)
                        : Number(event.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      {notes && (
        <label className="exercise-notes">
          Notas <span>· opcional</span>
          <input
            disabled={disabled}
            aria-label={`${e.name}: notas`}
            placeholder="¿Cómo te sentiste?"
            value={e.notes ?? ""}
            onChange={(event) => onChange({ ...e, notes: event.target.value })}
          />
        </label>
      )}
    </>
  );
}
export function ExerciseRecords({
  exercises,
  onChange,
  disabled = false,
}: {
  exercises: Exercise[];
  onChange: (rows: Exercise[]) => void;
  disabled?: boolean;
}) {
  const unit = useUnits();
  return (
    <div className="record-list">
      {exercises.map((e, i) => (
        <section key={e.id} className="record-exercise">
          <div className="record-title">
            <Photo
              image={e.image}
              fallback={defaultExerciseImage(e.exerciseId, [], e.name)}
              alt={e.name}
              type={e.type}
            />
            <span className="exercise-index">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3>{e.name}</h3>
            <span className="pill">
              {e.type === "cardio"
                ? "Aeróbico"
                : e.type === "mobility"
                  ? "Movilidad"
                  : "Musculación"}
            </span>
          </div>
          <details className="exercise-tags">
            <summary>Ver etiquetas</summary>
            <Chips tags={e.tags} />
          </details>
          {e.type === "strength" && e.performedSets !== undefined ? (
            <>
              <div className="performed-set-list">
                {e.performedSets.map((set, index) => (
                  <div className="performed-set-row" key={index}>
                    <span>Serie {index + 1}</span>
                    <label>
                      Peso ({unit})
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        required
                        disabled={disabled}
                        aria-label={`${e.name}: serie ${index + 1} peso (${unit})`}
                        value={displayWeight(set.weight, unit)}
                        onChange={(event) =>
                          onChange(
                            exercises.map((row) =>
                              row.id === e.id
                                ? {
                                    ...e,
                                    performedSets: e.performedSets!.map(
                                      (s, i) =>
                                        i === index
                                          ? {
                                              ...s,
                                              weight: kilograms(
                                                Number(event.target.value),
                                                unit,
                                              ),
                                            }
                                          : s,
                                    ),
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Repeticiones
                      <input
                        type="number"
                        inputMode="numeric"
                        required
                        min={1}
                        step={1}
                        disabled={disabled}
                        aria-label={`${e.name}: serie ${index + 1} repeticiones`}
                        value={set.reps}
                        onChange={(event) =>
                          onChange(
                            exercises.map((row) =>
                              row.id === e.id
                                ? {
                                    ...e,
                                    performedSets: e.performedSets!.map(
                                      (s, i) =>
                                        i === index
                                          ? {
                                              ...s,
                                              reps: Number(event.target.value),
                                            }
                                          : s,
                                    ),
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                    {!disabled && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Quitar serie ${index + 1} de ${e.name}`}
                        disabled={e.performedSets!.length === 1}
                        onClick={() =>
                          onChange(
                            exercises.map((row) =>
                              row.id === e.id
                                ? {
                                    ...e,
                                    performedSets: e.performedSets!.filter(
                                      (_, i) => i !== index,
                                    ),
                                  }
                                : row,
                            ),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!disabled && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    onChange(
                      exercises.map((row) =>
                        row.id === e.id
                          ? {
                              ...e,
                              performedSets: [
                                ...e.performedSets!,
                                {
                                  weight: e.performedSets!.at(-1)?.weight ?? 0,
                                  reps: e.performedSets!.at(-1)?.reps ?? 1,
                                },
                              ],
                            }
                          : row,
                      ),
                    )
                  }
                >
                  <Plus size={16} />
                  Agregar serie
                </button>
              )}
              <label className="exercise-notes">
                Notas · opcional
                <input
                  disabled={disabled}
                  aria-label={`${e.name}: notas`}
                  value={e.notes ?? ""}
                  onChange={(event) =>
                    onChange(
                      exercises.map((row) =>
                        row.id === e.id
                          ? { ...e, notes: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
              </label>
            </>
          ) : (
            <ExerciseFields
              exercise={e}
              disabled={disabled}
              onChange={(next) =>
                onChange(exercises.map((row) => (row.id === e.id ? next : row)))
              }
            />
          )}
          {e.type === "strength" && !e.performedSets && !disabled && (
            <button
              type="button"
              className="text-link"
              onClick={() =>
                onChange(
                  exercises.map((row) =>
                    row.id === e.id
                      ? {
                          ...e,
                          performedSets: Array.from(
                            { length: Math.min(100, Math.max(1, e.sets)) },
                            () => ({ weight: e.weight, reps: e.reps }),
                          ),
                        }
                      : row,
                  ),
                )
              }
            >
              Registrar series con valores distintos
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
export function exerciseSummary(e: Exercise, unit: WeightUnit = "kg") {
  if (e.type === "strength" && !e.performedSets && e.plannedSets)
    return exerciseSummary({ ...e, performedSets: e.plannedSets }, unit);
  if (e.type === "strength" && e.performedSets)
    return `${e.performedSets.length} series · ${e.performedSets.map((s) => `${displayWeight(s.weight, unit)} ${unit} × ${s.reps}`).join(" / ")}`;
  return e.type === "cardio"
    ? `${e.duration !== undefined ? `${e.duration} min` : "Duración sin registrar"}${e.distance !== undefined ? ` · ${e.distance} km` : ""}${e.resistance !== undefined ? ` · nivel ${e.resistance}` : ""}`
    : e.type === "mobility"
      ? e.duration !== undefined
        ? `${e.duration} min`
        : "Duración sin registrar"
      : `${e.sets} × ${e.reps} · ${displayWeight(e.weight, unit)} ${unit}`;
}
