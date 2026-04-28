// Sync VN Gerentes (Paso 1/3) — solo QUERY_A_GERENTE → ventas_gerente_mensual
// Refactor de sync-vn-metricas para evitar timeout de Edge Functions.
// Al terminar, dispara sync-vn-asesores-latam (fire & forget).
// CRÍTICO: solo borra el mes en curso. NUNCA toca meses históricos.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const YEAR = new Date().getFullYear();
    const MM = (n: number) => String(n).padStart(2, "0");
    const mesActual = new Date().getMonth() + 1;
    const periodoActual = `${YEAR}${MM(mesActual)}`;

    console.log(`[sync-vn-gerentes] → QUERY_A_GERENTE (periodo actual=${periodoActual})`);
    const rowsA = await runDatabricks(QUERY_A_GERENTE);
    console.log(`[sync-vn-gerentes] ← ${rowsA.length} filas`);

    // Agregar por (pais, canal, periodo, gerente, celula, familia) — solo mes actual
    type VgmRow = {
      pais: string; canal_direccion: string; periodo: string; anio: number; mes: number;
      gerente: string; gerente_normalizado: string; celula: string | null; familia: string;
      unidades: number; acv: number;
    };
    const vgmMap = new Map<string, VgmRow>();
    const paisesTocados = new Set<string>();

    for (const r of rowsA as any[]) {
      const mes = Number(r.mes_nro);
      const anio = Number(r.anio) || YEAR;
      // SOLO procesamos el mes en curso para preservar histórico
      if (anio !== YEAR || mes !== mesActual) continue;

      const gname = String(r.gerente || "");
      const gnorm = norm(gname);
      const celula = String(r.celula || "");
      const familia = classifyFamily(r.tipo_producto1);
      const pais = normalizePais(r.pais);
      const canal_direccion = normalizeCanal(r.equipo);
      if (!gnorm || !mes || !celula || !familia) continue;

      paisesTocados.add(pais);
      const periodo = `${anio}${MM(mes)}`;
      const key = [pais, canal_direccion, periodo, gnorm, celula, familia].join("|");
      const unidades = Math.round(Number(r.ventas) || 0);
      const acv = Math.round(Number(r.acv_total) || 0);
      const existing = vgmMap.get(key);
      if (existing) {
        existing.unidades += unidades;
        existing.acv += acv;
      } else {
        vgmMap.set(key, {
          pais, canal_direccion, periodo, anio, mes,
          gerente: gname, gerente_normalizado: gnorm, celula, familia,
          unidades, acv,
        });
      }
    }

    const vgmRows = [...vgmMap.values()];
    let vgmInserted = 0;

    if (paisesTocados.size > 0) {
      // CRÍTICO: solo borra el periodo en curso. Nunca toca meses históricos.
      const { error: delErr } = await sb
        .from("ventas_gerente_mensual")
        .delete()
        .eq("periodo", periodoActual)
        .in("pais", [...paisesTocados]);
      if (delErr) console.error(`[sync-vn-gerentes] delete previo:`, delErr.message);

      const BATCH = 500;
      for (let i = 0; i < vgmRows.length; i += BATCH) {
        const slice = vgmRows.slice(i, i + BATCH);
        const { error } = await sb.from("ventas_gerente_mensual").insert(slice);
        if (error) console.error(`[sync-vn-gerentes] insert batch ${i}:`, error.message);
        else vgmInserted += slice.length;
      }
      console.log(`[sync-vn-gerentes] ✓ ${vgmInserted} filas insertadas en ventas_gerente_mensual`);
    }

    // ── Fire & forget: dispara sync-vn-asesores-latam ──
    const triggerNext = fetch(`${SUPABASE_URL}/functions/v1/sync-vn-asesores-latam`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ triggered_by: "sync-vn-gerentes", periodo: periodoActual }),
    }).catch((e) => console.error("[sync-vn-gerentes] fire&forget error:", e));

    // @ts-ignore — EdgeRuntime API
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(triggerNext);
    }

    return new Response(
      JSON.stringify({
        success: true,
        step: "1/3",
        periodo_actual: periodoActual,
        rows_dbx: rowsA.length,
        ventas_gerente_mensual_insertadas: vgmInserted,
        paises: [...paisesTocados],
        next: "sync-vn-asesores-latam (fire & forget)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[sync-vn-gerentes] ERROR:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
