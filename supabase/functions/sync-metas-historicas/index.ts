// Sincroniza metas históricas (Enero-Abril 2026) desde Databricks
// hive_metastore.db_comercial.tbl_brz_cuotas_asesores → metas_asesores
//
// Diferencia con sync-databricks (metas_asesores_sync):
//   - Trae metas a NIVEL CÉLULA (sin documento_asesor)
//   - Mapea texto de mes ('Enero','Febrero',...) a anio_mes 'YYYYMM'
//   - Solo Aliados / SMBS / Empresarios
//   - Usa documento sintético `CELULA::ANIO_MES` para no chocar con la PK
//     de metas_asesores (UNIQUE documento_asesor,canal_direccion,anio_mes)

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
  // Asumir 2026
  return `2026${num}`;
}

function normalizeCanal(c: string | null): string | null {
  if (!c) return null;
  const u = String(c).trim().toUpperCase();
  if (u === "ALIADOS" || u === "VENTA NUEVA ALIADOS") return "VN_ALIADOS";
  if (u === "EMPRESARIOS" || u === "VENTA NUEVA EMPRESARIOS") return "VN_EMPRESARIOS";
  if (u === "SMBS") return "VN_EMPRESARIOS"; // SMBS se trata como Empresarios
  if (u === "VN_ALIADOS" || u === "VN_EMPRESARIOS") return u;
  return u;
}

function toInt(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
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

    const sql = `
      SELECT pais_gestion, canal_direccion, director, celula,
             fe, nube, meta_total_und, meta_total_acv, mes
      FROM hive_metastore.db_comercial.tbl_brz_cuotas_asesores
      WHERE canal_direccion IN ('Aliados','SMBS','Empresarios')
        AND meta_total_und IS NOT NULL
        AND meta_total_und > 0
    `;

    console.log("[sync-metas-historicas] Ejecutando query Databricks...");
    const rows = await runDatabricksQuery(sql);
    console.log(`[sync-metas-historicas] Filas recibidas: ${rows.length}`);

    // Agregar por (celula, canal, anio_mes) sumando fe/nube/meta_total
    const aggMap = new Map<string, {
      celula: string;
      canal_direccion: string;
      gerente: string | null;
      pais: string;
      anio_mes: string;
      meta_fe: number;
      meta_nube: number;
      meta_total: number;
    }>();

    let descartadas = 0;
    for (const r of rows) {
      const celula = r.celula ? String(r.celula).trim() : "";
      const canal = normalizeCanal(r.canal_direccion);
      const periodo = normalizePeriodo(r.mes);
      if (!celula || !canal || !periodo) { descartadas++; continue; }

      const key = `${celula}|${canal}|${periodo}`;
      const cur = aggMap.get(key) || {
        celula,
        canal_direccion: canal,
        gerente: r.director ? String(r.director).trim() : null,
        pais: String(r.pais_gestion || "COL").trim().toUpperCase(),
        anio_mes: periodo,
        meta_fe: 0,
        meta_nube: 0,
        meta_total: 0,
      };
      cur.meta_fe += toInt(r.fe);
      cur.meta_nube += toInt(r.nube);
      cur.meta_total += toInt(r.meta_total_und);
      if (!cur.gerente && r.director) cur.gerente = String(r.director).trim();
      aggMap.set(key, cur);
    }

    const upsertRows = Array.from(aggMap.values()).map((a) => ({
      // Documento sintético para no colisionar con asesores reales y respetar PK
      documento_asesor: `CEL_${a.celula}_${a.anio_mes}`.toUpperCase().replace(/\s+/g, "_"),
      pais: a.pais,
      canal_direccion: a.canal_direccion,
      celula: a.celula,
      gerente: a.gerente,
      nombre_asesor: null,
      anio_mes: a.anio_mes,
      meta_fe: a.meta_fe,
      meta_nube: a.meta_nube,
      meta_total: a.meta_total,
      novedad: "Sin novedad",
    }));

    console.log(`[sync-metas-historicas] Agregados: ${upsertRows.length} (descartadas: ${descartadas})`);

    // Upsert en lotes
    const BATCH = 500;
    let upserted = 0;
    const errores: string[] = [];
    for (let i = 0; i < upsertRows.length; i += BATCH) {
      const batch = upsertRows.slice(i, i + BATCH);
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
    const porPeriodo: Record<string, number> = {};
    upsertRows.forEach((r) => { porPeriodo[r.anio_mes] = (porPeriodo[r.anio_mes] || 0) + 1; });

    return new Response(JSON.stringify({
      success: errores.length === 0,
      filas_databricks: rows.length,
      registros_agregados: upsertRows.length,
      registros_upserted: upserted,
      por_periodo: porPeriodo,
      descartadas,
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
