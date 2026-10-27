import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_SUPABASE_");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (key && !key.startsWith("sb_publishable_"))
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY debe ser una clave publishable. Se bloqueó la compilación para evitar exponer una clave secreta.",
    );
  return { plugins: [react(), tailwindcss()], envPrefix: "VITE_SUPABASE_" };
});
