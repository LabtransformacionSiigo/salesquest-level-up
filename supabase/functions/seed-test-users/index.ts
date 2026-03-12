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

  const testUsers = [
    { email: "alejandro.rivas@siigo.com", nombre: "Alejandro Rivas Cruz", canal: "VN_ALIADOS" },
    { email: "ana.guerrero@siigo.com", nombre: "Ana Guerrero Téllez", canal: "VC" },
    { email: "luis.avila@siigo.com", nombre: "Luis Ávila Mendoza", canal: "VN_EMPRESARIOS" },
  ];

  const results = [];
  const password = "SiigoArena2026!";

  for (const u of testUsers) {
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { name: u.nombre },
    });

    if (authError) {
      results.push({ email: u.email, error: authError.message });
      continue;
    }

    // Link to existing gerente
    const { error: updateError } = await supabaseAdmin
      .from("gerentes")
      .update({ user_id: authData.user.id })
      .eq("email", u.email);

    // Delete the duplicate gerente created by trigger (if any)
    await supabaseAdmin
      .from("gerentes")
      .delete()
      .eq("user_id", authData.user.id)
      .neq("email", u.email);

    results.push({
      email: u.email,
      nombre: u.nombre,
      canal: u.canal,
      password,
      linked: !updateError,
    });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
