// Sync VN Asesores LATAM (Paso 2/3) — solo QUERY_B_ASESOR
// Inserta en ejecucion_asesores y vn_metricas_optimizadas (scope=asesor, pais≠MEX).
// Al terminar dispara sync-vn-asesores-mex (fire & forget).
// CRÍTICO: solo borra el mes en curso.

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

    console.log(`[sync-vn-asesores-latam] → QUERY_B_ASESOR (periodo actual=${periodoActual})`);
    const rowsB = await runDatabricks(QUERY_B_ASESOR);
    console.log(`[sync-vn-asesores-latam] ← ${rowsB.length} filas`);

    // Filtrar a SOLO mes actual y SOLO países LATAM (no MEX, eso lo hace el paso 3)
    const rowsActual = rowsB.filter((r: any) => {
      const mes = Number(r.mes_nro);
      const anio = Number(r.anio) || YEAR;
      const pais = normalizePais(r.pais);
      return anio === YEAR && mes === mesActual && pais !== "MEX";
    });

    // ── Agregar ejecucion_asesores ──
    type EjecRow = {
      documento_asesor: string; periodo: string; canal_direccion: string; pais: string;
      ventas_fe: number; ventas_nube: number; ventas_total: number; acv_total: number;
    };
    const ejecMap = new Map<string, EjecRow>();
    const paisesTocados = new Set<string>();

    for (const r of rowsActual as any[]) {
      const nombre = String(r.asesor || "").trim();
      if (!nombre) continue;
      const pais = normalizePais(r.pais);
      const canal_direccion = normalizeCanal(r.equipo);
      const familia = classifyFamily(r.tipo_producto1);
      const unidades = Math.round(Number(r.ventas) || 0);
      const acv = Math.round(Number(r.acv_total) || 0);
      paisesTocados.add(pais);
      const key = `${nombre}|${periodoActual}|${pais}|${canal_direccion}`;
      const cur = ejecMap.get(key) ?? {
        documento_asesor: nombre, periodo: periodoActual, canal_direccion, pais,
        ventas_fe: 0, ventas_nube: 0, ventas_total: 0, acv_total: 0,
      };
      if (familia === "FE") cur.ventas_fe += unidades;
      if (familia === "NUBE") cur.ventas_nube += unidades;
      cur.ventas_total += unidades;
      cur.acv_total += acv;
      ejecMap.set(key, cur);
    }

    // ── Agregar vn_metricas_optimizadas (scope=asesor) ──
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
      const pais = normalizePais(r.pais);
      const canal_direccion = normalizeCanal(r.equipo);
      const tipo_producto1 = String(r.tipo_producto1 || "");
      const gname = r.gerente ? String(r.gerente) : null;
      const key = [pais, mesActual, canal_direccion, gname ?? "", nombre, tipo_producto1].join("|");
      const ventas = Math.round(Number(r.ventas) || 0);
      const acv = Math.round(Number(r.acv_total) || 0);
      const cur = vmoMap.get(key);
      if (cur) {
        cur.ventas += ventas;
        cur.acv_total += acv;
      } else {
        vmoMap.set(key, {
          pais, mes_nro: mesActual, anio: YEAR, canal_direccion,
          gerente: gname, gerente_normalizado: gname ? norm(gname) : null,
          celula: r.celula || null, asesor: nombre, tipo_producto1,
          familia: classifyFamily(tipo_producto1), ventas, acv_total: acv,
          scope: "asesor",
        });
      }
    }

    let ejecInserted = 0;
    let vmoInserted = 0;

    if (paisesTocados.size > 0) {
      // CRÍTICO: solo mes actual
      const { error: ejecDelErr } = await sb
        .from("ejecucion_asesores")
        .delete()
        .eq("periodo", periodoActual)
        .in("pais", [...paisesTocados]);
      if (ejecDelErr) console.error(`[ejec] delete previo:`, ejecDelErr.message);

      const ejecFinal = [...ejecMap.values()];
      const BATCH = 500;
      for (let i = 0; i < ejecFinal.length; i += BATCH) {
        const slice = ejecFinal.slice(i, i + BATCH);
        const { error } = await sb.from("ejecucion_asesores").insert(slice);
        if (error) console.error(`[ejec] insert batch ${i}:`, error.message);
        else ejecInserted += slice.length;
      }
      console.log(`[sync-vn-asesores-latam] ✓ ejecucion_asesores: ${ejecInserted}`);

      // vn_metricas_optimizadas: borra solo scope=asesor del mes actual de los países tocados
      const { error: vmoDelErr } = await sb
        .from("vn_metricas_optimizadas")
        .delete()
        .eq("scope", "asesor")
        .eq("anio", YEAR)
        .eq("mes_nro", mesActual)
        .in("pais", [...paisesTocados]);
      if (vmoDelErr) console.error(`[vmo] delete previo:`, vmoDelErr.message);

      const vmoFinal = [...vmoMap.values()];
      for (let i = 0; i < vmoFinal.length; i += BATCH) {
        const slice = vmoFinal.slice(i, i + BATCH);
        const { error } = await sb.from("vn_metricas_optimizadas").insert(slice);
        if (error) console.error(`[vmo] insert batch ${i}:`, error.message);
        else vmoInserted += slice.length;
      }
      console.log(`[sync-vn-asesores-latam] ✓ vn_metricas_optimizadas (asesor LATAM): ${vmoInserted}`);
    }

    // ── Fire & forget: dispara sync-vn-asesores-mex ──
    const triggerNext = fetch(`${SUPABASE_URL}/functions/v1/sync-vn-asesores-mex`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ triggered_by: "sync-vn-asesores-latam", periodo: periodoActual }),
    }).catch((e) => console.error("[sync-vn-asesores-latam] fire&forget error:", e));

    // @ts-ignore — EdgeRuntime API
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(triggerNext);
    }

    return new Response(
      JSON.stringify({
        success: true,
        step: "2/3",
        periodo_actual: periodoActual,
        rows_dbx: rowsB.length,
        rows_mes_actual: rowsActual.length,
        ejecucion_asesores_insertadas: ejecInserted,
        vn_metricas_asesor_latam_insertadas: vmoInserted,
        paises: [...paisesTocados],
        next: "sync-vn-asesores-mex (fire & forget)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[sync-vn-asesores-latam] ERROR:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
