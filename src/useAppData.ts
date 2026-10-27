import { useEffect, useState } from "react";
import { useCloudData } from "./cloud/useCloudData";
import type { WorkspaceRepository } from "./cloud/types";
import { saveLocalSessionCopies } from "./session-changes";
import {
  initialData,
  loadData,
  STORAGE_KEY,
  validateData,
  type AppData,
} from "./data";
export function useAppData(repository?: WorkspaceRepository) {
  const cloud = useCloudData(repository);
  const [loaded] = useState(() => {
    try {
      return {
        data: repository ? initialData() : loadData(localStorage),
        error: "",
      };
    } catch (error) {
      return {
        data: initialData(),
        error: `No se pudieron leer los datos guardados. No se sobrescribirá el almacenamiento. ${error instanceof Error ? error.message : ""}`,
      };
    }
  });
  const [data, setData] = useState(loaded.data);
  const [error, setError] = useState(loaded.error);
  useEffect(() => {
    if (!repository && !loaded.error) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded.data));
      } catch {
        setError(
          "No se pudo guardar. Revisá el espacio y los permisos del navegador.",
        );
      }
    }
  }, [loaded]);
  function commit(next: AppData) {
    if (loaded.error) return false;
    try {
      validateData(next);
      saveLocalSessionCopies(data, next, localStorage);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setData(next);
      setError("");
      return true;
    } catch (e) {
      setError(
        `No se guardaron los cambios. ${e instanceof Error ? e.message : "Revisá el espacio disponible."}`,
      );
      return false;
    }
  }
  return repository
    ? cloud
    : {
        data,
        commit,
        error,
        blocked: !!loaded.error,
        loading: false,
        saving: false,
        pending: null,
        refresh: async () => false,
        importData: async () => false,
        discardPending: async () => false,
        retry: async () => false,
      };
}
