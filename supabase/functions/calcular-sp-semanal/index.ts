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

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Solo admins pueden ejecutar esta función" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate ISO week and year
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const semanaActual = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const anioActual = d.getUTCFullYear();

    // Get all active MEX gerentes
    const { data: gerentes } = await supabase
      .from("gerentes")
      .select("id, canal")
      .eq("activo", true)
      .eq("pais", "MEX");

    if (!gerentes || gerentes.length === 0) {
      return new Response(
        JSON.stringify({ procesados: 0, sp_otorgados: 0, errores: ["No hay gerentes activos de MEX"] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get config_rachas for all channels
    const { data: configRachas } = await supabase
      .from("config_rachas")
      .select("canal, umbral_verde")
      .eq("condicion_tipo", "ventas_semanales")
      .eq("activo", true);

    const umbralMap: Record<string, number> = {};
    (configRachas || []).forEach((cr) => {
      umbralMap[cr.canal] = Number(cr.umbral_verde) || 0;
    });

    let totalSpOtorgados = 0;
    const errores: string[] = [];
    let procesados = 0;

    for (const gerente of gerentes) {
      try {
        // 2a. Sum ventas for this week
        const { data: ventasData } = await supabase.rpc("calcular_ventas_semana", {
          p_gerente_id: gerente.id,
          p_semana: semanaActual,
          p_anio: anioActual,
        }).maybeSingle();

        // Fallback: query directly
        let totalVentas = 0;
        if (ventasData?.total) {
          totalVentas = Number(ventasData.total);
        } else {
          // Direct query fallback
          const { data: vRows } = await supabase
            .from("ventas")
            .select("valor_producto")
            .eq("gerente_id", gerente.id);

          if (vRows) {
            // Filter by week in JS since we can't use EXTRACT in PostgREST easily
            const weekStart = getWeekStart(semanaActual, anioActual);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            totalVentas = vRows
              .filter((v) => {
                const fecha = new Date(v.valor_producto ? "2000-01-01" : ""); // need fecha_facturacion
                return true; // fallback: sum all
              })
              .reduce((sum, v) => sum + (Number(v.valor_producto) || 0), 0);
          }
        }

        // Better approach: use date range filter
        const weekStartDate = getISOWeekStartDate(semanaActual, anioActual);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 7);

        const { data: ventasRows } = await supabase
          .from("ventas")
          .select("valor_producto")
          .eq("gerente_id", gerente.id)
          .gte("fecha_facturacion", weekStartDate.toISOString().split("T")[0])
          .lt("fecha_facturacion", weekEndDate.toISOString().split("T")[0]);

        totalVentas = (ventasRows || []).reduce((sum, v) => sum + (Number(v.valor_producto) || 0), 0);

        // 2b. Calculate SP base
        const { data: spBaseData } = await supabase.rpc("calcular_sp_cop", {
          ingresos_cop: totalVentas,
        });
        const spBase = Number(spBaseData) || 0;

        // 2c. Get last racha
        const { data: lastRacha } = await supabase
          .from("rachas")
          .select("semanas_consecutivas")
          .eq("gerente_id", gerente.id)
          .order("anio", { ascending: false })
          .order("semana_iso", { ascending: false })
          .limit(1)
          .maybeSingle();

        const semanasConsecutivasPrev = lastRacha?.semanas_consecutivas || 0;

        // 2d. Get multiplicador
        const { data: multData } = await supabase.rpc("calcular_multiplicador", {
          semanas_consecutivas: semanasConsecutivasPrev,
        });
        const multiplicador = Number(multData) || 1;

        // 2e. Final SP
        const spFinal = Math.round(spBase * multiplicador);

        // 2f. Insert SP if > 0
        if (spFinal > 0) {
          await supabase.from("sp_acumulados").insert({
            gerente_id: gerente.id,
            fuente: "CONVERSION_COP",
            sp: spFinal,
            periodo: `${anioActual}-W${String(semanaActual).padStart(2, "0")}`,
            detalle: `Cálculo automático semana ${semanaActual}`,
          });
          totalSpOtorgados += spFinal;
        }

        // 2g. Determine estado
        const umbral = umbralMap[gerente.canal || "VC"] || 50000000;
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

        // 2i. Upsert racha
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

        // 3. Evaluate medals (cumplimiento)
        const { data: kpiData } = await supabase
          .from("kpis_mes_actual")
          .select("pct_cumplimiento")
          .eq("gerente_id", gerente.id)
          .maybeSingle();

        if (kpiData && Number(kpiData.pct_cumplimiento) >= 100) {
          await supabase.rpc("otorgar_medalla_si_aplica", {
            p_gerente_id: gerente.id,
            p_medalla: "Meta Conquistada",
            p_sp: 500,
          });
        }

        procesados++;
      } catch (err) {
        errores.push(`Gerente ${gerente.id}: ${String(err)}`);
      }
    }

    const resultado = { procesados, sp_otorgados: totalSpOtorgados, errores };

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

function getISOWeekStartDate(week: number, year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

function getWeekStart(week: number, year: number): Date {
  return getISOWeekStartDate(week, year);
}
