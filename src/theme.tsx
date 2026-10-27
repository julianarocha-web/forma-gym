import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";
import type { ThemePreference } from "./cloud/types";

type ThemeState = {
  theme: "light" | "dark";
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
  message: string;
};
const ThemeContext = createContext<ThemeState>({
  theme: "light",
  preference: null,
  setPreference: () => {},
  message: "",
});
export const useTheme = () => useContext(ThemeContext);
const systemTheme = (): "dark" | "light" =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
function readPreference(key: string): ThemePreference {
  try {
    const value = localStorage.getItem(key);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}
export function ThemeProvider({
  children,
  accountId,
  remotePreference,
  onPersist,
}: {
  children: ReactNode;
  accountId?: string;
  remotePreference?: ThemePreference;
  onPersist?: (theme: ThemePreference) => Promise<boolean>;
}) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readPreference("forma-theme"),
  );
  const [system, setSystem] = useState(systemTheme);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const update = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    generation.current++;
  }, [accountId]);
  useLayoutEffect(() => {
    const key = accountId ? `forma-theme:${accountId}` : "forma-theme";
    let pending = false;
    try {
      pending =
        !!accountId && localStorage.getItem(`${key}:pending`) === "true";
    } catch {}
    if (pending) {
      setPreference(readPreference(key));
      setMessage("Tema guardado en este dispositivo. Falta sincronizarlo.");
    } else {
      const restored =
        accountId && remotePreference !== undefined
          ? remotePreference
          : readPreference(key);
      setPreference(restored);
      if (accountId && remotePreference !== undefined) {
        try {
          localStorage.setItem(key, restored ?? "system");
          localStorage.setItem("forma-theme", restored ?? "system");
        } catch {}
      }
      setMessage("");
    }
  }, [accountId, remotePreference]);
  const theme = preference ?? system;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#111320" : "#f7f8fc");
  }, [theme]);
  function choose(value: ThemePreference) {
    const request = ++generation.current;
    setPreference(value);
    setMessage("");
    const key = accountId ? `forma-theme:${accountId}` : "forma-theme";
    try {
      localStorage.setItem("forma-theme", value ?? "system");
      localStorage.setItem(key, value ?? "system");
      if (accountId) localStorage.setItem(`${key}:pending`, "true");
    } catch {
      setMessage(
        "El tema cambió, pero no se pudo guardar la preferencia en este navegador.",
      );
    }
    if (accountId && onPersist)
      void onPersist(value)
        .then((saved) => {
          if (request !== generation.current) return;
          if (saved) {
            try {
              localStorage.removeItem(`${key}:pending`);
            } catch {}
            setMessage("Preferencia de tema sincronizada.");
          } else
            setMessage(
              "Tema guardado en este dispositivo. No se pudo sincronizar: volvé a elegirlo para reintentar.",
            );
        })
        .catch(() => {
          if (request === generation.current)
            setMessage(
              "No se pudo sincronizar el tema. Tu elección sigue activa en este dispositivo.",
            );
        });
  }
  return (
    <ThemeContext.Provider
      value={{ theme, preference, setPreference: choose, message }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export function ThemeToggle() {
  const { theme, setPreference } = useTheme();
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={
        theme === "light" ? "Activar modo oscuro" : "Activar modo claro"
      }
      title={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
      onClick={() => setPreference(theme === "light" ? "dark" : "light")}
    >
      {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
export function ThemeOptions() {
  const { preference, setPreference, message } = useTheme();
  return (
    <fieldset className="theme-options">
      <legend>Apariencia</legend>
      <div>
        {(
          [
            ["light", "Claro"],
            ["dark", "Oscuro"],
            [null, "Sistema"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            type="button"
            className="secondary-button"
            aria-pressed={preference === value}
            onClick={() => setPreference(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {message && (
        <p role="status" className="form-help">
          {message}
        </p>
      )}
    </fieldset>
  );
}
