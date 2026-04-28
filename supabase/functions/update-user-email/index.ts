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

  const { updates } = await req.json() as {
    updates: { old_email: string; new_email: string; password?: string }[];
  };

  if (!Array.isArray(updates) || updates.length === 0) {
    return new Response(JSON.stringify({ error: "updates array required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const u of updates) {
    const { old_email, new_email, password } = u;
    try {
      // Find user by old email
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1, perPage: 1000,
      });
      if (listErr) throw listErr;

      const user = list.users.find((x) => x.email?.toLowerCase() === old_email.toLowerCase());
      if (!user) {
        results.push({ old_email, status: "auth_user_not_found" });
        continue;
      }

      // Update auth.users
      const updatePayload: any = { email: new_email, email_confirm: true };
      if (password) updatePayload.password = password;

      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, updatePayload);
      if (updErr) throw updErr;

      // Update gerentes table
      const { error: gerErr } = await supabaseAdmin
        .from("gerentes")
        .update({ email: new_email })
        .eq("user_id", user.id);
      if (gerErr) throw gerErr;

      results.push({ old_email, new_email, user_id: user.id, status: "ok" });
    } catch (e: any) {
      results.push({ old_email, status: "error", error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
