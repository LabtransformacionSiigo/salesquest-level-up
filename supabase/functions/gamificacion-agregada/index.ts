// Read-only aggregated gamification data for external dashboards.
// No writes. No new secrets. Uses Lovable Cloud injected env vars.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  paises?: string[];
  canales?: string[];
}

interface ActiveRow {
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

const percentile = (arrSortedAsc: number[], p: number): number => {
  if (arrSortedAsc.length === 0) return 0;
  if (arrSortedAsc.length === 1) return arrSortedAsc[0];
  const idx = (p / 100) * (arrSortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return arrSortedAsc[lo];
  return arrSortedAsc[lo] + (arrSortedAsc[hi] - arrSortedAsc[lo]) * (idx - lo);
};

const median = (arrSortedAsc: number[]): number => {
  if (arrSortedAsc.length === 0) return 0;
  const mid = Math.floor(arrSortedAsc.length / 2);
  return arrSortedAsc.length % 2 === 0
    ? (arrSortedAsc[mid - 1] + arrSortedAsc[mid]) / 2
    : arrSortedAsc[mid];
};

async function countRanking(
  supabase: SupabaseClient,
  paises: string[],
  canales: string[],
): Promise<number> {
  let q = supabase.from("ranking_general").select("*", { count: "exact", head: true });
  if (paises.length > 0) q = q.in("pais", paises);
  if (canales.length > 0) q = q.in("canal", canales);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

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

    // 0) Uso / adopción (RPC read-only)
    interface UsoPorMes { mes: string; usuarios_activos: number; eventos: number; }
    interface UsoTop { nombre: string | null; pais: string | null; canal: string | null; dias_activos: number; ultima_actividad: string | null; sp: number; }
    interface PorCanalPais { pais: string | null; canal: string | null; cuentas: number; logueados: number; activos30d: number; }
    interface RetoTop { nombre: string | null; pais: string | null; canal: string | null; retos: number; sp: number; ultimo: string | null; }
    interface SpTop { nombre: string | null; pais: string | null; canal: string | null; sp: number; }
    interface CanjeEstado { estado: string | null; n: number; sp: number; }
    interface DirectorRow { nombre: string | null; cargo: string | null; paises: string[] | null; canales: string[] | null; ultima_sesion: string | null; cuenta_creada: string | null; }
    interface ResumenSp { conSpTotal: number; conCanje: number; conConvencion: number; spTotalGlobal: number; }
    interface DetalleBlock {
      porCanalPais: PorCanalPais[];
      retos: { total: number; usuarios: number; top: RetoTop[] };
      spCanje: { conSaldo: number; top: SpTop[] };
      spConvencion: { conPuntos: number; top: SpTop[] };
      resumenSp: ResumenSp;
      canjes: { total: number; porEstado: CanjeEstado[] };
      directores: DirectorRow[];
    }
    interface UsoRpc {
      cuentas: number; logueados: number; activos30d: number;
      gerentesCuentas: number; gerentesLogueados: number;
      porMes: UsoPorMes[]; topUso: UsoTop[];
      detalle?: DetalleBlock | null;
    }
    interface UsoBlock extends UsoRpc { adopcionPct: number; activos30dPct: number; }
    let uso: UsoBlock | null = null;
    let detalle: DetalleBlock | null = null;
    const { data: usoData, error: usoErr } = await supabase.rpc("gamificacion_uso_stats");
    if (usoErr) {
      console.error("[gamificacion-agregada] uso rpc error", usoErr.message);
    } else if (usoData) {
      const u = usoData as UsoRpc;
      uso = {
        cuentas: Number(u.cuentas) || 0,
        logueados: Number(u.logueados) || 0,
        activos30d: Number(u.activos30d) || 0,
        gerentesCuentas: Number(u.gerentesCuentas) || 0,
        gerentesLogueados: Number(u.gerentesLogueados) || 0,
        porMes: Array.isArray(u.porMes) ? u.porMes.map((r) => ({
          mes: String(r.mes),
          usuarios_activos: Number(r.usuarios_activos) || 0,
          eventos: Number(r.eventos) || 0,
        })) : [],
        topUso: Array.isArray(u.topUso) ? u.topUso.map((r) => ({
          nombre: r.nombre, pais: r.pais, canal: r.canal,
          dias_activos: Number(r.dias_activos) || 0,
          ultima_actividad: r.ultima_actividad,
          sp: Number(r.sp) || 0,
        })) : [],
        adopcionPct: safeDiv(Number(u.logueados) || 0, Number(u.cuentas) || 0) * 100,
        activos30dPct: safeDiv(Number(u.activos30d) || 0, Number(u.cuentas) || 0) * 100,
      };
      try {
        const d = u.detalle;
        if (d) {
          detalle = {
            porCanalPais: Array.isArray(d.porCanalPais) ? d.porCanalPais.map((r) => ({
              pais: r.pais, canal: r.canal,
              cuentas: Number(r.cuentas) || 0,
              logueados: Number(r.logueados) || 0,
              activos30d: Number(r.activos30d) || 0,
            })) : [],
            retos: {
              total: Number(d.retos?.total) || 0,
              usuarios: Number(d.retos?.usuarios) || 0,
              top: Array.isArray(d.retos?.top) ? d.retos.top.map((r) => ({
                nombre: r.nombre, pais: r.pais, canal: r.canal,
                retos: Number(r.retos) || 0,
                sp: Number(r.sp) || 0,
                ultimo: r.ultimo,
              })) : [],
            },
            spCanje: {
              conSaldo: Number(d.spCanje?.conSaldo) || 0,
              top: Array.isArray(d.spCanje?.top) ? d.spCanje.top.map((r) => ({
                nombre: r.nombre, pais: r.pais, canal: r.canal, sp: Number(r.sp) || 0,
              })) : [],
            },
            spConvencion: {
              conPuntos: Number(d.spConvencion?.conPuntos) || 0,
              top: Array.isArray(d.spConvencion?.top) ? d.spConvencion.top.map((r) => ({
                nombre: r.nombre, pais: r.pais, canal: r.canal, sp: Number(r.sp) || 0,
              })) : [],
            },
            canjes: {
              total: Number(d.canjes?.total) || 0,
              porEstado: Array.isArray(d.canjes?.porEstado) ? d.canjes.porEstado.map((r) => ({
                estado: r.estado, n: Number(r.n) || 0, sp: Number(r.sp) || 0,
              })) : [],
            },
            directores: Array.isArray(d.directores) ? d.directores.map((r) => ({
              nombre: r.nombre, cargo: r.cargo,
              paises: r.paises ?? null, canales: r.canales ?? null,
              ultima_sesion: r.ultima_sesion, cuenta_creada: r.cuenta_creada,
            })) : [],
          };
        }
      } catch (e) {
        console.error("[gamificacion-agregada] detalle mapping error", (e as Error).message);
        detalle = null;
      }
    }


    // 1) Exact total count with filters (bypasses 1000-row default cap)
    const usuarios = await countRanking(supabase, paises, canales);

    // 2) Detail only over ACTIVOS (sp_totales > 0). Small set (~decenas), fits well below the cap.
    let activeQ = supabase
      .from("ranking_general")
      .select("user_id,nombre,canal,pais,sp_totales,nivel,posicion")
      .gt("sp_totales", 0)
      .limit(10000);
    if (paises.length > 0) activeQ = activeQ.in("pais", paises);
    if (canales.length > 0) activeQ = activeQ.in("canal", canales);
    const { data: activeData, error: activeErr } = await activeQ;
    if (activeErr) throw activeErr;
    const activosRows: ActiveRow[] = (activeData ?? []) as ActiveRow[];

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

    // 3) Derived metrics
    const activos = activosRows.length;
    const spDeActivos: number[] = activosRows.map((r) => Number(r.sp_totales) || 0);
    const spTotal = spDeActivos.reduce((s, v) => s + v, 0); // inactivos aportan 0 -> exacto
    const spPromedio = safeDiv(spTotal, usuarios);
    const spPromedioActivos = safeDiv(spTotal, activos);
    const participacionPct = safeDiv(activos, usuarios) * 100;

    // Nivel distribucion (solo activos: los inactivos tendrían nivel base y diluirían)
    const nivelAgg = new Map<string, { usuarios: number; sp: number }>();
    for (const r of activosRows) {
      const key = r.nivel ?? "Sin nivel";
      const a = nivelAgg.get(key) ?? { usuarios: 0, sp: 0 };
      a.usuarios += 1;
      a.sp += Number(r.sp_totales) || 0;
      nivelAgg.set(key, a);
    }
    const nivelDistribucion = Array.from(nivelAgg.entries())
      .map(([nivel, v]) => ({ nivel, usuarios: v.usuarios, avgSp: safeDiv(v.sp, v.usuarios) }))
      .sort((a, b) => a.avgSp - b.avgSp);

    const leaderboard = [...activosRows]
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

    // Aggregations per canal / pais over ACTIVOS
    interface GroupAgg { sp: number; activos: number; maxSp: number; }
    const canalAgg = new Map<string, GroupAgg>();
    const paisAgg = new Map<string, GroupAgg>();
    const canalesPresentes = new Set<string>();
    const paisesPresentes = new Set<string>();
    for (const r of activosRows) {
      const sp = Number(r.sp_totales) || 0;
      const c = r.canal ?? "Sin canal";
      const p = r.pais ?? "Sin pais";
      canalesPresentes.add(c);
      paisesPresentes.add(p);
      const ca = canalAgg.get(c) ?? { sp: 0, activos: 0, maxSp: 0 };
      ca.sp += sp; ca.activos += 1; if (sp > ca.maxSp) ca.maxSp = sp;
      canalAgg.set(c, ca);
      const pa = paisAgg.get(p) ?? { sp: 0, activos: 0, maxSp: 0 };
      pa.sp += sp; pa.activos += 1; if (sp > pa.maxSp) pa.maxSp = sp;
      paisAgg.set(p, pa);
    }

    // Exact totals per canal / pais (respecting filters) via count exact head
    const canalList = Array.from(canalesPresentes);
    const paisList = Array.from(paisesPresentes);
    const canalTotals = new Map<string, number>();
    const paisTotals = new Map<string, number>();
    await Promise.all([
      ...canalList.map(async (c) => {
        const total = await countRanking(supabase, paises, [c]);
        canalTotals.set(c, total);
      }),
      ...paisList.map(async (p) => {
        const total = await countRanking(supabase, [p], canales);
        paisTotals.set(p, total);
      }),
    ]);

    const porCanal = canalList.map((canal) => {
      const v = canalAgg.get(canal)!;
      const totalUsuarios = canalTotals.get(canal) ?? v.activos;
      return {
        canal,
        usuarios: totalUsuarios,
        activos: v.activos,
        participacionPct: safeDiv(v.activos, totalUsuarios) * 100,
        avgActivos: safeDiv(v.sp, v.activos),
        maxSp: v.maxSp,
      };
    });
    const porPais = paisList.map((pais) => {
      const v = paisAgg.get(pais)!;
      const totalUsuarios = paisTotals.get(pais) ?? v.activos;
      return {
        pais,
        usuarios: totalUsuarios,
        activos: v.activos,
        participacionPct: safeDiv(v.activos, totalUsuarios) * 100,
        avgActivos: safeDiv(v.sp, v.activos),
        maxSp: v.maxSp,
      };
    });

    // Backward-compatible spPorCanal / spPorPais (usuarios = total del grupo)
    const spPorCanal = porCanal.map(({ canal, usuarios }) => ({
      canal,
      sp: canalAgg.get(canal)?.sp ?? 0,
      usuarios,
    }));
    const spPorPais = porPais.map(({ pais, usuarios }) => ({
      pais,
      sp: paisAgg.get(pais)?.sp ?? 0,
      usuarios,
    }));

    // Mediana / p90 over ALL usuarios (inactivos = 0), sin traerlos
    const zeros = Math.max(usuarios - activos, 0);
    const activosSorted = [...spDeActivos].sort((a, b) => a - b);
    // Sorted asc: primero los ceros, luego los activos ordenados
    const allSorted: number[] = zeros > 0
      ? [...new Array<number>(zeros).fill(0), ...activosSorted]
      : activosSorted;
    const mediana = median(allSorted);
    const p90 = percentile(allSorted, 90);

    // Distribución SP solo activos
    const buckets: Array<{ rango: string; min: number; max: number }> = [
      { rango: "1–50", min: 1, max: 50 },
      { rango: "51–100", min: 51, max: 100 },
      { rango: "101–250", min: 101, max: 250 },
      { rango: "251–500", min: 251, max: 500 },
      { rango: "501–1000", min: 501, max: 1000 },
      { rango: "1000+", min: 1001, max: Number.POSITIVE_INFINITY },
    ];
    const distribucionSp = buckets.map((b) => ({
      rango: b.rango,
      usuarios: spDeActivos.filter((v) => v >= b.min && v <= b.max).length,
    }));

    // Rachas
    const totalRachas = rachaFiltradas.length;
    const verdes = rachaFiltradas.filter((r) => String(r.estado ?? "").toLowerCase() === "verde").length;
    const sumaSemanas = rachaFiltradas.reduce((s, r) => s + (Number(r.semanas_consecutivas) || 0), 0);
    const rachas = {
      total: totalRachas,
      verdes,
      pctVerde: safeDiv(verdes, totalRachas) * 100,
      promedioSemanas: safeDiv(sumaSemanas, totalRachas),
    };

    // ===== porRol: comparación global gerentes vs comerciales (SIN filtros pais/canal) =====
    interface RankRoleRow { user_id: string | null; sp_totales: number | null; }
    interface GerenteIdRow { user_id: string | null; }
    interface ComercialRow { nombre: string | null; sp_totales: number | null; }

    const PAGE = 1000;
    const rankingAll: RankRoleRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("ranking_general")
        .select("user_id,sp_totales")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as RankRoleRow[];
      rankingAll.push(...rows);
      if (rows.length < PAGE) break;
    }

    const gerenteUserIds = new Set<string>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("gerentes")
        .select("user_id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as GerenteIdRow[];
      for (const r of rows) if (r.user_id) gerenteUserIds.add(r.user_id);
      if (rows.length < PAGE) break;
    }

    const gerentesRows = rankingAll.filter((r) => r.user_id && gerenteUserIds.has(r.user_id));
    const gerentesActivos = gerentesRows.filter((r) => (Number(r.sp_totales) || 0) > 0);
    const gerentesSpSum = gerentesActivos.reduce((s, r) => s + (Number(r.sp_totales) || 0), 0);
    const gerentesMax = gerentesActivos.reduce((m, r) => Math.max(m, Number(r.sp_totales) || 0), 0);
    const gerentesBlock = {
      usuarios: gerentesRows.length,
      activos: gerentesActivos.length,
      participacionPct: safeDiv(gerentesActivos.length, gerentesRows.length) * 100,
      avgActivos: safeDiv(gerentesSpSum, gerentesActivos.length),
      maxSp: gerentesMax,
    };

    const { count: comTotal, error: comTotalErr } = await supabase
      .from("sp_acumulados_comerciales")
      .select("*", { count: "exact", head: true });
    if (comTotalErr) throw comTotalErr;
    const { count: comActivosCount, error: comActErr } = await supabase
      .from("sp_acumulados_comerciales")
      .select("*", { count: "exact", head: true })
      .gt("sp_totales", 0);
    if (comActErr) throw comActErr;
    const { data: comActData, error: comDataErr } = await supabase
      .from("sp_acumulados_comerciales")
      .select("nombre,sp_totales")
      .gt("sp_totales", 0)
      .order("sp_totales", { ascending: false })
      .limit(10000);
    if (comDataErr) throw comDataErr;
    const comRows: ComercialRow[] = (comActData ?? []) as ComercialRow[];
    const comSpSum = comRows.reduce((s, r) => s + (Number(r.sp_totales) || 0), 0);
    const comMax = comRows.reduce((m, r) => Math.max(m, Number(r.sp_totales) || 0), 0);
    const comercialesUsuarios = comTotal ?? 0;
    const comercialesActivos = comActivosCount ?? 0;
    const comercialesBlock = {
      usuarios: comercialesUsuarios,
      activos: comercialesActivos,
      participacionPct: safeDiv(comercialesActivos, comercialesUsuarios) * 100,
      avgActivos: safeDiv(comSpSum, comRows.length),
      maxSp: comMax,
    };
    const topComerciales = comRows.slice(0, 10).map((r) => ({
      nombre: r.nombre,
      sp_totales: Number(r.sp_totales) || 0,
    }));

    const porRol = {
      global: true,
      gerentes: gerentesBlock,
      comerciales: comercialesBlock,
      topComerciales,
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
      activos,
      participacionPct,
      spPromedioActivos,
      mediana,
      p90,
      porCanal,
      porPais,
      distribucionSp,
      porRol,
      uso,
      detalle,

    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gamificacion-agregada] error", message);
    return jsonResponse({ error: message }, 500);
  }
});
