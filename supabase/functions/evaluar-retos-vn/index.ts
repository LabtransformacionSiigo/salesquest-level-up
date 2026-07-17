// Evalúa retos VN (diario/semanal/mensual), rachas y medallas VN.
// Otorga SP Canje a gerentes (gerentes.sp_canje) y persiste en:
// - retos_vn_progreso_diario / _semanal / _mensual (UPSERT idempotente)
// - rachas_vn_estado (UPSERT)
// - medallas_vn_ganadas (INSERT idempotente)
// - sp_acumulados (tipo_sp='canje') y gerentes.sp_canje (via RPC)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──
const toMonthKey = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

const toMonthRange = (d: Date) => {
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
  return { start, end };
};

const isoWeekRange = (d: Date) => {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = dt.getUTCDay() || 7;
  const monday = new Date(dt); monday.setUTCDate(dt.getUTCDate() - dow + 1);
  const next = new Date(monday); next.setUTCDate(next.getUTCDate() + 7);
  return {
    start: monday.toISOString().slice(0, 10),
    end: next.toISOString().slice(0, 10),
    monday,
  };
};

const weekOfMonth = (d: Date) => {
  // 1..4 — semana del mes basada en lunes
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const firstDow = first.getUTCDay() || 7;
  const offset = (firstDow - 1);
  const w = Math.floor(((d.getUTCDate() + offset) - 1) / 7) + 1;
  return Math.max(1, Math.min(4, w));
};

