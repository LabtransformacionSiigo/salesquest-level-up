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

  const OUT_EMAIL = "said.gomez@siigo.com";
  const IN_EMAIL = "brandon.guayara@siigo.com";
  const IN_NAME = "Brandon David Guayara Bermudez";
  const PASSWORD = "Siigo2026!";
  const PAISES = ["COL"];
  const OPERACIONES = ["Venta Cruzada"];

  const log: any = { steps: [] };

  // 1) Create or fetch Brandon auth user
  let brandonId: string | null = null;
  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email: IN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: IN_NAME },
  });
  if (created?.user) {
    brandonId = created.user.id;
    log.steps.push({ create: "ok", brandonId });
  } else {
    log.steps.push({ create: "exists_or_err", err: cErr?.message });
    // find existing
    for (let page = 1; page <= 30; page++) {
      const { data: list } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
      if (!list?.users?.length) break;
      const u = list.users.find((x) => x.email?.toLowerCase() === IN_EMAIL);
      if (u) { brandonId = u.id; break; }
      if (list.users.length < 1000) break;
    }
    if (brandonId) {
      await sb.auth.admin.updateUserById(brandonId, {
        password: PASSWORD, email_confirm: true, user_metadata: { name: IN_NAME },
      });
    }
  }
  if (!brandonId) return new Response(JSON.stringify({ error: "no brandon id", log }), { status: 500, headers: corsHeaders });

  // 2) Role especialista for Brandon
  await sb.from("user_roles").upsert(
    { user_id: brandonId, role: "especialista" },
    { onConflict: "user_id,role" },
  );
  log.steps.push({ role_brandon: "ok" });

  // 3) Insert especialista_permisos for Brandon
  const { error: upErr } = await sb.from("especialista_permisos").upsert(
    {
      user_id: brandonId,
      nombre: IN_NAME,
      email: IN_EMAIL,
      paises: PAISES,
      operaciones: OPERACIONES,
    },
    { onConflict: "user_id" },
  );
  log.steps.push({ permisos_brandon: upErr ? upErr.message : "ok" });

  // 4) Find Said and revoke
  const { data: said } = await sb
    .from("especialista_permisos")
    .select("user_id")
    .eq("email", OUT_EMAIL)
    .maybeSingle();

  if (said?.user_id) {
    await sb.from("especialista_permisos").delete().eq("user_id", said.user_id);
    await sb.from("user_roles").delete().eq("user_id", said.user_id).eq("role", "especialista");
    // Optionally disable auth user
    try {
      await sb.auth.admin.updateUserById(said.user_id, { ban_duration: "876000h" } as any);
    } catch (_) {}
    log.steps.push({ said_removed: said.user_id });
  } else {
    log.steps.push({ said_removed: "not_found" });
  }

  return new Response(JSON.stringify({ success: true, brandonId, log }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
