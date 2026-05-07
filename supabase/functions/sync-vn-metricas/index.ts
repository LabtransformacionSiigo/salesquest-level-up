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
  SELECT celula, MAX(gerente) AS gerente
  FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
  WHERE gerente IS NOT NULL
  GROUP BY celula
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
  SELECT celula, MAX(gerente) AS gerente
  FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
  WHERE gerente IS NOT NULL
  GROUP BY celula
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
  if (t.includes("NUBE") || t.includes("CLOUD") || t.includes("CAMPAN")) return "NUBE";
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

function mergeByUniqueGrain(records: ReturnType<typeof buildRecord>[]) {
  const merged = new Map<string, ReturnType<typeof buildRecord>>();

  for (const record of records) {
    const key = [
      record.pais,
      record.anio,
      record.mes_nro,
      record.canal_direccion,
      record.scope,
      record.gerente_normalizado ?? "",
      record.asesor ?? "",
      record.tipo_producto1,
    ].join("|");

    const existing = merged.get(key);
    if (existing) {
      existing.ventas += record.ventas;
      existing.acv_total += record.acv_total;
      if (!existing.gerente && record.gerente) existing.gerente = record.gerente;
      if (!existing.celula && record.celula) existing.celula = record.celula;
      if (!existing.familia && record.familia) existing.familia = record.familia;
      continue;
    }

    merged.set(key, { ...record });
  }

  return [...merged.values()];
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

    // Limpia SOLO el mes en curso por país tocado. NUNCA toca meses históricos.
    const paisesTocados = new Set<string>();
    rowsA.forEach((r: any) => paisesTocados.add(normalizePais(r.pais)));
    rowsB.forEach((r: any) => paisesTocados.add(normalizePais(r.pais)));
    if (rowsC.length) paisesTocados.add("MEX");

    const _now = new Date();
    const _mesActualNum = _now.getMonth() + 1;
    const periodoActual = `${_now.getFullYear()}${String(_mesActualNum).padStart(2, "0")}`;

    if (paisesTocados.size > 0) {
      const { error: delErr } = await sb
        .from("vn_metricas_optimizadas")
        .delete()
        .eq("anio", _now.getFullYear())
        .eq("mes_nro", _mesActualNum)
        .in("pais", [...paisesTocados]);
      if (delErr) throw new Error(`delete previo vn_metricas: ${delErr.message}`);
    }

    const records = mergeByUniqueGrain([
      ...rowsA.map((r: any) => buildRecord(r, "gerente")),
      ...rowsB.map((r: any) => buildRecord(r, "asesor")),
      ...rowsC.map((r: any) => buildRecord(r, "gerente")),
      ...rowsC.map((r: any) => buildRecord(r, "asesor")),
    ]);

    // Filtrar SOLO al mes en curso para no tocar histórico
    const recordsMesActual = records.filter(
      (r) => r.anio === _now.getFullYear() && r.mes_nro === _mesActualNum,
    );

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < recordsMesActual.length; i += BATCH) {
      const slice = recordsMesActual.slice(i, i + BATCH);
      const { error } = await sb.from("vn_metricas_optimizadas").insert(slice);
      if (error) throw new Error(`insert batch ${i}: ${error.message}`);
      inserted += slice.length;
    }
    console.log(`✓ vn_metricas_optimizadas insertadas (mes ${periodoActual}): ${inserted}`);

    // ── Replicar rowsA (gerente level) a ventas_gerente_mensual ─────────
    // rowsA ya viene agregado por celula/mes/familia desde QUERY_A_GERENTE.
    // NO usar records (mezcla gerente+asesor → duplica valores).
    // Agrupamos por (pais, canal_direccion, periodo, gerente_normalizado, celula, familia)
    // porque múltiples tipo_producto1 pueden mapear a la misma familia.
    const YEAR = new Date().getFullYear();
    const MM = (n: number) => String(n).padStart(2, "0");

    type VgmRow = {
      pais: string;
      canal_direccion: string;
      periodo: string;
      anio: number;
      mes: number;
      gerente: string;
      gerente_normalizado: string;
      celula: string | null;
      familia: string;
      unidades: number;
      acv: number;
    };

    const vgmMap = new Map<string, VgmRow>();
    for (const r of [...(rowsA as any[]), ...(rowsC as any[])]) {
      const mes = Number(r.mes_nro);
      const anio = Number(r.anio) || YEAR;
      // SOLO mes en curso para preservar histórico
      if (anio !== _now.getFullYear() || mes !== _mesActualNum) continue;
      const gname = String(r.gerente || "");
      const gnorm = norm(gname);
      const celula = String(r.celula || "");
      const familia = classifyFamily(r.tipo_producto1);
      const pais = normalizePais(r.pais);
      const canal_direccion = normalizeCanal(r.equipo);
      if (!gnorm || !mes || !celula || !familia) continue;
      const periodo = `${anio}${MM(mes)}`;
      const key = [pais, canal_direccion, periodo, gnorm, celula, familia].join("|");
      const existing = vgmMap.get(key);
      const unidades = Math.round(Number(r.ventas) || 0);
      const acv = Math.round(Number(r.acv_total) || 0);
      if (existing) {
        existing.unidades += unidades;
        existing.acv += acv;
      } else {
        vgmMap.set(key, {
          pais,
          canal_direccion,
          periodo,
          anio,
          mes,
          gerente: gname,
          gerente_normalizado: gnorm,
          celula,
          familia,
          unidades,
          acv,
        });
      }
    }

    const vgmRows = [...vgmMap.values()];
    let vgmInserted = 0;

    if (vgmRows.length > 0) {
      const paisesVgm = [...new Set(vgmRows.map((r) => r.pais))];
      // CRÍTICO: solo borra el periodo actual. NUNCA toca meses históricos.
      const { error: vgmDelErr } = await sb
        .from("ventas_gerente_mensual")
        .delete()
        .in("pais", paisesVgm)
        .eq("periodo", periodoActual);
      if (vgmDelErr) console.error(`[vgm] delete previo:`, vgmDelErr.message);

      const BATCH_VGM = 500;
      for (let i = 0; i < vgmRows.length; i += BATCH_VGM) {
        const slice = vgmRows.slice(i, i + BATCH_VGM);
        const { error } = await sb
          .from("ventas_gerente_mensual")
          .upsert(slice, { onConflict: "periodo,familia,celula", ignoreDuplicates: false });
        if (error) {
          console.error(`[vgm] insert batch ${i}:`, error.message);
        } else {
          vgmInserted += slice.length;
        }
      }
      console.log(`✓ ventas_gerente_mensual actualizadas: ${vgmInserted} filas (de ${vgmRows.length})`);
    }

    // ── Replicar rowsB (asesor level) a ejecucion_asesores ─────────────
    // rowsB ya viene agregado por pais/mes/gerente/celula/asesor/tipo_producto1
    // desde QUERY_B_ASESOR (tbl_gld_Ventas_SA — fuente única de verdad LATAM).
    // Schema real: documento_asesor (PK lógica, guarda el fullname), periodo,
    // canal_direccion, pais, ventas_fe, ventas_nube, ventas_total, acv_total.
    type EjecRow = {
      documento_asesor: string;
      periodo: string;
      canal_direccion: string;
      pais: string;
      ventas_fe: number;
      ventas_nube: number;
      ventas_total: number;
      acv_total: number;
    };

    const ejecMap = new Map<string, EjecRow>();
    for (const r of [...(rowsB as any[]), ...(rowsC as any[])]) {
      const nombre = String(r.asesor || "").trim();
      const mes = Number(r.mes_nro);
      const anio = Number(r.anio) || YEAR;
      if (!nombre || !mes) continue;
      // SOLO mes en curso para preservar histórico
      if (anio !== _now.getFullYear() || mes !== _mesActualNum) continue;
      const periodo = `${anio}${MM(mes)}`;
      const pais = normalizePais(r.pais);
      const canal_direccion = normalizeCanal(r.equipo);
      const familia = classifyFamily(r.tipo_producto1);
      const unidades = Math.round(Number(r.ventas) || 0);
      const acv = Math.round(Number(r.acv_total) || 0);
      const key = `${nombre}|${periodo}|${pais}|${canal_direccion}`;
      const cur = ejecMap.get(key) ?? {
        documento_asesor: nombre,
        periodo,
        canal_direccion,
        pais,
        ventas_fe: 0,
        ventas_nube: 0,
        ventas_total: 0,
        acv_total: 0,
      };
      if (familia === "FE") cur.ventas_fe += unidades;
      if (familia === "NUBE") cur.ventas_nube += unidades;
      cur.ventas_total += unidades;
      cur.acv_total += acv;
      ejecMap.set(key, cur);
    }

    const ejecFinal = [...ejecMap.values()];
    let ejecInserted = 0;

    if (ejecFinal.length > 0) {
      const paisesEjec = [...new Set(ejecFinal.map((r) => r.pais))];
      // CRÍTICO: solo borra el periodo actual. NUNCA toca meses históricos.
      const { error: ejecDelErr } = await sb
        .from("ejecucion_asesores")
        .delete()
        .in("pais", paisesEjec)
        .eq("periodo", periodoActual);
      if (ejecDelErr) console.error(`[ejec] delete previo:`, ejecDelErr.message);

      const BATCH_EJEC = 500;
      for (let i = 0; i < ejecFinal.length; i += BATCH_EJEC) {
        const slice = ejecFinal.slice(i, i + BATCH_EJEC);
        const { error } = await sb.from("ejecucion_asesores").insert(slice);
        if (error) console.error(`[ejec] insert batch ${i}:`, error.message);
        else ejecInserted += slice.length;
      }
      console.log(`✓ ejecucion_asesores actualizadas: ${ejecInserted} filas (de ${ejecFinal.length})`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        rows_dbx_gerente: rowsA.length,
        rows_dbx_asesor_sa: rowsB.length,
        rows_dbx_asesor_mx: rowsC.length,
        inserted,
        vgm_inserted: vgmInserted,
        ejec_inserted: ejecInserted,
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
