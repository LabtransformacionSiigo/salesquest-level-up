import { requireRole } from "../_shared/admin-auth.ts";
// Sincroniza auth.users con gerentes.email para gerentes activos.
// Regla: no reescribir emails de cuentas existentes; solo vincular exacto o crear faltante.
// Procesa en LOTES (offset/limit) para evitar IDLE_TIMEOUT (150s).
// El cliente debe iterar llamando con nextOffset hasta done=true.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PASSWORD = "SiigoArena2026!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await requireRole(req, ["admin"]);
  if (_guard.error) return _guard.error;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* default */ }
  const offset: number = Math.max(0, Number(body?.offset ?? 0));
  const limit: number = Math.min(Math.max(1, Number(body?.limit ?? 100)), 200);

  // 1) Total de gerentes activos
  const { count: total } = await sb
    .from("gerentes")
    .select("id", { count: "exact", head: true })
    .eq("activo", true)
    .not("email", "is", null);

  // 2) Lote actual
  const { data: gerentes, error: gErr } = await sb
    .from("gerentes")
    .select("id, email, nombre, user_id")
    .eq("activo", true)
    .not("email", "is", null)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (gErr) {
    return new Response(JSON.stringify({ error: gErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let creados = 0;
  let actualizados = 0;
  let errores = 0;
  const errorSamples: any[] = [];

  // Helper: buscar usuario en auth por email (paginando)
  const findAuthUserByEmail = async (email: string): Promise<string | null> => {
    const target = email.toLowerCase();
    for (let page = 1; page <= 50; page++) {
      const { data: list, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return null;
      const users = list?.users ?? [];
      const found = users.find((u: any) => (u.email || "").toLowerCase() === target);
      if (found) return found.id;
      if (users.length < 200) break;
    }
    return null;
  };

  for (const g of gerentes ?? []) {
    if (!g.email) continue;
    try {
      const email = String(g.email).toLowerCase().trim();
      const existingId = await findAuthUserByEmail(email);
      if (existingId) {
        if (existingId !== g.user_id) {
          await sb.from("gerentes").update({ user_id: existingId }).eq("id", g.id);
        }
        await sb.auth.admin.updateUserById(existingId, {
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { name: g.nombre },
        });
        actualizados++;
        continue;
      }

      const { data: user, error } = await sb.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: g.nombre },
      });
      if (!error && user?.user?.id) {
        await sb.from("gerentes").update({ user_id: user.user.id }).eq("id", g.id);
        creados++;
      } else {
        errores++;
        if (errorSamples.length < 10) {
          errorSamples.push({ id: g.id, nombre: g.nombre, email, error: error?.message ?? "create_failed" });
        }
      }
    } catch (e: any) {
      errores++;
      if (errorSamples.length < 10) errorSamples.push({ id: g.id, error: e?.message || String(e) });
    }
  }

  const processedNow = gerentes?.length ?? 0;
  const done = processedNow < limit;
  const nextOffset = done ? null : offset + limit;

  return new Response(JSON.stringify({
    success: true,
    offset,
    limit,
    processedNow,
    total: total ?? 0,
    creados,
    actualizados,
    errores,
    errorSamples,
    nextOffset,
    done,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
