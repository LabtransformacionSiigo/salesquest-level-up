// Shared admin/role JWT verification for edge functions.
// Usage:
//   const guard = await requireRole(req, ["admin"]);
//   if (guard.error) return guard.error;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function unauthorized(msg = "Unauthorized") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function forbidden(msg = "Forbidden") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type Role = "admin" | "especialista" | "director" | "aprobador" | "asesor";

export async function requireRole(
  req: Request,
  allowedRoles: Role[] = ["admin"],
  opts: { allowCronSecret?: boolean } = {},
): Promise<
  | { error: Response; user?: undefined }
  | { error?: undefined; user: { id: string; email?: string }; viaCron?: boolean }
> {
  // Optional shared-secret bypass for Supabase cron / internal orchestrators.
  if (opts.allowCronSecret) {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (cronSecret && provided && provided === cronSecret) {
      return { user: { id: "cron" }, viaCron: true };
    }
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: unauthorized("Missing bearer token") };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: uErr } = await userClient.auth.getUser();
  if (uErr || !userData?.user) return { error: unauthorized("Invalid token") };

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRows, error: rErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (rErr) return { error: forbidden("Role lookup failed") };

  const userRoles = (roleRows ?? []).map((r: any) => r.role as string);
  const ok = userRoles.some((r) => allowedRoles.includes(r as Role));
  if (!ok) return { error: forbidden(`Requires one of: ${allowedRoles.join(", ")}`) };

  return { user: { id: userData.user.id, email: userData.user.email ?? undefined } };
}
