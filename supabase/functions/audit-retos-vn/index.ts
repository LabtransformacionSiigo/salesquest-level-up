import { requireRole } from "../_shared/admin-auth.ts";
// Auditoría histórica: itera fechas y dispara `evaluar-retos-vn` por cada día.
// Es idempotente porque el evaluador deduplica sp_acumulados antes de insertar.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _guard = await requireRole(req, ["admin","especialista"], { allowCronSecret: true });
  if (_guard.error) return _guard.error;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const today = new Date().toISOString().slice(0, 10);
  const fechaInicio = (typeof body.fecha_inicio === "string" && body.fecha_inicio) || "2026-01-01";
  const fechaFin = (typeof body.fecha_fin === "string" && body.fecha_fin) || today;

  const start = new Date(`${fechaInicio}T12:00:00Z`);
  const end = new Date(`${fechaFin}T12:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return new Response(JSON.stringify({ ok: false, error: "rango de fechas inválido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results: any[] = [];
  let totalSp = 0;

  // Procesa de forma asíncrona en background (puede tomar varios minutos)
  const run = async () => {
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const fecha = d.toISOString().slice(0, 10);
      let attempts = 0;
      let done = false;
      while (!done && attempts < 6) {
        attempts++;
        try {
          const r = await fetch(`${supabaseUrl}/functions/v1/evaluar-retos-vn`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
            },
            body: JSON.stringify({ fecha }),
          });
          const txt = await r.text();
          let parsed: any = {};
          try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt.slice(0, 200) }; }

          // Rate limit handling
          if (r.status === 429 || /RateLimit/i.test(txt)) {
            const retryMs = Number(parsed?.retryAfterMs) || 35000;
            console.warn(`[audit] ${fecha} rate-limited, sleeping ${retryMs}ms (attempt ${attempts})`);
            await new Promise((res) => setTimeout(res, retryMs));
            continue;
          }

          const sp = Number(parsed.sp_total) || 0;
          totalSp += sp;
          results.push({ fecha, status: r.status, sp_total: sp, errores: parsed.errores || [] });
          console.log(`[audit] ${fecha} status=${r.status} sp=${sp}`);
          done = true;
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (/RateLimit/i.test(msg)) {
            const m = msg.match(/Retry after (\d+)ms/);
            const retryMs = m ? Number(m[1]) + 500 : 35000;
            console.warn(`[audit] ${fecha} caught rate-limit, sleeping ${retryMs}ms (attempt ${attempts})`);
            await new Promise((res) => setTimeout(res, retryMs));
            continue;
          }
          results.push({ fecha, error: msg });
          console.error(`[audit] ${fecha} error`, e);
          done = true;
        }
      }
      // Pequeña pausa entre días para no saturar
      await new Promise((res) => setTimeout(res, 1500));
    }
    console.log(`[audit] total_sp=${totalSp} dias=${results.length}`);

  };

  // @ts-ignore EdgeRuntime existe en runtime de Supabase
  EdgeRuntime.waitUntil(run());

  return new Response(JSON.stringify({
    ok: true,
    started: true,
    rango: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
    msg: "Auditoría iniciada en background. Revisa los logs de la función para ver progreso.",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
