// Orquestador único: ejecuta en orden retos VC, retos VN y medallas (VC + VN).
// Es la fuente de verdad para "evaluar gamificación ahora" (botones UI + cron).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const dryRun = body.dry_run === true;

  const call = async (path: string) => {
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({ dry_run: dryRun }),
      });
      const txt = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt.slice(0, 500) }; }
      return { path, status: r.status, body: parsed };
    } catch (e) {
      return { path, error: String(e) };
    }
  };

  const results = await Promise.all([
    call("/evaluar-retos-vc"),
    call("/evaluar-retos-vn"),
    call("/evaluate-medals"),
  ]);

  // Resumen agregado
  const summary = {
    retos_vc: results[0]?.body?.totales || results[0]?.body || null,
    retos_vn: results[1]?.body?.totales || results[1]?.body || null,
    medallas: results[2]?.body || null,
  };

  return new Response(JSON.stringify({ ok: true, dry_run: dryRun, summary, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
