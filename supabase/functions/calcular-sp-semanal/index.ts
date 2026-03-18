import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Allow service role key calls (from sync-databricks auto-trigger)
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!isServiceRole) {
      // Verify admin via user auth
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

    // Calculate ISO week and year
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semanaActual = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const anioActual = d.getUTCFullYear();
    const mesActual = `${anioActual}${String(now.getMonth() + 1).padStart(2, "0")}`;

    const weekStartDate = getISOWeekStartDate(semanaActual, anioActual);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 7);
    const weekStartStr = weekStartDate.toISOString().split("T")[0];
    const weekEndStr = weekEndDate.toISOString().split("T")[0];

    // Get ALL active gerentes (all channels, all countries)
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

    // Load config_rachas (thresholds per channel)
    const { data: configRachas } = await supabase
      .from("config_rachas")
      .select("canal, umbral_verde")
      .eq("condicion_tipo", "ventas_semanales")
      .eq("activo", true);

    const umbralMap: Record<string, number> = {};
    (configRachas || []).forEach((cr) => {
      umbralMap[cr.canal] = Number(cr.umbral_verde) || 0;
    });

    // Load medal catalog (grouped by channel)
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
        // 1. Sum ventas for this week (date range filter)
        const { data: ventasRows } = await supabase
          .from("ventas")
          .select("valor_producto, producto, acv_plus")
          .eq("gerente_id", gerente.id)
          .gte("fecha_facturacion", weekStartStr)
          .lt("fecha_facturacion", weekEndStr);

        const totalVentas = (ventasRows || []).reduce(
          (sum, v) => sum + (Number(v.valor_producto) || 0), 0
        );

        // 2. Calculate SP base from COP conversion
        const { data: spBaseData } = await supabase.rpc("calcular_sp_cop", {
          ingresos_cop: totalVentas,
        });
        const spBase = Number(spBaseData) || 0;

        // 3. Get previous racha for multiplicador
        const { data: lastRacha } = await supabase
          .from("rachas")
          .select("semanas_consecutivas")
          .eq("gerente_id", gerente.id)
          .order("anio", { ascending: false })
          .order("semana_iso", { ascending: false })
          .limit(1)
          .maybeSingle();

        const semanasConsecutivasPrev = lastRacha?.semanas_consecutivas || 0;

        const { data: multData } = await supabase.rpc("calcular_multiplicador", {
          semanas_consecutivas: semanasConsecutivasPrev,
        });
        const multiplicador = Number(multData) || 1;

        // 4. Final SP = base × multiplicador
        const spFinal = Math.round(spBase * multiplicador);

        if (spFinal > 0) {
          await supabase.from("sp_acumulados").insert({
            gerente_id: gerente.id,
            fuente: "CONVERSION_COP",
            sp: spFinal,
            periodo: `${anioActual}-W${String(semanaActual).padStart(2, "0")}`,
            detalle: `SP semana ${semanaActual} · ${canal} · ×${multiplicador}`,
          });
          totalSpOtorgados += spFinal;
          resumenCanal[canal].sp += spFinal;
        }

        // 5. Update racha state
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

        // 6. Evaluate ALL medals from catalog for this gerente's channel
        await evaluateMedals(supabase, gerente, canal, medalsByCanal[canal] || [], mesActual);

        procesados++;
        resumenCanal[canal].procesados++;
      } catch (err) {
        if (errores.length < 30) errores.push(`${canal}/${gerente.nombre}: ${String(err)}`);
      }
    }

    const resultado = {
      procesados,
      sp_otorgados: totalSpOtorgados,
      semana: `${anioActual}-W${String(semanaActual).padStart(2, "0")}`,
      por_canal: resumenCanal,
      errores,
    };

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Medal evaluation per channel ──
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
          // Check if gerente has at least 1 sale of the specified product
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
          // Check if gerente has >= cantidad_requerida sales of the product
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
            // For VN_ALIADOS: check cant_recomendados from KPIs
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
          // Check if gerente's ACV+ total >= cantidad_requerida
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
          // Check KPI cumplimiento >= 100%
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
      // Silent fail per medal, don't block others
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
