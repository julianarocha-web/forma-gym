import type { AppData, Session } from "./data";
import { canonical } from "./cloud/import-data";

export function sessionChanges(before: AppData, after: AppData) {
  return before.sessions.filter((s) => {
    const next = after.sessions.find((row) => row.id === s.id);
    return !next || canonical(s) !== canonical(next);
  });
}
export function saveLocalSessionCopies(
  before: AppData,
  after: AppData,
  storage: Storage,
) {
  const changed = sessionChanges(before, after);
  if (!changed.length) return;
  const key = "forma-session-corrections-v1";
  const raw = storage.getItem(key);
  const copies: { savedAt: string; before: Session; after: Session | null }[] =
    raw ? JSON.parse(raw) : [];
  if (!Array.isArray(copies))
    throw new Error(
      "No se pudo conservar una copia del registro anterior. No se guardó la corrección.",
    );
  storage.setItem(
    key,
    JSON.stringify([
      ...copies,
      ...changed.map((s) => ({
        savedAt: new Date().toISOString(),
        before: s,
        after: after.sessions.find((row) => row.id === s.id) ?? null,
      })),
    ]),
  );
}
