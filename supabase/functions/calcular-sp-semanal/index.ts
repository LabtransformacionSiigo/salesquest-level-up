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
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (roleData?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Solo admins pueden ejecutar esta función" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Current period info
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semanaActual = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const anioActual = d.getUTCFullYear();
    const mesActual = `${anioActual}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthName = SPANISH_MONTHS[now.getMonth() + 1] || "Enero";
    const periodoSemana = `${anioActual}-W${String(semanaActual).padStart(2, "0")}`;
    const currentMonthStart = `${anioActual}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const nextMonthStart = now.getMonth() === 11
      ? `${anioActual + 1}-01-01`
      : `${anioActual}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

    // Load config_rachas + medal catalog in parallel
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
    (configRachasRes.data || []).forEach((cr) => {
      umbralMap[cr.canal] = Number(cr.umbral_verde) || 0;
    });

    const medalsByCanal: Record<string, any[]> = {};
    (medalCatalogRes.data || []).forEach((m) => {
      if (!medalsByCanal[m.canal]) medalsByCanal[m.canal] = [];
      medalsByCanal[m.canal].push(m);
    });

    let totalSpOtorgados = 0;
    const errores: string[] = [];
    let procesados = 0;
    const resumenCanal: Record<string, { procesados: number; sp: number }> = {};

    // ── Process gerentes (VC uses ventas table, VN uses kpis_mensuales) ──
    for (const gerente of gerentes) {
      const canal = gerente.canal || "VC";
      if (!resumenCanal[canal]) resumenCanal[canal] = { procesados: 0, sp: 0 };

      try {
        if (canal === "VC") {
          // VC gerentes: SP = acv_plus / meta * 100 from ventas table
          const { data: ventasMes } = await supabase
            .from("ventas")
            .select("acv_plus, meta")
            .eq("gerente_id", gerente.id)
            .eq("canal", "VC")
            .eq("mes", currentMonthName);

          const totalAcv = (ventasMes || []).reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
          const totalMeta = (ventasMes || []).reduce((s, v) => s + (Number(v.meta) || 0), 0);

          if (totalMeta > 0) {
            const spFinal = Math.round((totalAcv / totalMeta) * 100);
            if (spFinal > 0) {
              const { error: upsertErr } = await supabase.from("sp_acumulados").upsert({
                gerente_id: gerente.id, fuente: "CUMPLIMIENTO_META", sp: spFinal,
                periodo: mesActual, detalle: `Cumplimiento de Meta: ${spFinal}% · VC`, tipo_sp: "convencion",
              }, { onConflict: "gerente_id,fuente,periodo" });
              if (upsertErr) { if (errores.length < 30) errores.push(`SP upsert ${gerente.nombre}: ${upsertErr.message}`); }
              else { totalSpOtorgados += spFinal; resumenCanal[canal].sp += spFinal; }
            }
          }
        } else {
          // VN channels: SP from kpis_mensuales (ventas/meta per month)
          let { data: allKpis } = await supabase
            .from("kpis_mensuales")
            .select("anio_mes, ventas, meta")
            .eq("gerente_id", gerente.id)
            .eq("canal", canal)
            .gte("anio_mes", `${anioActual}01`)
            .lte("anio_mes", `${anioActual}12`);

          // Fallback: aggregate from ventas_diarias directly
          if (!allKpis || allKpis.length === 0) {
            const canalNorm = canal === "VN_ALIADOS" ? "Aliados" : canal === "VN_EMPRESARIOS" ? "Empresarios" : canal;
            const { data: ventasDiarias } = await supabase
              .from("ventas_diarias")
              .select("fecha, unidades, acv")
              .eq("canal_direccion", canalNorm)
              .ilike("asesor", `%${gerente.nombre}%`);

            const { data: metasG } = await supabase
              .from("metas_gerentes")
              .select("meta_total_und, meta_total_acv")
              .eq("canal_direccion", canalNorm)
              .ilike("celula", `%${gerente.nombre}%`)
              .limit(1)
              .maybeSingle();

            if (ventasDiarias && ventasDiarias.length > 0) {
              const byMonth = new Map<string, number>();
              for (const vd of ventasDiarias) {
                const fecha = String(vd.fecha || "");
                const periodo = fecha.length >= 7 ? fecha.substring(0, 7).replace("-", "") : mesActual;
                const periodoClean = periodo.replace(/[^0-9]/g, "").substring(0, 6);
                byMonth.set(periodoClean, (byMonth.get(periodoClean) || 0) + (Number(vd.unidades) || 0));
              }
              const meta = Number(metasG?.meta_total_und) || Number(metasG?.meta_total_acv) || 0;
              allKpis = [...byMonth.entries()].map(([anio_mes, ventas]) => ({ anio_mes, ventas, meta }));
            }
          }

          for (const kpi of (allKpis || [])) {
            const metaVal = Number(kpi.meta) || 0;
            const ventasVal = Number(kpi.ventas) || 0;
            if (metaVal <= 0) continue;
            const spFinal = Math.round((ventasVal / metaVal) * 100);
            if (spFinal <= 0) continue;

            const { error: upsertErr } = await supabase.from("sp_acumulados").upsert({
              gerente_id: gerente.id, fuente: "CUMPLIMIENTO_META", sp: spFinal,
              periodo: String(kpi.anio_mes), detalle: `Cumplimiento de Meta: ${spFinal}% · ${canal} · ${kpi.anio_mes}`, tipo_sp: "convencion",
            }, { onConflict: "gerente_id,fuente,periodo" });
            if (upsertErr) { if (errores.length < 30) errores.push(`SP upsert ${gerente.nombre}: ${upsertErr.message}`); }
            else { totalSpOtorgados += spFinal; resumenCanal[canal].sp += spFinal; }
          }
        }

        // Update racha state
        const weekStartDate = getISOWeekStartDate(semanaActual, anioActual);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 7);
        const weekStartStr = weekStartDate.toISOString().split("T")[0];
        const weekEndStr = weekEndDate.toISOString().split("T")[0];

        const { data: ventasRows } = await supabase
          .from("ventas")
          .select("valor_producto")
          .eq("gerente_id", gerente.id)
          .gte("fecha_facturacion", weekStartStr)
          .lt("fecha_facturacion", weekEndStr);

        const totalVentas = (ventasRows || []).reduce(
          (sum, v) => sum + (Number(v.valor_producto) || 0), 0
        );

        const { data: lastRacha } = await supabase
          .from("rachas")
          .select("semanas_consecutivas")
          .eq("gerente_id", gerente.id)
          .order("anio", { ascending: false })
          .order("semana_iso", { ascending: false })
          .limit(1)
          .maybeSingle();

        const semanasConsecutivasPrev = lastRacha?.semanas_consecutivas || 0;
        const umbral = umbralMap[canal] || 50000000;
        let estado: string;
        let nuevasConsecutivas: number;

        if (totalVentas >= umbral) {
          estado = "VERDE";
          nuevasConsecutivas = semanasConsecutivasPrev + 1;
        } else if (totalVentas >= umbral * 0.8) {
          estado = "AMARILLA";
          nuevasConsecutivas = 0;
        } else {
          estado = "ROJA";
          nuevasConsecutivas = 0;
        }

        const { data: nuevoMult } = await supabase.rpc("calcular_multiplicador", {
          semanas_consecutivas: nuevasConsecutivas,
        });

        await supabase.from("rachas").upsert(
          {
            gerente_id: gerente.id,
            semana_iso: semanaActual,
            anio: anioActual,
            ingresos_semana: totalVentas,
            estado,
            semanas_consecutivas: nuevasConsecutivas,
            multiplicador: Number(nuevoMult) || 1,
          },
          { onConflict: "gerente_id,semana_iso,anio" }
        );

        // Evaluate medals for gerente
        await evaluateMedals(supabase, gerente, canal, medalsByCanal[canal] || [], mesActual);

        procesados++;
        resumenCanal[canal].procesados++;
      } catch (err) {
        if (errores.length < 30) errores.push(`${canal}/${gerente.nombre}: ${String(err)}`);
      }
    }

    // ── Process asesores SP Convención from ventas_diarias + metas_asesores ──
    const asesoresConvResult = await processAsesoresConvencion(
      supabase, mesActual, currentMonthStart, nextMonthStart, medalsByCanal
    );

    // ── Process asesores SP Canje from productividad_asesores ──
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
  mesActual: string,
  currentMonthStart: string,
  nextMonthStart: string,
  medalsByCanal: Record<string, any[]>
) {
  const errores: string[] = [];
  let procesados = 0;
  let spOtorgados = 0;

  // Load all asesores
  const { data: asesores } = await supabase
    .from("asesores")
    .select("id, documento, canal_direccion, nombre, canal");

  if (!asesores || asesores.length === 0) {
    return { procesados: 0, sp_otorgados: 0, errores: [] };
  }

  // Load metas for current period
  const { data: metasRows } = await supabase
    .from("metas_asesores")
    .select("*")
    .eq("anio_mes", mesActual);

  const metasMap = new Map<string, any>();
  (metasRows || []).forEach((m: any) => {
    metasMap.set(`${m.documento_asesor}|${m.canal_direccion}`, m);
  });

  // Load ventas_diarias for current month (all canales)
  const { data: ventasDiarias } = await supabase
    .from("ventas_diarias")
    .select("asesor, canal_direccion, unidades, acv, fecha")
    .gte("fecha", currentMonthStart)
    .lt("fecha", nextMonthStart);

  // Aggregate ventas_diarias by asesor name + canal
  const ventasAgg = new Map<string, { unidades: number; acv: number }>();
  (ventasDiarias || []).forEach((vd: any) => {
    const key = `${(vd.asesor || "").trim().toLowerCase()}|${vd.canal_direccion}`;
    const entry = ventasAgg.get(key) || { unidades: 0, acv: 0 };
    entry.unidades += Number(vd.unidades) || 0;
    entry.acv += Number(vd.acv) || 0;
    ventasAgg.set(key, entry);
  });

  // Also load ejecucion_asesores as fallback (for asesores not in ventas_diarias)
  const { data: ejecRows } = await supabase
    .from("ejecucion_asesores")
    .select("documento_asesor, canal_direccion, ventas_total, acv_total, ventas_fe, ventas_nube, cant_recomendados")
    .eq("periodo", mesActual);

  const ejecMap = new Map<string, any>();
  (ejecRows || []).forEach((e: any) => {
    ejecMap.set(`${e.documento_asesor}|${e.canal_direccion}`, e);
  });

  for (const asesor of asesores) {
    try {
      if (!asesor.documento) continue;

      const canalDir = asesor.canal_direccion || "";
      const meta = metasMap.get(`${asesor.documento}|${canalDir}`);
      if (!meta) continue;

      const isVentaCruzada = canalDir.toLowerCase().includes("cruzada") || canalDir === "VC";

      // Try ventas_diarias first (by asesor name match)
      const asesorNameKey = `${asesor.nombre.trim().toLowerCase()}|${canalDir}`;
      const ventasData = ventasAgg.get(asesorNameKey);

      // Fallback to ejecucion_asesores
      const ejecData = ejecMap.get(`${asesor.documento}|${canalDir}`);

      let spFinal = 0;
      let detalleLabel = "";

      if (isVentaCruzada) {
        // ── Venta Cruzada: SP = (sum acv / meta_total) * 100 ──
        const acvTotal = ventasData?.acv ?? (ejecData ? Number(ejecData.acv_total) || 0 : 0);
        const metaAcv = Number(meta.meta_total) || 0;
        if (metaAcv > 0 && acvTotal > 0) {
          spFinal = Math.round((acvTotal / metaAcv) * 100);
          detalleLabel = `Cumplimiento ACV: ${spFinal}% · Venta Cruzada`;
        }
      } else {
        // ── Venta Directa (Aliados/Empresarios): SP = (sum unidades / meta_total) * 100 ──
        const unidadesTotal = ventasData?.unidades ?? (ejecData ? Number(ejecData.ventas_total) || 0 : 0);
        const metaUnidades = Number(meta.meta_total) || 0;
        if (metaUnidades > 0 && unidadesTotal > 0) {
          spFinal = Math.round((unidadesTotal / metaUnidades) * 100);
          detalleLabel = `Cumplimiento Unidades: ${spFinal}% · ${canalDir}`;
        }
      }

      if (spFinal <= 0) continue;

      // Upsert SP Convención
      const { error: upsertErr } = await supabase.from("sp_acumulados").upsert({
        gerente_id: asesor.id,
        fuente: "CUMPLIMIENTO_META",
        sp: spFinal,
        periodo: mesActual,
        detalle: detalleLabel,
        tipo_sp: "convencion",
      }, { onConflict: "gerente_id,fuente,periodo" });

      if (upsertErr) {
        if (errores.length < 20) errores.push(`Asesor SP ${asesor.nombre}: ${upsertErr.message}`);
      } else {
        spOtorgados += spFinal;
      }

      // Update cumulative sp_convencion on asesor record
      const { data: allSp } = await supabase
        .from("sp_acumulados")
        .select("sp")
        .eq("gerente_id", asesor.id)
        .eq("tipo_sp", "convencion");

      const totalRanking = (allSp || []).reduce((s: number, r: any) => s + (Number(r.sp) || 0), 0);
      await supabase.from("asesores").update({ sp_convencion: totalRanking }).eq("id", asesor.id);

      // Evaluate medals (credits sp_canje via otorgar_medalla_si_aplica)
      const ejec = ejecData || {
        ventas_total: ventasData?.unidades || 0,
        acv_total: ventasData?.acv || 0,
        cant_recomendados: 0,
        ventas_fe: 0,
        ventas_nube: 0,
      };
      await evaluateAsesorMedals(supabase, asesor, ejec, meta, medalsByCanal[canalDir] || []);

      procesados++;
    } catch (err) {
      if (errores.length < 20) errores.push(`Asesor conv error: ${String(err)}`);
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

  // Load productividad_asesores for current period
  const { data: prodRows } = await supabase
    .from("productividad_asesores")
    .select("asesor, anio_mes, cant_recomendados, ventas_mm_sql, sc_creados, celula, area, pais")
    .eq("anio_mes", mesActual);

  if (!prodRows || prodRows.length === 0) {
    return { procesados: 0, sp_otorgados: 0, errores: [] };
  }

  // Load asesores for name→id mapping
  const { data: asesores } = await supabase
    .from("asesores")
    .select("id, nombre, canal_direccion");

  const asesorByName = new Map<string, any>();
  (asesores || []).forEach((a: any) => {
    if (a.nombre) asesorByName.set(a.nombre.trim().toLowerCase(), a);
  });

  // Load existing canje awards for dedup (using retos_completados as log)
  const { data: existingRetos } = await supabase
    .from("retos_completados")
    .select("gerente_id, reto, periodo")
    .eq("periodo", mesActual);

  const awardedSet = new Set<string>();
  (existingRetos || []).forEach((r: any) => {
    awardedSet.add(`${r.gerente_id}|${r.reto}|${r.periodo}`);
  });

  // ── Gamification rules ──
  const RULES = [
    {
      id: "RECOMENDADOS_5",
      field: "cant_recomendados",
      threshold: 5,
      sp: 150,
      label: "5 Recomendados Efectivos",
    },
    {
      id: "RECOMENDADOS_10",
      field: "cant_recomendados",
      threshold: 10,
      sp: 300,
      label: "10 Recomendados Efectivos",
    },
    {
      id: "RECOMENDADOS_20",
      field: "cant_recomendados",
      threshold: 20,
      sp: 500,
      label: "20 Recomendados Efectivos",
    },
    {
      id: "VENTAS_SQL_1",
      field: "ventas_mm_sql",
      threshold: 1,
      sp: 50,
      label: "Primera Venta SQL",
      perUnit: true,
    },
    {
      id: "SC_CREADOS_5",
      field: "sc_creados",
      threshold: 5,
      sp: 100,
      label: "5 SC Creados",
    },
    {
      id: "SC_CREADOS_10",
      field: "sc_creados",
      threshold: 10,
      sp: 250,
      label: "10 SC Creados",
    },
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
        if (rule.perUnit) {
          // Per-unit rules: award sp * count (but only once per period via dedup)
          spAmount = rule.sp * fieldVal;
        }

        // Insert into retos_completados as log (dedup)
        const { error: retoErr } = await supabase.from("retos_completados").insert({
          gerente_id: asesor.id,
          reto: rule.id,
          periodo: mesActual,
          sp: spAmount,
          tipo: "gamificacion_auto",
        });

        if (retoErr) {
          // Likely duplicate — skip
          continue;
        }

        // Insert SP Canje
        const { error: spErr } = await supabase.from("sp_acumulados").insert({
          gerente_id: asesor.id,
          fuente: "RETO",
          sp: spAmount,
          periodo: mesActual,
          detalle: rule.label,
          tipo_sp: "canje",
        });

        if (spErr) {
          if (errores.length < 20) errores.push(`Canje SP ${asesor.nombre}: ${spErr.message}`);
          continue;
        }

        // Increment sp_canje on asesor
        await supabase.rpc("increment_sp_canje", {
          p_gerente_id: asesor.id,
          p_amount: spAmount,
        });

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

// ── Medal evaluation for asesores ──
async function evaluateAsesorMedals(
  supabase: any,
  asesor: { id: string; nombre: string },
  ejec: any,
  meta: any,
  medals: any[]
) {
  if (!medals || medals.length === 0) return;

  for (const medal of medals) {
    try {
      switch (medal.condicion_tipo) {
        case "recomendados": {
          if ((ejec.cant_recomendados || 0) >= (medal.cantidad_requerida || 1)) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: asesor.id, p_medalla: medal.nombre, p_sp: medal.sp,
            });
          }
          break;
        }
        case "equilibrio": {
          if (
            (ejec.ventas_fe || 0) >= (meta.meta_fe || 0) &&
            (ejec.ventas_nube || 0) >= (meta.meta_nube || 0) &&
            meta.meta_fe > 0 && meta.meta_nube > 0
          ) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: asesor.id, p_medalla: medal.nombre, p_sp: medal.sp,
            });
          }
          break;
        }
        case "primera_venta": {
          if ((ejec.ventas_total || 0) >= 1) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: asesor.id, p_medalla: medal.nombre, p_sp: medal.sp,
            });
          }
          break;
        }
        case "cantidad": {
          if ((ejec.ventas_total || 0) >= (medal.cantidad_requerida || 1)) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: asesor.id, p_medalla: medal.nombre, p_sp: medal.sp,
            });
          }
          break;
        }
        case "cumplimiento": {
          const pct = meta.meta_total > 0 ? Math.round((ejec.ventas_total / meta.meta_total) * 100) : 0;
          if (pct >= (medal.cantidad_requerida || 100)) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: asesor.id, p_medalla: medal.nombre, p_sp: medal.sp,
            });
          }
          break;
        }
      }
    } catch (_err) {
      // Silent fail per medal
    }
  }
}

// ── Medal evaluation for gerentes ──
async function evaluateMedals(
  supabase: any,
  gerente: { id: string; nombre: string },
  canal: string,
  medals: any[],
  mesActual: string
) {
  if (!medals || medals.length === 0) return;

  for (const medal of medals) {
    try {
      switch (medal.condicion_tipo) {
        case "primera_venta": {
          const { count } = await supabase
            .from("ventas")
            .select("id", { count: "exact", head: true })
            .eq("gerente_id", gerente.id)
            .eq("canal", canal)
            .ilike("producto", `%${medal.producto}%`);

          if ((count || 0) >= 1) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: gerente.id, p_medalla: medal.nombre, p_sp: medal.sp,
            });
          }
          break;
        }
        case "cantidad": {
          if (medal.producto) {
            const { count } = await supabase
              .from("ventas")
              .select("id", { count: "exact", head: true })
              .eq("gerente_id", gerente.id)
              .eq("canal", canal)
              .ilike("producto", `%${medal.producto}%`);

            if ((count || 0) >= (medal.cantidad_requerida || 1)) {
              await supabase.rpc("otorgar_medalla_si_aplica", {
                p_gerente_id: gerente.id, p_medalla: medal.nombre, p_sp: medal.sp,
              });
            }
          } else if (medal.nombre.includes("Referido")) {
            const { data: kpi } = await supabase
              .from("kpis_mes_actual")
              .select("cant_recomendados")
              .eq("gerente_id", gerente.id)
              .maybeSingle();

            if (kpi && (Number(kpi.cant_recomendados) || 0) >= (medal.cantidad_requerida || 1)) {
              await supabase.rpc("otorgar_medalla_si_aplica", {
                p_gerente_id: gerente.id, p_medalla: medal.nombre, p_sp: medal.sp,
              });
            }
          }
          break;
        }
        case "monto": {
          const { data: acvData } = await supabase
            .from("ventas")
            .select("acv_plus")
            .eq("gerente_id", gerente.id)
            .eq("canal", canal);

          const acvTotal = (acvData || []).reduce(
            (s: number, v: any) => s + (Number(v.acv_plus) || 0), 0
          );

          if (acvTotal >= (medal.cantidad_requerida || 0)) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: gerente.id, p_medalla: medal.nombre, p_sp: medal.sp,
            });
          }
          break;
        }
        case "cumplimiento": {
          const { data: kpiData } = await supabase
            .from("kpis_mes_actual")
            .select("pct_cumplimiento")
            .eq("gerente_id", gerente.id)
            .maybeSingle();

          if (kpiData && Number(kpiData.pct_cumplimiento) >= (medal.cantidad_requerida || 100)) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: gerente.id, p_medalla: medal.nombre, p_sp: medal.sp,
            });
          }
          break;
        }
      }
    } catch (_err) {
      // Silent fail per medal
    }
  }
}

function getISOWeekStartDate(week: number, year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
  return monday;
}
