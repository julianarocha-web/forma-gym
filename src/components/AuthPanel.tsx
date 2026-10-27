import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  Mail,
  ShieldCheck,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ThemeToggle } from "../theme";
import { userError } from "../cloud/client";
export type AuthMode = "login" | "signup" | "forgot" | "reset";
export default function AuthPanel({
  client,
  mode,
  onMode,
  canReset = false,
  authError = "",
}: {
  client: SupabaseClient;
  mode: AuthMode;
  onMode: (mode: AuthMode) => void;
  canReset?: boolean;
  authError?: string;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(authError);
  const [message, setMessage] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const titles = {
    login: "Volvé a tu espacio.",
    signup: "Tu próximo paso empieza acá.",
    forgot: "Recuperá tu acceso.",
    reset: "Elegí una nueva contraseña.",
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (
      (mode === "signup" || mode === "reset") &&
      (password.length < 8 || password !== repeat)
    ) {
      setError("Usá al menos 8 caracteres y repetí la misma contraseña.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const result = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error) throw result.error;
      } else if (mode === "signup") {
        const result = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (result.error) throw result.error;
        setPassword("");
        setRepeat("");
        setMessage(
          "Revisá tu correo para confirmar la cuenta. Si ya tenías una, podés iniciar sesión o recuperar el acceso.",
        );
      } else if (mode === "forgot") {
        const result = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/restablecer`,
        });
        if (result.error) throw result.error;
        setMessage(
          "Si hay una cuenta asociada, recibirás un enlace para restablecer la contraseña. Revisá también el correo no deseado.",
        );
      } else {
        if (!canReset)
          throw new Error(
            "FORMA: Abrí el enlace que recibiste por correo para restablecer la contraseña.",
          );
        const result = await client.auth.updateUser({ password });
        if (result.error) throw result.error;
        setPassword("");
        setRepeat("");
        await client.auth.signOut({ scope: "global" });
        setMessage("Contraseña actualizada. Ya podés volver a iniciar sesión.");
        setResetDone(true);
        try {
          sessionStorage.removeItem("forma-password-recovery");
        } catch {}
      }
    } catch (err) {
      setError(userError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <header className="auth-header">
        <a className="auth-brand" href="/" aria-label="Forma, inicio">
          <Activity size={27} />
          forma<span>.</span>
        </a>
        <ThemeToggle />
      </header>
      <div className="auth-layout">
        <section className="auth-story">
          <span className="eyebrow">TU BIENESTAR, A TU RITMO</span>
          <h1>
            Un espacio para
            <br />
            <em>tu constancia.</em>
          </h1>
          <p>
            Tus rutinas, tus registros y tu recorrido. En el celular y en la
            compu, cuando lo necesites.
          </p>
          <div className="auth-reassurance">
            <ShieldCheck size={21} />
            <span>
              Tus entrenamientos son privados.
              <br />
              Vos elegís cómo construir tu progreso.
            </span>
          </div>
        </section>
        <section className="card auth-card" aria-busy={busy}>
          <span className="eyebrow">FORMA. · TU ESPACIO PERSONAL</span>
          <h2>{titles[mode]}</h2>
          <p>
            {mode === "login"
              ? "Ingresá para encontrar tus entrenamientos."
              : mode === "signup"
                ? "Creá tu cuenta y llevá tu progreso con vos."
                : mode === "forgot"
                  ? "Te enviaremos un enlace seguro a tu correo."
                  : "El enlace es personal y tiene una duración limitada."}
          </p>
          {resetDone ? (
            <p className="success-notice" role="status">
              {message}
            </p>
          ) : mode === "reset" && !canReset && !message ? (
            <div className="error" role="alert">
              El enlace no es válido o venció. Solicitá uno nuevo.
              <button
                type="button"
                className="text-link"
                onClick={() => onMode("forgot")}
              >
                Solicitar otro enlace
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <fieldset disabled={busy} className="plain-fieldset">
                {mode === "signup" && (
                  <label className="field-label">
                    Cómo querés que te llamemos
                    <input
                      required
                      maxLength={80}
                      autoComplete="nickname"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre o apodo"
                    />
                  </label>
                )}
                {mode !== "reset" && (
                  <label className="field-label">
                    Correo electrónico
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vos@ejemplo.com"
                    />
                  </label>
                )}
                {mode !== "forgot" && (
                  <label className="field-label">
                    {mode === "reset" ? "Nueva contraseña" : "Contraseña"}
                    <input
                      type="password"
                      required
                      minLength={mode === "login" ? undefined : 8}
                      maxLength={128}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                )}
                {(mode === "signup" || mode === "reset") && (
                  <label className="field-label">
                    Repetir contraseña
                    <input
                      type="password"
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      aria-describedby="auth-password-help"
                      value={repeat}
                      onChange={(e) => setRepeat(e.target.value)}
                    />
                  </label>
                )}
                {(mode === "signup" || mode === "reset") && (
                  <p className="form-help" id="auth-password-help">
                    Al menos 8 caracteres. Elegí una contraseña única.
                  </p>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="success-notice" role="status">
                    <Mail size={18} />
                    {message}
                  </p>
                )}
                <button className="primary-button auth-submit" type="submit">
                  {busy
                    ? "Un momento…"
                    : mode === "login"
                      ? "Iniciar sesión"
                      : mode === "signup"
                        ? "Crear cuenta"
                        : mode === "forgot"
                          ? "Enviar enlace"
                          : "Guardar contraseña"}
                  <ArrowRight size={18} />
                </button>
              </fieldset>
            </form>
          )}
          <div className="auth-links">
            {mode === "login" ? (
              <>
                <button className="text-link" onClick={() => onMode("forgot")}>
                  Olvidé mi contraseña
                </button>
                <span>
                  ¿Tu primera vez acá?{" "}
                  <button
                    className="text-link"
                    onClick={() => onMode("signup")}
                  >
                    Crear cuenta
                  </button>
                </span>
              </>
            ) : (
              <button className="text-link" onClick={() => onMode("login")}>
                <ArrowLeft size={16} />
                Volver a iniciar sesión
              </button>
            )}
          </div>
          <p className="auth-local-note">
            Si entrenabas en este navegador, tus datos locales se conservan.
            Podrás revisarlos e importarlos después de ingresar.
          </p>
        </section>
      </div>
    </main>
  );
}
