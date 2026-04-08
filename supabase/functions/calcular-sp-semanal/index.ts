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

    // Get ALL active gerentes
    const { data: gerentes } = await supabase
      .from("gerentes")
      .select("id, canal, nombre")
      .eq("activo", true);

    if (!gerentes || gerentes.length === 0) {
      return new Response(
        JSON.stringify({ procesados: 0, sp_otorgados: 0, errores: ["No hay gerentes activos"] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load config_rachas
    const { data: configRachas } = await supabase
      .from("config_rachas")
      .select("canal, umbral_verde")
      .eq("condicion_tipo", "ventas_semanales")
      .eq("activo", true);

    const umbralMap: Record<string, number> = {};
    (configRachas || []).forEach((cr) => {
      umbralMap[cr.canal] = Number(cr.umbral_verde) || 0;
    });

    // Load medal catalog
    const { data: medalCatalog } = await supabase
      .from("catalogo_medallas")
      .select("*")
      .eq("activo", true);

    const medalsByCanal: Record<string, any[]> = {};
    (medalCatalog || []).forEach((m) => {
      if (!medalsByCanal[m.canal]) medalsByCanal[m.canal] = [];
      medalsByCanal[m.canal].push(m);
    });

    let totalSpOtorgados = 0;
    const errores: string[] = [];
    let procesados = 0;
    const resumenCanal: Record<string, { procesados: number; sp: number }> = {};

    for (const gerente of gerentes) {
      const canal = gerente.canal || "VC";
      if (!resumenCanal[canal]) resumenCanal[canal] = { procesados: 0, sp: 0 };

      try {
        if (canal === "VC") {
          // VC: SP = % cumplimiento de meta mensual (current month only, stored per month)
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
                periodo: mesActual, detalle: `Cumplimiento de Meta: ${spFinal}% · VC`,
              }, { onConflict: "gerente_id,fuente,periodo" });
              if (upsertErr) { if (errores.length < 30) errores.push(`SP upsert ${gerente.nombre}: ${upsertErr.message}`); }
              else { totalSpOtorgados += spFinal; resumenCanal[canal].sp += spFinal; }
            }
          }
        } else {
          // VN channels (VN_ALIADOS, VN_EMPRESARIOS): SP = % cumplimiento per EACH month
          const { data: allKpis } = await supabase
            .from("kpis_mensuales")
            .select("anio_mes, ventas, meta")
            .eq("gerente_id", gerente.id)
            .eq("canal", canal)
            .gte("anio_mes", `${anioActual}01`)
            .lte("anio_mes", `${anioActual}12`);

          for (const kpi of (allKpis || [])) {
            const metaVal = Number(kpi.meta) || 0;
            const ventasVal = Number(kpi.ventas) || 0;
            if (metaVal <= 0) continue;
            const spFinal = Math.round((ventasVal / metaVal) * 100);
            if (spFinal <= 0) continue;

            const { error: upsertErr } = await supabase.from("sp_acumulados").upsert({
              gerente_id: gerente.id, fuente: "CUMPLIMIENTO_META", sp: spFinal,
              periodo: String(kpi.anio_mes), detalle: `Cumplimiento de Meta: ${spFinal}% · ${canal} · ${kpi.anio_mes}`,
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

        // Evaluate medals
        await evaluateMedals(supabase, gerente, canal, medalsByCanal[canal] || [], mesActual);

        procesados++;
        resumenCanal[canal].procesados++;
      } catch (err) {
        if (errores.length < 30) errores.push(`${canal}/${gerente.nombre}: ${String(err)}`);
      }
    }

    // ── Process asesores from ejecucion_asesores (Aliados/Empresarios) ──
    const asesoresSpResult = await processAsesoresEjecucion(supabase, mesActual, periodoSemana, medalsByCanal);

    return new Response(JSON.stringify({
      procesados,
      sp_otorgados: totalSpOtorgados + asesoresSpResult.sp_otorgados,
      semana: periodoSemana,
      por_canal: resumenCanal,
      asesores_procesados: asesoresSpResult,
      errores: [...errores, ...asesoresSpResult.errores],
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

// ── Process asesores SP from ejecucion_asesores + metas_asesores ──
async function processAsesoresEjecucion(
  supabase: any,
  mesActual: string,
  periodoSemana: string,
  medalsByCanal: Record<string, any[]>
) {
  const errores: string[] = [];
  let procesados = 0;
  let spOtorgados = 0;

  // Get all ejecucion rows for current period
  const { data: ejecRows } = await supabase
    .from("ejecucion_asesores")
    .select("*")
    .eq("periodo", mesActual);

  if (!ejecRows || ejecRows.length === 0) {
    return { procesados: 0, sp_otorgados: 0, errores: [] };
  }

  // Get matching metas
  const { data: metasRows } = await supabase
    .from("metas_asesores")
    .select("*")
    .eq("anio_mes", mesActual);

  const metasMap = new Map<string, any>();
  (metasRows || []).forEach((m: any) => {
    metasMap.set(`${m.documento_asesor}|${m.canal_direccion}`, m);
  });

  // Get asesores mapping (documento → asesor id)
  const { data: asesores } = await supabase
    .from("asesores")
    .select("id, documento, canal_direccion, nombre");

  const asesorByDoc = new Map<string, any>();
  (asesores || []).forEach((a: any) => {
    if (a.documento) asesorByDoc.set(`${a.documento}|${a.canal_direccion}`, a);
  });

  for (const ejec of ejecRows) {
    try {
      const meta = metasMap.get(`${ejec.documento_asesor}|${ejec.canal_direccion}`);
      if (!meta || !meta.meta_total || meta.meta_total <= 0) continue;

      const asesor = asesorByDoc.get(`${ejec.documento_asesor}|${ejec.canal_direccion}`);
      if (!asesor) continue;

      const spFinal = Math.round((ejec.ventas_total / meta.meta_total) * 100);
      if (spFinal <= 0) continue;

      // Upsert SP
      const { error: upsertErr } = await supabase.from("sp_acumulados").upsert({
        gerente_id: asesor.id,
        fuente: "CUMPLIMIENTO_META",
        sp: spFinal,
        periodo: periodoSemana,
        detalle: `Cumplimiento: ${spFinal}% · ${ejec.canal_direccion}`,
      }, { onConflict: "gerente_id,fuente,periodo" });

      if (upsertErr) {
        if (errores.length < 20) errores.push(`Asesor SP ${asesor.nombre}: ${upsertErr.message}`);
      } else {
        spOtorgados += spFinal;
      }

      // Update puntos_ranking on asesor
      const { data: allSp } = await supabase
        .from("sp_acumulados")
        .select("sp")
        .eq("gerente_id", asesor.id)
        .eq("fuente", "CUMPLIMIENTO_META");

      const totalRanking = (allSp || []).reduce((s: number, r: any) => s + (Number(r.sp) || 0), 0);
      await supabase.from("asesores").update({ puntos_ranking: totalRanking }).eq("id", asesor.id);

      // Evaluate medals for new fronts
      await evaluateAsesorMedals(supabase, asesor, ejec, meta, medalsByCanal[ejec.canal_direccion] || []);

      procesados++;
    } catch (err) {
      if (errores.length < 20) errores.push(`Asesor ejec error: ${String(err)}`);
    }
  }

  return { procesados, sp_otorgados: spOtorgados, errores };
}

// ── Medal evaluation for asesores (Aliados/Empresarios) ──
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
              p_gerente_id: asesor.id,
              p_medalla: medal.nombre,
              p_sp: medal.sp,
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
              p_gerente_id: asesor.id,
              p_medalla: medal.nombre,
              p_sp: medal.sp,
            });
          }
          break;
        }
        case "primera_venta": {
          if ((ejec.ventas_total || 0) >= 1) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: asesor.id,
              p_medalla: medal.nombre,
              p_sp: medal.sp,
            });
          }
          break;
        }
        case "cantidad": {
          if ((ejec.ventas_total || 0) >= (medal.cantidad_requerida || 1)) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: asesor.id,
              p_medalla: medal.nombre,
              p_sp: medal.sp,
            });
          }
          break;
        }
        case "cumplimiento": {
          const pct = meta.meta_total > 0 ? Math.round((ejec.ventas_total / meta.meta_total) * 100) : 0;
          if (pct >= (medal.cantidad_requerida || 100)) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: asesor.id,
              p_medalla: medal.nombre,
              p_sp: medal.sp,
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
            .ilike("producto", `%${medal.producto}%`);

          if ((count || 0) >= 1) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: gerente.id,
              p_medalla: medal.nombre,
              p_sp: medal.sp,
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
              .ilike("producto", `%${medal.producto}%`);

            if ((count || 0) >= (medal.cantidad_requerida || 1)) {
              await supabase.rpc("otorgar_medalla_si_aplica", {
                p_gerente_id: gerente.id,
                p_medalla: medal.nombre,
                p_sp: medal.sp,
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
                p_gerente_id: gerente.id,
                p_medalla: medal.nombre,
                p_sp: medal.sp,
              });
            }
          }
          break;
        }
        case "monto": {
          const { data: acvData } = await supabase
            .from("ventas")
            .select("acv_plus")
            .eq("gerente_id", gerente.id);

          const acvTotal = (acvData || []).reduce(
            (s: number, v: any) => s + (Number(v.acv_plus) || 0), 0
          );

          if (acvTotal >= (medal.cantidad_requerida || 0)) {
            await supabase.rpc("otorgar_medalla_si_aplica", {
              p_gerente_id: gerente.id,
              p_medalla: medal.nombre,
              p_sp: medal.sp,
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
              p_gerente_id: gerente.id,
              p_medalla: medal.nombre,
              p_sp: medal.sp,
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
