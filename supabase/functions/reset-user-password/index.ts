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

  const { email, password } = await req.json();
  if (!email || !password) {
    return new Response(JSON.stringify({ error: "email and password required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    return new Response(JSON.stringify({ error: "user not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (updErr) {
    return new Response(JSON.stringify({ error: updErr.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, userId: user.id, email: user.email }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
