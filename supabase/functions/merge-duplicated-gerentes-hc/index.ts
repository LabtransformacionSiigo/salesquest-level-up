import { requireRole } from "../_shared/admin-auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NORM = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isEmpPlaceholder = (e: string) => /^emp-[0-9a-f-]{20,}@/i.test(String(e || ""));
const hasAccents = (s: string) => /[^\x00-\x7F]/.test(String(s || ""));

// pick "HC-style" long email: first.middle.last@siigo.com pattern (more dots)
const dots = (e: string) => (String(e || "").split("@")[0] || "").split(".").length;

/**
 * From a duplicate group, decide keeper + duplicate + final email.
 * Rules:
 *   keeper priority: has celula > has user_id > most recent created_at
 *   final email: prefer the non-placeholder, non-accented email with more name-dots (HC style).
 */
function decide(rows: any[]) {
  const sorted = [...rows].sort((a, b) => {
    const ca = a.celula ? 1 : 0, cb = b.celula ? 1 : 0;
    if (ca !== cb) return cb - ca;
    const ua = a.user_id ? 1 : 0, ub = b.user_id ? 1 : 0;
    if (ua !== ub) return ub - ua;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
  const keeper = sorted[0];
  const dup = sorted[1];

  const cand = [keeper.email, dup.email].filter(Boolean);
  const scored = cand.map((e) => ({
    e,
    score:
      (isEmpPlaceholder(e) ? -100 : 0) +
      (hasAccents(e) ? -50 : 0) +
      dots(e),
  }));
  scored.sort((a, b) => b.score - a.score);
  const finalEmail = scored[0]?.e || keeper.email;

  return { keeper, dup, finalEmail };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await requireRole(req, ["admin"], { allowCronSecret: true });
  if (_guard.error) return _guard.error;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let body: any = {};
  try { body = await req.json(); } catch {}
  const dryRun: boolean = body?.dryRun !== false; // default true for safety
  const limit: number = Number(body?.limit || 0) || 0;
  const password: string = String(body?.password || "SiigoArena2026!");

  // Fetch all active gerentes (paginate to bypass PostgREST default cap)
  const allRows: any[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await sb
      .from("gerentes")
      .select("id,nombre,email,user_id,celula,canal,pais,activo,created_at")
      .eq("activo", true)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
  }

  // Group by normalized name
  const groups = new Map<string, any[]>();
  for (const r of allRows || []) {
    const k = NORM(r.nombre);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const dupGroups = [...groups.entries()].filter(([, arr]) => arr.length === 2);
  const skipped3plus = [...groups.entries()].filter(([, arr]) => arr.length > 2)
    .map(([k, arr]) => ({ k, count: arr.length, ids: arr.map((a) => a.id) }));
  const debug_total_rows = (allRows || []).length;
  const debug_unique_names = groups.size;

  const plan: any[] = [];
  const errors: any[] = [];
  let merged = 0, authDeleted = 0;

  const toProcess = limit > 0 ? dupGroups.slice(0, limit) : dupGroups;

  const childTables = [
    "sp_acumulados",
    "medallas",
    "medallas_vn_ganadas",
    "canjes",
    "retos_completados",
    "retos_vn_progreso_diario",
    "retos_vn_progreso_semanal",
    "retos_vn_progreso_mensual",
    "notificaciones",
    "rachas",
    "rachas_vn_estado",
    "streak_daily_progress",
    "kpis_mensuales",
  ];

  for (const [k, rows] of toProcess) {
    try {
      const { keeper, dup, finalEmail } = decide(rows);
      const entry: any = {
        name: rows[0].nombre,
        keeper_id: keeper.id,
        keeper_email: keeper.email,
        keeper_celula: keeper.celula,
        keeper_login: !!keeper.user_id,
        dup_id: dup.id,
        dup_email: dup.email,
        dup_celula: dup.celula,
        dup_login: !!dup.user_id,
        final_email: finalEmail,
      };

      if (dryRun) { plan.push(entry); continue; }

      // 1) Reassign children from dup → keeper
      for (const t of childTables) {
        const { error: rErr } = await sb.from(t).update({ gerente_id: keeper.id }).eq("gerente_id", dup.id);
        if (rErr && !/column .* does not exist/i.test(rErr.message)) {
          entry.warn = (entry.warn || []).concat(`${t}: ${rErr.message}`);
        }
      }
      // reconocimientos has two fk cols
      await sb.from("reconocimientos").update({ de_gerente_id: keeper.id }).eq("de_gerente_id", dup.id);
      await sb.from("reconocimientos").update({ para_gerente_id: keeper.id }).eq("para_gerente_id", dup.id);
      // asesores.gerente_id
      await sb.from("asesores").update({ gerente_id: keeper.id }).eq("gerente_id", dup.id);

      // 2) Delete dup auth.user first (frees the email in auth.users)
      if (dup.user_id) {
        const { error: aErr } = await sb.auth.admin.deleteUser(dup.user_id);
        if (aErr) entry.warn = (entry.warn || []).concat(`auth_del: ${aErr.message}`);
        else authDeleted++;
      }

      // 3) Delete dup gerente row
      const { error: dErr } = await sb.from("gerentes").delete().eq("id", dup.id);
      if (dErr) { errors.push({ ...entry, error: `delete_dup: ${dErr.message}` }); continue; }

      // 4) Update keeper email if different (trigger syncs auth.users)
      if (finalEmail && NORM(finalEmail) !== NORM(keeper.email)) {
        const { error: uErr } = await sb.from("gerentes")
          .update({ email: finalEmail })
          .eq("id", keeper.id);
        if (uErr) entry.warn = (entry.warn || []).concat(`update_email: ${uErr.message}`);

        // Ensure the keeper's auth.user password is set to the default so they can login with new email
        if (keeper.user_id) {
          const { error: pErr } = await sb.auth.admin.updateUserById(keeper.user_id, {
            email: finalEmail,
            email_confirm: true,
            password,
          });
          if (pErr) entry.warn = (entry.warn || []).concat(`auth_update_keeper: ${pErr.message}`);
        }
      }

      merged++;
      plan.push({ ...entry, ok: true });
    } catch (e: any) {
      errors.push({ group: k, error: e?.message || String(e) });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    dryRun,
    debug_total_rows,
    debug_unique_names,
    total_dup_groups: dupGroups.length,
    processed: toProcess.length,
    merged,
    authDeleted,
    errors_count: errors.length,
    skipped_groups_3plus: skipped3plus,
    plan_sample: plan.slice(0, 30),
    plan_full_count: plan.length,
    errors: errors.slice(0, 30),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
