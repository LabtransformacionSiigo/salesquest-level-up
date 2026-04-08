import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { email, password, name, role } = await req.json();
  if (!email || !password) {
    return new Response(JSON.stringify({ error: "email and password required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || email.split("@")[0] },
  });

  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = authData.user.id;

  // Link to gerente
  const { data: linked } = await supabaseAdmin
    .from("gerentes")
    .update({ user_id: userId })
    .eq("email", email)
    .select("id, nombre, canal, pais")
    .maybeSingle();

  // Delete duplicate created by trigger
  if (linked) {
    await supabaseAdmin.from("gerentes").delete().eq("user_id", userId).neq("id", linked.id);
  }

  // Assign role
  if (role) {
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  }

  return new Response(JSON.stringify({ success: true, userId, linked, role }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
