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
        let spFinal = 0;

        if (canal === "VC") {
          // VC: SP = % cumplimiento de meta mensual
          // Get all monthly summary rows for this gerente in current month
          const { data: ventasMes } = await supabase
            .from("ventas")
            .select("acv_plus, meta")
            .eq("gerente_id", gerente.id)
            .eq("canal", "VC")
            .eq("mes", currentMonthName);

          // Sum ACV and average meta across all asesores of this gerente
          const totalAcv = (ventasMes || []).reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
          const totalMeta = (ventasMes || []).reduce((s, v) => s + (Number(v.meta) || 0), 0);

          if (totalMeta > 0) {
            spFinal = Math.round((totalAcv / totalMeta) * 100);
          }
        } else {
          // Other channels: SP = % cumplimiento from kpis_mensuales
          const { data: kpi } = await supabase
            .from("kpis_mensuales")
            .select("ventas, meta")
            .eq("gerente_id", gerente.id)
            .eq("anio_mes", mesActual)
            .maybeSingle();

          if (kpi && Number(kpi.meta) > 0) {
            spFinal = Math.round((Number(kpi.ventas) / Number(kpi.meta)) * 100);
          }
        }

        if (spFinal > 0) {
          // Upsert so SP reflects latest % without accumulating
          await supabase.from("sp_acumulados").upsert({
            gerente_id: gerente.id,
            fuente: "CUMPLIMIENTO_META",
            sp: spFinal,
            periodo: periodoSemana,
            detalle: `Cumplimiento de Meta: ${spFinal}% · ${canal}`,
          }, { onConflict: "gerente_id,fuente,periodo" });

          totalSpOtorgados += spFinal;
          resumenCanal[canal].sp += spFinal;
        }

        // Update racha state (use week-based ventas for streaks)
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

    return new Response(JSON.stringify({
      procesados,
      sp_otorgados: totalSpOtorgados,
      semana: periodoSemana,
      por_canal: resumenCanal,
      errores,
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

// ── Medal evaluation ──
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
