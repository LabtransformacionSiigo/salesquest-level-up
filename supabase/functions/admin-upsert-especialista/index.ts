import { requireRole } from "../_shared/admin-auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Crea o actualiza un especialista, opcionalmente reemplazando a otro (revoke_user_id).
// Body: { email, nombre, paises: string[], operaciones: string[], password?, revoke_user_id? }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const _guard = await requireRole(req, ["admin"]);
  if (_guard.error) return _guard.error;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const nombre = String(body?.nombre || "").trim();
    const paises: string[] = Array.isArray(body?.paises) ? body.paises : [];
    const operaciones: string[] = Array.isArray(body?.operaciones) ? body.operaciones : [];
    const password: string | undefined = body?.password ? String(body.password) : undefined;
    const revoke_user_id: string | undefined = body?.revoke_user_id || undefined;

    if (!email || !nombre || paises.length === 0 || operaciones.length === 0) {
      return new Response(JSON.stringify({ error: "email, nombre, paises y operaciones requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password && password.length < 8) {
      return new Response(JSON.stringify({ error: "password mínimo 8 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Buscar o crear auth user
    let userId: string | null = null;
    for (let page = 1; page <= 30 && !userId; page++) {
      const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      const u = data?.users?.find((x) => (x.email || "").toLowerCase() === email);
      if (u) userId = u.id;
      if (!data?.users?.length || data.users.length < 1000) break;
    }
    let created = false;
    if (!userId) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password: password || "Siigo2026!",
        email_confirm: true,
        user_metadata: { name: nombre },
      });
      if (error) throw error;
      userId = data.user!.id;
      created = true;
    } else if (password) {
      await sb.auth.admin.updateUserById(userId, { password, email_confirm: true, user_metadata: { name: nombre } });
    } else {
      await sb.auth.admin.updateUserById(userId, { user_metadata: { name: nombre } });
    }

    // 2) Asignar rol especialista
    await sb.from("user_roles").upsert(
      { user_id: userId!, role: "especialista" },
      { onConflict: "user_id,role" },
    );

    // 3) Upsert permisos
    const { error: upErr } = await sb.from("especialista_permisos").upsert(
      { user_id: userId!, nombre, email, paises, operaciones },
      { onConflict: "user_id" },
    );
    if (upErr) throw upErr;

    // 4) Revocar al saliente
    let revoked: any = null;
    if (revoke_user_id && revoke_user_id !== userId) {
      await sb.from("especialista_permisos").delete().eq("user_id", revoke_user_id);
      await sb.from("user_roles").delete().eq("user_id", revoke_user_id).eq("role", "especialista");
      try { await sb.auth.admin.updateUserById(revoke_user_id, { ban_duration: "876000h" } as any); } catch (_) {}
      revoked = revoke_user_id;
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, created, revoked }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
