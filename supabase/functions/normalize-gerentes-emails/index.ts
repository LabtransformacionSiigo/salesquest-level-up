// Sincroniza auth.users con gerentes.email para TODOS los gerentes activos.
// - Si el gerente tiene user_id: actualiza email + password en auth.
// - Si no tiene user_id: crea cuenta en auth y vincula. Si el email ya existe
//   en auth, busca y vincula sin duplicar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PASSWORD = "SiigoArena2026!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1) Traer TODOS los gerentes activos con email
  const { data: gerentes, error: gErr } = await sb
    .from("gerentes")
    .select("id, email, nombre, canal, pais, user_id")
    .eq("activo", true)
    .not("email", "is", null)
    .limit(5000);

  if (gErr) {
    return new Response(JSON.stringify({ error: gErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2) Pre-cargar todos los usuarios de auth (paginado) para resolver colisiones
  // sin llamar a listUsers en cada iteración.
  const authByEmail = new Map<string, string>(); // email lower -> user_id
  {
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: list, error: lErr } = await sb.auth.admin.listUsers({ page, perPage });
      if (lErr) break;
      const users = list?.users ?? [];
      for (const u of users) {
        if (u.email) authByEmail.set(u.email.toLowerCase(), u.id);
      }
      if (users.length < perPage) break;
      page++;
      if (page > 50) break; // safety
    }
  }

  let creados = 0;
  let actualizados = 0;
  let errores = 0;
  const errorSamples: any[] = [];

  for (const g of gerentes ?? []) {
    if (!g.email) continue;
    const emailLower = String(g.email).toLowerCase();

    try {
      if (g.user_id) {
        // Gerente con cuenta — actualizar email + password
        const { error } = await sb.auth.admin.updateUserById(g.user_id, {
          email: g.email,
          password: PASSWORD,
          email_confirm: true,
        });
        if (error) {
          // Si la colisión es porque ese email ya está usado por OTRO user, vincular al existente
          const existingId = authByEmail.get(emailLower);
          if (existingId && existingId !== g.user_id) {
            await sb.from("gerentes").update({ user_id: existingId }).eq("id", g.id);
            const { error: e2 } = await sb.auth.admin.updateUserById(existingId, {
              password: PASSWORD,
              email_confirm: true,
            });
            if (e2) { errores++; if (errorSamples.length < 10) errorSamples.push({ id: g.id, error: e2.message }); }
            else { actualizados++; }
          } else {
            errores++;
            if (errorSamples.length < 10) errorSamples.push({ id: g.id, nombre: g.nombre, error: error.message });
          }
        } else {
          actualizados++;
          authByEmail.set(emailLower, g.user_id);
        }
      } else {
        // Gerente sin cuenta — intentar crear
        const { data: user, error } = await sb.auth.admin.createUser({
          email: g.email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { name: g.nombre },
        });
        if (!error && user?.user?.id) {
          await sb.from("gerentes").update({ user_id: user.user.id }).eq("id", g.id);
          authByEmail.set(emailLower, user.user.id);
          creados++;
        } else {
          // Si ya existe ese email en auth, vincular
          const existingId = authByEmail.get(emailLower);
          if (existingId) {
            await sb.from("gerentes").update({ user_id: existingId }).eq("id", g.id);
            await sb.auth.admin.updateUserById(existingId, {
              password: PASSWORD,
              email_confirm: true,
            });
            actualizados++;
          } else {
            errores++;
            if (errorSamples.length < 10) {
              errorSamples.push({ id: g.id, nombre: g.nombre, email: g.email, error: error?.message ?? "create_failed" });
            }
          }
        }
      }
    } catch (e: any) {
      errores++;
      if (errorSamples.length < 10) errorSamples.push({ id: g.id, error: e?.message || String(e) });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    total: gerentes?.length ?? 0,
    creados,
    actualizados,
    errores,
    errorSamples,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
