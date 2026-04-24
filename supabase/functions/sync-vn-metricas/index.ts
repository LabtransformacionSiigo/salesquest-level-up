// Sync VN Métricas Optimizadas: ejecuta las 3 consultas A/B/C en Databricks
// y hace upsert a vn_metricas_optimizadas. Esta es la fuente única de verdad
// para ventas/ACV de Venta Nueva (gerentes y asesores).

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

// ── Consulta A: Agregado por GERENTE (LATAM ex-MX) ──
// El canal (Aliados/Empresarios) viene de la venta misma (`v.equipo`).
// El cruce con cuotas solo se usa para resolver gerente por célula.
const QUERY_A_GERENTE = `
SELECT
  v.pais,
  MONTH(v.fecha) AS mes_nro,
  YEAR(v.fecha)  AS anio,
  c.gerente,
  v.celula,
  v.equipo AS equipo,
  v.tipo_producto1,
  SUM(v.cuenta_finanzas) AS ventas,
  CAST(SUM(v.ACV) AS BIGINT) AS acv_total
FROM analyticdl.db_comercial.tbl_gld_Ventas_SA v
LEFT JOIN (
  SELECT DISTINCT celula, gerente
  FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
  WHERE gerente IS NOT NULL
) c ON v.celula = c.celula
WHERE v.fecha >= '2026-01-01'
GROUP BY 1,2,3,4,5,6,7
`;

// ── Consulta B: Desglose por ASESOR (LATAM ex-MX) ──
const QUERY_B_ASESOR = `
SELECT
  v.pais,
  MONTH(v.fecha) AS mes_nro,
  YEAR(v.fecha)  AS anio,
  c.gerente,
  v.celula,
  v.equipo AS equipo,
  v.fullname AS asesor,
  v.tipo_producto1,
  SUM(v.cuenta_finanzas) AS ventas,
  CAST(SUM(v.ACV) AS BIGINT) AS acv_total
FROM analyticdl.db_comercial.tbl_gld_Ventas_SA v
LEFT JOIN (
  SELECT DISTINCT celula, gerente
  FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
  WHERE gerente IS NOT NULL
) c ON v.celula = c.celula
WHERE v.fecha >= '2026-01-01'
GROUP BY 1,2,3,4,5,6,7,8
`;

// ── Consulta C: Asesor + gerente para MÉXICO ──
// Nota: usa Unidades en lugar de cuenta_finanzas y ASESOR como key.
const QUERY_C_MEX = `
WITH MaestroGerentes AS (
  SELECT
    UPPER(TRIM(nombre_asesor)) AS asesor_key,
    MAX(gerente) AS gerente_asignado,
    MAX(celula)  AS celula_asignada
  FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
  WHERE gerente IS NOT NULL
  GROUP BY 1
)
SELECT
  'MEX' AS pais,
  MONTH(v.FECHA) AS mes_nro,
  YEAR(v.FECHA)  AS anio,
  COALESCE(m.gerente_asignado, v.Director) AS gerente,
  m.celula_asignada AS celula,
  v.EQUIPO AS equipo,
  v.ASESOR  AS asesor,
  v.TIPO_PRODUCTO AS tipo_producto1,
  SUM(v.Unidades) AS ventas,
  CAST(SUM(v.ACV) AS BIGINT) AS acv_total
FROM analyticdl.db_comercial.tbl_gld_Ventas_MX v
LEFT JOIN MaestroGerentes m ON UPPER(TRIM(v.ASESOR)) = m.asesor_key
WHERE v.FECHA >= '2026-01-01'
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
  const id = json.statement_id;
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
  for (const r of json.result?.data_array || []) {
    const o: any = {};
    cols.forEach((c: string, i: number) => (o[c] = r[i]));
    rows.push(o);
  }
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

function normalizeCanal(equipo: any): string {
  const n = norm(equipo);
  if (n.includes("EMPRES")) return "Empresarios";
  if (n.includes("ALIAD")) return "Aliados";
  return "Aliados";
}

function normalizePais(p: any): string {
  const n = norm(p);
  if (n.startsWith("MEX") || n === "MX") return "MEX";
  if (n.startsWith("ECU") || n === "EC") return "ECU";
  if (n.startsWith("URU") || n === "UY") return "URU";
  if (n.startsWith("COL") || n === "CO") return "COL";
  return n || "COL";
}

function buildRecord(r: any, scope: "gerente" | "asesor") {
  const pais = normalizePais(r.pais);
  const mes_nro = Number(r.mes_nro);
  const anio = Number(r.anio) || 2026;
  const canal = normalizeCanal(r.equipo);
  const gerente = r.gerente ? String(r.gerente) : null;
  const tipo_producto1 = String(r.tipo_producto1 || "");
  return {
    pais,
    mes_nro,
    anio,
    canal_direccion: canal,
    gerente,
    gerente_normalizado: gerente ? norm(gerente) : null,
    celula: r.celula || null,
    asesor: scope === "asesor" ? String(r.asesor || "") : null,
    tipo_producto1,
    familia: classifyFamily(tipo_producto1),
    ventas: Math.round(Number(r.ventas) || 0),
    acv_total: Math.round(Number(r.acv_total) || 0),
    scope,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const onlyMx = body.only === "mx";
    const onlySa = body.only === "sa";

    console.log("→ Ejecutando consultas Databricks…");
    const [rowsA, rowsB, rowsC] = await Promise.all([
      onlyMx ? Promise.resolve([]) : runDatabricks(QUERY_A_GERENTE),
      onlyMx ? Promise.resolve([]) : runDatabricks(QUERY_B_ASESOR),
      onlySa ? Promise.resolve([]) : runDatabricks(QUERY_C_MEX),
    ]);
    console.log(`← A=${rowsA.length} B=${rowsB.length} C=${rowsC.length}`);

    // Limpia datos previos por país tocado, para evitar registros huérfanos
    // si una célula/asesor desaparece del origen.
    const paisesTocados = new Set<string>();
    rowsA.forEach((r: any) => paisesTocados.add(normalizePais(r.pais)));
    rowsB.forEach((r: any) => paisesTocados.add(normalizePais(r.pais)));
    if (rowsC.length) paisesTocados.add("MEX");

    if (paisesTocados.size > 0) {
      const { error: delErr } = await sb
        .from("vn_metricas_optimizadas")
        .delete()
        .in("pais", [...paisesTocados]);
      if (delErr) throw new Error(`delete previo: ${delErr.message}`);
    }

    const records = [
      ...rowsA.map((r: any) => buildRecord(r, "gerente")),
      ...rowsB.map((r: any) => buildRecord(r, "asesor")),
      ...rowsC.map((r: any) => buildRecord(r, "asesor")),
    ];

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      const slice = records.slice(i, i + BATCH);
      const { error } = await sb.from("vn_metricas_optimizadas").insert(slice);
      if (error) throw new Error(`insert batch ${i}: ${error.message}`);
      inserted += slice.length;
    }
    console.log(`✓ vn_metricas_optimizadas insertadas: ${inserted}`);

    return new Response(
      JSON.stringify({
        success: true,
        rows_dbx_gerente: rowsA.length,
        rows_dbx_asesor_sa: rowsB.length,
        rows_dbx_asesor_mx: rowsC.length,
        inserted,
        paises: [...paisesTocados],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("ERROR sync-vn-metricas:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
