import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  Dumbbell,
  Flame,
  LayoutDashboard,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  RefreshCw,
  Download,
} from "lucide-react";
import {
  dateKey,
  deleteRoutine,
  duplicateRoutine,
  formatDate,
  newRoutine,
  routineTags,
  saveRoutine,
  saveCatalogExercise,
  type Routine,
} from "./data";
import { useAppData } from "./useAppData";
import RoutineEditor from "./components/RoutineEditor";
import TrainingCalendar from "./components/TrainingCalendar";
import DayDialog from "./components/DayDialog";
import Workout from "./components/Workout";
import Progress from "./components/Progress";
import ExerciseCatalog from "./components/ExerciseCatalog";
import Modal from "./components/Modal";
import ActionMenu from "./components/ActionMenu";
import { Chips } from "./components/Tags";
import { exerciseSummary } from "./components/ExerciseFields";
import HomeOverview from "./components/HomeOverview";
import { Photo } from "./components/Media";
import { defaultRoutineImage, defaultExerciseImage } from "./media";
import { afterCommit, type AccountRuntime } from "./cloud/types";
import { ThemeToggle } from "./theme";
import { useUnits } from "./units";
import ProfilePage from "./components/ProfilePage";
import ImportLocal from "./components/ImportLocal";
import { hasLocalData, downloadJson, exportBackup } from "./cloud/import-data";
import { useMedia } from "./cloud/media";

