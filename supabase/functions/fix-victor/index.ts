import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const userId = "389cf149-f79f-4449-b3ac-328a927fd9de";
  const email = "victor.buitrago@siigo.com";
  const password = "SiigoArena2026!";
  const gerenteId = "c5db5ac8-15d0-4e6b-b461-e981df8dad82";

  // 1) Update auth user: set proper email + password + confirm
  const { data: upd, error: upErr } = await sb.auth.admin.updateUserById(userId, {
    email,
    password,
    email_confirm: true,
    user_metadata: {
      email,
      name: "Victor Alexis Buitrago Garay",
      nombre: "Victor Alexis Buitrago Garay",
      role: "gerente",
    },
  });

  if (upErr) {
    return new Response(JSON.stringify({ step: "updateUserById", error: upErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2) Liberar el user_id si está en otro gerente
  await sb.from("gerentes").update({ user_id: null }).eq("user_id", userId).neq("id", gerenteId);

  // 3) Asignar al gerente correcto
  const { error: gErr } = await sb.from("gerentes").update({ user_id: userId }).eq("id", gerenteId);
  if (gErr) {
    return new Response(JSON.stringify({ step: "linkGerente", error: gErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4) Asegurar role
  await sb.from("user_roles").delete().eq("user_id", userId).neq("role", "gerente");
  await sb.from("user_roles").upsert({ user_id: userId, role: "gerente" }, { onConflict: "user_id,role" });

  return new Response(JSON.stringify({
    success: true,
    user_id: userId,
    email_after: upd?.user?.email,
    password,
    gerente_id: gerenteId,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
