import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPANISH_MONTHS: Record<number, string> = {
  1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
  5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
  9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
};

const MONTH_NUMBERS_ES: Record<string, string> = {
  Enero: "01",
  Febrero: "02",
  Marzo: "03",
  Abril: "04",
  Mayo: "05",
  Junio: "06",
  Julio: "07",
  Agosto: "08",
  Septiembre: "09",
  Octubre: "10",
  Noviembre: "11",
  Diciembre: "12",
};

const getPeriodFromSpanishMonth = (year?: number | null, monthName?: string | null) => {
  if (!year || !monthName) return null;
  const monthNumber = MONTH_NUMBERS_ES[monthName];
  return monthNumber ? `${year}${monthNumber}` : null;
};

const getPeriodFromDate = (dateValue?: string | null) => {
  if (!dateValue) return null;
  const [year, month] = dateValue.split("-");
  if (!year || !month) return null;
  return `${year}${month}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authUser }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !authUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleData } = await supabase
        .from("user_roles").select("role").eq("user_id", authUser.id).maybeSingle();
      if (roleData?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Solo admins pueden ejecutar esta función" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semanaActual = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const anioActual = d.getUTCFullYear();
    const mesActual = `${anioActual}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthName = SPANISH_MONTHS[now.getMonth() + 1] || "Enero";
    const periodoSemana = `${anioActual}-W${String(semanaActual).padStart(2, "0")}`;
    const yearStartDate = `${anioActual}-01-01`;
    const nextYearStartDate = `${anioActual + 1}-01-01`;
    const currentMonthStart = `${anioActual}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const nextMonthStart = now.getMonth() === 11
      ? `${anioActual + 1}-01-01`
      : `${anioActual}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

    // ── Batch load all data upfront ──
    const [gerentesRes, configRachasRes, medalCatalogRes] = await Promise.all([
      supabase.from("gerentes").select("id, canal, nombre").eq("activo", true),
      supabase.from("config_rachas").select("canal, umbral_verde").eq("condicion_tipo", "ventas_semanales").eq("activo", true),
      supabase.from("catalogo_medallas").select("*").eq("activo", true),
    ]);

    const gerentes = gerentesRes.data || [];
    if (gerentes.length === 0) {
      return new Response(
        JSON.stringify({ procesados: 0, sp_otorgados: 0, errores: ["No hay gerentes activos"] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const umbralMap: Record<string, number> = {};
    (configRachasRes.data || []).forEach((cr) => { umbralMap[cr.canal] = Number(cr.umbral_verde) || 0; });

    const medalsByCanal: Record<string, any[]> = {};
    (medalCatalogRes.data || []).forEach((m) => {
      if (!medalsByCanal[m.canal]) medalsByCanal[m.canal] = [];
      medalsByCanal[m.canal].push(m);
    });

    // ── Batch load ventas for VC (year to date, monthly SUM rows only) ──
    const { data: allVentasVc } = await supabase
      .from("ventas")
      .select("gerente_id, acv_plus, meta, mes, anio, documento_factura")
      .eq("canal", "VC")
      .eq("anio", anioActual)
      .like("documento_factura", "SUM-%");

    const vcMonthlyByGerente = new Map<string, Map<string, { mes: string; acv: number; meta: number }>>();
    (allVentasVc || []).forEach((v) => {
      if (!v.gerente_id) return;
      const periodo = getPeriodFromSpanishMonth(v.anio, v.mes);
      if (!periodo) return;

      const monthlyRows = vcMonthlyByGerente.get(v.gerente_id) || new Map<string, { mes: string; acv: number; meta: number }>();
      const entry = monthlyRows.get(periodo) || { mes: v.mes || currentMonthName, acv: 0, meta: 0 };
      entry.acv += Number(v.acv_plus) || 0;
      entry.meta += Number(v.meta) || 0;
      monthlyRows.set(periodo, entry);
      vcMonthlyByGerente.set(v.gerente_id, monthlyRows);
    });

    // ── Batch load kpis_mensuales for VN gerentes (all months this year) ──
    const [kpisAllRes, metasGerentesRes, gerentesFullRes] = await Promise.all([
      supabase.from("kpis_mensuales")
        .select("gerente_id, anio_mes, ventas, meta, acv_f, canal")
        .gte("anio_mes", `${anioActual}01`)
        .lte("anio_mes", `${anioActual}12`),
      supabase.from("metas_gerentes")
        .select("celula, canal_direccion, meta_total_acv, cuota"),
      supabase.from("gerentes")
        .select("id, celula, canal")
        .eq("activo", true),
    ]);

    const allKpis = kpisAllRes.data;

    // Group KPIs by gerente_id
    const kpisByGerente = new Map<string, any[]>();
    (allKpis || []).forEach((k) => {
      if (!k.gerente_id) return;
      const arr = kpisByGerente.get(k.gerente_id) || [];
      arr.push(k);
      kpisByGerente.set(k.gerente_id, arr);
    });

    // Build meta ACV map by celula+canal for VN gerentes
    const metaAcvByCelula = new Map<string, number>();
    (metasGerentesRes.data || []).forEach((m: any) => {
      const key = `${(m.celula || "").trim()}|${m.canal_direccion}`;
      metaAcvByCelula.set(key, Number(m.meta_total_acv) || Number(m.cuota) || 0);
    });

    // Build celula map for gerentes
    const celulaPorGerente = new Map<string, string>();
    (gerentesFullRes.data || []).forEach((g: any) => {
      if (g.id && g.celula) celulaPorGerente.set(g.id, g.celula);
    });

    let totalSpOtorgados = 0;
    const errores: string[] = [];
    let procesados = 0;
    const resumenCanal: Record<string, { procesados: number; sp: number }> = {};

    // ── Prepare batch upserts ──
    const spUpserts: any[] = [];

    for (const gerente of gerentes) {
      const canal = gerente.canal || "VC";
      if (!resumenCanal[canal]) resumenCanal[canal] = { procesados: 0, sp: 0 };

      try {
        if (canal === "VC") {
          const monthlyRows = vcMonthlyByGerente.get(gerente.id);
          for (const [periodo, agg] of monthlyRows?.entries() || []) {
            if (agg.meta <= 0) continue;

            const spFinal = Math.round((agg.acv / agg.meta) * 100);
            if (spFinal > 0) {
              spUpserts.push({
                gerente_id: gerente.id, fuente: "CUMPLIMIENTO_META", sp: spFinal,
                periodo, detalle: `Cumplimiento de Meta: ${spFinal}% · VC · ${agg.mes}`, tipo_sp: "convencion",
              });
              totalSpOtorgados += spFinal;
              resumenCanal[canal].sp += spFinal;
            }
          }
        } else {
          // VN channels: SP from ACV / Meta ACV (como VC)
          const kpis = (kpisByGerente.get(gerente.id) || []).filter((k) => k.canal === canal);
          const canalNorm = canal === "VN_ALIADOS" ? "Aliados" : "Empresarios";
          const gerenteCelula = celulaPorGerente.get(gerente.id) || "";
          const metaAcv = metaAcvByCelula.get(`${gerenteCelula}|${canalNorm}`) || 0;

          for (const kpi of kpis) {
            const acvVal = Number(kpi.acv_f) || 0;
            // Use ACV / Meta ACV if available, otherwise fallback to units
            let spFinal = 0;
            if (metaAcv > 0 && acvVal > 0) {
              spFinal = Math.round((acvVal / metaAcv) * 100);
            } else {
              const metaVal = Number(kpi.meta) || 0;
              const ventasVal = Number(kpi.ventas) || 0;
              if (metaVal > 0 && ventasVal > 0) spFinal = Math.round((ventasVal / metaVal) * 100);
            }
            if (spFinal <= 0) continue;
            spUpserts.push({
              gerente_id: gerente.id, fuente: "CUMPLIMIENTO_META", sp: spFinal,
              periodo: String(kpi.anio_mes), detalle: `Cumplimiento ACV: ${spFinal}% · ${canal} · ${kpi.anio_mes}`, tipo_sp: "convencion",
            });
            totalSpOtorgados += spFinal;
            resumenCanal[canal].sp += spFinal;
          }
        }
        procesados++;
        resumenCanal[canal].procesados++;
      } catch (err) {
        if (errores.length < 30) errores.push(`${canal}/${gerente.nombre}: ${String(err)}`);
      }
    }

    // ── Batch upsert all SP records ──
    if (spUpserts.length > 0) {
      // Process in chunks of 500
      for (let i = 0; i < spUpserts.length; i += 500) {
        const chunk = spUpserts.slice(i, i + 500);
        const { error: batchErr } = await supabase
          .from("sp_acumulados")
          .upsert(chunk, { onConflict: "gerente_id,fuente,periodo" });
        if (batchErr) {
          errores.push(`Batch SP upsert error: ${batchErr.message}`);
        }
      }
    }

    // ── Rachas: batch load weekly ventas + last rachas ──
    const weekStartDate = getISOWeekStartDate(semanaActual, anioActual);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 7);
    const weekStartStr = weekStartDate.toISOString().split("T")[0];
    const weekEndStr = weekEndDate.toISOString().split("T")[0];

    const [weekVentasRes, lastRachasRes] = await Promise.all([
      supabase.from("ventas").select("gerente_id, valor_producto")
        .gte("fecha_facturacion", weekStartStr).lt("fecha_facturacion", weekEndStr),
      supabase.from("rachas").select("gerente_id, semanas_consecutivas, anio, semana_iso")
        .eq("anio", anioActual).order("semana_iso", { ascending: false }),
    ]);

    // Aggregate weekly sales by gerente
    const weekSalesByGerente = new Map<string, number>();
    (weekVentasRes.data || []).forEach((v) => {
      if (!v.gerente_id) return;
      weekSalesByGerente.set(v.gerente_id, (weekSalesByGerente.get(v.gerente_id) || 0) + (Number(v.valor_producto) || 0));
    });

    // Get latest racha per gerente
    const lastRachaByGerente = new Map<string, number>();
    (lastRachasRes.data || []).forEach((r) => {
      if (!r.gerente_id || lastRachaByGerente.has(r.gerente_id)) return;
      lastRachaByGerente.set(r.gerente_id, r.semanas_consecutivas || 0);
    });

    // Batch upsert rachas
    const rachaUpserts: any[] = [];
    for (const gerente of gerentes) {
      const canal = gerente.canal || "VC";
      const totalVentas = weekSalesByGerente.get(gerente.id) || 0;
      const semanasConsecutivasPrev = lastRachaByGerente.get(gerente.id) || 0;
      const umbral = umbralMap[canal] || 50000000;

      let estado: string;
      let nuevasConsecutivas: number;
      if (totalVentas >= umbral) {
        estado = "VERDE"; nuevasConsecutivas = semanasConsecutivasPrev + 1;
      } else if (totalVentas >= umbral * 0.8) {
        estado = "AMARILLA"; nuevasConsecutivas = 0;
      } else {
        estado = "ROJA"; nuevasConsecutivas = 0;
      }

      // Calculate multiplicador inline (avoid RPC per gerente)
      const multiplicador = nuevasConsecutivas >= 12 ? 2.0
        : nuevasConsecutivas >= 8 ? 1.75
        : nuevasConsecutivas >= 6 ? 1.5
        : nuevasConsecutivas >= 4 ? 1.25
        : nuevasConsecutivas >= 2 ? 1.1
        : 1.0;

      rachaUpserts.push({
        gerente_id: gerente.id, semana_iso: semanaActual, anio: anioActual,
        ingresos_semana: totalVentas, estado, semanas_consecutivas: nuevasConsecutivas,
        multiplicador,
      });
    }

    if (rachaUpserts.length > 0) {
      for (let i = 0; i < rachaUpserts.length; i += 500) {
        const chunk = rachaUpserts.slice(i, i + 500);
        const { error: rachaErr } = await supabase
          .from("rachas").upsert(chunk, { onConflict: "gerente_id,semana_iso,anio" });
        if (rachaErr) errores.push(`Batch racha upsert: ${rachaErr.message}`);
      }
    }

    // ── Medal evaluation (batch load ventas for medal checks) ──
    // Only evaluate medals for gerentes that have medal catalogs for their canal
    const gerentesWithMedals = gerentes.filter((g) => medalsByCanal[g.canal || "VC"]?.length > 0);
    if (gerentesWithMedals.length > 0) {
      // Batch load existing medals to skip already-awarded
      const { data: existingMedals } = await supabase
        .from("medallas").select("gerente_id, medalla");
      const existingMedalSet = new Set<string>();
      (existingMedals || []).forEach((m) => existingMedalSet.add(`${m.gerente_id}|${m.medalla}`));

      // Batch load ventas counts by gerente+product for medal checks
      const { data: ventasForMedals } = await supabase
        .from("ventas").select("gerente_id, producto, canal, acv_plus")
        .in("gerente_id", gerentesWithMedals.map((g) => g.id));

      const ventasByGerente = new Map<string, any[]>();
      (ventasForMedals || []).forEach((v) => {
        if (!v.gerente_id) return;
        const arr = ventasByGerente.get(v.gerente_id) || [];
        arr.push(v);
        ventasByGerente.set(v.gerente_id, arr);
      });

      // Batch load kpis_mes_actual for cumplimiento + recomendados medals
      const { data: kpisMesActual } = await supabase
        .from("kpis_mes_actual").select("gerente_id, pct_cumplimiento, cant_recomendados")
        .in("gerente_id", gerentesWithMedals.map((g) => g.id));
      const kpiMap = new Map<string, any>();
      (kpisMesActual || []).forEach((k) => { if (k.gerente_id) kpiMap.set(k.gerente_id, k); });

      for (const gerente of gerentesWithMedals) {
        const canal = gerente.canal || "VC";
        const medals = medalsByCanal[canal] || [];
        const gVentas = ventasByGerente.get(gerente.id) || [];
        const gKpi = kpiMap.get(gerente.id);

        for (const medal of medals) {
          const medalKey = `${gerente.id}|${medal.nombre}`;
          if (existingMedalSet.has(medalKey)) continue;

          try {
            let earned = false;
            switch (medal.condicion_tipo) {
              case "primera_venta": {
                const count = gVentas.filter((v) =>
                  v.canal === canal && v.producto?.toLowerCase().includes((medal.producto || "").toLowerCase())
                ).length;
                earned = count >= 1;
                break;
              }
              case "cantidad": {
                if (medal.producto) {
                  const count = gVentas.filter((v) =>
                    v.canal === canal && v.producto?.toLowerCase().includes((medal.producto || "").toLowerCase())
                  ).length;
                  earned = count >= (medal.cantidad_requerida || 1);
                } else if (medal.nombre.includes("Referido") && gKpi) {
                  earned = (Number(gKpi.cant_recomendados) || 0) >= (medal.cantidad_requerida || 1);
                }
                break;
              }
              case "monto": {
                const acvTotal = gVentas
                  .filter((v) => v.canal === canal)
                  .reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
                earned = acvTotal >= (medal.cantidad_requerida || 0);
                break;
              }
              case "cumplimiento": {
                if (gKpi) {
                  earned = Number(gKpi.pct_cumplimiento) >= (medal.cantidad_requerida || 100);
                }
                break;
              }
            }

            if (earned) {
              await supabase.rpc("otorgar_medalla_si_aplica", {
                p_gerente_id: gerente.id, p_medalla: medal.nombre, p_sp: medal.sp,
              });
              existingMedalSet.add(medalKey);
            }
          } catch (_err) { /* silent */ }
        }
      }
    }

    // ── Process asesores SP Convención ──
    const asesoresConvResult = await processAsesoresConvencion(
      supabase, anioActual, mesActual, yearStartDate, nextYearStartDate, medalsByCanal
    );

    // ── Process asesores SP Canje ──
    const asesoresCanjeResult = await processAsesoresCanje(supabase, mesActual);

    return new Response(JSON.stringify({
      procesados,
      sp_otorgados: totalSpOtorgados + asesoresConvResult.sp_otorgados,
      sp_canje_otorgados: asesoresCanjeResult.sp_otorgados,
      semana: periodoSemana,
      por_canal: resumenCanal,
      asesores_convencion: asesoresConvResult,
      asesores_canje: asesoresCanjeResult,
      errores: [...errores, ...asesoresConvResult.errores, ...asesoresCanjeResult.errores],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ══════════════════════════════════════════════════════════════════════
//  SP CONVENCIÓN for asesores — reads ventas_diarias + metas_asesores
// ══════════════════════════════════════════════════════════════════════
async function processAsesoresConvencion(
  supabase: any,
  anioActual: number,
  mesActual: string,
  yearStartDate: string,
  nextYearStartDate: string,
  medalsByCanal: Record<string, any[]>
) {
  const errores: string[] = [];
  let procesados = 0;
  let spOtorgados = 0;

  const [asesoresRes, metasRes, ventasDiariasRes, ejecRes, metasGerentesAsesorRes, prodAsesoresRes] = await Promise.all([
    supabase.from("asesores").select("id, documento, canal_direccion, nombre, canal"),
    supabase.from("metas_asesores").select("*")
      .gte("anio_mes", `${anioActual}01`)
      .lte("anio_mes", `${anioActual}12`),
    supabase.from("ventas_diarias").select("asesor, canal_direccion, unidades, acv, fecha")
      .gte("fecha", yearStartDate).lt("fecha", nextYearStartDate),
    supabase.from("ejecucion_asesores")
      .select("documento_asesor, canal_direccion, periodo, ventas_total, acv_total, ventas_fe, ventas_nube, cant_recomendados")
      .gte("periodo", `${anioActual}01`)
      .lte("periodo", `${anioActual}12`),
    supabase.from("metas_gerentes")
      .select("celula, canal_direccion, meta_total_acv, cuota, meta_total_und"),
    supabase.from("productividad_asesores")
      .select("asesor, anio_mes, acv_f, ventas, meta, celula, area")
      .gte("anio_mes", `${anioActual}01`)
      .lte("anio_mes", `${anioActual}12`)
      .limit(5000),
  ]);

  const asesores = asesoresRes.data || [];
  if (asesores.length === 0) return { procesados: 0, sp_otorgados: 0, errores: [] };

  const metasByAsesor = new Map<string, any[]>();
  (metasRes.data || []).forEach((m: any) => {
    const key = `${m.documento_asesor}|${m.canal_direccion}`;
    const current = metasByAsesor.get(key) || [];
    current.push(m);
    metasByAsesor.set(key, current);
  });

  const ventasAgg = new Map<string, { unidades: number; acv: number }>();
  (ventasDiariasRes.data || []).forEach((vd: any) => {
    const periodo = getPeriodFromDate(vd.fecha);
    if (!periodo) return;
    const key = `${(vd.asesor || "").trim().toLowerCase()}|${vd.canal_direccion}|${periodo}`;
    const entry = ventasAgg.get(key) || { unidades: 0, acv: 0 };
    entry.unidades += Number(vd.unidades) || 0;
    entry.acv += Number(vd.acv) || 0;
    ventasAgg.set(key, entry);
  });

  const ejecMap = new Map<string, any>();
  (ejecRes.data || []).forEach((e: any) => ejecMap.set(`${e.documento_asesor}|${e.canal_direccion}|${e.periodo}`, e));

  const spUpserts: any[] = [];
  const asesorSpTotals: { id: string; sp: number; ejec: any; meta: any; canalDir: string }[] = [];

  for (const asesor of asesores) {
    try {
      if (!asesor.documento) continue;
      const canalDir = asesor.canal_direccion || "";
      const metas = metasByAsesor.get(`${asesor.documento}|${canalDir}`) || [];
      if (metas.length === 0) continue;

      const isVentaCruzada = canalDir.toLowerCase().includes("cruzada") || canalDir === "VC";
      let currentMonthSummary: { id: string; sp: number; ejec: any; meta: any; canalDir: string } | null = null;

      for (const meta of metas) {
        const periodo = String(meta.anio_mes);
        const asesorNameKey = `${asesor.nombre.trim().toLowerCase()}|${canalDir}|${periodo}`;
        const ventasData = ventasAgg.get(asesorNameKey);
        const ejecData = ejecMap.get(`${asesor.documento}|${canalDir}|${periodo}`);

        let spFinal = 0;
        let detalleLabel = "";

        if (isVentaCruzada) {
          const acvTotal = ventasData?.acv ?? (ejecData ? Number(ejecData.acv_total) || 0 : 0);
          const metaAcv = Number(meta.meta_total) || 0;
          if (metaAcv > 0 && acvTotal > 0) {
            spFinal = Math.round((acvTotal / metaAcv) * 100);
            detalleLabel = `Cumplimiento ACV: ${spFinal}% · Venta Cruzada · ${periodo}`;
          }
        } else {
          const unidadesTotal = ventasData?.unidades ?? (ejecData ? Number(ejecData.ventas_total) || 0 : 0);
          const metaUnidades = Number(meta.meta_total) || 0;
          if (metaUnidades > 0 && unidadesTotal > 0) {
            spFinal = Math.round((unidadesTotal / metaUnidades) * 100);
            detalleLabel = `Cumplimiento Unidades: ${spFinal}% · ${canalDir} · ${periodo}`;
          }
        }

        if (spFinal <= 0) continue;

        spUpserts.push({
          gerente_id: asesor.id, fuente: "CUMPLIMIENTO_META", sp: spFinal,
          periodo, detalle: detalleLabel, tipo_sp: "convencion",
        });
        spOtorgados += spFinal;

        if (periodo === mesActual) {
          const ejec = ejecData || {
            ventas_total: ventasData?.unidades || 0,
            acv_total: ventasData?.acv || 0,
            cant_recomendados: 0, ventas_fe: 0, ventas_nube: 0,
          };
          currentMonthSummary = { id: asesor.id, sp: spFinal, ejec, meta, canalDir };
        }
        procesados++;
      }

      if (currentMonthSummary) asesorSpTotals.push(currentMonthSummary);
    } catch (err) {
      if (errores.length < 20) errores.push(`Asesor conv error: ${String(err)}`);
    }
  }

  // Batch upsert SP
  if (spUpserts.length > 0) {
    for (let i = 0; i < spUpserts.length; i += 500) {
      const chunk = spUpserts.slice(i, i + 500);
      const { error: batchErr } = await supabase
        .from("sp_acumulados").upsert(chunk, { onConflict: "gerente_id,fuente,periodo" });
      if (batchErr) errores.push(`Batch asesor SP: ${batchErr.message}`);
    }
  }

  // Update sp_convencion on asesores (batch: load all SP totals then update)
  if (asesorSpTotals.length > 0) {
    const asesorIds = asesorSpTotals.map((a) => a.id);
    const { data: allSpRows } = await supabase
      .from("sp_acumulados").select("gerente_id, sp")
      .in("gerente_id", asesorIds).eq("tipo_sp", "convencion");

    const totalByAsesor = new Map<string, number>();
    (allSpRows || []).forEach((r: any) => {
      totalByAsesor.set(r.gerente_id, (totalByAsesor.get(r.gerente_id) || 0) + (Number(r.sp) || 0));
    });

    for (const [asesorId, total] of totalByAsesor.entries()) {
      await supabase.from("asesores").update({ sp_convencion: total }).eq("id", asesorId);
    }
  }

  // Evaluate asesor medals (batch load existing medals)
  if (asesorSpTotals.length > 0) {
    const { data: existingMedals } = await supabase.from("medallas").select("gerente_id, medalla")
      .in("gerente_id", asesorSpTotals.map((a) => a.id));
    const existingSet = new Set<string>();
    (existingMedals || []).forEach((m: any) => existingSet.add(`${m.gerente_id}|${m.medalla}`));

    for (const { id, ejec, meta, canalDir } of asesorSpTotals) {
      const medals = medalsByCanal[canalDir] || [];
      for (const medal of medals) {
        if (existingSet.has(`${id}|${medal.nombre}`)) continue;
        try {
          let earned = false;
          switch (medal.condicion_tipo) {
            case "recomendados":
              earned = (ejec.cant_recomendados || 0) >= (medal.cantidad_requerida || 1); break;
            case "equilibrio":
              earned = (ejec.ventas_fe || 0) >= (meta.meta_fe || 0) &&
                (ejec.ventas_nube || 0) >= (meta.meta_nube || 0) && meta.meta_fe > 0 && meta.meta_nube > 0; break;
            case "primera_venta":
              earned = (ejec.ventas_total || 0) >= 1; break;
            case "cantidad":
              earned = (ejec.ventas_total || 0) >= (medal.cantidad_requerida || 1); break;
            case "cumplimiento": {
              const pct = meta.meta_total > 0 ? Math.round((ejec.ventas_total / meta.meta_total) * 100) : 0;
              earned = pct >= (medal.cantidad_requerida || 100); break;
            }
          }
          if (earned) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: id, p_medalla: medal.nombre, p_sp: medal.sp,
            });
            existingSet.add(`${id}|${medal.nombre}`);
          }
        } catch (_err) { /* silent */ }
      }
    }
  }

  return { procesados, sp_otorgados: spOtorgados, errores };
}

// ══════════════════════════════════════════════════════════════════════
//  SP CANJE for asesores — triggered by productividad_asesores hitos
// ══════════════════════════════════════════════════════════════════════
async function processAsesoresCanje(supabase: any, mesActual: string) {
  const errores: string[] = [];
  let procesados = 0;
  let spOtorgados = 0;

  const [prodRes, asesoresRes, retosRes] = await Promise.all([
    supabase.from("productividad_asesores")
      .select("asesor, anio_mes, cant_recomendados, ventas_mm_sql, sc_creados, celula, area, pais")
      .eq("anio_mes", mesActual),
    supabase.from("asesores").select("id, nombre, canal_direccion"),
    supabase.from("retos_completados").select("gerente_id, reto, periodo").eq("periodo", mesActual),
  ]);

  const prodRows = prodRes.data || [];
  if (prodRows.length === 0) return { procesados: 0, sp_otorgados: 0, errores: [] };

  const asesorByName = new Map<string, any>();
  (asesoresRes.data || []).forEach((a: any) => {
    if (a.nombre) asesorByName.set(a.nombre.trim().toLowerCase(), a);
  });

  const awardedSet = new Set<string>();
  (retosRes.data || []).forEach((r: any) => awardedSet.add(`${r.gerente_id}|${r.reto}|${r.periodo}`));

  const RULES = [
    { id: "RECOMENDADOS_5", field: "cant_recomendados", threshold: 5, sp: 150, label: "5 Recomendados Efectivos" },
    { id: "RECOMENDADOS_10", field: "cant_recomendados", threshold: 10, sp: 300, label: "10 Recomendados Efectivos" },
    { id: "RECOMENDADOS_20", field: "cant_recomendados", threshold: 20, sp: 500, label: "20 Recomendados Efectivos" },
    { id: "VENTAS_SQL_1", field: "ventas_mm_sql", threshold: 1, sp: 50, label: "Primera Venta SQL", perUnit: true },
    { id: "SC_CREADOS_5", field: "sc_creados", threshold: 5, sp: 100, label: "5 SC Creados" },
    { id: "SC_CREADOS_10", field: "sc_creados", threshold: 10, sp: 250, label: "10 SC Creados" },
  ];

  for (const prod of prodRows) {
    try {
      const asesor = asesorByName.get((prod.asesor || "").trim().toLowerCase());
      if (!asesor) continue;

      for (const rule of RULES) {
        const fieldVal = Number((prod as any)[rule.field]) || 0;
        if (fieldVal < rule.threshold) continue;
        const retoKey = `${asesor.id}|${rule.id}|${mesActual}`;
        if (awardedSet.has(retoKey)) continue;

        let spAmount = rule.sp;
        if ((rule as any).perUnit) spAmount = rule.sp * fieldVal;

        const { error: retoErr } = await supabase.from("retos_completados").insert({
          gerente_id: asesor.id, reto: rule.id, periodo: mesActual, sp: spAmount, tipo: "gamificacion_auto",
        });
        if (retoErr) continue;

        const { error: spErr } = await supabase.from("sp_acumulados").insert({
          gerente_id: asesor.id, fuente: "RETO", sp: spAmount, periodo: mesActual,
          detalle: rule.label, tipo_sp: "canje",
        });
        if (spErr) { if (errores.length < 20) errores.push(`Canje SP ${asesor.nombre}: ${spErr.message}`); continue; }

        await supabase.rpc("increment_sp_canje", { p_gerente_id: asesor.id, p_amount: spAmount });
        awardedSet.add(retoKey);
        spOtorgados += spAmount;
        procesados++;
      }
    } catch (err) {
      if (errores.length < 20) errores.push(`Canje error: ${String(err)}`);
    }
  }

  return { procesados, sp_otorgados: spOtorgados, errores };
}

function getISOWeekStartDate(week: number, year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
  return monday;
}
