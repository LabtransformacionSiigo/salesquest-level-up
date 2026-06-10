import { requireRole } from "../_shared/admin-auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await requireRole(req, ["admin"]);
  if (_guard.error) return _guard.error;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const password = "SiigoArena2026!";

  // Get all asesores without a user_id
  const { data: asesores, error: fetchError } = await supabaseAdmin
    .from("asesores")
    .select("id, nombre, email, canal")
    .is("user_id", null)
    .order("nombre");

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];

  for (const a of asesores || []) {
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: a.email,
      password,
      email_confirm: true,
      user_metadata: { name: a.nombre },
    });

    if (authError) {
      results.push({ email: a.email, error: authError.message });
      continue;
    }

    const userId = authData.user.id;

    // Link user_id to asesor
    await supabaseAdmin
      .from("asesores")
      .update({ user_id: userId })
      .eq("id", a.id);

    // Delete any gerente auto-created by trigger
    await supabaseAdmin
      .from("gerentes")
      .delete()
      .eq("user_id", userId);

    // Assign asesor role
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "asesor" }, { onConflict: "user_id,role" });

    results.push({
      email: a.email,
      nombre: a.nombre,
      canal: a.canal,
      linked: true,
    });
  }

  return new Response(JSON.stringify({ total: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
