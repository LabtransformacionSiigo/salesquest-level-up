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
  const adminEmail = "juankmilo216@gmail.com";

  // Get all gerentes without a user_id (no login yet), excluding admin
  const { data: gerentes, error: fetchError } = await supabaseAdmin
    .from("gerentes")
    .select("id, nombre, email, canal")
    .is("user_id", null)
    .neq("email", adminEmail)
    .order("nombre");

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];

  for (const g of gerentes || []) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: g.email,
      password,
      email_confirm: true,
      user_metadata: { name: g.nombre },
    });

    if (authError) {
      results.push({ email: g.email, error: authError.message });
      continue;
    }

    // Link to existing gerente
    const { error: updateError } = await supabaseAdmin
      .from("gerentes")
      .update({ user_id: authData.user.id })
      .eq("id", g.id);

    // Delete duplicate gerente created by trigger (if any)
    await supabaseAdmin
      .from("gerentes")
      .delete()
      .eq("user_id", authData.user.id)
      .neq("id", g.id);

    results.push({
      email: g.email,
      nombre: g.nombre,
      canal: g.canal,
      linked: !updateError,
    });
  }

  return new Response(JSON.stringify({ total: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
