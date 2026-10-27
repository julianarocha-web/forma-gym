import { useState } from "react";
import { Activity, ChevronRight, Search } from "lucide-react";
import { Photo } from "./Media";
import { defaultExerciseImage } from "../media";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { activityLabel, formatDate, type AppData } from "../data";
import {
  exerciseProgress,
  metricDetails,
  type ProgressEntry,
  type ProgressMetric,
  type ProgressPeriod,
} from "../progress";
import { Chips } from "./Tags";
import { useUnits, displayWeight } from "../units";

const number = (value: number) =>
  value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
export default function Progress({ data }: { data: AppData }) {
  const unit = useUnits();
  const [selected, setSelected] = useState(data.catalog[0]?.id ?? "");
  const [period, setPeriod] = useState<ProgressPeriod>("all");
  const [metric, setMetric] = useState<ProgressMetric>("weight");
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const definition =
    data.catalog.find((e) => e.id === selected) ?? data.catalog[0];
  const allowed: ProgressMetric[] =
    definition?.type === "strength"
      ? ["weight", "reps", "sets"]
      : definition?.type === "cardio"
        ? ["duration", "distance"]
        : ["duration"];
  const actualMetric = allowed.includes(metric) ? metric : allowed[0];
  const details = {
    ...metricDetails[actualMetric],
    ...(actualMetric === "weight" ? { unit } : {}),
  };
  const entries = definition
    ? exerciseProgress(data, definition.id, actualMetric, period).map(
        (entry) => ({
          ...entry,
          value:
            entry.value !== null && actualMetric === "weight"
              ? displayWeight(entry.value, unit)
              : entry.value,
        }),
      )
    : [];
  const known = entries.filter(
    (e): e is ProgressEntry & { value: number } => e.value !== null,
  );
  const point = entries.find((e) => e.key === active && e.value !== null);
  const first = known[0],
    last = known.at(-1);
  const best = known.length
    ? Math.max(...known.map((row) => row.value))
    : undefined;
  const chartColor =
    definition?.type === "cardio"
      ? "var(--chart-cardio)"
      : "var(--color-primary)";
  function pointDot(props: {
    cx?: number;
    cy?: number;
    payload?: ProgressEntry;
  }) {
    const { cx, cy, payload } = props;
    if (
      payload?.value === null ||
      !payload ||
      cx === undefined ||
      cy === undefined
    )
      return <g />;
    const label = `${formatDate(payload.date)}, ${payload.routineName}: ${number(payload.value)} ${details.unit}`;
    return (
      <g
        key={payload.key}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => setActive(payload.key)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActive(payload.key);
          }
        }}
        className="progress-dot"
      >
        <circle cx={cx} cy={cy} r={22} fill="transparent" />
        <circle
          cx={cx}
          cy={cy}
          r={active === payload.key ? 6 : 4.5}
          fill={chartColor}
          stroke="var(--color-surface)"
          strokeWidth={2}
        />
      </g>
    );
  }
  return (
    <section className="card progress-card exercise-progress">
      <div className="section-heading">
        <div>
          <span className="eyebrow">REGISTROS REALES</span>
          <h2>Tu progreso por ejercicio</h2>
        </div>
        <label className="progress-exercise-label">
          Ejercicio
          <select
            aria-label="Ejercicio del gráfico"
            value={definition?.id ?? ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setActive(null);
            }}
          >
            {data.catalog.length === 0 && (
              <option value="">Sin ejercicios</option>
            )}
            {data.catalog.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="progress-search">
        <Search size={17} />
        <input
          aria-label="Buscar ejercicio para progreso"
          placeholder="Buscá un ejercicio por nombre…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {query && (
        <div className="progress-search-results">
          {data.catalog
            .filter((def) =>
              def.name
                .toLocaleLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .includes(
                  query
                    .toLocaleLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, ""),
                ),
            )
            .map((def) => (
              <button
                type="button"
                key={def.id}
                onClick={() => {
                  setSelected(def.id);
                  setActive(null);
                  setQuery("");
                }}
                aria-label={`Ver progreso de ${def.name}`}
              >
                <Photo
                  image={def.image}
                  fallback={defaultExerciseImage(
                    def.id,
                    def.legacyIds,
                    def.name,
                  )}
                  alt={def.name}
                  type={def.type}
                />
                <span>
                  <strong>{def.name}</strong>
                  <Chips
                    tags={[
                      activityLabel(def.type),
                      ...def.tags.filter(
                        (tag) => tag !== activityLabel(def.type),
                      ),
                    ]}
                  />
                </span>
              </button>
            ))}
          {!data.catalog.some((def) =>
            def.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
          ) && (
            <p className="form-help">
              Buscá otro nombre para encontrar tu ejercicio.
            </p>
          )}
        </div>
      )}
      {definition && (
        <>
          <div className="progress-exercise-heading">
            <Photo
              image={definition.image}
              fallback={defaultExerciseImage(
                definition.id,
                definition.legacyIds,
                definition.name,
              )}
              alt={definition.name}
              type={definition.type}
              variant="detail"
            />
            <div>
              <h3>{definition.name}</h3>
              <Chips
                tags={[
                  ...new Set([
                    activityLabel(definition.type),
                    ...definition.tags,
                  ]),
                ]}
              />
            </div>
          </div>
          <div
            className="period-filter"
            role="group"
            aria-label="Período del progreso"
          >
            {(
              [
                ["month", "Último mes"],
                ["quarter", "Últimos tres meses"],
                ["all", "Todo el historial"],
              ] as const
            ).map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-pressed={period === key}
                className={period === key ? "selected" : ""}
                onClick={() => {
                  setPeriod(key);
                  setActive(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="field-label progress-metric-label">
            Métrica
            <select
              aria-label="Métrica del progreso"
              value={actualMetric}
              onChange={(e) => {
                setMetric(e.target.value as ProgressMetric);
                setActive(null);
              }}
            >
              {allowed.map((m) => (
                <option key={m} value={m}>
                  {metricDetails[m].label}
                  {metricDetails[m].unit
                    ? ` (${m === "weight" ? unit : metricDetails[m].unit})`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="metric-explanation">{details.explanation}</p>
        </>
      )}
      {actualMetric !== "sets" && known.length > 0 && (
        <>
          <div className="progress-summary">
            <div>
              <span>Primer valor del período</span>
              <strong>
                {number(first.value)} <small>{details.unit}</small>
              </strong>
              <time dateTime={first.date}>{formatDate(first.date)}</time>
            </div>
            <ChevronRight size={17} />
            <div>
              <span>Último valor del período</span>
              <strong>
                {number(last!.value)} <small>{details.unit}</small>
              </strong>
              <time dateTime={last!.date}>{formatDate(last!.date)}</time>
            </div>
            <div className="progress-best">
              <span>Mejor marca del período</span>
              <strong>
                {number(best!)} <small>{details.unit}</small>
              </strong>
              <span>Máximo de la métrica elegida</span>
            </div>
          </div>
          <div className="chart-heading">
            <h4>
              {details.label} <span>({details.unit})</span>
            </h4>
            <span>Tocá un punto para ver el valor.</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer
              width="100%"
              height={250}
              initialDimension={{ width: 350, height: 250 }}
            >
              <LineChart
                data={entries}
                margin={{ top: 20, right: 17, left: -18, bottom: 10 }}
                accessibilityLayer
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--color-border)"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="key"
                  tickFormatter={(key) => {
                    const e = entries.find((e) => e.key === key);
                    return e
                      ? new Date(`${e.date}T12:00:00`).toLocaleDateString(
                          "es-AR",
                          { day: "numeric", month: "short" },
                        )
                      : "";
                  }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-secondary)" }}
                  minTickGap={25}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-secondary)" }}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  filterNull
                  formatter={(value) => [
                    `${number(Number(value))} ${details.unit}`,
                    details.label,
                  ]}
                  labelFormatter={(key) => {
                    const e = entries.find((e) => e.key === key);
                    return e ? `${formatDate(e.date)} · ${e.routineName}` : "";
                  }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--color-border)",
                    background: "var(--surface-popup)",
                    color: "var(--color-text)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={2.5}
                  dot={pointDot}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {point && (
            <div className="selected-point" role="status">
              <span>
                {formatDate(point.date)} · {point.routineName}
              </span>
              <strong>
                {details.label}: {number(point.value!)} {details.unit}
              </strong>
            </div>
          )}
          {entries.some((e) => e.value === null) && (
            <p className="calendar-hint">
              Las sesiones sin esta medición aparecen como «Sin registrar» y
              dejan un corte en la línea.
            </p>
          )}
        </>
      )}
      {(entries.length === 0 ||
        (actualMetric !== "sets" && known.length === 0)) && (
        <div className="empty-state progress-empty">
          <Activity size={30} />
          <h3>
            {entries.length
              ? "Esta métrica todavía no tiene registros."
              : "Un espacio para ver tu recorrido."}
          </h3>
          <p>
            {entries.length
              ? "Podés consultar los otros valores guardados en el historial."
              : "Elegí otro período o completá una sesión con este ejercicio."}
          </p>
        </div>
      )}
      {entries.length > 0 && (
        <div className="exercise-session-history">
          <h3>Historial del ejercicio</h3>
          <p className="form-help">
            Todas las rutinas · {entries.length}{" "}
            {entries.length === 1 ? "sesión" : "sesiones"} en el período
          </p>
          {[...entries].reverse().map((entry) => (
            <article className="progress-history-entry" key={entry.key}>
              <header>
                <div>
                  <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                  <span>{entry.routineName}</span>
                </div>
                {actualMetric !== "sets" && (
                  <button
                    type="button"
                    className="history-point-button"
                    disabled={entry.value === null}
                    aria-label={`Ver valor del ${entry.date} en ${entry.routineName}`}
                    onClick={() => setActive(entry.key)}
                  >
                    {entry.value === null
                      ? "Sin registrar"
                      : `${number(entry.value)} ${details.unit}`}
                  </button>
                )}
              </header>
              {entry.exercises.map((e) => (
                <div key={e.id} className="actual-exercise-record">
                  {e.type === "strength" ? (
                    e.performedSets !== undefined ? (
                      <table className="sets-history-table">
                        <caption>Series realizadas</caption>
                        <thead>
                          <tr>
                            <th>Serie</th>
                            <th>Peso ({unit})</th>
                            <th>Repeticiones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.performedSets.map((s, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>
                                {number(displayWeight(s.weight, unit))} {unit}
                              </td>
                              <td>{s.reps} reps</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="legacy-set-record">
                        <strong>
                          {e.sets} series ·{" "}
                          {number(displayWeight(e.weight, unit))} {unit} ×{" "}
                          {e.reps} reps
                        </strong>
                        <p>
                          Registro anterior con valores comunes. No se guardó un
                          desglose por serie.
                        </p>
                      </div>
                    )
                  ) : (
                    <dl className="cardio-history-values">
                      <div>
                        <dt>Duración</dt>
                        <dd>
                          {e.duration !== undefined
                            ? `${number(e.duration)} min`
                            : "Sin registrar"}
                        </dd>
                      </div>
                      {e.type === "cardio" && (
                        <>
                          <div>
                            <dt>Distancia</dt>
                            <dd>
                              {e.distance !== undefined
                                ? `${number(e.distance)} km`
                                : "Sin registrar"}
                            </dd>
                          </div>
                          <div>
                            <dt>Resistencia</dt>
                            <dd>
                              {e.resistance !== undefined
                                ? number(e.resistance)
                                : "Sin registrar"}
                            </dd>
                          </div>
                        </>
                      )}
                    </dl>
                  )}
                  {e.notes && <p className="historical-note">{e.notes}</p>}
                  {e.type !== definition?.type && (
                    <p className="calendar-hint">
                      Tipo guardado en esta sesión: {activityLabel(e.type)}.
                    </p>
                  )}
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
