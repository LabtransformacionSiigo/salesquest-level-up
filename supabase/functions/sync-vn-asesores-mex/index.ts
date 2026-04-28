// Sync VN Asesores MEX (Paso 3/3) — solo QUERY_C_MEX
// Inserta vn_metricas_optimizadas (scope=asesor, pais=MEX) del mes en curso.
// CRÍTICO: solo borra el mes actual.

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
    headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}`, "Content-Type": "application/json" },
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
  if (!t) return "OTRO";
  // MEX: CAMPANA → NUBE
  if (t === "FE" || t.startsWith("FE") || t.includes("FACTURA")) return "FE";
  if (t === "CAMPANA" || t === "CAMPAÑA" || t.includes("CAMPAN") || t.includes("NUBE") || t.includes("CLOUD")) return "NUBE";
  if (t.includes("CONTADOR")) return "CONTADOR";
  return "OTRO";
}

function normalizeCanal(equipo: any): string {
  const n = norm(equipo);
  if (n.includes("EMPRES")) return "Empresarios";
  if (n.includes("ALIAD")) return "Aliados";
  return "Aliados";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const YEAR = new Date().getFullYear();
    const MM = (n: number) => String(n).padStart(2, "0");
    const mesActual = new Date().getMonth() + 1;
    const periodoActual = `${YEAR}${MM(mesActual)}`;

    console.log(`[sync-vn-asesores-mex] → QUERY_C_MEX (periodo=${periodoActual})`);
    const rowsC = await runDatabricks(QUERY_C_MEX);
    console.log(`[sync-vn-asesores-mex] ← ${rowsC.length} filas`);

    // Solo mes en curso
    const rowsActual = rowsC.filter((r: any) => {
      const mes = Number(r.mes_nro);
      const anio = Number(r.anio) || YEAR;
      return anio === YEAR && mes === mesActual;
    });

    type VmoRow = {
      pais: string; mes_nro: number; anio: number; canal_direccion: string;
      gerente: string | null; gerente_normalizado: string | null;
      celula: string | null; asesor: string; tipo_producto1: string;
      familia: string; ventas: number; acv_total: number; scope: string;
    };
    const vmoMap = new Map<string, VmoRow>();
    for (const r of rowsActual as any[]) {
      const nombre = String(r.asesor || "").trim();
      if (!nombre) continue;
      const canal_direccion = normalizeCanal(r.equipo);
      const tipo_producto1 = String(r.tipo_producto1 || "");
      const gname = r.gerente ? String(r.gerente) : null;
      const key = ["MEX", mesActual, canal_direccion, gname ?? "", nombre, tipo_producto1].join("|");
      const ventas = Math.round(Number(r.ventas) || 0);
      const acv = Math.round(Number(r.acv_total) || 0);
      const cur = vmoMap.get(key);
      if (cur) {
        cur.ventas += ventas;
        cur.acv_total += acv;
      } else {
        vmoMap.set(key, {
          pais: "MEX", mes_nro: mesActual, anio: YEAR, canal_direccion,
          gerente: gname, gerente_normalizado: gname ? norm(gname) : null,
          celula: r.celula || null, asesor: nombre, tipo_producto1,
          familia: classifyFamily(tipo_producto1), ventas, acv_total: acv,
          scope: "asesor",
        });
      }
    }

    let vmoInserted = 0;

    // CRÍTICO: borrar SOLO scope=asesor + pais=MEX + mes actual
    const { error: delErr } = await sb
      .from("vn_metricas_optimizadas")
      .delete()
      .eq("scope", "asesor")
      .eq("pais", "MEX")
      .eq("anio", YEAR)
      .eq("mes_nro", mesActual);
    if (delErr) console.error(`[vmo-mex] delete previo:`, delErr.message);

    const vmoFinal = [...vmoMap.values()];
    const BATCH = 500;
    for (let i = 0; i < vmoFinal.length; i += BATCH) {
      const slice = vmoFinal.slice(i, i + BATCH);
      const { error } = await sb.from("vn_metricas_optimizadas").insert(slice);
      if (error) console.error(`[vmo-mex] insert batch ${i}:`, error.message);
      else vmoInserted += slice.length;
    }
    console.log(`[sync-vn-asesores-mex] ✓ vn_metricas_optimizadas (asesor MEX): ${vmoInserted}`);

    return new Response(
      JSON.stringify({
        success: true,
        step: "3/3",
        periodo_actual: periodoActual,
        rows_dbx: rowsC.length,
        rows_mes_actual: rowsActual.length,
        vn_metricas_asesor_mex_insertadas: vmoInserted,
        chain_completed: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[sync-vn-asesores-mex] ERROR:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
