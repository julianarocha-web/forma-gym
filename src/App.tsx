import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import AppShell from "./AppShell";
import AuthPanel, { type AuthMode } from "./components/AuthPanel";
import { cloudConfigured, configError, supabase } from "./cloud/client";
import { useAuthSession, useAccount } from "./cloud/auth";
import { createCloudMedia, localMedia, MediaProvider } from "./cloud/media";
import { ThemeProvider, ThemeToggle } from "./theme";
import { UnitProvider } from "./units";

const routes: Record<AuthMode, string> = {
  login: "/ingresar",
  signup: "/crear-cuenta",
  forgot: "/recuperar",
  reset: "/restablecer",
};
export default function App() {
  const auth = useAuthSession(supabase);
  const [path, setPath] = useState(() => window.location.pathname);
  const accountState = useAccount(
    supabase,
    path === "/restablecer" || auth.recovery ? null : auth.session,
  );
  const account = accountState.account;
  const media = useMemo(
    () =>
      supabase && auth.session?.user.id
        ? createCloudMedia(supabase, auth.session.user.id)
        : localMedia,
    [auth.session?.user.id],
  );
  function navigate(mode: AuthMode) {
    const next = routes[mode];
    window.history.pushState({}, "", next);
    setPath(next);
  }
  useEffect(() => {
    const listener = () => setPath(window.location.pathname);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  useEffect(() => {
    if (
      auth.session &&
      !auth.recovery &&
      path !== "/restablecer" &&
      (Object.values(routes).includes(path) || path === "/auth/callback")
    ) {
      window.history.replaceState({}, "", "/");
      setPath("/");
    }
  }, [auth.session?.user.id, path, auth.recovery]);
  const mode: AuthMode =
    path === "/crear-cuenta"
      ? "signup"
      : path === "/recuperar"
        ? "forgot"
        : path === "/restablecer" || auth.recovery
          ? "reset"
          : "login";
  const isLocal = !cloudConfigured && !import.meta.env?.PROD;
  return (
    <ThemeProvider
      accountId={auth.session?.user.id}
      remotePreference={account?.profile.theme}
      onPersist={
        account ? (value) => account.saveProfile({ theme: value }) : undefined
      }
    >
      <MediaProvider service={media}>
        <UnitProvider unit={account?.profile.unit ?? "kg"}>
          {isLocal ? (
            <>
              <div className="local-mode-note">
                Modo local · Las cuentas todavía no están configuradas.
              </div>
              <AppShell />
            </>
          ) : configError || !supabase ? (
            <main className="auth-page">
              <header className="auth-header">
                <span className="auth-brand">
                  <Activity />
                  forma.
                </span>
                <ThemeToggle />
              </header>
              <section className="card setup-card">
                <h1>Estamos preparando tu espacio.</h1>
                <p>
                  {configError ||
                    "Falta configurar la conexión de cuentas. Revisá las instrucciones de instalación de Forma."}
                </p>
              </section>
            </main>
          ) : auth.loading ? (
            <main className="auth-page">
              <section className="card setup-card" role="status">
                <Activity size={30} />
                <h1>Volviendo a tu espacio…</h1>
                <p>Estamos restaurando tu sesión.</p>
              </section>
            </main>
          ) : !auth.session || mode === "reset" ? (
            <AuthPanel
              key={mode}
              client={supabase}
              mode={mode}
              onMode={navigate}
              canReset={!!auth.session && auth.recovery}
              authError={auth.error}
            />
          ) : account ? (
            <AppShell key={account.user.id} account={account} />
          ) : (
            <main className="auth-page">
              <section
                className="card setup-card"
                aria-busy={accountState.loading}
              >
                <h1>
                  {accountState.loading
                    ? "Preparando tu espacio…"
                    : "No pudimos abrir tu cuenta todavía."}
                </h1>
                <p role={accountState.error ? "alert" : "status"}>
                  {accountState.error ||
                    "Estamos consultando tu perfil y tus preferencias."}
                </p>
                <div className="account-actions">
                  <button
                    className="secondary-button"
                    disabled={accountState.loading}
                    onClick={accountState.retry}
                  >
                    <RefreshCw size={17} />
                    Volver a intentar
                  </button>
                  <button
                    className="text-link"
                    onClick={() =>
                      void supabase!.auth.signOut({ scope: "local" })
                    }
                  >
                    Cerrar sesión
                  </button>
                </div>
              </section>
            </main>
          )}
        </UnitProvider>
      </MediaProvider>
    </ThemeProvider>
  );
}
