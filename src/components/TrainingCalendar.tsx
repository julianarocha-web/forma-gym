import { useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Moon,
} from "lucide-react";
import { dateKey, dayState, type AppData } from "../data";
export const stateLabels: Record<string, string> = {
  completed: "Completado",
  rest: "Descanso",
  planned: "Planificado",
  empty: "Sin registro",
};
export default function TrainingCalendar({
  data,
  onSelect,
  compact = false,
}: {
  data: AppData;
  onSelect: (date: string) => void;
  compact?: boolean;
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  return (
    <div className={`training-calendar ${compact ? "compact-calendar" : ""}`}>
      <div className="calendar-top">
        <strong>
          {month.toLocaleDateString("es-AR", {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <div>
          <button
            className="icon-button"
            aria-label="Mes anterior"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Mes siguiente"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i} className="day-label">
            {d}
          </span>
        ))}
        {Array.from({ length: (month.getDay() + 6) % 7 }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from(
          {
            length: new Date(
              month.getFullYear(),
              month.getMonth() + 1,
              0,
            ).getDate(),
          },
          (_, i) => {
            const date = dateKey(
              new Date(month.getFullYear(), month.getMonth(), i + 1),
            );
            const { status, sessions, plan } = dayState(data, date);
            const name =
              sessions.map((s) => s.name).join(", ") ||
              data.routines.find((r) => r.id === plan?.routineId)?.name ||
              (plan?.routineId ? "Rutina eliminada" : "");
            return (
              <button
                key={date}
                className={`calendar-day state-${status} ${date === dateKey() ? "is-today" : ""}`}
                onClick={() => onSelect(date)}
                aria-current={date === dateKey() ? "date" : undefined}
                aria-label={`${date}: ${stateLabels[status]}${name ? `, ${name}` : ""}`}
              >
                <span className="calendar-number">{i + 1}</span>
                {status !== "empty" && (
                  <span className="calendar-state-icon">
                    {status === "completed" ? (
                      <Check size={15} />
                    ) : status === "rest" ? (
                      <Moon size={14} />
                    ) : (
                      <CalendarDays size={14} />
                    )}
                  </span>
                )}
                {!compact && status !== "empty" && (
                  <span className="calendar-routine">
                    {status === "rest" ? "Descanso" : name}
                  </span>
                )}
              </button>
            );
          },
        )}
      </div>
      <div className="state-legend">
        <span className="state-completed">
          <Check size={13} />
          Completado
        </span>
        <span className="state-planned">
          <CalendarDays size={13} />
          Planificado
        </span>
        <span className="state-rest">
          <Moon size={13} />
          Descanso
        </span>
      </div>
      <p className="calendar-hint">
        El contorno marca hoy. Tocá una fecha para organizarla.
      </p>
    </div>
  );
}
