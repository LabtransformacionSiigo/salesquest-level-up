// Sincroniza TODAS las metas históricas desde Databricks
// analyticdl.db_comercial.tbl_brz_cuotas_asesores → metas_asesores
//
// Reglas clave:
//   - Trae TODAS las columnas relevantes (asesor + célula + flags + bonos + archivo).
//   - Cuando existe (documento, canal, mes) en archivo='Inicio' Y 'Cierre',
//     SIEMPRE prevalece 'Cierre' (es la fuente de verdad oficial).
//   - Persiste flags: aplica_cuota_lider, aplica_ejecucion_lider, aplica_hc_minimo,
//     reingreso, dias_softlanding, caso_salud_ocupacional, fecha_ingreso_asesor,
//     m_de_antiguedad, proyecto, dias_novedad y bonos trimestrales.
//   - Inserta DOS niveles: por ASESOR individual y AGREGADO por CÉLULA (CEL_<celula>_<periodo>).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MES_A_NUM: Record<string, string> = {
  enero: "01", ene: "01",
  febrero: "02", feb: "02",
  marzo: "03", mar: "03",
  abril: "04", abr: "04",
  mayo: "05", may: "05",
  junio: "06", jun: "06",
  julio: "07", jul: "07",
  agosto: "08", ago: "08",
  septiembre: "09", sep: "09", sept: "09",
  octubre: "10", oct: "10",
  noviembre: "11", nov: "11",
  diciembre: "12", dic: "12",
};

function normalizePeriodo(mes: string | null): string | null {
  if (!mes) return null;
  const k = String(mes).trim().toLowerCase();
  const num = MES_A_NUM[k];
  if (!num) return null;
  return `2026${num}`;
}

function normalizeCanal(c: string | null): string | null {
  if (!c) return null;
  const u = String(c).trim().toUpperCase();
  if (u === "ALIADOS" || u === "VENTA NUEVA ALIADOS") return "VN_ALIADOS";
  if (u === "EMPRESARIOS" || u === "VENTA NUEVA EMPRESARIOS") return "VN_EMPRESARIOS";
  if (u === "SMBS") return "VN_EMPRESARIOS";
  if (u === "VN_ALIADOS" || u === "VN_EMPRESARIOS") return u;
  return u;
}

