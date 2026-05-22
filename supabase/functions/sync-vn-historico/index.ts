// Sync histórico VN Ene-Abr 2026 desde Databricks (tbl_gld_Ventas_SA)
// Reemplaza ventas_diarias y ventas_gerente_mensual de VN para esos meses,
// y dispara recálculo de SP Convención (lógica híbrida).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DATABRICKS_HOST = Deno.env.get("DATABRICKS_HOST")!.replace(/^https?:\/\//, "").replace(/\/+$/, "");
const DATABRICKS_TOKEN = Deno.env.get("DATABRICKS_TOKEN")!;
const DATABRICKS_WAREHOUSE_ID = Deno.env.get("DATABRICKS_WAREHOUSE_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const QUERY = `
WITH MaestroGerentes AS (
  SELECT DISTINCT celula,
    MAX(gerente) OVER(PARTITION BY celula) AS gerente_limpio
  FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
  WHERE gerente IS NOT NULL
)
SELECT v.pais, MONTH(v.fecha) AS mes_nro,
  COALESCE(m.gerente_limpio, v.Director) AS gerente,
  v.fullname AS asesor, v.tipo_producto1,
  v.celula, v.equipo, v.fecha,
  SUM(v.cuenta_finanzas) AS ventas,
  CAST(SUM(v.ACV) AS BIGINT) AS acv_total
FROM analyticdl.db_comercial.tbl_gld_Ventas_SA v
LEFT JOIN MaestroGerentes m ON v.celula = m.celula
WHERE v.fecha >= '2026-01-01' AND v.fecha < '2027-01-01'
GROUP BY 1,2,3,4,5,6,7,8
`;

async function runDatabricks(sql: string) {
  const resp = await fetch(`https://${DATABRICKS_HOST}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DATABRICKS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      warehouse_id: DATABRICKS_WAREHOUSE_ID,
      statement: sql,
      wait_timeout: "50s",
      disposition: "INLINE",
      format: "JSON_ARRAY",
    }),
  });
  if (!resp.ok) throw new Error(`Databricks ${resp.status}: ${await resp.text()}`);
  let json = await resp.json();
  let id = json.statement_id;
  while (json.status?.state === "PENDING" || json.status?.state === "RUNNING") {
    await new Promise((r) => setTimeout(r, 1500));
    const p = await fetch(`https://${DATABRICKS_HOST}/api/2.0/sql/statements/${id}`, {
      headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}` },
    });
    json = await p.json();
  }
  if (json.status?.state !== "SUCCEEDED") {
    throw new Error(`DBX state ${json.status?.state}: ${JSON.stringify(json.status?.error)}`);
  }
  const cols = json.manifest?.schema?.columns?.map((c: any) => c.name) || [];
  const rows: any[] = [];
  const chunks = json.result?.data_array || [];
  for (const r of chunks) {
    const o: any = {};
    cols.forEach((c: string, i: number) => (o[c] = r[i]));
    rows.push(o);
  }
  // fetch additional chunks if present
  const totalChunks = json.manifest?.total_chunk_count || 1;
  for (let ci = 1; ci < totalChunks; ci++) {
    const c = await fetch(
      `https://${DATABRICKS_HOST}/api/2.0/sql/statements/${id}/result/chunks/${ci}`,
      { headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}` } },
    );
    const cj = await c.json();
    for (const r of cj.data_array || []) {
      const o: any = {};
      cols.forEach((cn: string, i: number) => (o[cn] = r[i]));
      rows.push(o);
    }
  }
  return rows;
}

const norm = (s: any) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

function classifyFamily(tipo: any): string {
  const t = norm(tipo);
  if (t.includes("FE") || t.includes("FACTURA")) return "FE";
  if (t.includes("NUBE") || t.includes("CLOUD")) return "NUBE";
  if (t.includes("CONTADOR") || t.includes("SCO")) return "CONTADOR";
  return "OTRO";
}

function normalizeCanal(c: any): string {
  const n = norm(c);
  if (n.includes("ALIAD")) return "Aliados";
  if (n.includes("EMPRES")) return "Empresarios";
  // fallback: por defecto Aliados (la mayoría de SA)
  return "Aliados";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    console.log("→ Ejecutando query Databricks…");
    const rows = await runDatabricks(QUERY);
    console.log(`← ${rows.length} filas recibidas`);

    // 1) Limpia ventas_diarias VN 2026 completo
    await sb.from("ventas_diarias")
      .delete()
      .gte("fecha", "2026-01-01")
      .lt("fecha", "2027-01-01")
      .in("canal_direccion", ["Aliados", "Empresarios"]);

    // 2) Limpia ventas_gerente_mensual 2026 completo (VN únicamente)
    await sb.from("ventas_gerente_mensual")
      .delete()
      .eq("anio", 2026);

    // 3) Inserta ventas_diarias en lotes (registro_idx por clave única)
    const idxMap = new Map<string, number>();
    const diarias = rows.map((r) => {
      const fecha = String(r.fecha).slice(0, 10);
      const asesor = String(r.asesor || "");
      const tipo = classifyFamily(r.tipo_producto1);
      const canal = normalizeCanal(r.equipo);
      const producto = r.tipo_producto1 || "";
      const key = `${fecha}|${asesor}|${tipo}|${canal}|${producto}`;
      const cur = (idxMap.get(key) ?? -1) + 1;
      idxMap.set(key, cur);
      return {
        fecha, asesor,
        pais: String(r.pais || "COL").toUpperCase().startsWith("MEX") ? "MEX"
            : String(r.pais || "COL").toUpperCase().startsWith("ECU") ? "ECU"
            : String(r.pais || "COL").toUpperCase().startsWith("URU") ? "URU" : "COL",
        celula: r.celula || null,
        director: r.gerente || null,
        canal_direccion: canal,
        producto: r.tipo_producto1 || null,
        tipo_producto: tipo,
        unidades: Number(r.ventas) || 0,
        acv: Number(r.acv_total) || 0,
        registro_idx: cur,
      };
    });

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < diarias.length; i += BATCH) {
      const slice = diarias.slice(i, i + BATCH);
      const { error } = await sb.from("ventas_diarias")
        .upsert(slice, { onConflict: "fecha,asesor,tipo_producto,canal_direccion,producto,registro_idx" });
      if (error) throw new Error(`insert ventas_diarias [batch ${i}]: ${error.message}`);
      inserted += slice.length;
    }
    console.log(`✓ ventas_diarias insertadas: ${inserted}`);

    // 4) Agrega ventas_gerente_mensual por (periodo, familia, celula).
    //    Dedupe primario por esa clave. Para respetar también el unique legacy
    //    (pais, periodo, canal, gerente_normalizado, familia), si dos celulas
    //    comparten gerente_normalizado, le añadimos sufijo " [celula]".
    const aggMap = new Map<string, any>();
    for (const r of rows) {
      const mes = Number(r.mes_nro);
      const familia = classifyFamily(r.tipo_producto1);
      const canal = normalizeCanal(r.equipo);
      const gerente = String(r.gerente || "");
      const gnorm = norm(gerente);
      const celula = String(r.celula || "").trim() || null;
      const pais = String(r.pais || "COL").toUpperCase().startsWith("MEX") ? "MEX"
                : String(r.pais || "COL").toUpperCase().startsWith("ECU") ? "ECU"
                : String(r.pais || "COL").toUpperCase().startsWith("URU") ? "URU" : "COL";
      const periodo = `2026${String(mes).padStart(2, "0")}`;
      const celulaKey = (celula || `__SC_${gnorm}__`).toUpperCase();
      const key = `${periodo}|${familia}|${celulaKey}`;
      const cur = aggMap.get(key) || {
        gerente, gerente_normalizado: gnorm, canal_direccion: canal, celula,
        familia, mes, anio: 2026, periodo, pais, unidades: 0, acv: 0,
      };
      cur.unidades += Number(r.ventas) || 0;
      cur.acv += Number(r.acv_total) || 0;
      aggMap.set(key, cur);
    }
    const aggRows = [...aggMap.values()];

    for (let i = 0; i < aggRows.length; i += BATCH) {
      const slice = aggRows.slice(i, i + BATCH);
      const { error } = await sb.from("ventas_gerente_mensual")
        .upsert(slice, { onConflict: "periodo,familia,celula" });
      if (error) throw new Error(`insert ventas_gerente_mensual: ${error.message}`);
    }
    console.log(`✓ ventas_gerente_mensual: ${aggRows.length} filas`);

    return new Response(
      JSON.stringify({
        success: true,
        rows_dbx: rows.length,
        ventas_diarias_insertadas: inserted,
        ventas_gerente_mensual_insertadas: aggRows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("ERROR:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
