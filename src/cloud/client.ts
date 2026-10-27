import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function checkPublicConfig(url: string, key: string): string {
  if (!url && !key) return "";
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      )
    )
      throw new Error();
    if (!key.startsWith("sb_publishable_")) throw new Error();
    if (key.includes("REPLACE_ME") || url.includes("YOUR_PROJECT"))
      throw new Error();
    return "";
  } catch {
    return "La conexión de cuentas no está configurada correctamente. Usá la URL del proyecto y su clave pública publishable; nunca una clave secreta.";
  }
}
const url = String(import.meta.env?.VITE_SUPABASE_URL ?? "").trim();
const key = String(import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
export const configError = checkPublicConfig(url, key);
export const cloudConfigured = !!(url || key);
export const supabase: SupabaseClient | null =
  url && key && !configError
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          storageKey: "forma-auth",
        },
      })
    : null;

export function userError(error: unknown): string {
  const value = error as { code?: string; message?: string };
  const messages: Record<string, string> = {
    invalid_credentials: "El correo o la contraseña no son correctos.",
    email_not_confirmed: "Confirmá tu correo antes de ingresar.",
    user_already_exists:
      "No se pudo crear la cuenta. Probá iniciar sesión o recuperar tu contraseña.",
    weak_password: "Elegí una contraseña más segura, de al menos 8 caracteres.",
    same_password: "Elegí una contraseña diferente de la actual.",
    over_email_send_rate_limit:
      "Esperá unos minutos antes de solicitar otro correo.",
    over_request_rate_limit:
      "Hubo demasiados intentos. Esperá unos minutos y volvé a intentar.",
    otp_expired: "El enlace venció o ya fue utilizado. Solicitá uno nuevo.",
    session_not_found: "La sesión venció. Volvé a iniciar sesión.",
    PGRST202:
      "Falta configurar la base de datos. Ejecutá las migraciones de Forma. en Supabase.",
    "42P01": "Falta configurar la base de datos de Forma. en Supabase.",
    "42501": "No tenés permiso para realizar esta operación.",
    FORMA_CONFLICT:
      "Los datos cambiaron en otro dispositivo. Conservamos tus cambios pendientes: descargalos y actualizá antes de volver a guardar.",
  };
  if (value?.code && messages[value.code]) return messages[value.code];
  if (value?.message?.startsWith("FORMA:"))
    return value.message.slice(6).trim();
  if (value?.message?.includes("FORMA_CONFLICT"))
    return messages.FORMA_CONFLICT;
  return "No se pudo completar la operación. Revisá tu conexión y volvé a intentar. Tus datos anteriores se conservan.";
}
