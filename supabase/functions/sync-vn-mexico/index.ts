// Sync histórico VN México Ene-Abr 2026 desde Databricks (tbl_gld_Ventas_MX)
// Mapeo especial: CAMPANA → NUBE, FE → FE, CONTADOR → CONTADOR.
// Reemplaza ventas_diarias y ventas_gerente_mensual de VN MEX para esos meses.

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
  SELECT
    UPPER(TRIM(nombre_asesor)) AS asesor_key,
    MAX(gerente) AS gerente_asignado
  FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
  WHERE gerente IS NOT NULL
  GROUP BY 1
)
SELECT
  'MEX' AS pais,
  MONTH(v.FECHA) AS mes_nro,
  v.FECHA AS fecha,
  COALESCE(m.gerente_asignado, v.Director) AS gerente,
  v.ASESOR AS asesor,
  v.TIPO_PRODUCTO AS tipo_producto1,
  v.EQUIPO AS equipo,
  v.CELULA AS celula,
  SUM(v.Unidades) AS ventas,
  CAST(SUM(v.ACV) AS BIGINT) AS acv_total
FROM analyticdl.db_comercial.tbl_gld_Ventas_MX v
LEFT JOIN MaestroGerentes m ON UPPER(TRIM(v.ASESOR)) = m.asesor_key
WHERE v.FECHA >= '2026-01-01' AND v.FECHA < '2026-05-01'
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
  const chunks = json.result?.data_array || [];
  for (const r of chunks) {
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

// Mapeo MEX: CAMPANA → NUBE, FE → FE, CONTADOR → CONTADOR
function classifyFamilyMX(tipo: any): string {
  const t = norm(tipo);
  if (!t) return "OTRO";
  if (t === "FE" || t.startsWith("FE") || t.includes("FACTURA")) return "FE";
  if (t === "CAMPANA" || t === "CAMPAÑA" || t.includes("CAMPAN") || t.includes("NUBE") || t.includes("CLOUD")) return "NUBE";
  if (t === "CONTADOR" || t.includes("CONTADOR")) return "CONTADOR";
  return "OTRO";
}

function normalizeCanalMX(equipo: any): string {
  const n = norm(equipo);
  if (n.includes("ALIAD")) return "Aliados";
  if (n.includes("EMPRES")) return "Empresarios";
  // En MX por defecto Aliados (igual que SA)
  return "Aliados";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    console.log("→ Ejecutando query Databricks MX…");
    const rows = await runDatabricks(QUERY);
    console.log(`← ${rows.length} filas MX recibidas`);

    // 1) Limpia ventas_diarias VN MEX Ene-Abr 2026
    await sb.from("ventas_diarias")
      .delete()
      .gte("fecha", "2026-01-01")
      .lt("fecha", "2026-05-01")
      .eq("pais", "MEX")
      .in("canal_direccion", ["Aliados", "Empresarios"]);

    // 2) Limpia ventas_gerente_mensual VN MEX Ene-Abr 2026
    await sb.from("ventas_gerente_mensual")
      .delete()
      .eq("anio", 2026)
      .lte("mes", 4)
      .eq("pais", "MEX")
      .in("canal_direccion", ["Aliados", "Empresarios"]);

    // 3) Inserta ventas_diarias
    const idxMap = new Map<string, number>();
    const diarias = rows.map((r) => {
      const fecha = String(r.fecha).slice(0, 10);
      const asesor = String(r.asesor || "");
      const tipo = classifyFamilyMX(r.tipo_producto1);
      const canal = normalizeCanalMX(r.equipo);
      const producto = r.tipo_producto1 || "";
      const key = `${fecha}|${asesor}|${tipo}|${canal}|${producto}`;
      const cur = (idxMap.get(key) ?? -1) + 1;
      idxMap.set(key, cur);
      return {
        fecha,
        asesor,
        pais: "MEX",
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
    console.log(`✓ ventas_diarias MX insertadas: ${inserted}`);

    // 4) Agrega ventas_gerente_mensual
    const aggMap = new Map<string, any>();
    for (const r of rows) {
      const mes = Number(r.mes_nro);
      const familia = classifyFamilyMX(r.tipo_producto1);
      const canal = normalizeCanalMX(r.equipo);
      const gerente = String(r.gerente || "");
      const gnorm = norm(gerente);
      const celula = r.celula || null;
      const periodo = `2026${String(mes).padStart(2, "0")}`;
      const key = `MEX|${periodo}|${canal}|${gnorm}|${familia}`;
      const cur = aggMap.get(key) || {
        gerente, gerente_normalizado: gnorm, canal_direccion: canal, celula,
        familia, mes, anio: 2026, periodo, pais: "MEX", unidades: 0, acv: 0,
      };
      cur.unidades += Number(r.ventas) || 0;
      cur.acv += Number(r.acv_total) || 0;
      aggMap.set(key, cur);
    }
    const aggRows = [...aggMap.values()];
    for (let i = 0; i < aggRows.length; i += BATCH) {
      const slice = aggRows.slice(i, i + BATCH);
      const { error } = await sb.from("ventas_gerente_mensual")
        .upsert(slice, { onConflict: "pais,periodo,canal_direccion,gerente_normalizado,familia" });
      if (error) throw new Error(`insert ventas_gerente_mensual: ${error.message}`);
    }
    console.log(`✓ ventas_gerente_mensual MX: ${aggRows.length} filas`);

    return new Response(
      JSON.stringify({
        success: true,
        pais: "MEX",
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