const nav = [
  { key: "Mi dashboard", label: "Inicio", icon: LayoutDashboard },
  { key: "Mis rutinas", label: "Rutinas", icon: Dumbbell },
  { key: "Calendario", label: "Calendario", icon: CalendarDays },
  { key: "Mi progreso", label: "Progreso", icon: ChartNoAxesCombined },
  { key: "Mi perfil", label: "Mi perfil", icon: UserRound },
];
function Metric({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: typeof Dumbbell;
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="metric">
      <span className={`metric-icon ${color}`}>
        <Icon size={20} />
      </span>
      <div>
        <span className="muted text-xs">{label}</span>
        <div className="metric-value">{value}</div>
        <span className="metric-detail">{detail}</span>
      </div>
    </div>
  );
}
export default function AppShell({ account }: { account?: AccountRuntime }) {
  const {
    data,
    commit,
    error,
    blocked,
    loading,
    saving,
    pending,
    refresh,
    importData,
    discardPending,
    retry,
  } = useAppData(account?.repository);
  const unit = useUnits();
  const media = useMedia();
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDownloaded, setPendingDownloaded] = useState(false);
  const [pendingConfirmed, setPendingConfirmed] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  useEffect(() => {
    setPendingDownloaded(false);
    setPendingConfirmed(false);
    setRecoveryMessage("");
  }, [pending?.data]);
  const availableCatalog = [
    ...data.catalog,
    ...(account?.sharedCatalog ?? []).filter(
      (shared) =>
        !data.catalog.some(
          (own) =>
            own.id === shared.id ||
            own.sharedId === shared.sharedId ||
            own.legacyIds?.includes(shared.sharedId ?? ""),
        ),
    ),
  ];
  let localAvailable = false;
  try {
    localAvailable = !!account && hasLocalData();
  } catch {}
  const { routines } = data;
  const sessions = data.sessions.filter((s) => !s.demo);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const workoutRef = useRef<HTMLElement>(null);
  function register() {
    workoutRef.current?.scrollIntoView?.({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    workoutRef.current?.querySelector("select")?.focus();
  }
  const [page, setPage] = useState("Mi dashboard");
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<Routine | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [removing, setRemoving] = useState<Routine | null>(null);
  const [viewing, setViewing] = useState<Routine | null>(null);
  const [day, setDay] = useState<{ date: string; routineId?: string } | null>(
    null,
  );
  const [filter, setFilter] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const today = dateKey();
  const todayPlan = data.plans.find(
    (p) => p.date === today && p.status === "planned",
  );
  const routine =
    routines.find((r) => r.id === selected) ||
    routines.find((r) => r.id === todayPlan?.routineId);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekSessions = sessions.filter(
    (s) => s.date >= dateKey(weekStart) && s.date <= today,
  );
  function notify(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  const upcoming = data.plans
    .filter(
      (p) =>
        p.status === "planned" &&
        p.date >= today &&
        !sessions.some((s) => s.date === p.date && s.routineId === p.routineId),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const tags = [
    ...new Set([...routineTags, ...routines.flatMap((r) => r.tags)]),
  ];
  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              setPage("Mi dashboard");
            }}
          >
            <span className="brand-symbol">
              <Activity size={25} />
            </span>
            forma<span className="brand-dot">.</span>
          </a>
          <div className="workspace-label">TU ESPACIO PERSONAL</div>
          <nav>
            {nav.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={page === key ? "active" : ""}
                aria-current={page === key ? "page" : undefined}
                onClick={() => setPage(key)}
              >
                <Icon size={19} />
                {label}
                {page === key && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="small-note">
              <Sparkles size={20} />
              <strong>Un día a la vez.</strong>
              <p>
                El progreso se construye
                <br />
                con constancia.
              </p>
            </div>
            <button
              type="button"
              className="profile"
              onClick={() => setPage("Mi perfil")}
              aria-label="Ver mi perfil"
            >
              <div className="avatar">YO</div>
              <div>
                <strong>{account?.profile.display_name || "Mi espacio"}</strong>
                <span>Mi mejor versión</span>
              </div>
              <span className="profile-dot" />
            </button>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <span>
              Mi espacio <ArrowRight size={13} />
              <strong>{nav.find((item) => item.key === page)?.label}</strong>
            </span>
            <div>
              <span className="local-badge">
                <span />
                {saving
                  ? "Guardando en tu cuenta…"
                  : loading
                    ? "Consultando tu cuenta…"
                    : error
                      ? "Guardado no disponible"
                      : account
                        ? "Guardado en tu cuenta"
                        : "Almacenamiento en este dispositivo"}
              </span>
              {account && (
                <button
                  className="icon-button refresh-workspace"
                  aria-label="Actualizar datos de mi cuenta"
                  disabled={saving || loading || !!pending}
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={18} />
                </button>
              )}
              <ThemeToggle />
              <button
                type="button"
                className="icon-button header-profile"
                aria-label="Abrir mi perfil"
                onClick={() => setPage("Mi perfil")}
              >
                <Photo
                  image={account?.profile.avatar}
                  alt="Foto de perfil"
                  variant="avatar"
                />
              </button>
            </div>
          </header>
          <div className="content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">TU CONSTANCIA, TU PROGRESO</div>
                <h1>
                  {page === "Mi perfil"
                    ? "Tu espacio, a tu manera"
                    : page === "Mi dashboard"
                      ? "Tu momento empieza acá"
                      : page === "Mis rutinas"
                        ? "Tu plan. A tu manera"
                        : page === "Calendario"
                          ? "Cada día cuenta"
                          : "Mirá cuánto avanzaste"}
                  <span className="heading-dot">.</span>
                </h1>
                <p>
                  {page === "Mis rutinas"
                    ? "Tus rutinas no tienen un día fijo. Elegí cuándo y cómo entrenar."
                    : page === "Calendario"
                      ? "Organizá actividad y descanso, a tu ritmo."
                      : "Cada repetición cuenta. Seguí construyendo tu mejor versión."}
                </p>
              </div>
              <div className="date-badge">
                <CalendarDays size={16} />
                {formatDate(today)}
              </div>
            </div>
            {error && (
              <div role="alert" className="error">
                {error}
                {blocked && (
                  <p>
                    Conservamos los datos originales. Revisalos antes de volver
                    a cargar la aplicación.
                  </p>
                )}
              </div>
            )}
            {account && loading && (
              <p className="sync-banner" role="status">
                Consultando tus registros en la nube…
              </p>
            )}
            {account && blocked && !loading && (
              <button
                className="secondary-button"
                onClick={() => void refresh()}
              >
                Volver a consultar mis datos
              </button>
            )}
            {account && localAvailable && page !== "Mi perfil" && (
              <div className="import-banner">
                <div>
                  <strong>Tus registros locales siguen acá.</strong>
                  <span>Podés revisarlos e importarlos a tu cuenta.</span>
                </div>
                <button
                  className="secondary-button"
                  disabled={saving || loading || !!pending}
                  onClick={() => setImportOpen(true)}
                >
                  Revisar importación
                </button>
              </div>
            )}
            {pending && !saving && (
              <section
                className="card recovery-panel"
                aria-label="Cambios pendientes"
              >
                <h2>Conservamos tus cambios pendientes</h2>
                <p>
                  No se confirmó su guardado. Podés reintentar o descargar un
                  respaldo antes de actualizar.
                </p>
                <div className="account-actions">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      void exportBackup(
                        pending.data,
                        media.read,
                        account?.profile,
                      )
                        .then((backup) => {
                          downloadJson(backup, "forma-cambios-pendientes.json");
                          setPendingDownloaded(true);
                          setPendingConfirmed(false);
                          setRecoveryMessage(
                            "Copia preparada. Confirmá que guardaste el archivo antes de descartar.",
                          );
                        })
                        .catch(() =>
                          setRecoveryMessage(
                            "No se pudo preparar el respaldo con fotos. Conservamos los cambios pendientes.",
                          ),
                        );
                    }}
                  >
                    <Download size={16} />
                    Descargar cambios con fotos
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => void retry()}
                  >
                    Reintentar guardado
                  </button>
                </div>
                <label className="confirmation-check">
                  <input
                    type="checkbox"
                    disabled={!pendingDownloaded}
                    checked={pendingConfirmed}
                    onChange={(e) => setPendingConfirmed(e.target.checked)}
                  />
                  <span>
                    Guardé una copia y quiero descartar estos cambios pendientes
                    para consultar la nube.
                  </span>
                </label>
                <button
                  className="danger-link"
                  disabled={!pendingDownloaded || !pendingConfirmed}
                  onClick={() => void discardPending()}
                >
                  Descartar pendientes y actualizar
                </button>
                {recoveryMessage && <p role="status">{recoveryMessage}</p>}
              </section>
            )}
            {page === "Mi perfil" && (
              <ProfilePage
                key={account?.user.id ?? "local-profile"}
                account={account}
                data={data}
                dataReady={!blocked && !loading && !pending}
                onImport={() => setImportOpen(true)}
              />
            )}
            <fieldset
              className="workspace-fields"
              disabled={saving || !!pending || (!!account && blocked)}
            >
              {page === "Mi dashboard" && (
                <HomeOverview
                  data={data}
                  onRegister={register}
                  onRoutines={() => setPage("Mis rutinas")}
                  onCalendar={() => setPage("Calendario")}
                  onProgress={() => setPage("Mi progreso")}
                  onDate={(date) => setDay({ date })}
                />
              )}
              {page === "Mi dashboard" && (
                <div className="metrics-grid">
                  <Metric
                    icon={Dumbbell}
                    label="Entrenamientos"
                    value={String(sessions.length)}
                    detail="Tu esfuerzo acumulado"
                    color="sage"
                  />
                  <Metric
                    icon={Flame}
                    label="Esta semana"
                    value={String(weekSessions.length)}
                    detail="Sesiones que vos completaste"
                    color="peach"
                  />
                  <Metric
                    icon={Target}
                    label="Rutinas a tu medida"
                    value={String(routines.length)}
                    detail="Disponibles cuando vos quieras"
                    color="sand"
                  />
                </div>
              )}
              {page === "Mi dashboard" && (
                <>
                  <div className="dashboard-grid">
                    <section
                      className="card workout-card"
                      id="active-workout"
                      ref={workoutRef}
                    >
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">A TU RITMO</span>
                          <h2>Tu entrenamiento de hoy</h2>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Organizar hoy"
                          onClick={() =>
                            setDay({ date: today, routineId: routine?.id })
                          }
                        >
                          <CalendarDays size={20} />
                        </button>
                      </div>
                      <label className="field-label">
                        Elegí qué querés entrenar
                        <select
                          value={routine?.id ?? ""}
                          onChange={(e) => setSelected(e.target.value)}
                        >
                          <option value="">Seleccioná una rutina</option>
                          {routines.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {routine ? (
                        <>
                          <Photo
                            image={routine.image}
                            fallback={defaultRoutineImage(routine.id)}
                            alt={routine.name}
                            variant="cover"
                          />
                          <Chips tags={routine.tags} />
                          <Workout
                            key={`${today}-${routine.id}`}
                            data={data}
                            routine={routine}
                            date={today}
                            onCommit={commit}
                            cloud={!!account}
                            onDone={notify}
                          />
                        </>
                      ) : (
                        <div className="empty-state">
                          <Dumbbell size={30} />
                          <h3>Tu próximo entrenamiento lo elegís vos.</h3>
                          <p>
                            Seleccioná una rutina o creá una nueva para empezar.
                          </p>
                          <button
                            className="primary-button"
                            onClick={() => setEditing(newRoutine())}
                          >
                            <Plus size={17} />
                            Crear rutina
                          </button>
                        </div>
                      )}
                    </section>
                    <div className="right-column">
                      <section className="card calendar-card">
                        <div className="section-heading">
                          <h2>Tu actividad</h2>
                          <CalendarDays size={18} className="muted" />
                        </div>
                        <TrainingCalendar
                          compact
                          data={data}
                          onSelect={(date) => setDay({ date })}
                        />
                        <button
                          className="text-link calendar-link"
                          onClick={() => setPage("Calendario")}
                        >
                          Ver mi calendario
                          <ArrowRight size={16} />
                        </button>
                      </section>
                      <div className="quote-card">
                        <span className="quote-mark">“</span>
                        <p>
                          Tu ritmo también cuenta.
                          <br />
                          <strong>Un paso a la vez.</strong>
                        </p>
                        <span>
                          VOS PODÉS CON ESTO
                          <Sparkles size={13} />
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {page === "Mis rutinas" && (
                <>
                  <div className="routine-toolbar">
                    <label>
                      Filtrar por etiqueta
                      <select
                        aria-label="Filtrar rutinas por etiqueta"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="">Todas las rutinas</option>
                        {tags.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <div className="routine-toolbar-actions">
                      <button
                        className="secondary-button"
                        onClick={() => setCatalogOpen(true)}
                      >
                        <Dumbbell size={17} />
                        Catálogo de ejercicios
                      </button>
                      <button
                        className="primary-button"
                        onClick={() => setEditing(newRoutine())}
                      >
                        <Plus size={18} />
                        Crear rutina
                      </button>
                    </div>
                  </div>
                  <div className="routine-grid">
                    {routines
                      .filter((r) => !filter || r.tags.includes(filter))
                      .map((r) => (
                        <section
                          key={r.id}
                          className="card routine-editor-card"
                        >
                          <div className="routine-cover">
                            <Photo
                              image={r.image}
                              fallback={defaultRoutineImage(r.id)}
                              alt={`Portada de ${r.name}`}
                              variant="cover"
                            />
                          </div>
                          <div className="section-heading">
                            <span className="pill">
                              {r.exercises.length} ejercicios
                            </span>
                            <ActionMenu label={`Acciones de ${r.name}`}>
                              <button
                                onClick={() => setEditing(structuredClone(r))}
                              >
                                <Pencil size={16} />
                                Editar
                              </button>
                              <button
                                onClick={() => {
                                  const copy = duplicateRoutine(r);
                                  afterCommit(
                                    commit(saveRoutine(data, copy)),
                                    () =>
                                      notify(
                                        "Rutina duplicada. Podés editarla de forma independiente.",
                                      ),
                                  );
                                }}
                              >
                                <Plus size={16} />
                                Duplicar
                              </button>
                              <button
                                onClick={() =>
                                  setDay({ date: today, routineId: r.id })
                                }
                              >
                                <CalendarDays size={16} />
                                Asignar fecha
                              </button>
                              <button
                                className="danger-link"
                                onClick={() => setRemoving(r)}
                              >
                                <Trash2 size={16} />
                                Eliminar
                              </button>
                            </ActionMenu>
                          </div>
                          <h2>{r.name}</h2>
                          <Chips tags={r.tags} />
                          {r.description && (
                            <p className="routine-description">
                              {r.description}
                            </p>
                          )}
                          <div className="routine-preview">
                            {r.exercises.slice(0, 3).map((e) => (
                              <span key={e.id}>{e.name}</span>
                            ))}
                            {r.exercises.length > 3 && (
                              <small>
                                + {r.exercises.length - 3} ejercicios más
                              </small>
                            )}
                          </div>
                          <button
                            className="primary-button"
                            onClick={() => setViewing(r)}
                          >
                            Abrir rutina
                            <ArrowRight size={17} />
                          </button>
                          <div className="routine-management">
                            <button
                              type="button"
                              className="secondary-button"
                              aria-label={`Editar rutina ${r.name}`}
                              onClick={() => setEditing(structuredClone(r))}
                            >
                              <Pencil size={16} />
                              Editar
                            </button>
                            <button
                              type="button"
                              className="danger-link"
                              aria-label={`Eliminar rutina ${r.name}`}
                              onClick={() => setRemoving(r)}
                            >
                              <Trash2 size={16} />
                              Eliminar
                            </button>
                          </div>
                        </section>
                      ))}
                  </div>
                  {routines.filter((r) => !filter || r.tags.includes(filter))
                    .length === 0 && (
                    <section className="card empty-state">
                      <Dumbbell size={30} />
                      <h3>
                        {routines.length
                          ? "No hay rutinas con esta etiqueta."
                          : "Tu plan empieza acá."}
                      </h3>
                      <p>
                        Creá una rutina y elegí los ejercicios que te acompañan.
                      </p>
                      <button
                        className="primary-button"
                        onClick={() => setEditing(newRoutine())}
                      >
                        <Plus size={17} />
                        Crear rutina
                      </button>
                    </section>
                  )}
                </>
              )}
              {page === "Calendario" && (
                <section className="card full-calendar">
                  <div className="section-heading">
                    <div>
                      <h2>Tu calendario de entrenamientos</h2>
                      <p>
                        Planes, actividad y descanso. Cada fecha la decidís vos.
                      </p>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => setDay({ date: today })}
                    >
                      Organizar hoy
                    </button>
                  </div>
                  <TrainingCalendar
                    data={data}
                    onSelect={(date) => setDay({ date })}
                  />
                </section>
              )}
              {page === "Mi progreso" && (
                <>
                  <Progress data={data} />
                  <section className="card history-list">
                    <h3>Historial de entrenamientos</h3>
                    {sessions.length === 0 ? (
                      <p className="calendar-hint">
                        Todavía no hay sesiones completadas. Tus planes
                        aparecerán acá cuando confirmes que los realizaste.
                      </p>
                    ) : (
                      [...sessions]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((s) => (
                          <button
                            className="history-item"
                            key={s.id}
                            onClick={() => setDay({ date: s.date })}
                          >
                            <span className="history-icon">
                              <Dumbbell size={18} />
                            </span>
                            <strong>
                              {s.name}
                              <small>
                                {formatDate(s.date)}
                                {s.demo ? " · Ejemplo conservado" : ""}
                              </small>
                            </strong>
                            <span>
                              {s.exercises.length} ejercicios
                              <ArrowRight size={15} />
                            </span>
                          </button>
                        ))
                    )}
                  </section>
                </>
              )}
            </fieldset>
            <footer className="page-footer">
              <span>
                <Activity size={14} />
                Hecho para acompañar tu proceso.
              </span>
              <span>Datos locales · Tu historial se conserva</span>
              <a
                className="text-link"
                href="/images/CREDITS.md"
                target="_blank"
                rel="noreferrer"
              >
                Créditos de fotografías
              </a>
              {data.sessions.some((s) => s.demo) && (
                <button
                  className="text-link"
                  onClick={() => setExamplesOpen(true)}
                >
                  Ver ejemplos anteriores (
                  {data.sessions.filter((s) => s.demo).length})
                </button>
              )}
            </footer>
          </div>
        </main>
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
      {/* Modal controls keep their disabled state without sharing the main flex row. */}
      <fieldset
        className="workspace-fields modal-fields"
        disabled={saving || !!pending || (!!account && blocked)}
      >
        {examplesOpen && (
          <Modal
            title="Ejemplos anteriores"
            onClose={() => setExamplesOpen(false)}
          >
            <p className="form-help">
              Conservados por separado. No se incluyen en tu actividad ni en tus
              gráficos.
            </p>
            {data.sessions
              .filter((s) => s.demo)
              .map((s) => (
                <div className="legacy-set-record" key={s.id}>
                  <strong>{s.name}</strong>
                  <p>
                    {formatDate(s.date)} · {s.exercises.length} ejercicios de
                    ejemplo
                  </p>
                  {s.exercises.map((e) => (
                    <p key={e.id}>
                      {e.name}: {exerciseSummary(e, unit)}
                    </p>
                  ))}
                </div>
              ))}
          </Modal>
        )}
        {editing && (
          <RoutineEditor
            routine={editing}
            catalog={availableCatalog}
            onSaveExercise={(def) => commit(saveCatalogExercise(data, def))}
            onClose={() => {
              if (!saving) setEditing(null);
            }}
            onSave={(r) => {
              return afterCommit(commit(saveRoutine(data, r)), () => {
                setEditing(null);
                notify(
                  "Rutina guardada. El historial y los borradores se conservan.",
                );
              });
            }}
          />
        )}
        {catalogOpen && (
          <Modal
            title="Catálogo de ejercicios"
            onClose={() => setCatalogOpen(false)}
          >
            <ExerciseCatalog
              catalog={availableCatalog}
              onSave={(def) => {
                return afterCommit(commit(saveCatalogExercise(data, def)), () =>
                  notify(
                    "Ejercicio guardado en el catálogo. El historial se conserva.",
                  ),
                );
              }}
            />
          </Modal>
        )}
        {day && (
          <DayDialog
            key={`${day.date}-${day.routineId ?? ""}`}
            onDateChange={(date) => setDay({ ...day, date })}
            data={data}
            date={day.date}
            initialRoutine={day.routineId}
            onCommit={commit}
            cloud={!!account}
            onClose={() => setDay(null)}
            notify={notify}
          />
        )}
        {removing && (
          <Modal title="Eliminar rutina" onClose={() => setRemoving(null)}>
            <p className="confirm-copy">
              ¿Querés eliminar «{removing.name}»? Tus entrenamientos completados
              y sus cargas se conservarán. Las fechas planificadas quedarán
              visibles para que puedas reasignarlas.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setRemoving(null)}
              >
                Cancelar
              </button>
              <button
                className="primary-button danger-button"
                onClick={() => {
                  afterCommit(commit(deleteRoutine(data, removing.id)), () => {
                    setRemoving(null);
                    notify("Rutina eliminada. Tu historial se conserva.");
                  });
                }}
              >
                Eliminar rutina
              </button>
            </div>
          </Modal>
        )}
        {viewing && (
          <Modal title={viewing.name} onClose={() => setViewing(null)}>
            <Photo
              image={viewing.image}
              fallback={defaultRoutineImage(viewing.id)}
              alt={`Portada de ${viewing.name}`}
              variant="detail"
            />
            <Chips tags={viewing.tags} />
            <p className="routine-description">{viewing.description}</p>
            {viewing.exercises.map((e) => (
              <section key={e.id} className="record-exercise">
                <Photo
                  image={
                    data.catalog.find((def) => def.id === e.exerciseId)?.image
                  }
                  fallback={defaultExerciseImage(e.exerciseId, [], e.name)}
                  alt={e.name}
                  type={e.type}
                />
                <h3>{e.name}</h3>
                <p className="exercise-summary">{exerciseSummary(e, unit)}</p>
                <Chips tags={e.tags} />
              </section>
            ))}
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setEditing(structuredClone(viewing));
                  setViewing(null);
                }}
              >
                <Pencil size={16} />
                Editar
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setDay({ date: today, routineId: viewing.id });
                  setViewing(null);
                }}
              >
                <CalendarDays size={17} />
                Asignar fecha
              </button>
            </div>
          </Modal>
        )}
      </fieldset>
      {importOpen && account && (
        <ImportLocal
          account={account}
          current={data}
          onImport={importData}
          onClose={() => setImportOpen(false)}
        />
      )}
    </>
  );
}
