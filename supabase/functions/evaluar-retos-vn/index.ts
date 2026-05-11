// Evalúa los retos VN (Colombia & Ecuador):
//   DIARIO  — "El Golazo del Día"      (KPI: nubes vendidas vs meta diaria)
//   SEMANAL — "La Jugada de la Semana" (KPI: ACV semanal vs meta semanal)
//   MENSUAL — "La Bota de Oro"         (KPI: ACV mensual >= 100 % meta)
// También aplica rachas: Diaria x1.5 (desde día 4) y Semanal x2 (desde sem 3).
// Idempotente: UNIQUE (reto_id, gerente_id, fecha/semana/mes).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Clasificación de producto como NUBE (misma lógica que frontend Retos.tsx)
const NUBE_KEYWORDS = [
  "nube", "cloud", "siigo nube", "pyme", "lite", "emprendedor", "premium",
  "profesional independiente", "sci", "contai", "mto", "nomina ili",
];
const isNube = (sale: any): boolean => {
  const raw = `${sale.producto || ""} ${sale.categoria_producto_venta || ""} ${sale.bloque_venta || ""}`
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return NUBE_KEYWORDS.some((k) => raw.includes(k));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok */ }
    const dryRun: boolean = body.dry_run === true;

    // fecha_eval: usar la fecha enviada o hoy (UTC)
    const fechaEval: Date = body.fecha ? new Date(body.fecha) : new Date();
    const fechaStr = fechaEval.toISOString().split("T")[0];
    const anioMes = fechaStr.slice(0, 7); // 'YYYY-MM'

    const resultados: any[] = [];
    const spInserts: any[] = [];

    // ── Cargar retos VN activos vigentes ──────────────────────────────────
    const { data: retosData } = await supabase
      .from("retos_vn_config")
      .select("*")
      .eq("activo", true)
      .lte("fecha_inicio", fechaStr)
      .gte("fecha_fin", fechaStr);

    const retos = retosData ?? [];
    if (retos.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, msg: "Sin retos VN activos", resultados: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Cargar rachas activas ─────────────────────────────────────────────
    const { data: rachasData } = await supabase
      .from("rachas_vn_config")
      .select("*")
      .eq("activo", true)
      .lte("fecha_inicio", fechaStr)
      .gte("fecha_fin", fechaStr);
    const rachas = rachasData ?? [];

    // ── Cargar gerentes VN activos de COL/ECU ────────────────────────────
    const { data: gerentesData } = await supabase
      .from("gerentes")
      .select("id, nombre, pais, canal")
      .in("canal", ["VN_EMPRESARIOS", "VN_ALIADOS"])
      .in("pais", ["COL", "ECU"])
      .eq("activo", true);
    const gerentes = gerentesData ?? [];

    if (gerentes.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, msg: "Sin gerentes VN activos en COL/ECU", resultados: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Cargar calendarios del mes ────────────────────────────────────────
    const { data: calendariosData } = await supabase
      .from("config_calendario_vn")
      .select("*")
      .eq("anio_mes", anioMes);
    const calendarios = calendariosData ?? [];

    for (const gerente of gerentes) {
      const calendario = calendarios.find((c: any) => c.pais === gerente.pais);
      if (!calendario) {
        resultados.push({ gerente: gerente.nombre, error: `Sin calendario para ${gerente.pais} ${anioMes}` });
        continue;
      }

      // ── Verificar si hoy es festivo ──────────────────────────────────
      const esFestivo = (calendario.festivos as string[]).includes(fechaStr);

      // ── Asesores del equipo del gerente ──────────────────────────────
      const { data: asesoresData } = await supabase
        .from("asesores")
        .select("documento")
        .eq("gerente_id", gerente.id)
        .eq("activo", true);
      const documentos = (asesoresData ?? []).map((a: any) => a.documento).filter(Boolean);

      // ── Meta mensual ACV (kpis_mensuales) ────────────────────────────
      const { data: kpiRow } = await supabase
        .from("kpis_mensuales")
        .select("meta")
        .eq("gerente_id", gerente.id)
        .eq("anio_mes", anioMes)
        .maybeSingle();
      const metaMensualACV: number = Number(kpiRow?.meta ?? 0);

      // ── Meta mensual NUBES ────────────────────────────────────────────
      const { data: metaNubesRow } = await supabase
        .from("metas_nubes_mensuales")
        .select("meta_nubes")
        .eq("gerente_id", gerente.id)
        .eq("anio_mes", anioMes)
        .maybeSingle();
      const metaMensualNubes: number = Number(metaNubesRow?.meta_nubes ?? 0);

      for (const reto of retos) {
        if (!(reto.canal as string[]).includes(gerente.canal)) continue;
        if (!(reto.paises as string[]).includes(gerente.pais)) continue;

        // ══════════════════════════════════════════════════════════════
        // RETO DIARIO — "El Golazo del Día"
        // ══════════════════════════════════════════════════════════════
        if (reto.tipo === "DIARIO") {
          if (esFestivo) {
            resultados.push({ gerente: gerente.nombre, reto: reto.nombre, resultado: "FESTIVO_OMITIDO", fecha: fechaStr });
            continue;
          }

          // Idempotencia
          const { data: existe } = await supabase
            .from("retos_vn_progreso_diario")
            .select("id")
            .eq("reto_id", reto.id)
            .eq("gerente_id", gerente.id)
            .eq("fecha_evaluacion", fechaStr)
            .maybeSingle();
          if (existe) {
            resultados.push({ gerente: gerente.nombre, reto: reto.nombre, resultado: "YA_EVALUADO", fecha: fechaStr });
            continue;
          }

          const metaDiaria = calendario.dias_habiles > 0
            ? metaMensualNubes / calendario.dias_habiles
            : 0;

          // Rango de fechas: si es viernes y acumular_finde=true, incluir sáb+dom
          let fechaDesde = fechaStr;
          let fechaHasta = fechaStr;
          const diaSemana = fechaEval.getUTCDay(); // 0=Dom … 5=Vie … 6=Sáb
          if (reto.acumular_finde_al_viernes && diaSemana === 5) {
            const sab = new Date(fechaEval);
            sab.setUTCDate(sab.getUTCDate() + 1);
            const dom = new Date(fechaEval);
            dom.setUTCDate(dom.getUTCDate() + 2);
            fechaHasta = dom.toISOString().split("T")[0];
          }

          // Ventas nube del equipo en el rango
          let q = supabase
            .from("ventas")
            .select("id, producto, categoria_producto_venta, bloque_venta")
            .eq("gerente_id", gerente.id)
            .gte("fecha_facturacion", fechaDesde)
            .lte("fecha_facturacion", fechaHasta);
          if (documentos.length > 0) q = q.in("comercial", documentos);
          const { data: ventasDia } = await q;
          const nubesVendidas = (ventasDia ?? []).filter(isNube).length;

          const pct = metaDiaria > 0 ? nubesVendidas / metaDiaria : 0;
          const cumple = pct >= 1.0;

          // Racha diaria
          const rachaConf = rachas.find((r: any) => r.tipo === "DIARIA" && r.reto_ref_id === reto.id);
          let spBase = cumple ? reto.sp_base : 0;
          let spConRacha = spBase;
          let rachaActualizacion: any = null;

          if (rachaConf) {
            const { data: estadoRacha } = await supabase
              .from("rachas_vn_estado")
              .select("*")
              .eq("racha_id", rachaConf.id)
              .eq("gerente_id", gerente.id)
              .maybeSingle();

            if (cumple) {
              const consecutivos = (estadoRacha?.dias_o_semanas_consecutivas ?? 0) + 1;
              // Racha activa cuando ya superó el umbral (activa desde el 4to día)
              const yaActiva = estadoRacha?.racha_activa === true;
              const activaAhora = consecutivos > rachaConf.dias_consecutivos_requeridos;
              if (yaActiva || activaAhora) {
                spConRacha = Math.round(spBase * Number(rachaConf.multiplicador));
              }
              rachaActualizacion = {
                racha_id: rachaConf.id, gerente_id: gerente.id,
                dias_o_semanas_consecutivas: consecutivos,
                racha_activa: activaAhora || yaActiva,
                ultima_fecha_cumplida: fechaStr,
                updated_at: new Date().toISOString(),
              };
            } else {
              // Rompe la racha
              rachaActualizacion = {
                racha_id: rachaConf.id, gerente_id: gerente.id,
                dias_o_semanas_consecutivas: 0,
                racha_activa: false,
                ultima_fecha_cumplida: null,
                updated_at: new Date().toISOString(),
              };
            }
          }

          if (!dryRun) {
            await supabase.from("retos_vn_progreso_diario").insert({
              reto_id: reto.id, gerente_id: gerente.id,
              fecha_evaluacion: fechaStr,
              nubes_vendidas: nubesVendidas,
              meta_diaria_nubes: metaDiaria,
              cumple, sp_otorgados: spBase, sp_con_racha: spConRacha,
            });
            if (rachaActualizacion) {
              await supabase.from("rachas_vn_estado")
                .upsert(rachaActualizacion, { onConflict: "racha_id,gerente_id" });
            }
            if (cumple && spConRacha > 0) {
              spInserts.push({
                gerente_id: gerente.id, fuente: "RETO_DIARIO", sp: spConRacha,
                periodo: fechaStr, tipo_sp: "canje",
                detalle: `${reto.nombre} · nubes:${nubesVendidas}/${Math.ceil(metaDiaria)} · ${fechaStr}`,
              });
            }
          }

          resultados.push({
            gerente: gerente.nombre, pais: gerente.pais, reto: reto.nombre,
            tipo: "DIARIO", fecha: fechaStr,
            nubesVendidas, metaDiaria: Math.ceil(metaDiaria),
            pct: `${(pct * 100).toFixed(1)}%`, cumple,
            spBase, spConRacha, dry_run: dryRun,
          });
        }

        // ══════════════════════════════════════════════════════════════
        // RETO SEMANAL — "La Jugada de la Semana"
        // ══════════════════════════════════════════════════════════════
        if (reto.tipo === "SEMANAL") {
          const semanas = calendario.semanas as Array<{
            numero: number; fecha_inicio: string; fecha_fin: string; sp: number;
          }>;
          const semana = semanas.find((s) => fechaStr >= s.fecha_inicio && fechaStr <= s.fecha_fin);
          if (!semana) continue;

          // Evaluar solo al final de la semana
          if (fechaStr !== semana.fecha_fin) {
            resultados.push({
              gerente: gerente.nombre, reto: reto.nombre, tipo: "SEMANAL",
              resultado: `Sem ${semana.numero} aún no termina (fin: ${semana.fecha_fin})`,
            });
            continue;
          }

          const { data: existeSem } = await supabase
            .from("retos_vn_progreso_semanal")
            .select("id")
            .eq("reto_id", reto.id)
            .eq("gerente_id", gerente.id)
            .eq("anio_mes", anioMes)
            .eq("semana_numero", semana.numero)
            .maybeSingle();
          if (existeSem) {
            resultados.push({ gerente: gerente.nombre, reto: reto.nombre, resultado: "YA_EVALUADO_SEM", semana: semana.numero });
            continue;
          }

          const metaSemanal = metaMensualACV / 4;

          let qAcv = supabase
            .from("ventas")
            .select("acv_plus")
            .eq("gerente_id", gerente.id)
            .gte("fecha_facturacion", semana.fecha_inicio)
            .lte("fecha_facturacion", semana.fecha_fin);
          if (documentos.length > 0) qAcv = qAcv.in("comercial", documentos);
          const { data: ventasSem } = await qAcv;
          const acvReal = (ventasSem ?? []).reduce((s: number, v: any) => s + Number(v.acv_plus ?? 0), 0);
          const pctSem = metaSemanal > 0 ? acvReal / metaSemanal : 0;
          const cumpleSem = pctSem >= 1.0;

          const spBaseSem = cumpleSem ? semana.sp : 0;
          let spConRachaSem = spBaseSem;
          let rachaActualizacionSem: any = null;

          const rachaConfSem = rachas.find((r: any) => r.tipo === "SEMANAL" && r.reto_ref_id === reto.id);
          if (rachaConfSem) {
            const { data: estadoSem } = await supabase
              .from("rachas_vn_estado")
              .select("*")
              .eq("racha_id", rachaConfSem.id)
              .eq("gerente_id", gerente.id)
              .maybeSingle();

            if (cumpleSem) {
              const consecutivos = (estadoSem?.dias_o_semanas_consecutivas ?? 0) + 1;
              const yaActiva = estadoSem?.racha_activa === true;
              const activaAhora = consecutivos > rachaConfSem.dias_consecutivos_requeridos;
              if (yaActiva || activaAhora) {
                spConRachaSem = Math.round(spBaseSem * Number(rachaConfSem.multiplicador));
              }
              rachaActualizacionSem = {
                racha_id: rachaConfSem.id, gerente_id: gerente.id,
                dias_o_semanas_consecutivas: consecutivos,
                racha_activa: activaAhora || yaActiva,
                ultima_fecha_cumplida: fechaStr,
                updated_at: new Date().toISOString(),
              };
            } else {
              rachaActualizacionSem = {
                racha_id: rachaConfSem.id, gerente_id: gerente.id,
                dias_o_semanas_consecutivas: 0,
                racha_activa: false,
                ultima_fecha_cumplida: null,
                updated_at: new Date().toISOString(),
              };
            }
          }

          if (!dryRun) {
            await supabase.from("retos_vn_progreso_semanal").insert({
              reto_id: reto.id, gerente_id: gerente.id,
              anio_mes: anioMes, semana_numero: semana.numero,
              fecha_inicio_semana: semana.fecha_inicio, fecha_fin_semana: semana.fecha_fin,
              acv_real: acvReal, meta_semanal_acv: metaSemanal,
              pct_cumplimiento: pctSem, cumple: cumpleSem,
              sp_otorgados: spBaseSem, sp_con_racha: spConRachaSem,
            });
            if (rachaActualizacionSem) {
              await supabase.from("rachas_vn_estado")
                .upsert(rachaActualizacionSem, { onConflict: "racha_id,gerente_id" });
            }
            if (cumpleSem && spConRachaSem > 0) {
              spInserts.push({
                gerente_id: gerente.id, fuente: "RETO_SEMANAL", sp: spConRachaSem,
                periodo: `${anioMes}-S${semana.numero}`, tipo_sp: "canje",
                detalle: `${reto.nombre} · S${semana.numero} · ACV:${Math.round(acvReal)}/${Math.round(metaSemanal)}`,
              });
            }
          }

          resultados.push({
            gerente: gerente.nombre, pais: gerente.pais, reto: reto.nombre,
            tipo: "SEMANAL", semana: semana.numero,
            acvReal: Math.round(acvReal), metaSemanal: Math.round(metaSemanal),
            pct: `${(pctSem * 100).toFixed(1)}%`, cumple: cumpleSem,
            spBase: spBaseSem, spConRacha: spConRachaSem, dry_run: dryRun,
          });
        }

        // ══════════════════════════════════════════════════════════════
        // RETO MENSUAL — "La Bota de Oro"
        // ══════════════════════════════════════════════════════════════
        if (reto.tipo === "MENSUAL") {
          // Evaluar solo el último día del mes
          const ultimoDia = new Date(Date.UTC(
            fechaEval.getUTCFullYear(), fechaEval.getUTCMonth() + 1, 0,
          )).toISOString().split("T")[0];
          if (fechaStr !== ultimoDia) continue;

          const { data: existeMes } = await supabase
            .from("retos_vn_progreso_mensual")
            .select("id")
            .eq("reto_id", reto.id)
            .eq("gerente_id", gerente.id)
            .eq("anio_mes", anioMes)
            .maybeSingle();
          if (existeMes) {
            resultados.push({ gerente: gerente.nombre, reto: reto.nombre, resultado: "YA_EVALUADO_MES", mes: anioMes });
            continue;
          }

          let qMes = supabase
            .from("ventas")
            .select("acv_plus")
            .eq("gerente_id", gerente.id)
            .gte("fecha_facturacion", `${anioMes}-01`)
            .lte("fecha_facturacion", ultimoDia);
          if (documentos.length > 0) qMes = qMes.in("comercial", documentos);
          const { data: ventasMes } = await qMes;
          const acvMes = (ventasMes ?? []).reduce((s: number, v: any) => s + Number(v.acv_plus ?? 0), 0);
          const pctMes = metaMensualACV > 0 ? acvMes / metaMensualACV : 0;
          const cumpleMes = pctMes >= 1.0;
          const spMes = cumpleMes ? reto.sp_base : 0;

          if (!dryRun) {
            await supabase.from("retos_vn_progreso_mensual").insert({
              reto_id: reto.id, gerente_id: gerente.id, anio_mes: anioMes,
              acv_real: acvMes, meta_mensual_acv: metaMensualACV,
              pct_cumplimiento: pctMes, cumple: cumpleMes, sp_otorgados: spMes,
            });
            if (cumpleMes && spMes > 0) {
              spInserts.push({
                gerente_id: gerente.id, fuente: "RETO_MENSUAL", sp: spMes,
                periodo: anioMes, tipo_sp: "canje",
                detalle: `${reto.nombre} · ACV:${Math.round(acvMes)}/${Math.round(metaMensualACV)} (${(pctMes * 100).toFixed(1)}%)`,
              });
            }
          }

          resultados.push({
            gerente: gerente.nombre, pais: gerente.pais, reto: reto.nombre,
            tipo: "MENSUAL", mes: anioMes,
            acvMes: Math.round(acvMes), metaMensual: Math.round(metaMensualACV),
            pct: `${(pctMes * 100).toFixed(1)}%`, cumple: cumpleMes,
            sp: spMes, dry_run: dryRun,
          });
        }
      }

      // ── Evaluar medallas VN para este gerente ───────────────────────────
      await evaluarMedallasVN(supabase, gerente, anioMes, dryRun, spInserts);
    }

    // ── Persistir SP en bloque ────────────────────────────────────────────
    const errores: string[] = [];
    if (!dryRun && spInserts.length > 0) {
      const chunk = <T,>(arr: T[], n = 500): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
        return out;
      };
      for (const c of chunk(spInserts)) {
        const { error } = await supabase.from("sp_acumulados").insert(c);
        if (error) errores.push(`sp_acumulados: ${error.message}`);
      }
      // Sincronizar sp_canje de gerentes afectados
      const gerentesAfectados = [...new Set(spInserts.map((s) => s.gerente_id))];
      for (const gid of gerentesAfectados) {
        const totalSp = spInserts
          .filter((s) => s.gerente_id === gid)
          .reduce((sum, s) => sum + s.sp, 0);
        await supabase.rpc("increment_gerente_sp_canje", { p_gerente_id: gid, p_delta: totalSp });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, dry_run: dryRun, evaluados: resultados.length, resultados, errores }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function evaluarMedallasVN(
  supabase: any,
  gerente: any,
  anioMes: string,
  dryRun: boolean,
  spInserts: any[],
) {
  const { data: medallas } = await supabase
    .from("medallas_vn_config")
    .select("*")
    .eq("activo", true);

  for (const medalla of medallas ?? []) {
    if (!(medalla.canal as string[]).includes(gerente.canal)) continue;
    if (!(medalla.paises as string[]).includes(gerente.pais)) continue;

    const { data: yaGanada } = await supabase
      .from("medallas_vn_ganadas")
      .select("id")
      .eq("medalla_id", medalla.id)
      .eq("gerente_id", gerente.id)
      .maybeSingle();
    if (yaGanada) continue;

    let otorgar = false;

    if (medalla.condicion_tipo === "racha_diaria_activada") {
      const { data: e } = await supabase
        .from("rachas_vn_estado")
        .select("racha_activa")
        .eq("gerente_id", gerente.id)
        .eq("racha_activa", true)
        .limit(1);
      otorgar = (e ?? []).length > 0;
    } else if (medalla.condicion_tipo === "racha_semanal_activada") {
      const { count } = await supabase
        .from("rachas_vn_estado")
        .select("*", { count: "exact", head: true })
        .eq("gerente_id", gerente.id)
        .eq("racha_activa", true);
      otorgar = (count ?? 0) > 0;
    } else if (medalla.condicion_tipo === "reto_diario_completado_n") {
      const { count } = await supabase
        .from("retos_vn_progreso_diario")
        .select("*", { count: "exact", head: true })
        .eq("gerente_id", gerente.id)
        .eq("cumple", true);
      otorgar = (count ?? 0) >= medalla.condicion_valor;
    } else if (medalla.condicion_tipo === "reto_semanal_completado_n") {
      const { count } = await supabase
        .from("retos_vn_progreso_semanal")
        .select("*", { count: "exact", head: true })
        .eq("gerente_id", gerente.id)
        .eq("cumple", true);
      otorgar = (count ?? 0) >= medalla.condicion_valor;
    } else if (medalla.condicion_tipo === "reto_mensual_completado") {
      const { count } = await supabase
        .from("retos_vn_progreso_mensual")
        .select("*", { count: "exact", head: true })
        .eq("gerente_id", gerente.id)
        .eq("cumple", true);
      otorgar = (count ?? 0) >= 1;
    } else if (medalla.condicion_tipo === "cumplimiento_100_pct_mes") {
      const { data: prog } = await supabase
        .from("retos_vn_progreso_mensual")
        .select("cumple")
        .eq("gerente_id", gerente.id)
        .eq("anio_mes", anioMes)
        .eq("cumple", true)
        .maybeSingle();
      otorgar = !!prog;
    }

    if (otorgar && !dryRun) {
      await supabase.from("medallas_vn_ganadas").insert({
        medalla_id: medalla.id,
        gerente_id: gerente.id,
        sp_otorgados: medalla.sp_reward,
      });
      spInserts.push({
        gerente_id: gerente.id, fuente: "MEDALLA", sp: medalla.sp_reward,
        periodo: anioMes, tipo_sp: "canje",
        detalle: `Medalla VN: ${medalla.nombre}`,
      });
    }
  }
}
