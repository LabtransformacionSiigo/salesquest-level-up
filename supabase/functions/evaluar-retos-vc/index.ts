import { requireRole } from "../_shared/admin-auth.ts";
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

// Clasificación VC: NUBE vs LEGACY. Debe coincidir 1:1 con la del frontend
// src/pages/Retos.tsx (classifyFamilia). Orden importante:
//   1) NUBE primero (productos nube modernos, incluye 'pyme' que es Siigo Pyme)
//   2) LEGACY (desktop / FE / POS / Nómina desktop / Contador / Ilimitada)
//   3) OTROS si no aplica
const NUBE_KEYWORDS_VC = [
  "nube", "cloud", "siigo nube", "pyme", "lite", "emprendedor", "premium",
  "profesional independiente", "sci", "contai", "mto", "nomina ili",
];
const LEGACY_KEYWORDS_VC = [
  "ilimitada", "legacy", "contador",
  "fe ", "fe(", "fe pro", " pos", "pos ", "pos inicio", "pos avanzado",
  "pos esencial", "gastrobar", "nomina base", "nomina lite", "nomina plus",
  "nomina pro",
];
const classifyFamiliaVc = (sale: any): "NUBE" | "LEGACY" | "OTROS" => {
  const raw = `${sale.producto || ""} ${sale.categoria_producto_venta || ""} ${sale.bloque_venta || ""}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!raw) return "OTROS";
  if (NUBE_KEYWORDS_VC.some((k) => raw.includes(k))) return "NUBE";
  if (LEGACY_KEYWORDS_VC.some((k) => raw.includes(k))) return "LEGACY";
  return "OTROS";
};

const isUpgrade = (sale: any): boolean => {
  const rec = (sale.recurrencia || "").toLowerCase();
  const blq = (sale.bloque_venta || "").toLowerCase();
  const prod = (sale.producto || "").toLowerCase();
  return rec.includes("upgrade") || blq.includes("upgrade") || prod.includes("upgrade");
};

const isConversion = (sale: any): boolean => {
  const rec = (sale.recurrencia || "").toLowerCase();
  const blq = (sale.bloque_venta || "").toLowerCase();
  const prod = (sale.producto || "").toLowerCase();
  return rec.includes("conversion") || blq.includes("conversion") || prod.includes("conversion")
    || rec.includes("conversión") || blq.includes("conversión") || prod.includes("conversión");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _guard = await requireRole(req, ["admin","especialista"], { allowCronSecret: true });
  if (_guard.error) return _guard.error;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const dryRun = body.dry_run === true;
    // Permite forzar la fecha de evaluación (YYYY-MM-DD) para backfills mensuales.
    const fechaOverride: string | undefined = typeof body.fecha === 'string' ? body.fecha : undefined;

    const calendarNow = fechaOverride
      ? new Date(`${fechaOverride}T12:00:00Z`)
      : new Date();
    

    // Opción B: usar siempre la fecha real del sistema (o el override en backfill).
    // La fuente Databricks VC es mensual y todas las ventas quedan con fecha día 01,
    // lo que bloqueaba la idempotencia diaria. Con fecha real, retos MENSUALES siguen
    // funcionando (usan agregados del mes), y los DIARIO/SEMANAL quedan en 0 hasta
    // que exista granularidad diaria en la fuente.
    const now = calendarNow;


    const today = now.toISOString().split("T")[0];
    const monthKey = getMonthKey(now);
    const weekKey = getISOWeekKey(now);
    const { start: weekStart, end: weekEnd, monday } = getCurrentWeekRange(now);
    const { start: monthStart, end: monthEnd } = getMonthRange(now);

    // ── Cargar catálogo VC activo ──
    const [retosRes, rachasRes, gerentesRes] = await Promise.all([
      supabase.from("catalogo_retos").select("*").eq("activo", true).eq("canal", "VC"),
      supabase.from("config_rachas").select("*").eq("activo", true).eq("canal", "VC"),
      supabase.from("gerentes").select("id, nombre, canal, pais, user_id").eq("canal", "VC").eq("activo", true),
    ]);

    const todayStr = today;
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
      .select("gerente_id, fecha_facturacion, acv_plus, valor_producto, producto, categoria_producto_venta, bloque_venta, recurrencia, meta, documento_factura")
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

    const { data: spData } = await supabase
      .from("sp_acumulados")
      .select("id, gerente_id, fuente, periodo, detalle, sp")
      .in("gerente_id", gerenteIds)
      .in("fuente", ["RETO_DIARIO", "RETO_SEMANAL", "RETO_MENSUAL"])
      .eq("tipo_sp", "canje");
    const spExistingByPeriod = new Map(
      (spData || []).map((r) => [`${r.gerente_id}::${r.fuente}::${r.periodo}`, r]),
    );
    const retoNamesForMatch = retos
      .map((r: any) => String(r.nombre || ""))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const spAwardedSet = new Set<string>();
    for (const r of (spData || [])) {
      for (const part of String(r.detalle || "").split(" | ")) {
        const nombre = retoNamesForMatch.find((n) => part === n || part.startsWith(`${n} ·`))
          || part.split("·")[0].trim();
        if (nombre) spAwardedSet.add(`${r.gerente_id}::${r.fuente}::${r.periodo}::${nombre}`);
      }
    }

    const retosInsert: any[] = [];
    const spInsert: any[] = [];
    const rachasInsert: any[] = [];
    const detalleSimulacion: any[] = []; // para dry-run
    let totalRetos = 0;
    let totalSp = 0;

    for (const gerente of gerentes) {
      const ventasAll = ventasByGerente.get(gerente.id) || [];
      // SUM- = consolidado mensual (para ACV+ totales y cumplimiento). PROD- = transacciones reales (para upgrades/conversiones/ACV+ diario).
      const isSum = (v: any) => typeof v.documento_factura === 'string' && v.documento_factura.startsWith('SUM-');
      const isProd = (v: any) => typeof v.documento_factura === 'string' && v.documento_factura.startsWith('PROD-');
      const ventasSum = ventasAll.filter(isSum);
      const ventasProd = ventasAll.filter(isProd);
      // Para evaluación general usamos PROD (transacciones diarias). Las métricas mensuales agregadas usan SUM.
      const ventas = ventasProd;
      if (ventasAll.length === 0 && retos.every((r) => r.kpi !== "cumplimiento_pct")) continue;

      // Pre-agregaciones por familia para hoy / semana / mes (sobre transacciones PROD)
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

      // Meta del equipo = SUMA de metas de todas las filas SUM- del mes actual.
      // NO usar Math.max() — cada fila SUM- es un comercial distinto, no la meta total.
      // Math.max() tomaba el máximo individual (~$79M) en vez del total del equipo (~$1,453M),
      // causando cumplimientos inflados (191% en vez del 13% real).
      const metaMes = ventasSum.reduce((s, v) => s + (Number(v.meta) || 0), 0);
      const acvMes = ventasSum.reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
      const cumplimientoMesPct = metaMes > 0 ? (acvMes / metaMes) * 100 : 0;
      const conversionesMes = countBy((v) => isConversion(v) && v.fecha_facturacion >= monthStart && v.fecha_facturacion < monthEnd);
      const conversionesPct = metaMes > 0 ? (conversionesMes / (metaMes / 1000000)) * 100 : 0; // aprox por unidades vs meta MM

      // ── Evaluar cada reto del catálogo ──
      for (const reto of retos) {
        if (reto.pais && gerente.pais && String(reto.pais).toUpperCase() !== String(gerente.pais).toUpperCase()) continue;
        if (reto.gerente_id && reto.gerente_id !== gerente.id) continue;
        const ventana = String(reto.ventana_tiempo || '').toLowerCase();
        const kpi = reto.kpi || reto.tipo_metrica;
        const familia = (reto.familia_vc as "NUBE" | "LEGACY" | "AMBAS" | null) || "AMBAS";
        const umbral = Number(reto.umbral) || 0;
        const sp = Number(reto.sp_otorgados) || 0;
        if (sp <= 0 || umbral <= 0) continue;
        const fuenteReto = ventana === "diario" ? "RETO_DIARIO"
          : ventana === "semanal" ? "RETO_SEMANAL"
          : "RETO_MENSUAL";

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
          ya_completado: spAwardedSet.has(`${gerente.id}::${fuenteReto}::${periodo}::${reto.nombre}`),
        });

        if (!cumplido) continue;
        const key = `${gerente.id}::${reto.nombre}::${periodo}`;
        const spKey = `${gerente.id}::${fuenteReto}::${periodo}::${reto.nombre}`;
        if (spAwardedSet.has(spKey)) continue;

        if (!completadosSet.has(key)) {
          retosInsert.push({
            gerente_id: gerente.id,
            reto: reto.nombre,
            periodo,
            sp,
            tipo: ventana.toUpperCase(), // CHECK constraint exige DIARIO/SEMANAL/MENSUAL
          });
          completadosSet.add(key);
        }
        spInsert.push({
          gerente_id: gerente.id,
          fuente: fuenteReto,
          sp,
          periodo,
          detalle: `${reto.nombre} · ${kpi} · ${familia} · valor:${Math.round(valorAlcanzado)}`,
          tipo_sp: "canje",
        });
        spAwardedSet.add(spKey);
        totalRetos++;
        totalSp += sp;
      }

      // ── Evaluar rachas (multiplicador semanal) ──
      for (const racha of rachas) {
        if (racha.pais && gerente.pais && String(racha.pais).toUpperCase() !== String(gerente.pais).toUpperCase()) continue;
        if (racha.gerente_id && racha.gerente_id !== gerente.id) continue;
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
          estado: "VERDE",
        });
        spInsert.push({
          gerente_id: gerente.id,
          fuente: "RETO_SEMANAL",
          sp: bonus,
          periodo: weekKey,
          detalle: `RACHA · ${racha.nombre} · multiplicador ${multiplicador}x · familia ${familia}`,
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
    const spGrouped = new Map<string, any>();
    for (const s of spInsert) {
      const k = `${s.gerente_id}::${s.fuente}::${s.periodo}`;
      const cur = spGrouped.get(k) || { ...s, detalle: "" };
      cur.sp = (Number(cur.sp) || 0) + (Number(s.sp) || 0);
      cur.detalle = cur.detalle ? `${cur.detalle} | ${s.detalle}` : s.detalle;
      spGrouped.set(k, cur);
    }
    for (const s of spGrouped.values()) {
      const k = `${s.gerente_id}::${s.fuente}::${s.periodo}`;
      const existing: any = spExistingByPeriod.get(k);
      if (existing?.id) {
        const { error } = await supabase.from("sp_acumulados").update({
          sp: (Number(existing.sp) || 0) + (Number(s.sp) || 0),
          detalle: existing.detalle ? `${existing.detalle} | ${s.detalle}` : s.detalle,
        }).eq("id", existing.id);
        if (error) errores.push(`sp_acumulados: ${error.message}`);
      } else {
        const { error } = await supabase.from("sp_acumulados").insert(s);
        if (error) errores.push(`sp_acumulados: ${error.message}`);
      }
    }
    for (const r of rachasInsert) {
      const { error } = await supabase.from("rachas").upsert(r, { onConflict: "gerente_id,anio,semana_iso" });
      if (error) errores.push(`rachas: ${error.message}`);
    }

    // Sincronizar sp_canje de gerentes afectados (retos/rachas)
    const gerentesAfectados = [...new Set(spInsert.map((s) => s.gerente_id))];
    for (const gid of gerentesAfectados) {
      const totalSp = spInsert
        .filter((s) => s.gerente_id === gid)
        .reduce((sum, s) => sum + s.sp, 0);
      await supabase.rpc("increment_gerente_sp_canje", { p_gerente_id: gid, p_delta: totalSp });
    }

    // ── Evaluar medallas VC (catalogo_medallas) ──
    let medallasOtorgadas = 0;
    const { data: catalogoMedallas } = await supabase
      .from("catalogo_medallas")
      .select("*")
      .eq("activo", true)
      .eq("canal", "VC");
    const medallasVigentes = (catalogoMedallas || []).filter(isVigente);

    if (medallasVigentes.length > 0) {
      const { data: medallasYaGanadas } = await supabase
        .from("medallas")
        .select("gerente_id, medalla")
        .in("gerente_id", gerenteIds);
      const ganadasSet = new Set(
        (medallasYaGanadas || []).map((m) => `${m.gerente_id}::${m.medalla}`),
      );

      for (const gerente of gerentes) {
        const ventasG = (ventasByGerente.get(gerente.id) || []).filter(
          (v) => typeof v.documento_factura === "string" && v.documento_factura.startsWith("PROD-"),
        );
        for (const med of medallasVigentes) {
          // Filtro país: si la medalla define país y el gerente tiene país, deben coincidir
          if (med.pais && (gerente as any).pais && med.pais !== (gerente as any).pais) continue;
          // Filtro gerente_id (medalla personal)
          if (med.gerente_id && med.gerente_id !== gerente.id) continue;
          const key = `${gerente.id}::${med.nombre}`;
          if (ganadasSet.has(key)) continue;

          // Contar ventas que aplican según producto/familia
          let conteo = 0;
          const fam = (med.producto || "").toUpperCase();
          if (fam === "NUBE" || fam === "LEGACY") {
            conteo = ventasG.filter((v) => classifyFamiliaVc(v) === fam).length;
          } else if (med.producto) {
            const prodNorm = String(med.producto).toLowerCase();
            conteo = ventasG.filter((v) => (v.producto || "").toLowerCase().includes(prodNorm)).length;
          } else {
            conteo = ventasG.length;
          }

          const req = Math.max(1, Number(med.cantidad_requerida) || 1);
          if (conteo < req) continue;

          const spMedalla = Number(med.sp) || 0;
          const { data: ok } = await supabase.rpc("otorgar_medalla_si_aplica", {
            p_gerente_id: gerente.id, p_medalla: med.nombre, p_sp: spMedalla,
          });
          if (ok) {
            medallasOtorgadas++;
            ganadasSet.add(key);
          }
        }
      }
    }





    return new Response(JSON.stringify({
      ok: true,
      gerentes: gerentes.length,
      totalRetos, totalSp,
      retosInsertados: retosInsert.length,
      spInsertados: spInsert.length,
      rachasInsertadas: rachasInsert.length,
      medallasOtorgadas,
      errores,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
