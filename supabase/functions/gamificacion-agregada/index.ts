// Read-only aggregated gamification data for external dashboards.
// No writes. No new secrets. Uses Lovable Cloud injected env vars.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  paises?: string[];
  canales?: string[];
}

interface RankingRow {
  user_id: string | null;
  nombre: string | null;
  canal: string | null;
  pais: string | null;
  sp_totales: number | null;
  nivel: string | null;
  posicion: number | null;
}

interface GerenteRow {
  id: string;
  pais: string | null;
  canal: string | null;
}

interface RachaRow {
  gerente_id: string;
  anio: number | null;
  semana_iso: number | null;
  estado: string | null;
  semanas_consecutivas: number | null;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safeDiv = (a: number, b: number): number => (b > 0 ? a / b : 0);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: Body = {};
    try { body = (await req.json()) as Body; } catch { /* empty */ }
    const paises = (body.paises ?? []).filter((p): p is string => typeof p === "string" && p.length > 0);
    const canales = (body.canales ?? []).filter((c): c is string => typeof c === "string" && c.length > 0);

    // a) Ranking
    let rankingQuery = supabase
      .from("ranking_general")
      .select("user_id,nombre,canal,pais,sp_totales,nivel,posicion")
      .limit(5000);
    if (paises.length > 0) rankingQuery = rankingQuery.in("pais", paises);
    if (canales.length > 0) rankingQuery = rankingQuery.in("canal", canales);
    const { data: rankingData, error: rankingErr } = await rankingQuery;
    if (rankingErr) throw rankingErr;
    const ranking: RankingRow[] = (rankingData ?? []) as RankingRow[];

    // b) Gerentes + racha
    const { data: gerentesData, error: gerErr } = await supabase
      .from("gerentes")
      .select("id,pais,canal");
    if (gerErr) throw gerErr;
    const gerentes: GerenteRow[] = (gerentesData ?? []) as GerenteRow[];
    const gerenteMap = new Map<string, GerenteRow>();
    for (const g of gerentes) gerenteMap.set(g.id, g);

    const { data: rachaData, error: rachaErr } = await supabase
      .from("racha_activa")
      .select("gerente_id,anio,semana_iso,estado,semanas_consecutivas");
    if (rachaErr) throw rachaErr;
    const rachaRows: RachaRow[] = (rachaData ?? []) as RachaRow[];

    const latestByGerente = new Map<string, RachaRow>();
    for (const r of rachaRows) {
      const cur = latestByGerente.get(r.gerente_id);
      if (!cur) { latestByGerente.set(r.gerente_id, r); continue; }
      const ra = r.anio ?? 0, rs = r.semana_iso ?? 0;
      const ca = cur.anio ?? 0, cs = cur.semana_iso ?? 0;
      if (ra > ca || (ra === ca && rs > cs)) latestByGerente.set(r.gerente_id, r);
    }

    const rachaFiltradas: RachaRow[] = [];
    for (const [gid, r] of latestByGerente) {
      const g = gerenteMap.get(gid);
      if (!g) continue;
      if (paises.length > 0 && (!g.pais || !paises.includes(g.pais))) continue;
      if (canales.length > 0 && (!g.canal || !canales.includes(g.canal))) continue;
      rachaFiltradas.push(r);
    }

    // c) Medallas count
    const { count: medallasCount, error: medErr } = await supabase
      .from("medallas")
      .select("*", { count: "exact", head: true });
    if (medErr) throw medErr;

    // Aggregations
    const usuarios = ranking.length;
    const spTotal = ranking.reduce((s, r) => s + (Number(r.sp_totales) || 0), 0);
    const spPromedio = safeDiv(spTotal, usuarios);

    const nivelAgg = new Map<string, { usuarios: number; sp: number }>();
    for (const r of ranking) {
      const key = r.nivel ?? "Sin nivel";
      const a = nivelAgg.get(key) ?? { usuarios: 0, sp: 0 };
      a.usuarios += 1;
      a.sp += Number(r.sp_totales) || 0;
      nivelAgg.set(key, a);
    }
    const nivelDistribucion = Array.from(nivelAgg.entries())
      .map(([nivel, v]) => ({ nivel, usuarios: v.usuarios, avgSp: safeDiv(v.sp, v.usuarios) }))
      .sort((a, b) => a.avgSp - b.avgSp);

    const leaderboard = [...ranking]
      .sort((a, b) => (Number(b.sp_totales) || 0) - (Number(a.sp_totales) || 0))
      .slice(0, 50)
      .map((r) => ({
        user_id: r.user_id,
        nombre: r.nombre,
        pais: r.pais,
        canal: r.canal,
        sp_totales: Number(r.sp_totales) || 0,
        nivel: r.nivel,
        posicion: r.posicion,
      }));

    const canalAgg = new Map<string, { sp: number; usuarios: number }>();
    const paisAgg = new Map<string, { sp: number; usuarios: number }>();
    for (const r of ranking) {
      const sp = Number(r.sp_totales) || 0;
      const c = r.canal ?? "Sin canal";
      const p = r.pais ?? "Sin pais";
      const ca = canalAgg.get(c) ?? { sp: 0, usuarios: 0 };
      ca.sp += sp; ca.usuarios += 1; canalAgg.set(c, ca);
      const pa = paisAgg.get(p) ?? { sp: 0, usuarios: 0 };
      pa.sp += sp; pa.usuarios += 1; paisAgg.set(p, pa);
    }
    const spPorCanal = Array.from(canalAgg.entries()).map(([canal, v]) => ({ canal, sp: v.sp, usuarios: v.usuarios }));
    const spPorPais = Array.from(paisAgg.entries()).map(([pais, v]) => ({ pais, sp: v.sp, usuarios: v.usuarios }));

    const totalRachas = rachaFiltradas.length;
    const verdes = rachaFiltradas.filter((r) => String(r.estado ?? "").toLowerCase() === "verde").length;
    const sumaSemanas = rachaFiltradas.reduce((s, r) => s + (Number(r.semanas_consecutivas) || 0), 0);
    const rachas = {
      total: totalRachas,
      verdes,
      pctVerde: safeDiv(verdes, totalRachas) * 100,
      promedioSemanas: safeDiv(sumaSemanas, totalRachas),
    };

    return jsonResponse({
      usuarios,
      spPromedio,
      spTotal,
      nivelDistribucion,
      leaderboard,
      spPorCanal,
      spPorPais,
      rachas,
      medallasOtorgadas: medallasCount ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gamificacion-agregada] error", message);
    return jsonResponse({ error: message }, 500);
  }
});
