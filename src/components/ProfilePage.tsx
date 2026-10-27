import { useState } from "react";
import {
  Download,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
  Trash2,
  Upload,
} from "lucide-react";
import type { AppData } from "../data";
import { goals, type AccountRuntime } from "../cloud/types";
import { exportBackup, downloadJson } from "../cloud/import-data";
import { useMedia } from "../cloud/media";
import { removeUnusedImages } from "../cloud/cleanup-images";
import { userError } from "../cloud/client";
import { ThemeOptions } from "../theme";
import { ImagePicker, Photo } from "./Media";
import Modal from "./Modal";

export default function ProfilePage({
  account,
  data,
  onImport,
  dataReady = true,
}: {
  account?: AccountRuntime;
  data: AppData;
  onImport: () => void;
  dataReady?: boolean;
}) {
  const media = useMedia();
  const profile = account?.profile;
  const [draft, setDraft] = useState(() => ({
    display_name: profile?.display_name ?? "",
    avatar: profile?.avatar ?? null,
    primary_goal: profile?.primary_goal ?? "Bienestar general",
    secondary_goals: profile?.secondary_goals ?? [],
    unit: profile?.unit ?? "kg",
  }));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [backupReady, setBackupReady] = useState(false);
  const [agreed, setAgreed] = useState(false);
  async function backup() {
    if (!dataReady) {
      setError(
        "Esperá a que se recuperen todos tus registros antes de exportar o eliminar la cuenta.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      downloadJson(
        await exportBackup(data, media.read, profile),
        `forma-mis-registros-${new Date().toISOString().slice(0, 10)}.json`,
      );
      setBackupReady(true);
      setMessage(
        "Respaldo preparado con tus registros y fotos. Conservá el archivo descargado.",
      );
    } catch (err) {
      setError(userError(err));
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!account) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !(await account.saveProfile({
          ...draft,
          display_name: draft.display_name.trim(),
          secondary_goals: draft.secondary_goals.filter(
            (g) => g !== draft.primary_goal,
          ),
        }))
      )
        throw new Error(
          "FORMA: No se confirmó el guardado del perfil. Revisá la conexión o recargá si cambió en otro dispositivo.",
        );
      setMessage("Tu perfil quedó guardado.");
      if (profile?.avatar?.id !== draft.avatar?.id && profile?.avatar)
        await removeUnusedImages(account.client, account.user.id, [
          profile.avatar,
        ]);
    } catch (err) {
      setError(userError(err));
    } finally {
      setBusy(false);
    }
  }
  async function passwordLink() {
    if (!account?.user.email) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await account.client.auth.resetPasswordForEmail(
        account.user.email,
        { redirectTo: `${window.location.origin}/restablecer` },
      );
      if (error) throw error;
      setMessage(
        "Te enviamos un enlace seguro para cambiar la contraseña. Revisá tu correo.",
      );
    } catch (err) {
      setError(userError(err));
    } finally {
      setBusy(false);
    }
  }
  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    if (
      !account ||
      !dataReady ||
      !agreed ||
      !backupReady ||
      confirmation !== "ELIMINAR"
    )
      return;
    setBusy(true);
    setError("");
    try {
      const { data: result, error } = await account.client.functions.invoke(
        "delete-account",
        { body: { password, confirmation: "ELIMINAR" } },
      );
      if (error?.context instanceof Response) {
        const details = await error.context.json().catch(() => null);
        if (typeof details?.error === "string")
          throw new Error(`FORMA: ${details.error}`);
      }
      if (error || result?.deleted !== true)
        throw new Error(
          "FORMA: No se confirmó la eliminación. Verificá la contraseña, tu conexión y que la función de eliminación esté desplegada. No vuelvas a crear la cuenta hasta comprobar el resultado.",
        );
      setPassword("");
      try {
        localStorage.removeItem(`forma-pending:${account.user.id}`);
        localStorage.removeItem(`forma-theme:${account.user.id}`);
        localStorage.removeItem(`forma-theme:${account.user.id}:pending`);
      } catch {}
      await account.signOut();
    } catch (err) {
      setError(userError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-page">
      <section className="card profile-intro">
        <Photo image={profile?.avatar} alt="Foto de perfil" variant="avatar" />
        <div>
          <span className="eyebrow">TU ESPACIO PERSONAL</span>
          <h2>{profile?.display_name || "Mi perfil"}</h2>
          <p>{account?.user.email ?? "Preferencias de este dispositivo"}</p>
          {account && (
            <span className="form-help">
              Cuenta creada el{" "}
              {new Date(account.user.created_at).toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </section>
      {!account && (
        <section className="card">
          <h2>Las cuentas todavía no están configuradas</h2>
          <p>
            Tu aplicación sigue funcionando con los datos de este dispositivo.
            Configurá la conexión de Supabase para iniciar sesión y sincronizar
            tu espacio.
          </p>
        </section>
      )}
      {account && (
        <form onSubmit={save} className="profile-form">
          <fieldset
            disabled={busy || uploading}
            className="plain-fieldset profile-grid"
          >
            <section className="card">
              <h2>
                <UserRound size={19} /> Información personal
              </h2>
              <label className="field-label">
                Nombre o apodo
                <input
                  required
                  maxLength={80}
                  autoComplete="nickname"
                  value={draft.display_name}
                  onChange={(e) =>
                    setDraft({ ...draft, display_name: e.target.value })
                  }
                />
              </label>
              <label className="field-label">
                Correo electrónico
                <input
                  type="email"
                  value={account.user.email ?? ""}
                  readOnly
                  aria-readonly="true"
                />
                <span className="form-help">
                  El correo está asociado a tu cuenta de acceso.
                </span>
              </label>
              <ImagePicker
                kind="profile"
                label="Foto de perfil · opcional"
                value={draft.avatar}
                onChange={(avatar) =>
                  setDraft({ ...draft, avatar: avatar ?? null })
                }
                onBusyChange={setUploading}
              />
            </section>
            <section className="card">
              <h2>Objetivos</h2>
              <p>No necesitás compartir medidas ni fotos corporales.</p>
              <label className="field-label">
                Objetivo principal
                <select
                  value={draft.primary_goal}
                  onChange={(e) =>
                    setDraft({ ...draft, primary_goal: e.target.value })
                  }
                >
                  {goals.map((goal) => (
                    <option key={goal}>{goal}</option>
                  ))}
                </select>
              </label>
              <fieldset className="goal-options">
                <legend>Otros objetivos · opcional</legend>
                {goals
                  .filter((goal) => goal !== draft.primary_goal)
                  .map((goal) => (
                    <label key={goal}>
                      <input
                        type="checkbox"
                        checked={draft.secondary_goals.includes(goal)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            secondary_goals: e.target.checked
                              ? [...draft.secondary_goals, goal]
                              : draft.secondary_goals.filter((g) => g !== goal),
                          })
                        }
                      />
                      {goal}
                    </label>
                  ))}
              </fieldset>
              <label className="field-label">
                Unidad de peso
                <select
                  value={draft.unit}
                  onChange={(e) =>
                    setDraft({ ...draft, unit: e.target.value as "kg" | "lb" })
                  }
                >
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="lb">Libras (lb)</option>
                </select>
                <span className="form-help">
                  Los registros conservan su carga original; la visualización se
                  convierte a la unidad elegida.
                </span>
              </label>
              <button className="primary-button" type="submit">
                {busy ? "Guardando…" : "Guardar perfil"}
              </button>
            </section>
          </fieldset>
        </form>
      )}
      <section className="card">
        <h2>Preferencias</h2>
        <ThemeOptions />
      </section>
      <section className="card">
        <h2>
          <ShieldCheck size={19} /> Cuenta y seguridad
        </h2>
        <div className="account-actions">
          {account && (
            <>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void passwordLink()}
              >
                <Mail size={17} />
                Cambiar contraseña por correo
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => setLogoutOpen(true)}
              >
                <LogOut size={17} />
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </section>
      <section className="card">
        <h2>Exportación y privacidad</h2>
        <p>Descargá una copia personal con tus registros y fotografías.</p>
        <div className="account-actions">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void backup()}
          >
            <Download size={17} />
            Exportar mis registros
          </button>
          {account && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={onImport}
            >
              <Upload size={17} />
              Importar datos locales
            </button>
          )}
        </div>
        {account && (
          <div className="privacy-danger">
            <h3>Eliminar cuenta y datos</h3>
            <p>
              Esta acción elimina tu cuenta, sus registros en la nube y sus
              fotos privadas. Requiere una copia de seguridad y volver a
              verificar tu identidad.
            </p>
            <button
              type="button"
              className="danger-link"
              disabled={busy}
              onClick={() => {
                setDeleteOpen(true);
                setBackupReady(false);
                setConfirmation("");
                setPassword("");
                setAgreed(false);
              }}
            >
              <Trash2 size={16} />
              Solicitar eliminación
            </button>
          </div>
        )}
      </section>
      {(error || account?.error) && (
        <p role="alert" className="error">
          {error || account?.error}
        </p>
      )}
      {message && (
        <p role="status" className="success-notice">
          {message}
        </p>
      )}
      {logoutOpen && (
        <Modal
          title="Cerrar sesión"
          onClose={() => {
            if (!busy) setLogoutOpen(false);
          }}
        >
          <p>
            Los registros confirmados seguirán disponibles en tu cuenta. Los
            cambios pendientes de este dispositivo conservan su copia de
            recuperación.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setLogoutOpen(false)}
            >
              Seguir acá
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void account?.signOut().catch((err) => {
                  setError(userError(err));
                  setBusy(false);
                });
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </Modal>
      )}
      {deleteOpen && (
        <Modal
          title="Confirmar eliminación de cuenta"
          onClose={() => {
            if (!busy) {
              setDeleteOpen(false);
              setPassword("");
            }
          }}
        >
          <p>
            Se eliminarán permanentemente los datos de{" "}
            <strong>{account?.user.email}</strong> en la nube. Las copias
            descargadas y los datos locales previos de este navegador se
            conservan.
          </p>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void backup()}
          >
            <Download size={17} />
            Descargar respaldo completo
          </button>
          <form onSubmit={deleteAccount}>
            <fieldset className="plain-fieldset" disabled={busy}>
              <label className="field-label">
                Contraseña actual
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="field-label">
                Escribí ELIMINAR para confirmar
                <input
                  required
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="confirmation-check">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  Guardé el respaldo descargado y entiendo que la eliminación no
                  se puede deshacer.
                </span>
              </label>
              <button
                className="primary-button danger-button"
                disabled={
                  !dataReady ||
                  !backupReady ||
                  !agreed ||
                  confirmation !== "ELIMINAR"
                }
                type="submit"
              >
                {busy
                  ? "Verificando y eliminando…"
                  : "Eliminar mi cuenta y datos"}
              </button>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </fieldset>
          </form>
        </Modal>
      )}
    </div>
  );
}
