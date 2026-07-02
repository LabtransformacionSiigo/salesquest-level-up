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
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const default_password: string | undefined = body?.default_password ? String(body.default_password) : undefined;
    const nombre: string | undefined = body?.nombre ? String(body.nombre) : undefined;
    const create_director = !body?.director_id;
    const cargo: string | undefined = body?.cargo || undefined;
    const canales: string[] = Array.isArray(body?.canales) ? body.canales : [];
    const paises: string[] = Array.isArray(body?.paises) ? body.paises : [];

    if (!email) {
      return new Response(JSON.stringify({ error: "email requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (create_director && (!nombre || canales.length === 0 || paises.length === 0)) {
      return new Response(JSON.stringify({ error: "nombre, canales y paises requeridos para crear director" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Buscar usuario auth
    let userId: string | null = null;
    for (let page = 1; page <= 30 && !userId; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const found = data.users.find((u) => (u.email || "").toLowerCase() === email);
      if (found) userId = found.id;
      if (data.users.length < 1000) break;
    }

    // 2) Crear si no existe / actualizar pwd si se envió
    let created = false;
    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: default_password || "Siigo2026!",
        email_confirm: true,
        user_metadata: nombre ? { name: nombre } : undefined,
      });
      if (error) throw error;
      userId = data.user!.id;
      created = true;
    } else if (default_password) {
      await supabase.auth.admin.updateUserById(userId, {
        password: default_password,
        email_confirm: true,
        user_metadata: nombre ? { name: nombre } : undefined,
      });
    }

    // 3) Rol director
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "director" }, { onConflict: "user_id,role" });
    if (roleErr && !roleErr.message.includes("duplicate")) throw roleErr;

    // 4) Crear o vincular director
    let director_id: string = body?.director_id;
    if (create_director) {
      const { data: ins, error: insErr } = await supabase
        .from("directores")
        .insert({ user_id: userId, nombre, email, cargo: cargo || null, canales, paises, activo: true })
        .select("id")
        .single();
      if (insErr) throw insErr;
      director_id = ins.id;
    } else {
      const { error: updErr } = await supabase
        .from("directores")
        .update({ user_id: userId, activo: true })
        .eq("id", director_id);
      if (updErr) throw updErr;
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, director_id, created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
