// Sincroniza TODAS las metas históricas desde Databricks
// hive_metastore.db_comercial.tbl_brz_cuotas_asesores → metas_asesores
//
// Inserta DOS niveles:
//   1) Fila por ASESOR individual (cuando viene documento_asesor + nombre_asesor)
//   2) Fila AGREGADA por CÉLULA (documento sintético `CEL_<celula>_<periodo>`)
//      para que la UI siga teniendo totales aún si faltan asesores individuales.
//
// Mapea mes texto ('Enero','Febrero','Marzo','Abril') → 'YYYYMM' (asume 2026).
// Canales: Aliados, SMBS, Empresarios → VN_ALIADOS / VN_EMPRESARIOS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MES_A_NUM: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04",
  mayo: "05", junio: "06", julio: "07", agosto: "08",
  septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
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

function clean(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Traemos TODAS las columnas relevantes (asesor + célula)
    const sql = `
      SELECT pais, canal_direccion, director, gerente,
             documento_asesor, nombre_asesor, celula,
             meta_fe, meta_nube, meta_total, mes,
             novedad
      FROM hive_metastore.db_comercial.tbl_brz_cuotas_asesores
      WHERE canal_direccion IN ('Aliados','SMBS','Empresarios')
        AND meta_total IS NOT NULL
        AND meta_total > 0
    `;

    console.log("[sync-metas-historicas] Ejecutando query Databricks...");
    const rows = await runDatabricksQuery(sql);
    console.log(`[sync-metas-historicas] Filas recibidas: ${rows.length}`);

    // ────────────────────────────────────────────────
    // Diagnóstico de descartes
    // ────────────────────────────────────────────────
    const mesesNoMapeados = new Map<string, number>();
    const descartesPorMes: Record<string, { sin_canal: number; sin_celula: number; sin_periodo: number; total: number }> = {};

    // ────────────────────────────────────────────────
    // 1) Filas a nivel ASESOR individual
    // ────────────────────────────────────────────────
    const asesorMap = new Map<string, any>();
    // 2) Agregado por CÉLULA
    const celulaMap = new Map<string, {
      celula: string; canal_direccion: string; gerente: string | null;
      pais: string; anio_mes: string;
      meta_fe: number; meta_nube: number; meta_total: number;
    }>();

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

      const fe = toInt(r.meta_fe);
      const nube = toInt(r.meta_nube);
      const total = toInt(r.meta_total);

      // ── (1) Asesor individual ──
      if (documento && nombre) {
        const key = `${documento}|${canal}|${periodo}`;
        // Si ya existe (duplicado), sumamos para no perder filas
        const cur = asesorMap.get(key);
        if (cur) {
          cur.meta_fe += fe;
          cur.meta_nube += nube;
          cur.meta_total += total;
        } else {
          asesorMap.set(key, {
            documento_asesor: documento,
            nombre_asesor: nombre,
            pais,
            canal_direccion: canal,
            celula,
            gerente,
            anio_mes: periodo,
            meta_fe: fe,
            meta_nube: nube,
            meta_total: total,
            novedad,
          });
        }
      }

      // ── (2) Agregado por célula (siempre) ──
      const ckey = `${celula}|${canal}|${periodo}`;
      const cAgg = celulaMap.get(ckey) || {
        celula, canal_direccion: canal, gerente, pais, anio_mes: periodo,
        meta_fe: 0, meta_nube: 0, meta_total: 0,
      };
      cAgg.meta_fe += fe;
      cAgg.meta_nube += nube;
      cAgg.meta_total += total;
      if (!cAgg.gerente && gerente) cAgg.gerente = gerente;
      celulaMap.set(ckey, cAgg);
    }

    const asesorRows = Array.from(asesorMap.values());
    const celulaRows = Array.from(celulaMap.values()).map((a) => ({
      documento_asesor: `CEL_${a.celula}_${a.anio_mes}`.toUpperCase().replace(/\s+/g, "_"),
      nombre_asesor: null,
      pais: a.pais,
      canal_direccion: a.canal_direccion,
      celula: a.celula,
      gerente: a.gerente,
      anio_mes: a.anio_mes,
      meta_fe: a.meta_fe,
      meta_nube: a.meta_nube,
      meta_total: a.meta_total,
      novedad: "Sin novedad",
    }));

    const allUpsert = [...asesorRows, ...celulaRows];
    console.log(`[sync-metas-historicas] Asesor: ${asesorRows.length} | Célula: ${celulaRows.length} | Total: ${allUpsert.length}`);

    // ────────────────────────────────────────────────
    // Upsert en lotes
    // ────────────────────────────────────────────────
    const BATCH = 500;
    let upserted = 0;
    const errores: string[] = [];
    for (let i = 0; i < allUpsert.length; i += BATCH) {
      const batch = allUpsert.slice(i, i + BATCH);
      const { error, count } = await supabase
        .from("metas_asesores")
        .upsert(batch, { onConflict: "documento_asesor,canal_direccion,anio_mes", count: "exact" });
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
