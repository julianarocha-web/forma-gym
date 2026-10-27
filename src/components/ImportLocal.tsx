import { useEffect, useState } from "react";
import { Download, Upload, CheckCheck } from "lucide-react";
import type { AppData } from "../data";
import type { AccountRuntime } from "../cloud/types";
import type { ImageRef } from "../media";
import { readImageBlob } from "../media";
import {
  inspectLocal,
  exportBackup,
  downloadJson,
  migrateImages,
  parseBackup,
  mergeImport,
  legacyKeys,
} from "../cloud/import-data";
import { userError } from "../cloud/client";
import Modal from "./Modal";

type Source = {
  data: AppData;
  hash: string;
  read: (ref: ImageRef) => Promise<Blob | undefined>;
};
export default function ImportLocal({
  account,
  current,
  onImport,
  onClose,
}: {
  account: AccountRuntime;
  current: AppData;
  onImport: (data: AppData, hash: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [backedUp, setBackedUp] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);
  const [already, setAlready] = useState(false);
  useEffect(() => {
    let live = true;
    void inspectLocal()
      .then(async (local) => {
        if (!live) return;
        if (local) {
          setSource({ ...local, read: (ref) => readImageBlob(ref.id) });
          const exists = await account.repository.imported(local.hash);
          if (live) setAlready(exists);
        }
      })
      .catch((err) => {
        if (live)
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron leer los datos locales.",
          );
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [account.user.id]);
  async function backup() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      downloadJson(
        await exportBackup(source.data, source.read),
        `forma-respaldo-local-${new Date().toISOString().slice(0, 10)}.json`,
      );
      setBackedUp(true);
    } catch (err) {
      setError(userError(err));
    } finally {
      setBusy(false);
    }
  }
  async function runImport() {
    if (!source || !confirmed || !backedUp) return;
    setBusy(true);
    setError("");
    try {
      if (await account.repository.imported(source.hash)) {
        setAlready(true);
        return;
      }
      // Check conflicts before uploading anything. Only image refs change afterward.
      mergeImport(current, source.data);
      const migrated = await migrateImages(
        source.data,
        account.client,
        account.user.id,
        source.read,
      );
      if (await onImport(migrated, source.hash)) setDone(true);
      else
        setError(
          "No se confirmó la importación. Revisá el mensaje de guardado y la copia pendiente; tus datos locales siguen intactos.",
        );
    } catch (err) {
      setError(userError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Importar tus datos"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="form-help">
        Cuenta de destino: <strong>{account.user.email}</strong>. No se borrará
        la copia local de este navegador.
      </p>
      {done || already ? (
        <div className="success-notice" role="status">
          <CheckCheck size={24} />
          <div>
            <strong>
              {already
                ? "Estos datos ya están importados."
                : "Importación confirmada en la nube."}
            </strong>
            <p>
              La copia local se conserva y no se volvieron a crear registros.
            </p>
          </div>
        </div>
      ) : (
        <>
          <label className="field-label">
            También podés elegir un respaldo de Forma.
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setBackedUp(false);
                setConfirmed(false);
                setAlready(false);
                setError("");
                void parseBackup(file)
                  .then(async (parsed) => {
                    setSource(parsed);
                    setAlready(await account.repository.imported(parsed.hash));
                  })
                  .catch((err) => {
                    setSource(null);
                    setError(userError(err));
                  })
                  .finally(() => setBusy(false));
              }}
            />
          </label>
          {source ? (
            <>
              <div className="import-summary">
                <div>
                  <strong>{source.data.catalog.length}</strong>
                  <span>Ejercicios</span>
                </div>
                <div>
                  <strong>{source.data.routines.length}</strong>
                  <span>Rutinas</span>
                </div>
                <div>
                  <strong>{source.data.sessions.length}</strong>
                  <span>Registros</span>
                </div>
                <div>
                  <strong>{source.data.plans.length}</strong>
                  <span>Fechas planificadas</span>
                </div>
              </div>
              <p className="form-help">
                Se conservarán las series, cargas, repeticiones, fechas y
                borradores. Los conflictos se informan antes de sobrescribir
                cualquier dato.
              </p>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => void backup()}
              >
                <Download size={17} />
                {backedUp
                  ? "Descargar otra copia"
                  : "1. Descargar copia de seguridad"}
              </button>
              <label className="confirmation-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  Confirmo que estos datos son míos, que quiero importarlos a{" "}
                  <strong>{account.user.email}</strong> y que guardé la copia
                  descargada.
                </span>
              </label>
              <button
                type="button"
                className="primary-button"
                disabled={busy || !backedUp || !confirmed}
                onClick={() => void runImport()}
              >
                <Upload size={17} />
                {busy ? "Importando y verificando…" : "2. Importar a mi cuenta"}
              </button>
            </>
          ) : (
            !busy && (
              <p className="empty-state">
                No encontramos datos locales disponibles. Podés seleccionar un
                respaldo.
              </p>
            )
          )}
        </>
      )}
      {busy && (
        <p role="status" className="form-help">
          Un momento, estamos revisando la información…
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="text-link"
            onClick={() =>
              downloadJson(
                Object.fromEntries(
                  legacyKeys.map((key) => [key, localStorage.getItem(key)]),
                ),
                "forma-copia-original-sin-modificar.json",
              )
            }
          >
            Descargar los datos locales originales sin modificar
          </button>
        </div>
      )}
    </Modal>
  );
}