// Paginated SELECT helper — Supabase Data API truncates at 1000 rows.
// Sin esto, ventas_diarias COL (>1000 filas/mes) se trunca y las células
// más rezagadas nunca reciben sus ventas → retos siempre cumple=false.
async function fetchAllRows<T = any>(
  build: (from: number, to: number) => any,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 1_000_000; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

async function ejecutar(body: any): Promise<any> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const dryRun = body.dry_run === true;
    const includeResultados = body.include_resultados === true;
    const filtroPaises = Array.isArray(body.paises) ? body.paises.map((p: any) => String(p).toUpperCase()) : [];
    const filtroCanales = Array.isArray(body.canales) ? body.canales.map((c: any) => String(c).toUpperCase()) : [];
    const filtroGerenteIds = Array.isArray(body.gerente_ids) ? body.gerente_ids.map((id: any) => String(id)) : [];
    const fechaInput = typeof body.fecha === "string" ? body.fecha : null;
    const fechaBase = fechaInput ? new Date(`${fechaInput}T12:00:00Z`) : new Date();
    const today = fechaBase.toISOString().slice(0, 10);
    const monthKey = toMonthKey(fechaBase);

    // Guard: VN gamification (retos / rachas / medallas) solo aplica desde Mayo 2026
    const MIN_PERIOD_VN = "202605";
    if (monthKey < MIN_PERIOD_VN) {
      return { ok: true, skipped: true, reason: `Periodo ${monthKey} < ${MIN_PERIOD_VN}: gamificación VN inicia Mayo 2026` };
    }


    const { start: monthStart, end: monthEnd } = toMonthRange(fechaBase);
    const { start: weekStart, end: weekEnd } = isoWeekRange(fechaBase);
    const semNumMes = weekOfMonth(fechaBase);

    const todayStr = today;
    const isVigente = (it: { fecha_inicio?: string | null; fecha_fin?: string | null }) =>
      (!it.fecha_inicio || todayStr >= it.fecha_inicio) &&
      (!it.fecha_fin || todayStr <= it.fecha_fin);

    // ── Cargar gerentes VN (paginado) ──
    const gerentesArrAll = await fetchAllRows<any>((from, to) =>
      supabase.from("gerentes")
        .select("id, nombre, canal, pais, celula")
        .in("canal", ["VN_ALIADOS", "VN_EMPRESARIOS"])
        .eq("activo", true)
        .range(from, to)
    );
    const gerentesArr = gerentesArrAll.filter((g) => {
      if (filtroGerenteIds.length > 0 && !filtroGerenteIds.includes(String(g.id))) return false;
      if (filtroPaises.length > 0 && !filtroPaises.includes(String(g.pais || "").toUpperCase())) return false;
      if (filtroCanales.length > 0 && !filtroCanales.includes(String(g.canal || "").toUpperCase())) return false;
      return true;
    });
    console.log("[eval-vn] gerentes", gerentesArr.length);
    if (gerentesArr.length === 0) {
      return { ok: true, msg: "Sin gerentes VN activos" };
    }

    const gerenteIds = gerentesArr.map((g) => g.id);

    // ── Cargar retos / rachas / medallas vigentes ──
    const [retosRes, rachasRes, medallasRes, calRes, metasRes] = await Promise.all([
      supabase.from("retos_vn_config").select("*").eq("activo", true),
      supabase.from("rachas_vn_config").select("*").eq("activo", true),
      supabase.from("medallas_vn_config").select("*").eq("activo", true),
      supabase.from("config_calendario_vn").select("*").eq("anio_mes", monthKey),
      supabase.from("metas_acv_gerentes").select("celula, mes, meta_total_und, meta_nube, meta_fe, meta_total_acv, canal, pais"),
    ]);

    const retos = (retosRes.data || []).filter(isVigente);
    const rachas = (rachasRes.data || []).filter(isVigente);
    const medallas = (medallasRes.data || []).filter(isVigente);

    // Calendarios por país: días hábiles del mes + semanas comerciales
    const diasHabilesByPais = new Map<string, number>();
    // weekByPais: para fechaBase, da {start, endExcl, num} segun calendario comercial.
    // null = no hay calendario configurado → se usa fallback ISO (weekStart/weekEnd/semNumMes).
    const weekByPais = new Map<string, { start: string; end: string; num: number } | null>();
    // Cantidad de semanas comerciales del mes por país (para prorrateo meta semanal)
    const semanasCountByPais = new Map<string, number>();
    for (const c of calRes.data || []) {
      diasHabilesByPais.set(c.pais, Number(c.dias_habiles) || 20);
      const semanas: any[] = Array.isArray(c.semanas) ? c.semanas : [];
      semanasCountByPais.set(c.pais, semanas.length || 4);
      const hit = semanas.find((s) => {
        const ini = String(s.fecha_inicio || "");
        const fin = String(s.fecha_fin || "");
        return ini && fin && today >= ini && today <= fin;
      });
      if (hit) {
        const finDate = new Date(`${hit.fecha_fin}T12:00:00Z`);
        finDate.setUTCDate(finDate.getUTCDate() + 1);
        weekByPais.set(c.pais, {
          start: String(hit.fecha_inicio),
          end: finDate.toISOString().slice(0, 10),
          num: Number(hit.numero) || 1,
        });
      } else {
        weekByPais.set(c.pais, null);
      }
    }


    // Metas por (celula, mes-num). Mes en metas viene como "Ene","Feb",... o "Mayo"
    const mesNombre = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][fechaBase.getUTCMonth()];
    // Normaliza acentos/case/espacios para que "Equipo México" y "Equipo Mexico" hagan match
    const normCelula = (s: string | null | undefined) =>
      (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
    const metaKey = (pais?: string | null, canal?: string | null, celula?: string | null) =>
      `${String(pais || "").toUpperCase()}||${String(canal || "").toUpperCase()}||${normCelula(celula)}`;
    const metasByCelula = new Map<string, any>();
    for (const m of metasRes.data || []) {
      if (!m.celula) continue;
      const mesLower = (m.mes || "").toLowerCase();
      if (mesLower.startsWith(mesNombre.toLowerCase())) {
        metasByCelula.set(metaKey(m.pais, m.canal, m.celula), m);
      }
    }

    // ── Cargar ventas VN del mes (incluye día y semana) ──
    // ventas VN- = transacciones reales (no SUM-)
    // ── Cargar ventas VN del mes (paginado: la tabla puede tener miles de filas) ──
    const ventasMes = await fetchAllRows<any>((from, to) =>
      supabase.from("ventas")
        .select("gerente_id, fecha_facturacion, acv_plus, producto, categoria_producto_venta, bloque_venta, documento_factura, canal")
        .in("canal", ["VN_ALIADOS", "VN_EMPRESARIOS"])
        .gte("fecha_facturacion", monthStart)
        .lt("fecha_facturacion", monthEnd)
        .range(from, to)
    );
    console.log("[eval-vn] ventasMes", (ventasMes || []).length);


    const ventasByGerente = new Map<string, any[]>();
    for (const v of ventasMes || []) {
      if (!v.gerente_id) continue;
      // Solo transacciones VN- (excluye SUM- agregados)
      if (typeof v.documento_factura === "string" && v.documento_factura.startsWith("SUM-")) continue;
      const arr = ventasByGerente.get(v.gerente_id) || [];
      arr.push(v);
      ventasByGerente.set(v.gerente_id, arr);
    }

    // ── Fallback ventas_diarias para países sin transacciones VN en `ventas`:
    // MEX, COL y ECU. Las metas en metas_acv_gerentes son a NIVEL DE CÉLULA,
    // así que TODOS los gerentes del equipo comparten meta y resultado.
    // Replicamos las ventas agregadas del equipo a cada miembro del equipo.
    const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    const PAISES_VD_FALLBACK = ["MEX", "COL", "ECU"];
    const fbGerentes = gerentesArr.filter((g) => {
      const p = (g.pais || "").toUpperCase();
      const c = (g.canal || "").toUpperCase();
      return PAISES_VD_FALLBACK.includes(p) && g.celula &&
        (c === "VN_ALIADOS" || c === "VN_EMPRESARIOS" || p === "MEX");
    });
    if (fbGerentes.length > 0) {
      const gerentesByKey = new Map<string, any[]>(); // key = `${pais}||${celula_norm}`
      for (const g of fbGerentes) {
        const k = `${(g.pais || "").toUpperCase()}||${norm(g.celula)}`;
        if (!gerentesByKey.has(k)) gerentesByKey.set(k, []);
        gerentesByKey.get(k)!.push(g);
      }

      for (const pais of PAISES_VD_FALLBACK) {
        const celulasPais = fbGerentes
          .filter((g) => (g.pais || "").toUpperCase() === pais)
          .map((g) => g.celula!)
          .filter((c, i, a) => a.indexOf(c) === i);
        if (celulasPais.length === 0) continue;

        // Paginado: COL ~1400 filas/mes excede el límite default de 1000.
        const vd = await fetchAllRows<any>((from, to) =>
          supabase.from("ventas_diarias")
            .select("fecha, celula, tipo_producto, unidades, acv, canal_direccion")
            .eq("pais", pais)
            .in("canal_direccion", ["Aliados", "Empresarios"])
            .in("celula", celulasPais)
            .gte("fecha", monthStart)
            .lt("fecha", monthEnd)
            .range(from, to)
        );

        for (const r of vd || []) {
          if (!r.celula) continue;
          const teamGerentes = gerentesByKey.get(`${pais}||${norm(r.celula)}`) || [];
          if (teamGerentes.length === 0) continue;
          const unidades = Math.max(1, Number(r.unidades) || 0);
          const acvUnit = (Number(r.acv) || 0) / unidades;
          const producto = String(r.tipo_producto || "").toUpperCase();
          for (const member of teamGerentes) {
            const arr = ventasByGerente.get(member.id) || [];
            for (let i = 0; i < unidades; i++) {
              arr.push({
                gerente_id: member.id,
                fecha_facturacion: r.fecha,
                acv_plus: acvUnit,
                producto,
                categoria_producto_venta: producto,
                bloque_venta: producto,
                documento_factura: `VD-${pais}-${r.fecha}-${i}`,
                canal: member.canal,
              });
            }
            ventasByGerente.set(member.id, arr);
          }
        }
      }
    }

    // Clasificar familia NUBE simple (cualquier "nube" o "cloud" o "pyme" o "siigo nube")
    const NUBE_KW = ["nube","cloud","pyme","lite","emprendedor","premium","profesional independiente","sci","contai","mto","nomina ili"];
    const isNube = (sale: any) => {
      const raw = `${sale.producto||""} ${sale.categoria_producto_venta||""} ${sale.bloque_venta||""}`
        .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      return NUBE_KW.some((k) => raw.includes(k));
    };

    // ── Estados de retos previos (para medallas que cuentan completados) ──
    const [diariosPrevRes, semanalesPrevRes, mensualesPrevRes, rachasEstadoRes] = await Promise.all([
      supabase.from("retos_vn_progreso_diario").select("gerente_id, reto_id, cumple").in("gerente_id", gerenteIds),
      supabase.from("retos_vn_progreso_semanal").select("gerente_id, reto_id, cumple, anio_mes").in("gerente_id", gerenteIds),
      supabase.from("retos_vn_progreso_mensual").select("gerente_id, reto_id, cumple, anio_mes").in("gerente_id", gerenteIds),
      supabase.from("rachas_vn_estado").select("gerente_id, racha_id, racha_activa, dias_o_semanas_consecutivas").in("gerente_id", gerenteIds),
    ]);

    const completadosDiarios = new Map<string, number>();
    for (const r of diariosPrevRes.data || []) if (r.cumple) {
      completadosDiarios.set(r.gerente_id, (completadosDiarios.get(r.gerente_id) || 0) + 1);
    }
    const completadosSemanales = new Map<string, number>();
    for (const r of semanalesPrevRes.data || []) if (r.cumple) {
      completadosSemanales.set(r.gerente_id, (completadosSemanales.get(r.gerente_id) || 0) + 1);
    }
    const completadosMensuales = new Map<string, number>();
    for (const r of mensualesPrevRes.data || []) if (r.cumple) {
      completadosMensuales.set(r.gerente_id, (completadosMensuales.get(r.gerente_id) || 0) + 1);
    }
    const rachasActivasDiarias = new Map<string, number>();
    const rachasActivasSemanales = new Map<string, number>();

    // ── Medallas ya ganadas (idempotencia) ──
    const { data: medallasGanadasPrev } = await supabase
      .from("medallas_vn_ganadas")
      .select("gerente_id, medalla_id")
      .in("gerente_id", gerenteIds);
    const medallasGanadasSet = new Set(
      (medallasGanadasPrev || []).map((m) => `${m.gerente_id}::${m.medalla_id}`),
    );

    // ── Estructuras de salida ──
    const upsertsDiario: any[] = [];
    const upsertsSemanal: any[] = [];
    const upsertsMensual: any[] = [];
    const upsertsRacha: any[] = [];
    const insertsMedalla: any[] = [];
    const spInserts: any[] = [];
    const resultados: any[] = [];

    // SP semanal según semana del mes (por país, usando calendario comercial)
    const spSemanalForN = (reto: any, n: number) => {
      switch (n) {
        case 1: return Number(reto.sp_semanal_sem1) || 0;
        case 2: return Number(reto.sp_semanal_sem2) || 0;
        case 3: return Number(reto.sp_semanal_sem3) || 0;
        default: return Number(reto.sp_semanal_sem4) || 0;
      }
    };

    for (const g of gerentesArr) {
      const canal = g.canal as string;
      const pais = (g.pais || "COL").toUpperCase();
      const ventas = ventasByGerente.get(g.id) || [];
      const meta = g.celula ? metasByCelula.get(metaKey(pais, canal, g.celula)) : null;
      const diasHabiles = diasHabilesByPais.get(pais) || 20;

      // Semana comercial del país (si hay calendario en config_calendario_vn)
      const wkCal = weekByPais.get(pais);
      const gWeekStart = wkCal?.start ?? weekStart;
      const gWeekEnd = wkCal?.end ?? weekEnd;
      const gSemNum = wkCal?.num ?? semNumMes;

      const metaNubeMes = Number(meta?.meta_nube) || 0;
      const metaAcvMes = Number(meta?.meta_total_acv) || 0;
      const metaTotalUndMes = Number(meta?.meta_total_und) || 0;
      const metaDiariaNubes = metaNubeMes > 0 ? metaNubeMes / diasHabiles : 0;
      const metaDiariaUnd = metaTotalUndMes > 0 ? metaTotalUndMes / diasHabiles : 0;

      const nubesHoy = ventas.filter((v) => v.fecha_facturacion === today && isNube(v)).length;
      const unidadesHoy = ventas.filter((v) => v.fecha_facturacion === today).length;
      const pctUndDia = metaDiariaUnd > 0 ? (unidadesHoy / metaDiariaUnd) * 100 : 0;
      const nubesSemana = ventas.filter((v) => v.fecha_facturacion >= gWeekStart && v.fecha_facturacion < gWeekEnd && isNube(v)).length;
      const acvSemana = ventas.filter((v) => v.fecha_facturacion >= gWeekStart && v.fecha_facturacion < gWeekEnd)
        .reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
      const acvMes = ventas.reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
      const pctMes = metaAcvMes > 0 ? (acvMes / metaAcvMes) * 100 : 0;
      const numSemanasMes = semanasCountByPais.get(pais) || 4;
      const metaSemanalAcv = metaAcvMes > 0 ? metaAcvMes / numSemanasMes : 0;
      const pctSemana = metaSemanalAcv > 0 ? (acvSemana / metaSemanalAcv) * 100 : 0;


      for (const reto of retos) {
        // Filtrar por canal/país
        const canalesReto = (reto.canal as string[]) || [];
        const paisesReto = (reto.paises as string[]) || [];
        if (canalesReto.length > 0 && !canalesReto.includes(canal)) continue;
        if (paisesReto.length > 0 && !paisesReto.includes(pais)) continue;

        const tipo = reto.tipo as string;
        const kpi = reto.kpi as string;
        let cumple = false;
        let sp = 0;
        let detalle = "";

        if (tipo === "DIARIO" && kpi === "NUBES") {
          cumple = metaDiariaNubes > 0 && nubesHoy >= Math.ceil(metaDiariaNubes);
          sp = cumple ? (Number(reto.sp_base) || 0) : 0;
          detalle = `nubes:${nubesHoy} meta:${Math.ceil(metaDiariaNubes)}`;
          upsertsDiario.push({
            reto_id: reto.id, gerente_id: g.id, fecha_evaluacion: today,
            nubes_vendidas: nubesHoy, meta_diaria_nubes: metaDiariaNubes,
            cumple, sp_otorgados: sp, sp_con_racha: sp,
          });
        } else if (tipo === "DIARIO" && (kpi === "UNIDADES_70_79" || kpi === "UNIDADES_80_89" || kpi === "UNIDADES_90")) {
          // El Golazo del Día: rangos exclusivos de % unidades vs meta diaria
          if (metaDiariaUnd > 0) {
            if (kpi === "UNIDADES_70_79") cumple = pctUndDia >= 70 && pctUndDia < 80;
            else if (kpi === "UNIDADES_80_89") cumple = pctUndDia >= 80 && pctUndDia < 90;
            else cumple = pctUndDia >= 90;
          }
          sp = cumple ? (Number(reto.sp_base) || 0) : 0;
          detalle = `und:${unidadesHoy} meta_dia:${metaDiariaUnd.toFixed(2)} pct:${pctUndDia.toFixed(1)}`;
          upsertsDiario.push({
            reto_id: reto.id, gerente_id: g.id, fecha_evaluacion: today,
            nubes_vendidas: unidadesHoy, meta_diaria_nubes: metaDiariaUnd,
            cumple, sp_otorgados: sp, sp_con_racha: sp,
          });
        } else if (tipo === "SEMANAL") {
          if (kpi === "NUBES") {
            const metaSemNubes = metaNubeMes > 0 ? Math.ceil(metaNubeMes / 4) : 0;
            cumple = metaSemNubes > 0 && nubesSemana >= metaSemNubes;
            detalle = `nubes_sem:${nubesSemana} meta:${metaSemNubes}`;
            sp = cumple ? spSemanalForN(reto, gSemNum) : 0;
          } else if (kpi === "ACV_SEM_GTE_100K") {
            cumple = acvSemana >= 100000;
            sp = cumple ? (Number(reto.sp_base) || 0) : 0;
            detalle = `acv_sem:${Math.round(acvSemana)} (>=100k)`;
          } else if (kpi === "ACV_SEM_87K_100K") {
            cumple = acvSemana >= 87500 && acvSemana < 100000;
            sp = cumple ? (Number(reto.sp_base) || 0) : 0;
            detalle = `acv_sem:${Math.round(acvSemana)} (87.5k-100k)`;
          } else if (kpi === "ACV_SEM_62K_87K") {
            cumple = acvSemana >= 62500 && acvSemana < 87500;
            sp = cumple ? (Number(reto.sp_base) || 0) : 0;
            detalle = `acv_sem:${Math.round(acvSemana)} (62.5k-87.5k)`;
          } else {
            cumple = pctSemana >= 100;
            sp = cumple ? spSemanalForN(reto, gSemNum) : 0;
            detalle = `acv_sem:${Math.round(acvSemana)} pct:${pctSemana.toFixed(1)}`;
          }
          upsertsSemanal.push({
            reto_id: reto.id, gerente_id: g.id, anio_mes: monthKey,
            semana_numero: gSemNum, fecha_inicio_semana: gWeekStart, fecha_fin_semana: gWeekEnd,
            acv_real: acvSemana, meta_semanal_acv: metaSemanalAcv,
            pct_cumplimiento: pctSemana, cumple, sp_otorgados: sp, sp_con_racha: sp,
          });
        } else if (tipo === "MENSUAL") {
          if (kpi === "ACV_MES_80") {
            cumple = pctMes >= 80;
            detalle = `pct_mes:${pctMes.toFixed(1)} (>=80%)`;
          } else {
            cumple = pctMes >= 100;
            detalle = `pct_mes:${pctMes.toFixed(1)}`;
          }
          sp = cumple ? (Number(reto.sp_base) || 0) : 0;
          upsertsMensual.push({
            reto_id: reto.id, gerente_id: g.id, anio_mes: monthKey,
            acv_real: acvMes, meta_mensual_acv: metaAcvMes,
            pct_cumplimiento: pctMes, cumple, sp_otorgados: sp,
          });
        }

        resultados.push({ gerente: g.nombre, reto: reto.nombre, tipo, kpi, cumple, sp, detalle });

        if (cumple && sp > 0) {
          const fuente = tipo === "DIARIO" ? "RETO_DIARIO" : tipo === "SEMANAL" ? "RETO_SEMANAL" : "RETO_MENSUAL";
          const periodo = tipo === "DIARIO" ? today : tipo === "SEMANAL" ? `${monthKey}-S${gSemNum}` : monthKey;
          spInserts.push({
            gerente_id: g.id, fuente, sp, periodo, tipo_sp: "canje",
            detalle: `${reto.nombre} · ${tipo} · ${kpi} · ${detalle}`,
          });
        }
      }


      // ── Rachas VN ──
      for (const racha of rachas) {
        const canales = (racha.canal as string[]) || [];
        const paises = (racha.paises as string[]) || [];
        if (canales.length > 0 && !canales.includes(canal)) continue;
        if (paises.length > 0 && !paises.includes(pais)) continue;

        const estadoPrev = (rachasEstadoRes.data || []).find(
          (r) => r.gerente_id === g.id && r.racha_id === racha.id,
        );
        const tipo = racha.tipo as "DIARIA" | "SEMANAL";
        const req = Number(racha.dias_consecutivos_requeridos) || 3;

        // Cumplió HOY (diario) o ESTA SEMANA (semanal): basado en reto referenciado si existe
        let cumpleHoy = false;
        if (racha.reto_ref_id) {
          if (tipo === "DIARIA") {
            const u = upsertsDiario.find((r) => r.gerente_id === g.id && r.reto_id === racha.reto_ref_id);
            cumpleHoy = !!u?.cumple;
          } else {
            const u = upsertsSemanal.find((r) => r.gerente_id === g.id && r.reto_id === racha.reto_ref_id);
            cumpleHoy = !!u?.cumple;
          }
        }

        const prevDias = estadoPrev?.dias_o_semanas_consecutivas || 0;
        const nuevoConteo = cumpleHoy ? prevDias + 1 : 0;
        const activa = nuevoConteo >= req;

        upsertsRacha.push({
          racha_id: racha.id, gerente_id: g.id,
          dias_o_semanas_consecutivas: nuevoConteo,
          racha_activa: activa,
          ultima_fecha_cumplida: cumpleHoy ? (tipo === "DIARIA" ? today : gWeekEnd) : (estadoPrev?.ultima_fecha_cumplida ?? null),
        });

        if (activa) {
          if (tipo === "DIARIA") rachasActivasDiarias.set(g.id, (rachasActivasDiarias.get(g.id) || 0) + 1);
          else rachasActivasSemanales.set(g.id, (rachasActivasSemanales.get(g.id) || 0) + 1);
        }

        // Bonus por multiplicador: aplica a SP que ya se acaba de otorgar para reto referenciado hoy
        if (activa && cumpleHoy && racha.reto_ref_id) {
          const spBase = spInserts
            .filter((s) => s.gerente_id === g.id && s.detalle.includes(reto_nombre_lookup(retos, racha.reto_ref_id)))
            .reduce((s, x) => s + x.sp, 0);
          const bonus = Math.round(spBase * ((Number(racha.multiplicador) || 1) - 1));
          if (bonus > 0) {
            spInserts.push({
              gerente_id: g.id,
              fuente: tipo === "DIARIA" ? "RETO_DIARIO" : "RETO_SEMANAL",
              sp: bonus,
              periodo: tipo === "DIARIA" ? today : `${monthKey}-S${gSemNum}`,
              tipo_sp: "canje",
              detalle: `RACHA · ${racha.nombre} · multiplicador ${racha.multiplicador}x`,
            });
          }
        }
      }

      // ── Medallas VN ──
      const completosD = (completadosDiarios.get(g.id) || 0) + upsertsDiario.filter((u) => u.gerente_id === g.id && u.cumple).length;
      const completosS = (completadosSemanales.get(g.id) || 0) + upsertsSemanal.filter((u) => u.gerente_id === g.id && u.cumple).length;
      const completosM = (completadosMensuales.get(g.id) || 0) + upsertsMensual.filter((u) => u.gerente_id === g.id && u.cumple).length;
      const racD = rachasActivasDiarias.get(g.id) || 0;
      const racS = rachasActivasSemanales.get(g.id) || 0;

      for (const m of medallas) {
        const canales = (m.canal as string[]) || [];
        const paises = (m.paises as string[]) || [];
        if (canales.length > 0 && !canales.includes(canal)) continue;
        if (paises.length > 0 && !paises.includes(pais)) continue;
        const key = `${g.id}::${m.id}`;
        if (medallasGanadasSet.has(key)) continue;

        const val = Number(m.condicion_valor) || 1;
        let gana = false;
        switch (m.condicion_tipo) {
          case "racha_diaria_activada": gana = racD >= val; break;
          case "racha_semanal_activada": gana = racS >= val; break;
          case "reto_diario_completado_n": gana = completosD >= val; break;
          case "reto_semanal_completado_n": gana = completosS >= val; break;
          case "reto_mensual_completado": gana = completosM >= val; break;
          case "cumplimiento_100_pct_mes": gana = pctMes >= 100; break;
        }
        if (!gana) continue;
        const sp = Number(m.sp_reward) || 0;
        insertsMedalla.push({ gerente_id: g.id, medalla_id: m.id, sp_otorgados: sp });
        medallasGanadasSet.add(key);
        if (sp > 0) {
          spInserts.push({
            gerente_id: g.id, fuente: "MEDALLA", sp, periodo: monthKey,
            tipo_sp: "canje", detalle: `MEDALLA · ${m.nombre}`,
          });
        }
        resultados.push({ gerente: g.nombre, medalla: m.nombre, sp });
      }
    }

    if (dryRun) {
      return {
        ok: true, dry_run: true,
        evaluados: resultados.length,
        gerentes_evaluados: gerentesArr.length,
        retos_diarios: upsertsDiario.length,
        retos_semanales: upsertsSemanal.length,
        retos_mensuales: upsertsMensual.length,
        rachas: upsertsRacha.length,
        medallas: insertsMedalla.length,
        sp_total: spInserts.reduce((s, x) => s + x.sp, 0),
        resultados: includeResultados ? resultados : resultados.filter((r) => r.cumple || Number(r.sp) > 0).slice(0, 200),
      };
    }


    console.log("[eval-vn] eval done, persistiendo", upsertsDiario.length, upsertsSemanal.length, upsertsMensual.length);
    // ── Persistir ──
    const chunk = <T,>(arr: T[], n = 500) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };
    const errores: string[] = [];

    for (const c of chunk(upsertsDiario)) {
      const { error } = await supabase.from("retos_vn_progreso_diario")
        .upsert(c, { onConflict: "reto_id,gerente_id,fecha_evaluacion" });
      if (error) errores.push(`diario: ${error.message}`);
    }
    for (const c of chunk(upsertsSemanal)) {
      const { error } = await supabase.from("retos_vn_progreso_semanal")
        .upsert(c, { onConflict: "reto_id,gerente_id,anio_mes,semana_numero" });
      if (error) errores.push(`semanal: ${error.message}`);
    }
    for (const c of chunk(upsertsMensual)) {
      const { error } = await supabase.from("retos_vn_progreso_mensual")
        .upsert(c, { onConflict: "reto_id,gerente_id,anio_mes" });
      if (error) errores.push(`mensual: ${error.message}`);
    }
    for (const c of chunk(upsertsRacha)) {
      const { error } = await supabase.from("rachas_vn_estado")
        .upsert(c, { onConflict: "racha_id,gerente_id" });
      if (error) errores.push(`rachas: ${error.message}`);
    }
    if (insertsMedalla.length > 0) {
      const { error } = await supabase.from("medallas_vn_ganadas")
        .upsert(insertsMedalla, { onConflict: "medalla_id,gerente_id", ignoreDuplicates: true });
      if (error) errores.push(`medallas: ${error.message}`);
    }
    let spPersistidos = 0;
    let spDeltaNeto = 0;
    if (spInserts.length > 0) {
      // La tabla sp_acumulados tiene una sola fila permitida por
      // (gerente_id, fuente, periodo). Por eso agregamos TODOS los retos
      // cumplidos del mismo día/semana/mes en una fila, en vez de intentar
      // insertar una fila por reto y chocar con el índice único.
      const periodos = Array.from(new Set(spInserts.map((s) => s.periodo)));
      const { data: yaExistentes } = await supabase
        .from("sp_acumulados")
        .select("gerente_id, fuente, periodo, sp")
        .in("gerente_id", gerenteIds)
        .in("periodo", periodos);
      const seenMap = new Map<string, number>();
      for (const r of yaExistentes || []) {
        seenMap.set(`${r.gerente_id}::${r.fuente}::${r.periodo}`, Number(r.sp) || 0);
      }
      // Agregar SP por (gerente_id, fuente, periodo), preservando detalle auditable.
      const aggregatedByKey = new Map<string, any>();
      for (const s of spInserts) {
        const k = `${s.gerente_id}::${s.fuente}::${s.periodo}`;
        const prev = aggregatedByKey.get(k);
        if (!prev) {
          aggregatedByKey.set(k, { ...s, detalle: s.detalle });
        } else {
          prev.sp += Number(s.sp) || 0;
          prev.detalle = `${prev.detalle} | ${s.detalle}`;
        }
      }
      const spRowsToUpsert: any[] = [];
      const deltasByGid = new Map<string, number>();
      for (const [k, s] of aggregatedByKey) {
        const prevSp = seenMap.get(k) || 0;
        const nextSp = Number(s.sp) || 0;
        const delta = nextSp - prevSp;
        if (delta !== 0) {
          spRowsToUpsert.push(s);
          deltasByGid.set(s.gerente_id, (deltasByGid.get(s.gerente_id) || 0) + delta);
        }
      }

      for (const c of chunk(spRowsToUpsert)) {
        const { error } = await supabase
          .from("sp_acumulados")
          .upsert(c, { onConflict: "gerente_id,fuente,periodo" });
        if (error) errores.push(`sp_acumulados: ${error.message}`);
        else spPersistidos += c.length;
      }
      // Ajustar gerentes.sp_canje por el delta neto, positivo o negativo.
      for (const [gid, tot] of deltasByGid.entries()) {
        if (tot !== 0) {
          await supabase.rpc("increment_gerente_sp_canje", { p_gerente_id: gid, p_delta: tot });
          spDeltaNeto += tot;
        }
      }
    }


    console.log("[eval-vn] persist done");
    return {
      ok: true,
      evaluados: resultados.length,
      gerentes_evaluados: gerentesArr.length,
      retos_diarios: upsertsDiario.length,
      retos_semanales: upsertsSemanal.length,
      retos_mensuales: upsertsMensual.length,
      rachas: upsertsRacha.length,
      medallas: insertsMedalla.length,
      sp_total: spInserts.reduce((s, x) => s + x.sp, 0),
      sp_persistidos: spPersistidos,
      sp_delta_neto: spDeltaNeto,
      errores,
      resultados: includeResultados ? resultados : resultados.filter((r) => r.cumple || Number(r.sp) > 0).slice(0, 200),
    };
  } catch (err) {
    console.error("evaluar-retos-vn error", err);
    return { ok: false, error: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    if (body.async === true) {
      // @ts-ignore EdgeRuntime existe en runtime de Supabase
      EdgeRuntime.waitUntil(
        ejecutar(body)
          .then((r) => console.log("evaluar-retos-vn async ok", JSON.stringify({ sp_total: r?.sp_total, retos_diarios: r?.retos_diarios })))
          .catch((e) => console.error("evaluar-retos-vn async error", e?.message || String(e))),
      );
      return new Response(JSON.stringify({ ok: true, accepted: true, mode: "async" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const result = await ejecutar(body);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function reto_nombre_lookup(retos: any[], id: string): string {
  const r = retos.find((x) => x.id === id);
  return r?.nombre || "";
}
