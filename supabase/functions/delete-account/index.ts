import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const url = Deno.env.get("SUPABASE_URL")!;
const publicKey =
  Deno.env.get("FORMA_SUPABASE_PUBLISHABLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY")!;
const secret =
  Deno.env.get("FORMA_SUPABASE_SECRET_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const origins = (
  Deno.env.get("FORMA_ALLOWED_ORIGINS") ||
  "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((value) => value.trim());
const bucket = "forma-private";
Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "Content-Type": "application/json",
    Vary: "Origin",
    ...(origins.includes(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.includes(origin))
    return respond(403, { error: "Origen no permitido." });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return respond(405, { error: "Método no permitido." });
  if (!url || !publicKey || !secret)
    return respond(503, {
      error: "La eliminación de cuentas todavía no está configurada.",
    });
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer "))
    return respond(401, { error: "Iniciá sesión para continuar." });
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: identityError,
  } = await admin.auth.getUser(bearer.slice(7));
  if (identityError || !user?.email)
    return respond(401, { error: "La sesión venció." });
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 8192)
      return respond(413, { error: "Solicitud no válida." });
    const body = await request.json();
    if (
      body.confirmation !== "ELIMINAR" ||
      typeof body.password !== "string" ||
      !body.password ||
      body.password.length > 128
    )
      return respond(400, {
        error: "Confirmá la eliminación y tu contraseña actual.",
      });
    const verifier = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: reauth, error: passwordError } =
      await verifier.auth.signInWithPassword({
        email: user.email,
        password: body.password,
      });
    if (passwordError || reauth.user?.id !== user.id)
      return respond(403, { error: "No se pudo verificar tu identidad." });
    if (user.factors?.some((factor) => factor.status === "verified"))
      return respond(403, {
        error:
          "Tu cuenta usa segundo factor. Se necesita un flujo adicional antes de eliminarla; no se eliminó nada.",
      });
    const paths: string[] = [];
    async function collect(prefix: string, depth = 0) {
      if (
        depth > 8 ||
        !prefix.startsWith(user!.id) ||
        prefix.split("/").some((part) => part === ".." || part === "")
      )
        throw new Error("Ruta no válida.");
      let offset = 0;
      while (true) {
        const { data, error } = await admin.storage
          .from(bucket)
          .list(prefix, {
            limit: 1000,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
        if (error) throw error;
        for (const item of data) {
          const path = `${prefix}/${item.name}`;
          if (!path.startsWith(`${user!.id}/`))
            throw new Error("Ruta no válida.");
          if (item.id) paths.push(path);
          else await collect(path, depth + 1);
        }
        if (data.length < 1000) break;
        offset += 1000;
      }
    }
    await collect(user.id);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage
        .from(bucket)
        .remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
    // Cascades remove only this user's relational data. Storage is removed via its API.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return respond(200, { deleted: true });
  } catch {
    // Never log request bodies, passwords, tokens or account details.
    return respond(500, {
      error:
        "No se pudo completar la eliminación. Revisá tu cuenta antes de volver a intentar.",
    });
  }
});