function toInt(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clean(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function cleanDate(v: any): string | null {
  const s = clean(v);
  if (!s) return null;
  // ISO date or 'YYYY-MM-DD...' → keep first 10 chars
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function normalizeArchivo(v: any): "Inicio" | "Cierre" | null {
  const s = clean(v);
  if (!s) return null;
  const u = s.toLowerCase();
  if (u.includes("cierre")) return "Cierre";
  if (u.includes("inicio")) return "Inicio";
  return null;
}

async function runDatabricksQuery(sql: string): Promise<Record<string, any>[]> {
  const HOST = Deno.env.get("DATABRICKS_HOST")!;
  const TOKEN = Deno.env.get("DATABRICKS_TOKEN")!;
  const WAREHOUSE = Deno.env.get("DATABRICKS_WAREHOUSE_ID")!;
  if (!HOST || !TOKEN || !WAREHOUSE) throw new Error("Faltan credenciales de Databricks");

  const baseUrl = `${HOST.replace(/\/+$/, "")}/api/2.0/sql/statements`;
  const resp = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      warehouse_id: WAREHOUSE,
      statement: sql,
      wait_timeout: "50s",
      disposition: "INLINE",
      format: "JSON_ARRAY",
    }),
  });
  let data = await resp.json();
  if (!resp.ok && !data.statement_id) {
    throw new Error(data.status?.error?.message || data.message || JSON.stringify(data));
  }

  const statementId = data.statement_id;
  let polls = 0;
  while ((data.status?.state === "PENDING" || data.status?.state === "RUNNING") && polls < 24) {
    polls++;
    await new Promise((r) => setTimeout(r, 5000));
    const pr = await fetch(`${baseUrl}/${statementId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    data = await pr.json();
  }
  if (data.status?.state === "FAILED") throw new Error(data.status?.error?.message || "Query failed");
  if (data.status?.state !== "SUCCEEDED") throw new Error(`Estado inesperado: ${data.status?.state}`);

  const cols = (data.manifest?.schema?.columns || []).map((c: any) => c.name);
  const allRows: any[][] = [...(data.result?.data_array || [])];
  let nextLink: string | undefined = data.result?.next_chunk_internal_link;
  const baseHost = HOST.replace(/\/+$/, "");
  let chunkIdx = 1;
  while (nextLink && chunkIdx < 500) {
    const url = nextLink.startsWith("http") ? nextLink : `${baseHost}${nextLink}`;
    const cr = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!cr.ok) break;
    const cd = await cr.json();
    allRows.push(...(cd.data_array || []));
    nextLink = cd.next_chunk_internal_link;
    chunkIdx++;
  }

  return allRows.map((row: any[]) => {
    const obj: Record<string, any> = {};
    cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
    return obj;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    if (url.searchParams.get("debug") === "1") {
      const dbg = await runDatabricksQuery(`
        SELECT mes, archivo, canal_direccion, COUNT(*) AS n
        FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
        WHERE canal_direccion IN ('Aliados','SMBS','Empresarios')
        GROUP BY mes, archivo, canal_direccion
        ORDER BY mes, archivo, canal_direccion
      `);
      return new Response(JSON.stringify({ debug: true, rows: dbg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Traemos TODAS las columnas relevantes incluyendo archivo y flags
    const sql = `
      SELECT pais, canal_direccion, director, gerente,
             documento_asesor, nombre_asesor, celula, proyecto,
             fecha_ingreso_asesor, m_de_antiguedad,
             fe, nube, total,
             novedad, reingreso,
             dias_habiles_softlanding,
             caso_salud_ocupacional,
             meta_total, mes, archivo,
             dias_habiles_de_novedad_comisiones_peopleretiro_intrames AS dias_novedad,
             meta_fe, meta_nube,
             aplica_a_cuota_lider, aplica_a_ejecucion_lider, aplica_a_hc_minimo,
             dias_habiles_de_novedad_bono_trimestral,
             meta_sql_bono_trimestral_categorizacion_marzo AS meta_sql_bono,
             meta_recomendados_bono_trimestral_categorizacion_marzo AS meta_recomendados_bono,
             fe_bono_trimestral_categorizacion AS fe_bono,
             nube_bono_trimestral_categorizacion AS nube_bono,
             total_bono_trimestral_categorizacion AS total_bono
      FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
      WHERE canal_direccion IN ('Aliados','SMBS','Empresarios')
    `;

    console.log("[sync-metas-historicas] Ejecutando query Databricks...");
    const rows = await runDatabricksQuery(sql);
    console.log(`[sync-metas-historicas] Filas recibidas: ${rows.length}`);

    // ────────────────────────────────────────────────
    // Paso 1: indexar por (documento, canal, periodo) preferiendo Cierre
    // ────────────────────────────────────────────────
    const mesesNoMapeados = new Map<string, number>();
    const descartesPorMes: Record<string, { sin_canal: number; sin_celula: number; sin_periodo: number; total: number }> = {};

    type AsesorRow = {
      documento_asesor: string;
      nombre_asesor: string;
      pais: string;
      canal_direccion: string;
      celula: string;
      gerente: string | null;
      proyecto: string | null;
      fecha_ingreso_asesor: string | null;
      m_de_antiguedad: number | null;
      anio_mes: string;
      meta_fe: number;
      meta_nube: number;
      meta_total: number;
      novedad: string;
      reingreso: string | null;
      dias_softlanding: number;
      caso_salud_ocupacional: string | null;
      dias_novedad: number;
      aplica_cuota_lider: string | null;
      aplica_ejecucion_lider: string | null;
      aplica_hc_minimo: string | null;
      meta_sql_bono: number;
      meta_recomendados_bono: number;
      fe_bono: number;
      nube_bono: number;
      total_bono: number;
      __archivo: "Inicio" | "Cierre";
    };

    // key: documento|canal|periodo  →  best row (Cierre gana sobre Inicio)
    const asesorMap = new Map<string, AsesorRow>();
    // key: celula|canal|periodo|archivo → agregados separados por archivo
    // SOLO suma asesores con aplica_a_cuota_lider = 'Si'
    const celulaAggByArchivo = new Map<string, {
      celula: string; canal_direccion: string; gerente: string | null;
      pais: string; anio_mes: string; archivo: "Inicio" | "Cierre";
      meta_fe: number; meta_nube: number; meta_total: number;
    }>();
    // Dedupe dentro del mismo archivo: evita que filas duplicadas (ej. Cierre + Cierre1)
    // se sumen dos veces al agregado por célula.
    const seenAggByDocArchivo = new Set<string>();

    for (const r of rows) {
      const mesRaw = clean(r.mes);
      const periodo = normalizePeriodo(mesRaw);
      const canal = normalizeCanal(clean(r.canal_direccion));
      const celula = clean(r.celula);
      const pais = (clean(r.pais) || "COL").toUpperCase();
      const documento = clean(r.documento_asesor);
      const nombre = clean(r.nombre_asesor);
      const gerente = clean(r.gerente) || clean(r.director);
      const novedad = clean(r.novedad) || "Sin novedad";
      const archivo = normalizeArchivo(r.archivo);
      const totalMeta = toInt(r.meta_total);

      const mesKey = mesRaw || "(null)";
      if (!descartesPorMes[mesKey]) {
        descartesPorMes[mesKey] = { sin_canal: 0, sin_celula: 0, sin_periodo: 0, total: 0 };
      }
      descartesPorMes[mesKey].total++;

      if (!periodo) {
        mesesNoMapeados.set(mesKey, (mesesNoMapeados.get(mesKey) || 0) + 1);
        descartesPorMes[mesKey].sin_periodo++;
        continue;
      }
      if (!canal) { descartesPorMes[mesKey].sin_canal++; continue; }
      if (!celula) { descartesPorMes[mesKey].sin_celula++; continue; }
      if (!archivo) continue; // fila sin archivo es inutilizable
      if (totalMeta <= 0) continue;

      const fe = toInt(r.meta_fe);
      const nube = toInt(r.meta_nube);

      // ── (1) Asesor individual ── prevalece Cierre sobre Inicio
      if (documento && nombre) {
        const key = `${documento}|${canal}|${periodo}`;
        const cur = asesorMap.get(key);
        const incoming: AsesorRow = {
          documento_asesor: documento,
          nombre_asesor: nombre,
          pais,
          canal_direccion: canal,
          celula,
          gerente,
          proyecto: clean(r.proyecto),
          fecha_ingreso_asesor: cleanDate(r.fecha_ingreso_asesor),
          m_de_antiguedad: toNum(r.m_de_antiguedad),
          anio_mes: periodo,
          meta_fe: fe,
          meta_nube: nube,
          meta_total: totalMeta,
          novedad,
          reingreso: clean(r.reingreso),
          dias_softlanding: toInt(r.dias_habiles_softlanding),
          caso_salud_ocupacional: clean(r.caso_salud_ocupacional),
          dias_novedad: toInt(r.dias_novedad),
          aplica_cuota_lider: clean(r.aplica_a_cuota_lider),
          aplica_ejecucion_lider: clean(r.aplica_a_ejecucion_lider),
          aplica_hc_minimo: clean(r.aplica_a_hc_minimo),
          meta_sql_bono: toInt(r.meta_sql_bono),
          meta_recomendados_bono: toInt(r.meta_recomendados_bono),
          fe_bono: toInt(r.fe_bono),
          nube_bono: toInt(r.nube_bono),
          total_bono: toInt(r.total_bono),
          __archivo: archivo,
        };
        // Reemplaza si: no existe, o entra Cierre cuando había Inicio
        if (!cur) {
          asesorMap.set(key, incoming);
        } else if (cur.__archivo === "Inicio" && archivo === "Cierre") {
          asesorMap.set(key, incoming);
        }
        // si cur ya es Cierre, ignoramos cualquier Inicio adicional
      }

      // ── (2) Agregado por célula+archivo: SOLO asesores con aplica_a_cuota_lider = 'Si',
      //         deduplicando por (documento, canal, periodo, archivo) por si Databricks
      //         devuelve dos filas del mismo archivo (ej. Cierre + Cierre1).
      const aplicaSi = (clean(r.aplica_a_cuota_lider) || "").toLowerCase() === "si";
      if (aplicaSi && documento) {
        const dedupeKey = `${documento}|${canal}|${periodo}|${archivo}`;
        if (!seenAggByDocArchivo.has(dedupeKey)) {
          seenAggByDocArchivo.add(dedupeKey);
          const ckey = `${celula}|${canal}|${periodo}|${archivo}`;
          const cAgg = celulaAggByArchivo.get(ckey) || {
            celula, canal_direccion: canal, gerente, pais, anio_mes: periodo, archivo,
            meta_fe: 0, meta_nube: 0, meta_total: 0,
          };
          cAgg.meta_fe += fe;
          cAgg.meta_nube += nube;
          cAgg.meta_total += totalMeta;
          if (!cAgg.gerente && gerente) cAgg.gerente = gerente;
          celulaAggByArchivo.set(ckey, cAgg);
        }
      }
    }

    // Para cada (celula,canal,periodo) preferir Cierre sobre Inicio
    const bestCelula = new Map<string, ReturnType<typeof celulaAggByArchivo.get> extends Map<any, infer V> ? V : any>();
    for (const [k, v] of celulaAggByArchivo.entries()) {
      const base = `${v.celula}|${v.canal_direccion}|${v.anio_mes}`;
      const cur = bestCelula.get(base);
      if (!cur || (cur.archivo === "Inicio" && v.archivo === "Cierre")) {
        bestCelula.set(base, v);
      }
    }

    const asesorRows = Array.from(asesorMap.values()).map((a) => {
      // remove internal marker
      const { __archivo, ...rest } = a;
      return rest;
    });

    const celulaRows = Array.from(bestCelula.values()).map((a) => ({
      documento_asesor: `CEL_${a!.celula}_${a!.anio_mes}`.toUpperCase().replace(/\s+/g, "_"),
      nombre_asesor: null,
      pais: a!.pais,
      canal_direccion: a!.canal_direccion,
      celula: a!.celula,
      gerente: a!.gerente,
      anio_mes: a!.anio_mes,
      meta_fe: a!.meta_fe,
      meta_nube: a!.meta_nube,
      meta_total: a!.meta_total,
      novedad: "Sin novedad",
    }));

    const allUpsert = [...asesorRows, ...celulaRows];
    console.log(`[sync-metas-historicas] Asesor: ${asesorRows.length} | Célula: ${celulaRows.length} | Total: ${allUpsert.length}`);

    // ────────────────────────────────────────────────
    // LIMPIEZA: borrar filas previas de los períodos sincronizados
    // para eliminar asesores que ya no aplican (ej. cambio de Inicio→Cierre)
    // ────────────────────────────────────────────────
    const periodosSync = Array.from(new Set(asesorRows.map((r) => r.anio_mes)));
    if (periodosSync.length > 0) {
      const { error: delErr } = await supabase
        .from("metas_asesores")
        .delete()
        .in("anio_mes", periodosSync);
      if (delErr) {
        console.error("[sync-metas-historicas] Error limpiando períodos:", delErr.message);
      } else {
        console.log(`[sync-metas-historicas] ✓ Limpieza períodos: ${periodosSync.join(", ")}`);
      }
    }

    // ────────────────────────────────────────────────
    // Insert en lotes (tras limpieza)
    // ────────────────────────────────────────────────
    const BATCH = 500;
    let upserted = 0;
    const errores: string[] = [];
    for (let i = 0; i < allUpsert.length; i += BATCH) {
      const batch = allUpsert.slice(i, i + BATCH);
      const { error, count } = await supabase
        .from("metas_asesores")
        .insert(batch, { count: "exact" });
      if (error) {
        errores.push(`Lote ${i}: ${error.message}`);
        console.error(`[sync-metas-historicas] Error lote ${i}:`, error.message);
      } else {
        upserted += count || batch.length;
      }
    }

    // Resumen por periodo
    const porPeriodo: Record<string, { asesores: number; celulas: number }> = {};
    asesorRows.forEach((r) => {
      porPeriodo[r.anio_mes] = porPeriodo[r.anio_mes] || { asesores: 0, celulas: 0 };
      porPeriodo[r.anio_mes].asesores++;
    });
    celulaRows.forEach((r) => {
      porPeriodo[r.anio_mes] = porPeriodo[r.anio_mes] || { asesores: 0, celulas: 0 };
      porPeriodo[r.anio_mes].celulas++;
    });

    return new Response(JSON.stringify({
      success: errores.length === 0,
      filas_databricks: rows.length,
      asesor_individual: asesorRows.length,
      agregado_celula: celulaRows.length,
      total_upsert: allUpsert.length,
      registros_upserted: upserted,
      por_periodo: porPeriodo,
      meses_no_mapeados: Object.fromEntries(mesesNoMapeados),
      descartes_por_mes: descartesPorMes,
      errores: errores.slice(0, 10),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[sync-metas-historicas] Error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err?.message || String(err),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
