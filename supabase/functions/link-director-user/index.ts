import { requireRole } from "../_shared/admin-auth.ts";
// deno-lint-ignore-file
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await requireRole(req, ["admin"]);
  if (_guard.error) return _guard.error;
  try {
    const { director_id, email } = await req.json();
    if (!director_id || !email) {
      return new Response(JSON.stringify({ error: "director_id y email requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const emailNorm = String(email).trim().toLowerCase();

    // 1) Buscar usuario en auth.users
    let userId: string | null = null;
    let page = 1;
    while (page <= 20 && !userId) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const found = data.users.find((u) => (u.email || "").toLowerCase() === emailNorm);
      if (found) userId = found.id;
      if (data.users.length < 200) break;
      page++;
    }

    // 2) Si no existe, crearlo con contraseña por defecto
    let created = false;
    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: emailNorm,
        password: "Siigo2026!",
        email_confirm: true,
      });
      if (error) throw error;
      userId = data.user!.id;
      created = true;
    }

    // 3) Asegurar rol 'director' en user_roles
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "director" }, { onConflict: "user_id,role" });
    if (roleErr && !roleErr.message.includes("duplicate")) throw roleErr;

    // 4) Vincular en directores + activar
    const { error: updErr } = await supabase
      .from("directores")
      .update({ user_id: userId, activo: true })
      .eq("id", director_id);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({ success: true, user_id: userId, created, default_password: created ? "Siigo2026!" : null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
