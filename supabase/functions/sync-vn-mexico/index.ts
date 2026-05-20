// Sync VN México 2026 desde Databricks (tbl_gld_Ventas_MX)
// Mapeo especial: CAMPANA → NUBE, FE → FE, CONTADOR → CONTADOR.
// Reemplaza ventas_diarias y ventas_gerente_mensual de VN MEX para todo el año en curso.

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

const YEAR = new Date().getUTCFullYear();
const YEAR_START = `${YEAR}-01-01`;
const YEAR_END_EXCL = `${YEAR + 1}-01-01`;

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
WHERE v.FECHA >= '${YEAR_START}' AND v.FECHA < '${YEAR_END_EXCL}'
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

    // 1) Limpia ventas_diarias VN MEX del año en curso
    await sb.from("ventas_diarias")
      .delete()
      .gte("fecha", YEAR_START)
      .lt("fecha", YEAR_END_EXCL)
      .eq("pais", "MEX")
      .in("canal_direccion", ["Aliados", "Empresarios"]);

    // 2) Limpia ventas_gerente_mensual VN MEX del año en curso
    await sb.from("ventas_gerente_mensual")
      .delete()
      .eq("anio", YEAR)
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

    // 4) Agrega ventas_gerente_mensual.
    // Primero traemos los líderes oficiales por célula (gerentes activos VN MEX).
    // Si no asignamos el `gerente_normalizado` desde aquí, Databricks trae
    // variantes (FE bajo un nombre, NUBE bajo otro) y cada familia termina
    // bajo un líder diferente → aparecen ceros en el avance del mes.
    const { data: gerentesMx } = await sb
      .from("gerentes")
      .select("id, nombre, canal, celula")
      .eq("pais", "MEX")
      .in("canal", ["VN_ALIADOS", "VN_EMPRESARIOS"])
      .eq("activo", true);

    // Una misma célula puede tener varios "gerentes" (en realidad asesores).
    // El líder real es el que da nombre a la célula. Si varios candidatos
    // comparten la misma célula, escogemos aquel cuyo primer nombre aparece
    // en el nombre de la célula (ej. "Equipo México Jhonathan" → Jhonathan).
    const candidatesByCel = new Map<string, any[]>();
    for (const g of (gerentesMx || [])) {
      if (!g.celula) continue;
      const k = norm(g.celula);
      if (!candidatesByCel.has(k)) candidatesByCel.set(k, []);
      candidatesByCel.get(k)!.push(g);
    }
    const leaderByCelula = new Map<string, { nombre: string; norm: string; canal: string }>();
    for (const [celKey, candidates] of candidatesByCel) {
      let leader = candidates[0];
      if (candidates.length > 1) {
        const matched = candidates.find((c: any) => {
          const firstName = norm(c.nombre).split(" ")[0];
          return firstName && celKey.includes(firstName);
        });
        if (matched) leader = matched;
      }
      leaderByCelula.set(celKey, {
        nombre: leader.nombre,
        norm: norm(leader.nombre),
        canal: leader.canal === "VN_EMPRESARIOS" ? "Empresarios" : "Aliados",
      });
    }


    const cellMap = new Map<string, any>();
    for (const r of rows) {
      const mes = Number(r.mes_nro);
      const familia = classifyFamilyMX(r.tipo_producto1);
      const celula = String(r.celula || "").trim() || null;
      const celKey = celula ? norm(celula) : null;
      const leader = celKey ? leaderByCelula.get(celKey) : null;

      // Si hay líder oficial para la célula, usamos su nombre y canal.
      // De lo contrario, conservamos el director que venga de Databricks.
      const gerente = leader ? leader.nombre : String(r.gerente || "");
      const gnorm = leader ? leader.norm : norm(gerente);
      const canal = leader ? leader.canal : normalizeCanalMX(r.equipo);

      const periodo = `${YEAR}${String(mes).padStart(2, "0")}`;
      const key = celula
        ? `CEL|${periodo}|${familia}|${celKey}`
        : `GER|MEX|${periodo}|${canal}|${gnorm}|${familia}`;
      const cur = cellMap.get(key) || {
        gerente, gerente_normalizado: gnorm, canal_direccion: canal, celula,
        familia, mes, anio: YEAR, periodo, pais: "MEX", unidades: 0, acv: 0,
      };
      cur.unidades += Number(r.ventas) || 0;
      cur.acv += Number(r.acv_total) || 0;
      cellMap.set(key, cur);
    }
    const aggMap = new Map<string, any>();
    for (const row of cellMap.values()) {
      const key = `MEX|${row.periodo}|${row.canal_direccion}|${row.gerente_normalizado}|${row.familia}`;
      const existing = aggMap.get(key);
      if (!existing) {
        aggMap.set(key, { ...row });
      } else {
        existing.unidades += row.unidades;
        existing.acv += row.acv;
        if (!existing.celula && row.celula) existing.celula = row.celula;
      }
    }
    const aggRows = [...aggMap.values()];
    for (let i = 0; i < aggRows.length; i += BATCH) {
      const slice = aggRows.slice(i, i + BATCH);
      const { error } = await sb.from("ventas_gerente_mensual")
        .upsert(slice, { onConflict: "pais,periodo,canal_direccion,gerente_normalizado,familia" });
      if (error) throw new Error(`insert ventas_gerente_mensual: ${error.message}`);
    }
    console.log(`✓ ventas_gerente_mensual MX: ${aggRows.length} filas`);

    // 5) Sincroniza kpis_mensuales para VN MEX a partir de ventas_gerente_mensual.
    //    Esto es la fuente que lee "Avance del mes" en el dashboard.
    // Limpia previos para evitar arrastrar valores stale de runs anteriores.
    const gerenteIdsMx = (gerentesMx || []).map((g: any) => g.id);
    if (gerenteIdsMx.length > 0) {
      const { error: delKpiErr } = await sb.from("kpis_mensuales")
        .delete()
        .in("gerente_id", gerenteIdsMx)
        .gte("anio_mes", `${YEAR}01`)
        .lte("anio_mes", `${YEAR}12`);
      if (delKpiErr) console.error("[kpis_mensuales] delete previo:", delKpiErr.message);
    }



    const { data: metasMx } = await sb
      .from("metas_acv_gerentes")
      .select("celula, mes, meta_total_und, meta_total_acv")
      .eq("pais", "Mexico");

    const MES_NUM: Record<string, string> = {
      enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
      julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
    };
    const metaByKey = new Map<string, { und: number; acv: number }>();
    for (const m of (metasMx || [])) {
      const mm = MES_NUM[String(m.mes || "").trim().toLowerCase()] || "";
      if (!mm) continue;
      const periodo = `${YEAR}${mm}`;
      const key = `${norm(m.celula)}|${periodo}`;
      const cur = metaByKey.get(key) || { und: 0, acv: 0 };
      cur.und = Math.max(cur.und, Number(m.meta_total_und) || 0);
      cur.acv = Math.max(cur.acv, Number(m.meta_total_acv) || 0);
      metaByKey.set(key, cur);
    }

    // Aggregate ventas por (gerente_normalizado, periodo).
    // ventas_gerente_mensual ya está agregado al nivel del LIDER de célula:
    // su `gerente_normalizado` es el nombre del líder. Por eso cruzamos por
    // nombre normalizado del gerente (no por célula, para no duplicar el
    // total del equipo en cada asesor que comparta esa célula).
    type KpiAgg = { ventas: number; acv: number };
    const ventasByGerentePeriodo = new Map<string, KpiAgg>();
    for (const r of aggRows) {
      const key = `${r.gerente_normalizado}|${r.periodo}`;
      const cur = ventasByGerentePeriodo.get(key) || { ventas: 0, acv: 0 };
      cur.ventas += Number(r.unidades) || 0;
      cur.acv += Number(r.acv) || 0;
      ventasByGerentePeriodo.set(key, cur);
    }

    const kpiRows: any[] = [];
    for (const g of (gerentesMx || [])) {
      const nameKey = norm(g.nombre);
      for (let mes = 1; mes <= 12; mes++) {
        const periodo = `${YEAR}${String(mes).padStart(2, "0")}`;
        const agg = ventasByGerentePeriodo.get(`${nameKey}|${periodo}`);
        if (!agg) continue;

        const meta = g.celula ? metaByKey.get(`${norm(g.celula)}|${periodo}`) : undefined;
        kpiRows.push({
          gerente_id: g.id,
          anio_mes: periodo,
          canal: g.canal,
          ventas: Math.round(agg.ventas),
          acv_f: Math.round(agg.acv),
          meta: Math.round(meta?.und || 0),
          moneda: "COP",
        });
      }
    }

    let kpisUpserted = 0;
    for (let i = 0; i < kpiRows.length; i += BATCH) {
      const slice = kpiRows.slice(i, i + BATCH);
      const { error } = await sb.from("kpis_mensuales")
        .upsert(slice, { onConflict: "gerente_id,anio_mes" });
      if (error) throw new Error(`upsert kpis_mensuales: ${error.message}`);
      kpisUpserted += slice.length;
    }
    console.log(`✓ kpis_mensuales MX upserted: ${kpisUpserted}`);

    return new Response(
      JSON.stringify({
        success: true,
        pais: "MEX",
        rows_dbx: rows.length,
        ventas_diarias_insertadas: inserted,
        ventas_gerente_mensual_insertadas: aggRows.length,
        kpis_mensuales_upserted: kpisUpserted,
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
