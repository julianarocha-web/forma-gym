import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Dumbbell,
  Moon,
  TrendingUp,
} from "lucide-react";
import { dateKey, formatDate, type AppData } from "../data";
import { Photo } from "./Media";
import { defaultRoutineImage } from "../media";
import { weekSchedule } from "../schedule";

export default function HomeOverview({
  data,
  onRegister,
  onRoutines,
  onCalendar,
  onProgress,
  onDate,
}: {
  data: AppData;
  onRegister: () => void;
  onRoutines: () => void;
  onCalendar: () => void;
  onProgress: () => void;
  onDate: (date: string) => void;
}) {
  const today = dateKey();
  const sessions = data.sessions
    .filter((s) => !s.demo && s.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
  const last = sessions[0];
  const plan = [...data.plans]
    .filter(
      (p) =>
        p.status === "planned" &&
        p.date >= today &&
        !sessions.some((s) => s.date === p.date && s.routineId === p.routineId),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const next = data.routines.find((r) => r.id === plan?.routineId);
  const days = weekSchedule(data, today);
  const activeDays = days.filter((d) => d.sessions.length > 0).length;
  return (
    <div className="home-overview">
      <section className="home-hero card">
        <div className="hero-copy">
          <span className="eyebrow">TU BIENESTAR, A TU RITMO</span>
          <h2>
            Hoy, un paso más
            <br /> <em>para vos.</em>
          </h2>
          <p>
            Movete, registrá y descubrí tu progreso.
            <br />
            Tu próxima sesión la elegís vos.
          </p>
          <button className="primary-button" onClick={onRegister}>
            Registrar entrenamiento
            <ArrowRight size={17} />
          </button>
          <span className="hero-footnote">
            <span />
            Cada pequeño esfuerzo cuenta
          </span>
        </div>
        <Photo
          image={{ kind: "asset", id: "lower-body" }}
          alt="Atleta preparando su entrenamiento con barra"
          variant="hero"
          eager
        />
        <div className="hero-float">
          <CheckCheck size={20} />
          <span>
            El mejor plan<strong>es el que hacés tuyo.</strong>
          </span>
        </div>
      </section>
      <section
        className="card week-overview"
        aria-label="Tu constancia · Esta semana"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">TU CONSTANCIA</span>
            <h2>Esta semana</h2>
          </div>
          <span className="week-count">
            {activeDays}
            <small>/ 7 días activos</small>
          </span>
        </div>
        <div className="week-strip">
          {days.map((d) => {
            return (
              <button
                key={d.key}
                className={`week-${d.status === "completed" ? "complete" : d.status} ${d.key === today ? "week-today" : ""}`}
                onClick={() => onDate(d.key)}
                aria-current={d.key === today ? "date" : undefined}
                aria-label={`Organizar ${d.key}: ${d.description}`}
                title={d.description}
              >
                <span>{d.label}</span>
                <strong>{d.number}</strong>
                <i aria-hidden="true">
                  {d.status === "completed" ? (
                    <Check size={12} />
                  ) : d.status === "planned" ? (
                    <Dumbbell size={12} />
                  ) : d.status === "rest" ? (
                    <Moon size={12} />
                  ) : null}
                </i>
              </button>
            );
          })}
        </div>
        <div className="week-legend" aria-label="Estados de la semana">
          <span className="week-key-completed">
            <Check size={13} />
            Completado
          </span>
          <span className="week-key-planned">
            <Dumbbell size={13} />
            Planificado
          </span>
          <span className="week-key-rest">
            <Moon size={13} />
            Descanso
          </span>
          <span className="week-key-empty">
            <span aria-hidden="true">—</span>Sin planificación
          </span>
        </div>
        <ul className="week-agenda" aria-label="Actividades de esta semana">
          {days
            .filter((d) => d.activities.length)
            .map((d) => (
              <li key={d.key}>
                <button
                  className={`week-activity-card week-activity-${d.status}`}
                  onClick={() => onDate(d.key)}
                  aria-label={`Ver ${d.key}: ${d.description}`}
                >
                  <span className="week-agenda-date">
                    {d.label} {d.number}
                  </span>
                  <span className="week-agenda-activities">
                    {d.activities.map((a) => (
                      <span key={a.key} className={`week-key-${a.status}`}>
                        {a.status === "completed" ? (
                          <Check size={13} />
                        ) : a.status === "rest" ? (
                          <Moon size={13} />
                        ) : (
                          <Dumbbell size={13} />
                        )}
                        <span>
                          {a.name}
                          <small>{a.label}</small>
                        </span>
                      </span>
                    ))}
                  </span>
                  <ChevronRight size={14} />
                </button>
              </li>
            ))}
        </ul>
        {!days.some((d) => d.activities.length) && (
          <p className="calendar-hint">
            Tu semana todavía no tiene actividades. Tocá un día para planificar.
          </p>
        )}
        <div className="week-caption">
          <button className="text-link" onClick={onCalendar}>
            Ver calendario
            <ChevronRight size={14} />
          </button>
        </div>
      </section>
      <div className="home-session-cards">
        <section className="card recent-session">
          <span className="eyebrow">ÚLTIMA SESIÓN</span>
          {last ? (
            <>
              <div className="session-card-icon success">
                <CheckCheck size={22} />
              </div>
              <h3>{last.name}</h3>
              <p>
                {formatDate(last.date)} · {last.exercises.length} ejercicios
              </p>
              <button className="text-link" onClick={() => onDate(last.date)}>
                Ver entrenamiento
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <div className="session-card-icon">
                <Dumbbell size={22} />
              </div>
              <h3>Tu recorrido empieza acá.</h3>
              <p>
                Cuando completes una sesión, la vas a encontrar en este espacio.
              </p>
              <button className="text-link" onClick={onRegister}>
                Empezar
                <ArrowRight size={15} />
              </button>
            </>
          )}
        </section>
        <section className="card next-session">
          <span className="eyebrow">PRÓXIMO ENTRENAMIENTO</span>
          {plan ? (
            <>
              <Photo
                image={next?.image}
                fallback={next ? defaultRoutineImage(next.id) : undefined}
                alt={next?.name ?? "Rutina pendiente de reasignar"}
                variant="thumb"
              />
              <h3>{next?.name ?? "Rutina para reasignar"}</h3>
              <p>{formatDate(plan.date)}</p>
              <button className="text-link" onClick={() => onDate(plan.date)}>
                Ver planificación
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <div className="session-card-icon planned">
                <CalendarDays size={22} />
              </div>
              <h3>Hacé lugar para vos.</h3>
              <p>
                Elegí una rutina y una fecha. Sin días fijos ni planes
                automáticos.
              </p>
              <button className="text-link" onClick={onCalendar}>
                Planificar sesión
                <ArrowRight size={15} />
              </button>
            </>
          )}
        </section>
      </div>
      <div className="quick-actions">
        <button className="quick-action" onClick={onRoutines}>
          <span className="action-icon strength">
            <Dumbbell size={21} />
          </span>
          <span>
            Mis rutinas<small>Tu plan, a tu manera</small>
          </span>
          <ChevronRight size={18} />
        </button>
        <button className="quick-action" onClick={onProgress}>
          <span className="action-icon cardio">
            <TrendingUp size={21} />
          </span>
          <span>
            Mi progreso<small>Descubrí tu recorrido</small>
          </span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
