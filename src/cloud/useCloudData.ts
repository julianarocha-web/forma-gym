import { useEffect, useRef, useState } from "react";
import { validateData, type AppData } from "../data";
import { emptyData, type WorkspaceRepository } from "./types";
import { userError } from "./client";
import { mergeImport } from "./import-data";
import { sameWorkspace } from "./repository";

type Pending = { data: AppData; revision: number; importHash?: string };
export function useCloudData(repository?: WorkspaceRepository) {
  const [data, setData] = useState(emptyData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!repository);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(!!repository);
  const [pending, setPending] = useState<Pending | null>(null);
  const state = useRef({
    data: emptyData(),
    revision: 0,
    saving: false,
    loaded: false,
  });
  const live = useRef(true);
  const pendingKey = repository ? `forma-pending:${repository.userId}` : "";
  const show = (next: AppData, revision: number) => {
    state.current = { ...state.current, data: next, revision, loaded: true };
    setData(next);
  };
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!repository) return;
    void repository
      .load()
      .then((snapshot) => {
        if (!active) return;
        show(snapshot.data, snapshot.revision);
        setBlocked(false);
        setLoading(false);
        setError("");
        try {
          const raw = localStorage.getItem(pendingKey);
          if (raw) {
            const candidate: Pending = JSON.parse(raw);
            validateData(candidate.data);
            if (!Number.isSafeInteger(candidate.revision)) throw new Error();
            setPending(candidate);
            setError(
              "Hay cambios pendientes de una conexión anterior. Revisá o descargá la copia antes de volver a guardar.",
            );
          }
        } catch {
          setError(
            "No se pudo leer una copia pendiente de esta cuenta. No la eliminamos. Revisá el almacenamiento.",
          );
          setBlocked(true);
        }
      })
      .catch((err) => {
        if (active) {
          setLoading(false);
          setBlocked(true);
          setError(userError(err));
        }
      });
    return () => {
      active = false;
    };
  }, [repository]);
  useEffect(() => {
    if (!pending) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [!!pending]);
  async function persist(candidate: Pending): Promise<boolean> {
    if (!repository || state.current.saving) return false;
    try {
      validateData(candidate.data);
    } catch {
      setError(
        "Los cambios no son válidos. Conservamos tus registros anteriores.",
      );
      return false;
    }
    state.current.saving = true;
    setSaving(true);
    setPending(candidate);
    setError("");
    // Account-scoped recovery copy. Never modifies the previous local workspace.
    try {
      localStorage.setItem(pendingKey, JSON.stringify(candidate));
    } catch {
      /* Export + beforeunload protection remain available. */
    }
    try {
      const saved = await repository.save(
        candidate.data,
        candidate.revision,
        candidate.importHash,
      );
      if (!live.current) return false;
      show(saved.data, saved.revision);
      setPending(null);
      setError(saved.warning ?? "");
      try {
        localStorage.removeItem(pendingKey);
      } catch {
        /* Reviewed on the next login. */
      }
      return true;
    } catch (err) {
      if (live.current) setError(userError(err));
      return false;
    } finally {
      state.current.saving = false;
      if (live.current) setSaving(false);
    }
  }
  function commit(next: AppData, importHash?: string): Promise<boolean> {
    if (!state.current.loaded || state.current.saving || blocked || pending)
      return Promise.resolve(false);
    return persist({
      data: structuredClone(next),
      revision: state.current.revision,
      importHash,
    });
  }
  async function refresh() {
    if (!repository || state.current.saving) return false;
    if (pending) {
      setError(
        "Primero revisá los cambios pendientes. Podés descargar una copia antes de descartarlos.",
      );
      return false;
    }
    setLoading(true);
    try {
      const saved = await repository.load();
      if (!live.current) return false;
      show(saved.data, saved.revision);
      setBlocked(false);
      setError("");
      return true;
    } catch (err) {
      if (live.current) setError(userError(err));
      return false;
    } finally {
      if (live.current) setLoading(false);
    }
  }
  async function importData(incoming: AppData, hash: string) {
    if (!repository || state.current.saving || pending) return false;
    try {
      if (await repository.imported(hash)) {
        return await refresh();
      }
      return await commit(mergeImport(state.current.data, incoming), hash);
    } catch (err) {
      setError(userError(err));
      return false;
    }
  }
  async function discardPending() {
    if (!repository || state.current.saving) return false;
    try {
      const saved = await repository.load();
      if (!live.current) return false;
      localStorage.removeItem(pendingKey);
      setPending(null);
      show(saved.data, saved.revision);
      setBlocked(false);
      setError("");
      return true;
    } catch (err) {
      setError(userError(err));
      return false;
    }
  }
  async function retry() {
    if (!pending || !repository || state.current.saving) return false;
    try {
      const actual = await repository.load();
      // Covers a lost HTTP response after the server already committed.
      if (sameWorkspace(actual.data, pending.data)) {
        show(actual.data, actual.revision);
        setPending(null);
        setBlocked(false);
        setError("");
        try {
          localStorage.removeItem(pendingKey);
        } catch {}
        return true;
      }
      if (actual.revision !== pending.revision) {
        setError(
          "Tus cambios pendientes entran en conflicto con otra versión. Descargá la copia antes de descartarlos y volver a editar.",
        );
        return false;
      }
      return await persist(pending);
    } catch (err) {
      setError(userError(err));
      return false;
    }
  }
  return {
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
  };
}
