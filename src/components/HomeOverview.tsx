import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Dumbbell,
  TrendingUp,
} from "lucide-react";
import { dateKey, formatDate, type AppData } from "../data";
import { Photo } from "./Media";
import { defaultRoutineImage } from "../media";

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
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return {
      key: dateKey(d),
      label: d.toLocaleDateString("es-AR", { weekday: "short" }).slice(0, 2),
      number: d.getDate(),
    };
  });
  const activeDays = days.filter((d) =>
    sessions.some((s) => s.date === d.key),
  ).length;
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
      <section className="card week-overview">
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
            const done = sessions.some((s) => s.date === d.key);
            return (
              <button
                key={d.key}
                className={`${done ? "week-complete" : ""} ${d.key === today ? "week-today" : ""}`}
                onClick={() => onDate(d.key)}
                aria-label={`Organizar ${d.key}${done ? ", completado" : ""}`}
              >
                <span>{d.label}</span>
                <strong>{d.number}</strong>
                <i>{done ? <Check size={12} /> : null}</i>
              </button>
            );
          })}
        </div>
        <div className="week-caption">
          <span>
            <i />
            Entrenamiento realizado
          </span>
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
