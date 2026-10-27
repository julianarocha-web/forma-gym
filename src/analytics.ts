import type { BeforeSendEvent } from "@vercel/analytics";

const publicPaths = new Set([
  "/",
  "/ingresar",
  "/crear-cuenta",
  "/recuperar",
  "/restablecer",
  "/auth/callback",
]);

// Only static page views are allowed; never forward custom event payloads.
export function sanitizeAnalyticsEvent(event: BeforeSendEvent) {
  if (event.type !== "pageview") return null;
  try {
    const url = new URL(event.url);
    if (!publicPaths.has(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    url.username = "";
    url.password = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
