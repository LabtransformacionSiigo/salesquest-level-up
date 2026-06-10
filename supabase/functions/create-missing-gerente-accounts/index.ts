import { requireRole } from "../_shared/admin-auth.ts";
// Crea cuentas en Auth para gerentes activos que NO tienen user_id.
// Procesa por lotes (offset/limit). NO modifica usuarios existentes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "SiigoArena2026!";

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
  const limit: number = Math.min(Math.max(1, Number(body?.limit ?? 200)), 500);
  const password: string = String(body?.password || DEFAULT_PASSWORD);

  // Gerentes activos sin user_id, con email válido
  const { data: gerentes, error: qErr } = await sb
    .from("gerentes")
    .select("id, email, nombre")
    .eq("activo", true)
    .is("user_id", null)
    .not("email", "is", null)
    .not("email", "like", "emp-%")
    .order("nombre", { ascending: true })
    .range(offset, offset + limit - 1);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const total_processed = (gerentes || []).length;
  let created = 0;
  let linked_existing = 0;
  let errors = 0;
  const errorSamples: any[] = [];

  for (const g of gerentes || []) {
    try {
      const email = String(g.email).toLowerCase().trim();
      if (!email) { errors++; continue; }

      // Intentar crear
      const { data: created_user, error: cErr } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: g.nombre },
      });

      let userId: string | null = created_user?.user?.id ?? null;

      if (cErr) {
        // Si ya existe en Auth, vincular sin tocar password
        const msg = (cErr.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          // Buscar paginando hasta encontrar
          let found: any = null;
          for (let page = 1; page <= 50 && !found; page++) {
            const { data: list } = await sb.auth.admin.listUsers({ page, perPage: 200 });
            if (!list?.users?.length) break;
            found = list.users.find((u: any) => (u.email || "").toLowerCase() === email);
            if (list.users.length < 200) break;
          }
          if (found) {
            userId = found.id;
            linked_existing++;
          } else {
            errors++;
            if (errorSamples.length < 10) errorSamples.push({ id: g.id, email, error: cErr.message });
            continue;
          }
        } else {
          errors++;
          if (errorSamples.length < 10) errorSamples.push({ id: g.id, email, error: cErr.message });
          continue;
        }
      } else {
        created++;
      }

      if (userId) {
        const { error: upErr } = await sb.from("gerentes").update({ user_id: userId }).eq("id", g.id);
        if (upErr) {
          errors++;
          if (errorSamples.length < 10) errorSamples.push({ id: g.id, email, error: `link: ${upErr.message}` });
        }
      }
    } catch (e: any) {
      errors++;
      if (errorSamples.length < 10) errorSamples.push({ id: g.id, email: g.email, error: e?.message || String(e) });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    offset,
    limit,
    total_processed,
    created,
    linked_existing,
    errors,
    nextOffset: total_processed === limit ? offset + limit : null,
    errorSamples,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
