// Evalúa retos VC parametrizados en `catalogo_retos` y otorga SP a los gerentes
// que cumplan el umbral según el KPI (acv_plus, upgrades, conversiones, cumplimiento_pct).
// También evalúa la racha "El artillero" (config_rachas con dias_lun_mie=true) y duplica SP semanales.
//
// Idempotente: usa retos_completados (gerente_id, reto, periodo) y sp_acumulados con detalle único.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers de período ──
const getISOWeekKey = (date: Date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const getMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const getCurrentWeekRange = (date: Date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dayOfWeek + 1);
  const sundayExclusive = new Date(monday);
  sundayExclusive.setUTCDate(sundayExclusive.getUTCDate() + 7);
  return {
    start: monday.toISOString().split("T")[0],
    end: sundayExclusive.toISOString().split("T")[0],
    monday,
  };
};

const getMonthRange = (date: Date) => {
  const start = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = date.getUTCMonth() === 11
    ? `${date.getUTCFullYear() + 1}-01-01`
    : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 2).padStart(2, "0")}-01`;
  return { start, end: nextMonth };
};

// Clasificación de familia VC según producto / categoria / bloque_venta
const classifyFamiliaVc = (sale: any): "NUBE" | "LEGACY" | "OTROS" => {
  const txt = `${sale.producto || ""} ${sale.categoria_producto_venta || ""} ${sale.bloque_venta || ""}`
    .toLowerCase();
  if (!txt.trim()) return "OTROS";
  if (txt.includes("nube") || txt.includes("cloud") || txt.includes("siigo nube")) return "NUBE";
  if (txt.includes("pyme") || txt.includes("ilimitada") || txt.includes("legacy") || txt.includes("contador")) return "LEGACY";
  return "OTROS";
};

const isUpgrade = (sale: any): boolean => {
  const rec = (sale.recurrencia || "").toLowerCase();
  const blq = (sale.bloque_venta || "").toLowerCase();
  return rec.includes("upgrade") || blq.includes("upgrade");
};

const isConversion = (sale: any): boolean => {
  const rec = (sale.recurrencia || "").toLowerCase();
  const blq = (sale.bloque_venta || "").toLowerCase();
  return rec.includes("conversion") || blq.includes("conversion") || rec.includes("conversión") || blq.includes("conversión");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const dryRun = body.dry_run === true;

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const monthKey = getMonthKey(now);
    const weekKey = getISOWeekKey(now);
    const { start: weekStart, end: weekEnd, monday } = getCurrentWeekRange(now);
    const { start: monthStart, end: monthEnd } = getMonthRange(now);

    // ── Cargar catálogo VC activo ──
    const [retosRes, rachasRes, gerentesRes] = await Promise.all([
      supabase.from("catalogo_retos").select("*").eq("activo", true).eq("canal", "VC"),
      supabase.from("config_rachas").select("*").eq("activo", true).eq("canal", "VC"),
      supabase.from("gerentes").select("id, nombre, canal").eq("canal", "VC").eq("activo", true),
    ]);

    const todayStr = now.toISOString().slice(0, 10);
    const isVigente = (item: { fecha_inicio?: string | null; fecha_fin?: string | null }) =>
      (!item.fecha_inicio || todayStr >= item.fecha_inicio) &&
      (!item.fecha_fin || todayStr <= item.fecha_fin);
    const retos = (retosRes.data || []).filter(isVigente);
    const rachas = (rachasRes.data || []).filter(isVigente);
    const gerentes = gerentesRes.data || [];

    if (gerentes.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: "Sin gerentes VC activos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gerenteIds = gerentes.map((g) => g.id);

    // ── Cargar ventas del MES actual (cubre día/semana/mes) ──
    const { data: ventasMes } = await supabase
      .from("ventas")
      .select("gerente_id, fecha_facturacion, acv_plus, valor_producto, producto, categoria_producto_venta, bloque_venta, recurrencia, meta")
      .eq("canal", "VC")
      .in("gerente_id", gerenteIds)
      .gte("fecha_facturacion", monthStart)
      .lt("fecha_facturacion", monthEnd);

    // Index por gerente
    const ventasByGerente = new Map<string, any[]>();
    (ventasMes || []).forEach((v) => {
      if (!v.gerente_id) return;
      const arr = ventasByGerente.get(v.gerente_id) || [];
      arr.push(v);
      ventasByGerente.set(v.gerente_id, arr);
    });

    // ── Cargar retos ya completados este mes (para idempotencia) ──
    const { data: completadosData } = await supabase
      .from("retos_completados")
      .select("gerente_id, reto, periodo")
      .in("gerente_id", gerenteIds);
    const completadosSet = new Set((completadosData || []).map((r) => `${r.gerente_id}::${r.reto}::${r.periodo}`));

    const retosInsert: any[] = [];
    const spInsert: any[] = [];
    const rachasInsert: any[] = [];
    const detalleSimulacion: any[] = []; // para dry-run
    let totalRetos = 0;
    let totalSp = 0;

    for (const gerente of gerentes) {
      const ventas = ventasByGerente.get(gerente.id) || [];
      if (ventas.length === 0 && retos.every((r) => r.kpi !== "cumplimiento_pct")) continue;

      // Pre-agregaciones por familia para hoy / semana / mes
      const sumAcvBy = (filterFn: (v: any) => boolean, famFilter?: "NUBE" | "LEGACY" | "AMBAS") =>
        ventas
          .filter(filterFn)
          .filter((v) => {
            if (!famFilter || famFilter === "AMBAS") return true;
            return classifyFamiliaVc(v) === famFilter;
          })
          .reduce((sum, v) => sum + (Number(v.acv_plus) || 0), 0);

      const countBy = (filterFn: (v: any) => boolean, famFilter?: "NUBE" | "LEGACY" | "AMBAS") =>
        ventas
          .filter(filterFn)
          .filter((v) => {
            if (!famFilter || famFilter === "AMBAS") return true;
            return classifyFamiliaVc(v) === famFilter;
          }).length;

      // Meta del mes (toma máxima meta registrada para el mes, suele venir replicada)
      const metaMes = Math.max(0, ...ventas.map((v) => Number(v.meta) || 0));
      const acvMes = sumAcvBy((v) => v.fecha_facturacion >= monthStart && v.fecha_facturacion < monthEnd);
      const cumplimientoMesPct = metaMes > 0 ? (acvMes / metaMes) * 100 : 0;
      const conversionesMes = countBy((v) => isConversion(v) && v.fecha_facturacion >= monthStart && v.fecha_facturacion < monthEnd);
      const conversionesPct = metaMes > 0 ? (conversionesMes / (metaMes / 1000000)) * 100 : 0; // aprox por unidades vs meta MM

      // ── Evaluar cada reto del catálogo ──
      for (const reto of retos) {
        const ventana = reto.ventana_tiempo;
        const kpi = reto.kpi || reto.tipo_metrica;
        const familia = (reto.familia_vc as "NUBE" | "LEGACY" | "AMBAS" | null) || "AMBAS";
        const umbral = Number(reto.umbral) || 0;
        const sp = Number(reto.sp_otorgados) || 0;
        if (sp <= 0 || umbral <= 0) continue;

        let cumplido = false;
        let periodo = "";
        let valorAlcanzado = 0;

        if (ventana === "diario") {
          periodo = today;
          if (kpi === "acv_plus") {
            valorAlcanzado = sumAcvBy((v) => v.fecha_facturacion === today, familia);
            cumplido = valorAlcanzado >= umbral;
          } else if (kpi === "upgrades") {
            valorAlcanzado = countBy((v) => isUpgrade(v) && v.fecha_facturacion === today, familia);
            cumplido = valorAlcanzado >= umbral;
          }
        } else if (ventana === "semanal") {
          periodo = weekKey;
          const inWeek = (v: any) => v.fecha_facturacion >= weekStart && v.fecha_facturacion < weekEnd;
          if (kpi === "acv_plus") {
            valorAlcanzado = sumAcvBy(inWeek, familia);
            cumplido = valorAlcanzado >= umbral;
          } else if (kpi === "upgrades") {
            valorAlcanzado = countBy((v) => isUpgrade(v) && inWeek(v), familia);
            cumplido = valorAlcanzado >= umbral;
          } else if (kpi === "conversiones") {
            valorAlcanzado = countBy((v) => isConversion(v) && inWeek(v), familia);
            cumplido = valorAlcanzado >= umbral;
          }
        } else if (ventana === "mensual") {
          periodo = monthKey;
          if (kpi === "acv_plus") {
            valorAlcanzado = acvMes;
            cumplido = valorAlcanzado >= umbral;
          } else if (kpi === "cumplimiento_pct") {
            valorAlcanzado = cumplimientoMesPct;
            cumplido = valorAlcanzado >= umbral;
          } else if (kpi === "conversiones") {
            valorAlcanzado = conversionesPct;
            cumplido = valorAlcanzado >= umbral;
          } else if (kpi === "upgrades") {
            valorAlcanzado = countBy((v) => isUpgrade(v));
            cumplido = valorAlcanzado >= umbral;
          }
        }

        // Registrar siempre en simulación (cumplido o no)
        detalleSimulacion.push({
          gerente_id: gerente.id,
          gerente_nombre: gerente.nombre,
          reto: reto.nombre,
          ventana,
          kpi,
          familia,
          umbral,
          valor_alcanzado: Math.round(valorAlcanzado * 100) / 100,
          cumplido,
          sp_otorgables: sp,
          periodo,
          ya_completado: completadosSet.has(`${gerente.id}::${reto.nombre}::${periodo}`),
        });

        if (!cumplido) continue;
        const key = `${gerente.id}::${reto.nombre}::${periodo}`;
        if (completadosSet.has(key)) continue;

        retosInsert.push({
          gerente_id: gerente.id,
          reto: reto.nombre,
          periodo,
          sp,
          tipo: ventana,
        });
        spInsert.push({
          gerente_id: gerente.id,
          fuente: "RETO_VC",
          sp,
          periodo,
          detalle: `${reto.nombre} · ${kpi} · ${familia} · valor:${Math.round(valorAlcanzado)}`,
          tipo_sp: "canje",
        });
        completadosSet.add(key);
        totalRetos++;
        totalSp += sp;
      }

      // ── Evaluar rachas (multiplicador semanal) ──
      for (const racha of rachas) {
        if (!racha.dias_lun_mie) continue; // solo "El artillero" por ahora
        const umbralNube = Number(racha.umbral_verde) || 0;
        const umbralLegacy = Number(racha.umbral_legacy) || 0;
        const familia = (racha.familia_vc as "NUBE" | "LEGACY" | "AMBAS" | null) || "AMBAS";
        const multiplicador = Number(racha.multiplicador_sp) || 1;

        // Verifica lunes/martes/miércoles de la semana actual
        const dias: string[] = [];
        for (let i = 0; i < 3; i++) {
          const dt = new Date(monday);
          dt.setUTCDate(monday.getUTCDate() + i);
          if (dt > now) break; // futuro
          dias.push(dt.toISOString().split("T")[0]);
        }
        if (dias.length < 3) continue; // todavía no terminó miércoles

        const cumple = dias.every((dia) => {
          if (familia === "NUBE") return sumAcvBy((v) => v.fecha_facturacion === dia, "NUBE") >= umbralNube;
          if (familia === "LEGACY") return sumAcvBy((v) => v.fecha_facturacion === dia, "LEGACY") >= umbralLegacy;
          // AMBAS: cualquiera de las dos
          const nube = sumAcvBy((v) => v.fecha_facturacion === dia, "NUBE");
          const legacy = sumAcvBy((v) => v.fecha_facturacion === dia, "LEGACY");
          return nube >= umbralNube || legacy >= umbralLegacy;
        });

        if (!cumple) continue;
        const key = `${gerente.id}::${racha.nombre}::${weekKey}`;
        if (completadosSet.has(key)) continue;

        // SP del multiplicador = SP semanales del gerente esta semana × (mult - 1)
        const { data: spSemana } = await supabase
          .from("sp_acumulados")
          .select("sp")
          .eq("gerente_id", gerente.id)
          .eq("periodo", weekKey);
        const spBase = (spSemana || []).reduce((s, r) => s + (Number(r.sp) || 0), 0);
        const bonus = Math.round(spBase * (multiplicador - 1));
        if (bonus <= 0) continue;

        rachasInsert.push({
          gerente_id: gerente.id,
          anio: now.getUTCFullYear(),
          semana_iso: parseInt(weekKey.split("-W")[1], 10),
          ingresos_semana: 0,
          multiplicador,
          semanas_consecutivas: 1,
          estado: "verde",
        });
        spInsert.push({
          gerente_id: gerente.id,
          fuente: "RACHA_VC",
          sp: bonus,
          periodo: weekKey,
          detalle: `${racha.nombre} · multiplicador ${multiplicador}x · familia ${familia}`,
          tipo_sp: "canje",
        });
        completadosSet.add(key);
        totalSp += bonus;
      }
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        ok: true, dry_run: true,
        totalRetos, totalSp,
        retosInsert: retosInsert.length,
        spInsert: spInsert.length,
        rachasInsert: rachasInsert.length,
        detalle: detalleSimulacion,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Persistir en chunks ──
    const chunk = <T,>(arr: T[], n = 500) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };

    const errores: string[] = [];
    for (const c of chunk(retosInsert)) {
      const { error } = await supabase.from("retos_completados").insert(c);
      if (error) errores.push(`retos_completados: ${error.message}`);
    }
    for (const c of chunk(spInsert)) {
      const { error } = await supabase.from("sp_acumulados").insert(c);
      if (error) errores.push(`sp_acumulados: ${error.message}`);
    }
    for (const r of rachasInsert) {
      const { error } = await supabase.from("rachas").upsert(r, { onConflict: "gerente_id,anio,semana_iso" });
      if (error) errores.push(`rachas: ${error.message}`);
    }

    return new Response(JSON.stringify({
      ok: true,
      gerentes: gerentes.length,
      totalRetos, totalSp,
      retosInsertados: retosInsert.length,
      spInsertados: spInsert.length,
      rachasInsertadas: rachasInsert.length,
      errores,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
