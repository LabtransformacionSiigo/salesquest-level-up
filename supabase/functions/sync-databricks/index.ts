import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLocalJWKSet, jwtVerify } from "npm:jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const localJwks = createLocalJWKSet(JSON.parse(Deno.env.get("SUPABASE_JWKS") || '{"keys":[]}'));

async function getJwtUserId(token: string) {
  const { payload } = await jwtVerify(token, localJwks, {
    issuer: `${supabaseUrl}/auth/v1`,
    audience: "authenticated",
  });

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Invalid token subject");
  }

  return payload.sub;
}

const SPANISH_MONTHS: Record<string, string> = {
  "Enero": "01", "Febrero": "02", "Marzo": "03", "Abril": "04",
  "Mayo": "05", "Junio": "06", "Julio": "07", "Agosto": "08",
  "Septiembre": "09", "Octubre": "10", "Noviembre": "11", "Diciembre": "12",
};

// ============================================================
// TABLE_CONFIGS – all Databricks queries
// ============================================================
const TABLE_CONFIGS: Record<string, { sql: (limit: string, mesFilter?: string) => string; label: string }> = {
  productividad: {
    label: "Productividad Progresiva (legacy → kpis_mensuales)",
    sql: (limit: string) =>
      `SELECT * FROM analyticdl.db_comercial.tbl_slv_Productividad_Progresiva WHERE ANIO_MES >= 202601 AND ANIO_MES <= 202612 ${limit}`,
  },
  ventas_vc: {
    label: "Ventas VC (Mensual con Metas)",
    sql: (limit: string, mesFilter?: string) => {
      const ventasWhere = mesFilter
        ? `WHERE Anio = 2026 AND categoria_producto_Venta NOT IN ('Ecuador', 'Uruguay') AND mes = '${mesFilter}'`
        : `WHERE Anio = 2026 AND categoria_producto_Venta NOT IN ('Ecuador', 'Uruguay')`;
      const metasWhere = mesFilter
        ? `WHERE \`Año_Meta\` = 2026 AND Mes_meta = '${mesFilter}'`
        : `WHERE \`Año_Meta\` = 2026`;
      return `
WITH ventas_mensuales AS (
    SELECT comercial, lider, Anio, mes,
        SUM(CAST(ACV_PLUS AS BIGINT)) AS total_logrado_mes
    FROM analyticdl.db_comercial.tbl_gld_Ventas_VC
    ${ventasWhere}
    GROUP BY comercial, lider, Anio, mes
),
metas_mensuales AS (
    SELECT Comercial, Lider AS Lider_Meta, \`Año_Meta\`, Mes_meta,
        SUM(meta_todo) AS meta_del_mes
    FROM analyticdl.db_servicios.tbl_slv_metas_venta_cruzada
    ${metasWhere}
    GROUP BY Comercial, Lider, \`Año_Meta\`, Mes_meta
)
SELECT 
    m.Comercial AS Asesor, m.Lider_Meta AS Lider,
    m.\`Año_Meta\` AS Anio, m.Mes_meta AS Mes,
    m.meta_del_mes AS Meta_Objetivo,
    COALESCE(v.total_logrado_mes, 0) AS Saldo_ACV_Actual
FROM metas_mensuales m
LEFT JOIN ventas_mensuales v 
    ON LOWER(m.Comercial) = LOWER(v.comercial) AND m.Mes_meta = v.mes
${limit}`;
    },
  },
  ventas_vc_producto: {
    label: "Ventas VC Desglose por Producto",
    sql: (limit: string, mesFilter?: string) => {
      const ventasWhere = mesFilter
        ? `WHERE Anio = 2026 AND categoria_producto_Venta NOT IN ('Ecuador', 'Uruguay') AND mes = '${mesFilter}'`
        : `WHERE Anio = 2026 AND categoria_producto_Venta NOT IN ('Ecuador', 'Uruguay')`;
      return `
SELECT comercial AS Asesor, lider AS Lider, Anio, mes AS Mes,
    categoria_producto_Venta AS Producto, bloque_venta AS Bloque,
    SUM(CAST(ACV_PLUS AS BIGINT)) AS ACV_Producto, COUNT(*) AS Unidades
FROM analyticdl.db_comercial.tbl_gld_Ventas_VC
${ventasWhere}
GROUP BY comercial, lider, Anio, mes, categoria_producto_Venta, bloque_venta
${limit}`;
    },
  },
  // ── Metas Gerentes (Aliados + Empresarios, todos los países) ──
  metas_gerentes: {
    label: "Metas Gerentes Aliados+Empresarios (tbl_brz_gerentes)",
    sql: (limit: string) =>
      `SELECT pais_gestion, canal_direccion, director, celula, m, cuota, hc_operativo, fe, nube, coi, noi, siigo_fiscal, meta_total_und, meta_total_acv, recomendados, efectividad_sql, productividad,
              CONCAT('$ ', FORMAT_NUMBER(CAST(meta_total_acv AS BIGINT), 0)) AS meta_total_acv_formato
       FROM hive_metastore.db_stage.tbl_brz_gerentes
       WHERE celula IS NOT NULL AND TRIM(celula) <> ''
         AND UPPER(canal_direccion) IN ('ALIADOS','EMPRESARIOS','VN_ALIADOS','VN_EMPRESARIOS','VENTA NUEVA ALIADOS','VENTA NUEVA EMPRESARIOS')
       ${limit}`,
  },
  // ── Metas Asesores (Aliados + Empresarios, todos los países, con bonos trimestrales) ──
  metas_asesores_sync: {
    label: "Metas Asesores Aliados+Empresarios (cuotas_asesores)",
    sql: (limit: string) =>
      `SELECT pais, canal_direccion, director, gerente, documento_asesor, nombre_asesor, celula,
              proyecto, fecha_ingreso_asesor, m_de_antiguedad,
              COALESCE(novedad, 'No aplica') AS novedad,
              CAST(dias_habiles_de_novedad_comisiones_peopleretiro_intrames AS INT) AS dias_novedad,
              COALESCE(reingreso, 'No aplica') AS reingreso,
              CAST(dias_habiles_softlanding AS INT) AS dias_softlanding,
              COALESCE(caso_salud_ocupacional, 'No aplica') AS caso_salud_ocupacional,
              CAST(meta_fe AS INT) AS meta_fe,
              CAST(meta_nube AS INT) AS meta_nube,
              CAST(meta_total AS INT) AS meta_total,
              COALESCE(aplica_a_cuota_lider, 'No aplica') AS aplica_cuota_lider,
              COALESCE(aplica_a_ejecucion_lider, 'No aplica') AS aplica_ejecucion_lider,
              COALESCE(aplica_a_hc_minimo, 'No aplica') AS aplica_hc_minimo,
              CAST(meta_sql_bono_trimestral_categorizacion_marzo AS INT) AS meta_sql_bono,
              CAST(meta_recomendados_bono_trimestral_categorizacion_marzo AS INT) AS meta_recomendados_bono,
              CAST(fe_bono_trimestral_categorizacion AS INT) AS fe_bono,
              CAST(nube_bono_trimestral_categorizacion AS INT) AS nube_bono,
              CAST(total_bono_trimestral_categorizacion AS INT) AS total_bono
       FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
       WHERE documento_asesor IS NOT NULL AND TRIM(documento_asesor) <> ''
         AND nombre_asesor IS NOT NULL AND TRIM(nombre_asesor) <> ''
         AND celula IS NOT NULL AND TRIM(celula) <> ''
         AND UPPER(canal_direccion) IN ('ALIADOS','EMPRESARIOS','VN_ALIADOS','VN_EMPRESARIOS','VENTA NUEVA ALIADOS','VENTA NUEVA EMPRESARIOS')
       ${limit}`,
  },
  // ── NEW: Ventas Empresarios ──
  ventas_empresarios: {
    label: "Ventas Empresarios (tbl_gld_Ventas_MX)",
    sql: (limit: string) =>
      `SELECT FECHA, ASESOR, CELULA, Director, Equipo, TIPO_PRODUCTO, Producto, Unidades, ACV, Recurrencia, ORIGEN FROM analyticdl.db_comercial.tbl_gld_Ventas_MX WHERE YEAR(FECHA) = 2026 ${limit}`,
  },
  // ── NEW: Ventas Aliados ──
  ventas_aliados: {
    label: "Ventas Aliados (tbl_gld_Ventas_SA)",
    sql: (limit: string) =>
      `SELECT fecha, fullname, celula, tipo_producto1, equipo, pais, origen,
              CAST(cuenta_finanzas AS DOUBLE) AS cuenta_finanzas,
              CAST(ACV AS DOUBLE) AS ACV,
              Director
       FROM analyticdl.db_comercial.tbl_gld_Ventas_SA
       WHERE YEAR(fecha) = 2026 ${limit}`,
  },
  // ── NEW: Productividad Asesores (gamificación) ──
  productividad_asesores: {
    label: "Productividad Asesores (Progresiva)",
    sql: (limit: string) =>
      `SELECT ANIO_MES, ASESOR, PAIS, CELULA, AREA, RANGO_ANTIGUEDAD_SIIGO, CANT_RECOMENDADOS, VENTAS_MM_RECOMENDADOS, SC_Creados_MM, VENTAS_MM_SQL, META, VENTAS, ACV_F, Director FROM analyticdl.db_comercial.tbl_slv_Productividad_Progresiva WHERE ANIO_MES >= 202601 AND ANIO_MES <= 202612 ${limit}`,
  },
  // ── NEW: Ventas agregadas por GERENTE (fuente de verdad VN) ──
  // Replica exactamente la consulta oficial: cuenta_finanzas por pais+mes+gerente+familia,
  // con cruce celula→gerente desde tbl_brz_cuotas_asesores.
  ventas_gerente_mensual: {
    label: "Ventas Gerente Mensual (FE/NUBE/CONTADOR)",
    sql: (limit: string) =>
      `SELECT pais, mes_nro, gerente, celula, tipo_producto1,
              CAST(SUM(ventas) AS DOUBLE) AS ventas,
              CAST(SUM(acv_total) AS DOUBLE) AS acv_total
       FROM (
         -- Sudamérica (COL/ECU/URU): tbl_gld_Ventas_SA
         SELECT
           v.pais,
           MONTH(v.fecha) AS mes_nro,
           c.gerente,
           v.celula,
           v.tipo_producto1,
           v.cuenta_finanzas AS ventas,
           v.ACV AS acv_total
         FROM analyticdl.db_comercial.tbl_gld_Ventas_SA v
         LEFT JOIN (
           SELECT DISTINCT celula, gerente
           FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
           WHERE gerente IS NOT NULL
         ) c ON v.celula = c.celula
         WHERE v.fecha >= '2026-01-01'
           AND c.gerente IS NOT NULL

         UNION ALL

         -- México (MEX): tbl_gld_Ventas_MX
         SELECT
           'MEX' AS pais,
           MONTH(v.FECHA) AS mes_nro,
           c.gerente,
           v.CELULA AS celula,
           v.TIPO_PRODUCTO AS tipo_producto1,
           CAST(v.Unidades AS DOUBLE) AS ventas,
           CAST(v.ACV AS DOUBLE) AS acv_total
         FROM analyticdl.db_comercial.tbl_gld_Ventas_MX v
         LEFT JOIN (
           SELECT DISTINCT celula, gerente
           FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores
           WHERE gerente IS NOT NULL
         ) c ON v.CELULA = c.celula
         WHERE v.FECHA >= '2026-01-01'
           AND c.gerente IS NOT NULL
       ) unioned
       GROUP BY pais, mes_nro, gerente, celula, tipo_producto1
       ${limit}`,
  },

};

// ============================================================
// Utilities
// ============================================================
const normalizeText = (value: unknown) =>
  String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9@.\s_-]/g, "").replace(/\s+/g, " ");

// Normalize canal_direccion from any Databricks variant to canonical form
const normalizeCanalDireccion = (value: unknown): string => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw.includes("aliado") || raw === "vn_aliados") return "Aliados";
  if (raw.includes("empresario") || raw === "vn_empresarios") return "Empresarios";
  if (raw.includes("venta cruzada") || raw === "vc") return "VC";
  return String(value ?? "").trim() || "VC";
};

const buildEmailFromName = (name: string) => {
  const slug = normalizeText(name).replace(/[@]/g, "").replace(/[._-]+/g, " ").trim().replace(/\s+/g, ".");
  return `${slug || "sin.nombre"}@siigo.com`;
};

const inferCanal = (row: Record<string, any>) => {
  const area = (row.AREA || "").trim().toLowerCase();
  if (area === "aliados") return "VN_ALIADOS";
  if (area.includes("digital") || area.includes("mercadeo") || area.includes("leads")) return "VN_EMPRESARIOS";
  const combined = normalizeText(`${row.AREA || ""} ${row.CELULA || ""} ${row.Director || row.DIRECTOR || ""}`);
  if (combined.includes("aliados")) return "VN_ALIADOS";
  if (combined.includes("empres")) return "VN_EMPRESARIOS";
  return "VC";
};

const normalizeCountry = (value: unknown) => {
  const country = normalizeText(value).toUpperCase();
  if (["COL", "CO", "COLOMBIA"].includes(country)) return "COL";
  if (["MEX", "MX", "MEXICO", "MEXICO DF"].includes(country)) return "MEX";
  if (["ECU", "EC", "ECUADOR"].includes(country)) return "ECU";
  if (["URU", "UY", "URUGUAY"].includes(country)) return "URU";
  return "COL";
};

const toNumber = (...values: any[]) => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const toRoundedInt = (...values: any[]) => Math.round(toNumber(...values));

const buildStableHash = (...values: unknown[]) => {
  const input = values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const normalizeStoredAcvInt = (...values: any[]) => {
  const n = toNumber(...values);
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 1_000_000_000_000) return Math.round(n / 1_000_000_000);
  return Math.round(n);
};

// ============================================================
// Databricks query runner (reusable)
// ============================================================
async function runDatabricksQuery(queryName: string, sql: string): Promise<Record<string, any>[]> {
  const DATABRICKS_HOST = Deno.env.get("DATABRICKS_HOST")!;
  const DATABRICKS_TOKEN = Deno.env.get("DATABRICKS_TOKEN")!;
  const DATABRICKS_WAREHOUSE_ID = Deno.env.get("DATABRICKS_WAREHOUSE_ID")!;
  const databricksUrl = `${DATABRICKS_HOST.replace(/\/+$/, "")}/api/2.0/sql/statements`;

  console.log(`[${queryName}] Querying Databricks...`);
  const resp = await fetch(databricksUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ warehouse_id: DATABRICKS_WAREHOUSE_ID, statement: sql, wait_timeout: "50s", disposition: "INLINE", format: "JSON_ARRAY" }),
  });
  let data = await resp.json();
  if (!resp.ok && !data.statement_id) throw new Error(data.status?.error?.message || data.message || JSON.stringify(data));

  const statementId = data.statement_id;
  let polls = 0;
  while ((data.status?.state === "PENDING" || data.status?.state === "RUNNING") && polls < 24) {
    polls++;
    await new Promise((r) => setTimeout(r, 5000));
    const pr = await fetch(`${databricksUrl}/${statementId}`, { headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}` } });
    data = await pr.json();
    console.log(`[${queryName}] Poll #${polls}: state=${data.status?.state}`);
  }
  if (data.status?.state === "FAILED") throw new Error(data.status?.error?.message || "Query failed");
  if (data.status?.state === "PENDING" || data.status?.state === "RUNNING") throw new Error("Query timeout after 2 min");

  const cols = (data.manifest?.schema?.columns || []).map((c: any) => c.name);
  const totalRowCount = Number(data.manifest?.total_row_count ?? 0);
  const totalChunks = Number(data.manifest?.total_chunk_count ?? 1);

  // Collect first chunk
  const allRows: any[][] = [];
  const firstChunkRows = data.result?.data_array || [];
  allRows.push(...firstChunkRows);
  console.log(`[${queryName}] Chunk 0: ${firstChunkRows.length} rows (manifest total=${totalRowCount}, chunks=${totalChunks})`);

  // Follow next_chunk_internal_link until all chunks are read
  let nextLink: string | undefined = data.result?.next_chunk_internal_link;
  let chunkIdx = 1;
  const baseHost = DATABRICKS_HOST.replace(/\/+$/, "");
  while (nextLink && chunkIdx < 500) {
    const chunkUrl = nextLink.startsWith("http") ? nextLink : `${baseHost}${nextLink}`;
    const cr = await fetch(chunkUrl, { headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}` } });
    if (!cr.ok) {
      console.error(`[${queryName}] Chunk ${chunkIdx} fetch failed: ${cr.status}`);
      break;
    }
    const chunkData = await cr.json();
    const chunkRows = chunkData.data_array || [];
    allRows.push(...chunkRows);
    console.log(`[${queryName}] Chunk ${chunkIdx}: ${chunkRows.length} rows (running total=${allRows.length})`);
    nextLink = chunkData.next_chunk_internal_link;
    chunkIdx++;
  }

  if (totalRowCount > 0 && allRows.length < totalRowCount) {
    console.warn(`[${queryName}] WARNING: fetched ${allRows.length} of ${totalRowCount} expected rows`);
  } else {
    console.log(`[${queryName}] DONE: ${allRows.length} rows in ${chunkIdx} chunk(s)`);
  }

  return allRows.map((row: any[]) => {
    const obj: Record<string, any> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;
    let authUserId: string | null = null;

    if (!isServiceRole) {
      try {
        authUserId = await getJwtUserId(token);
      } catch (err) {
        return new Response(JSON.stringify({ error: "Unauthorized", detail: err instanceof Error ? err.message : "Invalid JWT" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", authUserId).eq("role", "admin").maybeSingle();
      if (!roleData) return new Response(JSON.stringify({ error: "Solo admins pueden sincronizar" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
      if (!roleData) return new Response(JSON.stringify({ error: "Solo admins pueden sincronizar" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "preview";
    const table = body.table || "productividad";
    const mesFilter = body.mes || undefined;
    const jobId = body.jobId || undefined;

    // ── clean_stuck: mark old running/pending jobs as failed ──
    if (mode === "clean_stuck") {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min
      const { data: cleaned } = await supabase
        .from("sync_jobs")
        .update({ status: "failed", error_message: "Limpieza: job atascado >30min", finished_at: new Date().toISOString() })
        .in("status", ["running", "pending"])
        .lt("created_at", cutoff)
        .select("id");
      return new Response(JSON.stringify({ cleaned: cleaned?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Auto-cleanup stuck jobs before starting new sync ──
    if (mode === "sync") {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      await supabase
        .from("sync_jobs")
        .update({ status: "failed", error_message: "Auto-limpieza: job atascado", finished_at: new Date().toISOString() })
        .in("status", ["running", "pending"])
        .lt("created_at", cutoff);
    }

    // ── all_new: dispatch each table to its own fresh worker (fire-and-forget) ──
    // Each fetch hits this same edge function with a single table → fresh CPU budget per worker.
    // OPTIMIZACIÓN: usamos jobs combinados (ventas_empresarios_combo / ventas_aliados_combo)
    // que descargan UNA sola vez de Databricks y procesan ambos destinos (ventas_diarias + ventas).
    // Antes ejecutábamos la misma query 2 veces por canal → ahora 1 vez. ~50% menos tiempo en Databricks.
    if (table === "all_new" && mode === "sync") {
      const tables = ["metas_gerentes", "metas_asesores_sync", "ventas_empresarios_combo", "ventas_aliados_combo", "productividad_asesores", "ventas_gerente_mensual"];
      const jobIds: Record<string, string> = {};
      for (const t of tables) {
        const { data: job } = await supabase
          .from("sync_jobs")
          .insert({ table_name: t, mode: "sync", status: "pending", requested_by: authUserId, started_at: new Date().toISOString() })
          .select("id").single();
        if (job) jobIds[t] = job.id;
      }
      // Dispatch one HTTP call per table — each lands on a fresh worker with its own CPU budget.
      const selfUrl = `${supabaseUrl}/functions/v1/sync-databricks`;
      EdgeRuntime.waitUntil((async () => {
        await Promise.all(tables.map((t) =>
          fetch(selfUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
              "apikey": serviceRoleKey,
            },
            body: JSON.stringify({ mode: "sync", table: t, jobId: jobIds[t] }),
          }).catch((e) => console.error(`[all_new] dispatch ${t} failed:`, e))
        ));
      })());
      return new Response(JSON.stringify({ queued: true, launched: tables, jobIds, message: `${tables.length} syncs iniciados en paralelo (workers aislados)` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Dispatched worker: incoming jobId means this is a fresh worker for one table ──
    if (mode === "sync" && jobId) {
      EdgeRuntime.waitUntil(processSyncJob({ supabaseUrl, serviceRoleKey, table, mesFilter, jobId }));
      return new Response(JSON.stringify({ queued: true, jobId, table, message: "Worker iniciado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Background job creation ──
    if (mode === "sync" && !jobId) {
      const { data: job, error: jobError } = await supabase
        .from("sync_jobs")
        .insert({ table_name: table, mode, status: "pending", requested_by: authUserId, started_at: new Date().toISOString() })
        .select("id, table_name, status, created_at")
        .single();
      if (jobError || !job) return new Response(JSON.stringify({ error: jobError?.message || "No se pudo crear el trabajo" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      EdgeRuntime.waitUntil(processSyncJob({ supabaseUrl, serviceRoleKey, table, mesFilter, jobId: job.id }));
      return new Response(JSON.stringify({ queued: true, job, message: "Sincronización iniciada en segundo plano" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Job status polling ──
    if (mode === "job_status") {
      if (!jobId) return new Response(JSON.stringify({ error: "jobId es requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: job, error: jobError } = await supabase.from("sync_jobs").select("*").eq("id", jobId).maybeSingle();
      if (jobError) return new Response(JSON.stringify({ error: jobError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!job) return new Response(JSON.stringify({ error: "Trabajo no encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify(job), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Composite modes ──
    if (table === "ventas_vc_completo") {
      const result = await runVentasVcCompleto({ supabase, supabaseUrl, serviceRoleKey, mesFilter, mode });
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (table === "ventas_vn_completo") {
      const result = await runVentasVnCompleto({ supabase, supabaseUrl, serviceRoleKey, mesFilter, mode });
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // ── Single table ──
    const result = await runSingleTableSync({ supabase, supabaseUrl, serviceRoleKey, table, mesFilter, mode });
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("sync-databricks error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ============================================================
// Background job processor
// ============================================================
async function processSyncJob({ supabaseUrl, serviceRoleKey, table, mesFilter, jobId }: { supabaseUrl: string; serviceRoleKey: string; table: string; mesFilter?: string; jobId: string }) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  try {
    await supabase.from("sync_jobs").update({ status: "running", started_at: new Date().toISOString(), error_message: null }).eq("id", jobId);

    let result: any;
    if (table === "ventas_vc_completo") result = await runVentasVcCompleto({ supabase, supabaseUrl, serviceRoleKey, mesFilter, mode: "sync" });
    else if (table === "ventas_vn_completo") result = await runVentasVnCompleto({ supabase, supabaseUrl, serviceRoleKey, mesFilter, mode: "sync" });
    else if (table === "ventas_empresarios_combo") result = await runVentasEmpresariosCombo({ supabase, mesFilter });
    else if (table === "ventas_aliados_combo") result = await runVentasAliadosCombo({ supabase, mesFilter });
    else if (table === "all_new") result = { error: "all_new should be dispatched, not processed inline" };
    else result = await runSingleTableSync({ supabase, supabaseUrl, serviceRoleKey, table, mesFilter, mode: "sync" });

    await supabase.from("sync_jobs").update({ status: "completed", finished_at: new Date().toISOString(), result, error_message: null }).eq("id", jobId);
  } catch (error) {
    console.error("processSyncJob error:", error);
    await supabase.from("sync_jobs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: String(error) }).eq("id", jobId);
  }
}

// ============================================================
// Run all 5 new syncs at once
// ============================================================
async function runAllNewSyncs({ supabase, supabaseUrl, serviceRoleKey, mode }: { supabase: any; supabaseUrl: string; serviceRoleKey: string; mode: string }) {
  const limitClause = mode === "preview" ? "LIMIT 10" : "";
  const results: Record<string, any> = {};
  const errors: string[] = [];

  const tasks = [
    { key: "metas_gerentes", syncFn: syncMetasGerentes },
    { key: "metas_asesores_sync", syncFn: syncMetasAsesoresData },
    { key: "ventas_empresarios", syncFn: syncVentasEmpresarios },
    { key: "ventas_aliados", syncFn: syncVentasAliados },
    { key: "productividad_asesores", syncFn: syncProductividadAsesores },
  ];

  // Run each sequentially to avoid overwhelming Databricks
  for (const task of tasks) {
    try {
      console.log(`[all_new] Starting ${task.key}...`);
      const config = TABLE_CONFIGS[task.key];
      const rows = await runDatabricksQuery(task.key, config.sql(limitClause));

      if (mode === "preview") {
        const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
        results[task.key] = { label: config.label, total_rows: rows.length, columns: cols, sample: rows.slice(0, 3) };
      } else {
        results[task.key] = await task.syncFn(supabase, rows);
      }
    } catch (err) {
      console.error(`[all_new] Error in ${task.key}:`, err);
      errors.push(`${task.key}: ${String(err)}`);
      results[task.key] = { error: String(err) };
    }
  }

  // SP recalculation is decoupled — admin triggers it manually from /admin/calculos after all syncs complete.
  return { ...results, errors };
}

// ============================================================
// Ventas VC Completo (existing composite)
// ============================================================
async function runVentasVcCompleto({ supabase, supabaseUrl, serviceRoleKey, mesFilter, mode }: { supabase: any; supabaseUrl: string; serviceRoleKey: string; mesFilter?: string; mode: string }) {
  const limitClause = mode === "preview" ? "LIMIT 10" : "";

  const [vcRows, prodRows] = await Promise.all([
    runDatabricksQuery("ventas_vc", TABLE_CONFIGS.ventas_vc.sql(limitClause, mesFilter)),
    runDatabricksQuery("ventas_vc_producto", TABLE_CONFIGS.ventas_vc_producto.sql(limitClause, mesFilter)),
  ]);

  if (mode === "preview") {
    return {
      table: "Ventas VC Completo (Totales + Desglose)",
      ventas_vc: { total_rows: vcRows.length, sample: vcRows.slice(0, 3) },
      ventas_vc_producto: { total_rows: prodRows.length, sample: prodRows.slice(0, 3) },
    };
  }

  const [vcResult, prodResult] = await Promise.all([
    syncVentasVC(supabase, vcRows),
    syncVentasVCProducto(supabase, prodRows),
  ]);

  // SP recalculation decoupled — admin triggers it manually from /admin/calculos.
  return { ventas_vc: vcResult, ventas_vc_producto: prodResult };
}

// ============================================================
// Single table sync router
// ============================================================
async function runSingleTableSync({ supabase, supabaseUrl, serviceRoleKey, table, mesFilter, mode }: { supabase: any; supabaseUrl: string; serviceRoleKey: string; table: string; mesFilter?: string; mode: string }) {
  const tableConfig = TABLE_CONFIGS[table];
  if (!tableConfig) throw new Error(`Tabla no soportada: ${table}. Opciones: ${Object.keys(TABLE_CONFIGS).join(", ")}, ventas_vc_completo, all_new`);

  const DATABRICKS_HOST = Deno.env.get("DATABRICKS_HOST");
  const DATABRICKS_TOKEN = Deno.env.get("DATABRICKS_TOKEN");
  const DATABRICKS_WAREHOUSE_ID = Deno.env.get("DATABRICKS_WAREHOUSE_ID");
  if (!DATABRICKS_HOST || !DATABRICKS_TOKEN || !DATABRICKS_WAREHOUSE_ID) throw new Error("Faltan credenciales de Databricks.");

  const limitClause = mode === "preview" ? "LIMIT 10" : "";
  const sql = tableConfig.sql(limitClause, mesFilter);
  const rows = await runDatabricksQuery(table, sql);

  console.log(`[${table}] Databricks returned ${rows.length} rows`);

  if (mode === "preview") {
    const columnNames = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { table: tableConfig.label, columns: columnNames, total_rows: rows.length, sample: rows.slice(0, 5) };
  }

  // Route to the correct sync function
  const SYNC_MAP: Record<string, (sb: any, r: any[]) => Promise<any>> = {
    productividad: syncProductividad,
    ventas_vc: syncVentasVC,
    ventas_vc_producto: syncVentasVCProducto,
    metas_gerentes: syncMetasGerentes,
    metas_asesores_sync: syncMetasAsesoresData,
    ventas_empresarios: syncVentasEmpresarios,
    ventas_aliados: syncVentasAliados,
    productividad_asesores: syncProductividadAsesores,
    ventas_gerente_mensual: syncVentasGerenteMensual,
  };

  const syncFn = SYNC_MAP[table];
  if (!syncFn) throw new Error(`No sync function for table: ${table}`);

  const syncResult = await syncFn(supabase, rows);
  // SP recalculation decoupled — admin triggers it manually from /admin/calculos.
  return syncResult;
}

// ============================================================
// SP recalculation trigger
// ============================================================
async function triggerSpRecalculation(supabaseUrl: string, serviceRoleKey: string, context: string) {
  // Fire-and-forget: do not await the response to avoid blocking the sync
  try {
    const spUrl = `${supabaseUrl}/functions/v1/calcular-sp-semanal`;
    fetch(spUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
    }).then(() => {
      console.log(`[${context}] SP recalculation dispatched`);
    }).catch((err) => {
      console.error(`[${context}] SP recalculation dispatch error:`, err);
    });
    return { dispatched: true };
  } catch (spErr) {
    console.error(`[${context}] SP recalculation error:`, spErr);
    return { error: String(spErr) };
  }
}

// ============================================================
// Helper: parallel upsert in large batches (4-way concurrency)
// ============================================================
async function parallelUpsert(
  supabase: any,
  table: string,
  rows: any[],
  options: { onConflict?: string; count?: "exact" } = {},
  errores: string[] = [],
  label = table,
): Promise<number> {
  if (!rows.length) return 0;
  const BATCH = 2000;
  const CONCURRENCY = 4;
  const chunks: any[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) chunks.push(rows.slice(i, i + BATCH));
  let total = 0;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const slice = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map((c, idx) =>
        supabase.from(table).upsert(c, options).then((r: any) => ({ r, idx: i + idx, len: c.length })),
      ),
    );
    for (const { r, idx, len } of results) {
      if (r.error) errores.push(`${label} batch ${idx * BATCH}: ${r.error.message}`);
      else total += r.count ?? len;
    }
  }
  return total;
}

// ============================================================
// SYNC: Productividad Progresiva → kpis_mensuales (existing)
// ============================================================
async function syncProductividad(supabase: any, rows: Record<string, any>[]) {
  let insertedKpis = 0;
  let createdGerentes = 0;
  const errores: string[] = [];

  const gerenteMap = new Map<string, any>();
  const registerGerente = (gerente: any) => {
    const nn = normalizeText(gerente?.nombre);
    const ne = normalizeText(gerente?.email);
    if (nn) gerenteMap.set(nn, gerente);
    if (ne) gerenteMap.set(ne, gerente);
  };

  const { data: gerentes } = await supabase.from("gerentes").select("id, nombre, email, canal, pais, lider");
  (gerentes || []).forEach(registerGerente);

  const missingGerentes = new Map<string, any>();
  for (const row of rows) {
    const asesorNombre = String(row.ASESOR || row.GERENTE || row.NOMBRE_GERENTE || "").trim();
    const asesorEmail = String(row.EMAIL || row.CORREO || "").trim().toLowerCase();
    const lookupKey = normalizeText(asesorEmail || asesorNombre);
    if (!lookupKey) { if (errores.length < 20) errores.push(`Fila sin asesor: ${JSON.stringify(row).slice(0, 120)}`); continue; }

    if (!gerenteMap.get(lookupKey)) {
      const nombre = asesorNombre || asesorEmail.split("@")[0].replace(/\./g, " ").trim();
      const email = asesorEmail || buildEmailFromName(nombre);
      const key = normalizeText(email);
      if (!missingGerentes.has(key)) {
        missingGerentes.set(key, { nombre, email, canal: inferCanal(row), pais: "COL", lider: String(row.Director || row.DIRECTOR || "").trim() || null, activo: true });
      }
    }
  }

  if (missingGerentes.size > 0) {
    const { data: created, error: batchErr } = await supabase.from("gerentes").upsert([...missingGerentes.values()], { onConflict: "email" }).select("id, nombre, email, canal, pais, lider");
    if (batchErr) errores.push(`Error creando participantes: ${batchErr.message}`);
    else { createdGerentes = created?.length || 0; (created || []).forEach(registerGerente); }
  }

  const kpiRows = new Map<string, any>();
  for (const row of rows) {
    try {
      const asesorNombre = String(row.ASESOR || row.GERENTE || row.NOMBRE_GERENTE || "").trim();
      const asesorEmail = String(row.EMAIL || row.CORREO || "").trim().toLowerCase();
      const gerente = gerenteMap.get(normalizeText(asesorEmail)) || gerenteMap.get(normalizeText(asesorNombre)) || gerenteMap.get(normalizeText(buildEmailFromName(asesorNombre)));
      if (!gerente) { if (errores.length < 20) errores.push(`Gerente no encontrado: ${JSON.stringify(row).slice(0, 120)}`); continue; }

      const anioMes = String(row.ANIO_MES || row.anio_mes || "").trim();
      if (!anioMes) continue;

      kpiRows.set(`${gerente.id}|${anioMes}`, {
        gerente_id: gerente.id, anio_mes: anioMes, canal: gerente.canal || inferCanal(row), moneda: "COP",
        ventas: toRoundedInt(row.VENTAS, row.ventas), meta: toRoundedInt(row.META, row.meta),
        acv_f: normalizeStoredAcvInt(row.ACV_F, row.acv_f), cant_recomendados: toRoundedInt(row.CANT_RECOMENDADOS),
        ventas_recomendados: toRoundedInt(row.VENTAS_MM_RECOMENDADOS), sa_creados: toRoundedInt(row.SA_Creados_MM),
        sc_creados: toRoundedInt(row.SC_Creados_MM), ventas_sql: toRoundedInt(row.VENTAS_MM_SQL),
        hc_final: toRoundedInt(row.HC_final), hc_inicial: toRoundedInt(row.HC_inicial), terminaciones: toRoundedInt(row.terminaciones),
      });
    } catch (err) { if (errores.length < 20) errores.push(`Row error: ${String(err)}`); }
  }

  const uniqueKpiRows = [...kpiRows.values()];
  insertedKpis += await parallelUpsert(supabase, "kpis_mensuales", uniqueKpiRows, { onConflict: "gerente_id,anio_mes", count: "exact" }, errores, "KPI");

  return { total_rows: rows.length, participantes_creados: createdGerentes, kpis_sincronizados: insertedKpis, filas_unicas: uniqueKpiRows.length, errores: errores.slice(0, 20) };
}

// ============================================================
// SYNC: Ventas VC → ventas table (existing)
// ============================================================
async function syncVentasVC(supabase: any, rows: Record<string, any>[]) {
  let insertedVentas = 0;
  const errores: string[] = [];

  const { data: gerentes } = await supabase.from("gerentes").select("id, nombre, email, canal");
  const gerenteMap = new Map<string, any>();
  (gerentes || []).forEach((g: any) => { gerenteMap.set(g.nombre?.toLowerCase()?.trim(), g); });

  const liderNames = new Set<string>();
  for (const row of rows) { const lider = (row.Lider || "").trim(); if (lider && !gerenteMap.get(lider.toLowerCase())) liderNames.add(lider); }

  if (liderNames.size > 0) {
    const newGerentes = [...liderNames].map(name => ({ nombre: name, email: name.toLowerCase().replace(/\s+/g, ".").normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "@siigo.com", canal: "VC", pais: "COL", activo: true }));
    const { data: created, error: batchErr } = await supabase.from("gerentes").upsert(newGerentes, { onConflict: "email" }).select("id, nombre, email, canal");
    if (batchErr) errores.push(`Error creando gerentes: ${batchErr.message}`);
    (created || []).forEach((g: any) => gerenteMap.set(g.nombre?.toLowerCase()?.trim(), g));
  }

  const ventaRows: any[] = [];
  for (const row of rows) {
    const liderName = (row.Lider || "").toLowerCase().trim();
    const gerente = gerenteMap.get(liderName);
    if (!gerente) { if (errores.length < 20) errores.push(`Gerente no encontrado: ${row.Lider || "?"}`); continue; }
    const monthNum = SPANISH_MONTHS[row.Mes] || "01";
    const anio = Number(row.Anio) || 2026;
    const asesor = String(row.Asesor || row.comercial || "");
    ventaRows.push({
      gerente_id: gerente.id, fecha_facturacion: `${anio}-${monthNum}-01`, canal: "VC", anio, mes: String(row.Mes || ""),
      producto: "Resumen Mensual VC", bloque_venta: "", documento_factura: `SUM-${anio}-${row.Mes}-${asesor}`,
      valor_producto: Number(row.Saldo_ACV_Actual || 0), acv_plus: Number(row.Saldo_ACV_Actual || 0),
      meta: Number(row.Meta_Objetivo || 0), comercial: asesor, lider: String(row.Lider || ""), categoria_producto_venta: "",
    });
  }

  const deduped = new Map<string, any>();
  for (const row of ventaRows) {
    const key = `${row.documento_factura}|${row.producto}|${row.fecha_facturacion}`;
    if (deduped.has(key)) { const e = deduped.get(key); e.acv_plus += row.acv_plus; e.valor_producto += row.valor_producto; e.meta = Math.max(e.meta, row.meta); }
    else deduped.set(key, { ...row });
  }
  const uniqueRows = [...deduped.values()];

  insertedVentas += await parallelUpsert(supabase, "ventas", uniqueRows, { onConflict: "documento_factura,producto,fecha_facturacion", count: "exact" }, errores, "ventas VC");

  return { total_rows: rows.length, ventas_sincronizadas: insertedVentas, deduplicadas: uniqueRows.length, errores: errores.slice(0, 20) };
}

// ============================================================
// SYNC: Ventas VC Producto → ventas table (existing)
// ============================================================
async function syncVentasVCProducto(supabase: any, rows: Record<string, any>[]) {
  let insertedVentas = 0;
  const errores: string[] = [];

  const { data: gerentes } = await supabase.from("gerentes").select("id, nombre, email, canal");
  const gerenteMap = new Map<string, any>();
  (gerentes || []).forEach((g: any) => { gerenteMap.set(g.nombre?.toLowerCase()?.trim(), g); });

  const ventaRows: any[] = [];
  for (const row of rows) {
    const liderName = (row.Lider || "").toLowerCase().trim();
    const gerente = gerenteMap.get(liderName);
    if (!gerente) { if (errores.length < 20) errores.push(`Gerente no encontrado: ${row.Lider || "?"}`); continue; }
    const monthNum = SPANISH_MONTHS[row.Mes] || "01";
    const anio = Number(row.Anio) || 2026;
    const asesor = String(row.Asesor || "").trim();
    const producto = String(row.Producto || "Sin categoría").trim();
    const bloque = String(row.Bloque || "").trim();
    const acv = Number(row.ACV_Producto || 0);
    const unidades = Number(row.Unidades || 0);
    if (acv === 0 && unidades === 0) continue;
    ventaRows.push({
      gerente_id: gerente.id, fecha_facturacion: `${anio}-${monthNum}-01`, canal: "VC", anio, mes: String(row.Mes || ""),
      producto, bloque_venta: bloque, documento_factura: `PROD-${anio}-${row.Mes}-${asesor}-${producto}-${bloque}`,
      valor_producto: acv, acv_plus: acv, meta: 0, comercial: asesor, lider: String(row.Lider || ""), categoria_producto_venta: producto,
    });
  }

  const deduped = new Map<string, any>();
  for (const row of ventaRows) {
    const key = `${row.documento_factura}|${row.producto}|${row.fecha_facturacion}`;
    if (deduped.has(key)) { const e = deduped.get(key); e.acv_plus += row.acv_plus; e.valor_producto += row.valor_producto; }
    else deduped.set(key, { ...row });
  }
  const uniqueRows = [...deduped.values()];

  insertedVentas += await parallelUpsert(supabase, "ventas", uniqueRows, { onConflict: "documento_factura,producto,fecha_facturacion", count: "exact" }, errores, "ventas VC producto");

  return { total_rows: rows.length, ventas_producto_sincronizadas: insertedVentas, deduplicadas: uniqueRows.length, errores: errores.slice(0, 20) };
}

// ============================================================
// NEW SYNC 1: Metas Gerentes → metas_gerentes
// ============================================================
async function syncMetasGerentes(supabase: any, rows: Record<string, any>[]) {
  let synced = 0;
  const errores: string[] = [];

  const upsertRows = rows.map((row) => ({
    pais_gestion: String(row.pais_gestion || "").trim() || null,
    canal_direccion: normalizeCanalDireccion(row.canal_direccion),
    director: String(row.director || "").trim() || null,
    celula: String(row.celula || "").trim(),
    m: String(row.m || "").trim() || null,
    cuota: toNumber(row.cuota),
    hc_operativo: toNumber(row.hc_operativo),
    fe: toNumber(row.fe),
    nube: toNumber(row.nube),
    coi: toNumber(row.coi),
    noi: toNumber(row.noi),
    siigo_fiscal: toNumber(row.siigo_fiscal),
    meta_total_und: toNumber(row.meta_total_und),
    meta_total_acv: toNumber(row.meta_total_acv),
    meta_total_acv_formato: row.meta_total_acv_formato ? String(row.meta_total_acv_formato).trim() : null,
    recomendados: toNumber(row.recomendados),
    efectividad_sql: toNumber(row.efectividad_sql),
    productividad: toNumber(row.productividad),
  })).filter((r) => r.celula && r.canal_direccion);

  // Dedup by (celula, canal_direccion) — last row wins. Postgres rejects upserts with
  // duplicate keys in the same batch ("ON CONFLICT DO UPDATE command cannot affect row a second time").
  const dedupedMap = new Map<string, typeof upsertRows[number]>();
  for (const r of upsertRows) {
    dedupedMap.set(`${r.celula}|${r.canal_direccion}`, r);
  }
  const uniqueRows = [...dedupedMap.values()];
  console.log(`[metas_gerentes] Total rows: ${upsertRows.length} → únicas: ${uniqueRows.length}`);

  synced += await parallelUpsert(supabase, "metas_gerentes", uniqueRows, { onConflict: "celula,canal_direccion", count: "exact" }, errores, "metas_gerentes");

  let gerentesEnriquecidos = 0;
  try {
    const leaderCellMap = new Map<string, string>();
    for (const row of uniqueRows) {
      const director = normalizeText(row.director);
      const celula = String(row.celula || "").trim();
      if (director && celula && !leaderCellMap.has(director)) {
        leaderCellMap.set(director, celula);
      }
    }

    const { data: gerentesVn } = await supabase
      .from("gerentes")
      .select("id, nombre, celula, canal")
      .in("canal", ["VN_ALIADOS", "VN_EMPRESARIOS"]);

    const updates = (gerentesVn || [])
      .filter((g: any) => !g.celula)
      .map((g: any) => {
        const celula = leaderCellMap.get(normalizeText(g.nombre));
        return celula ? { id: g.id, celula } : null;
      })
      .filter(Boolean);

    if (updates.length > 0) {
      gerentesEnriquecidos += await parallelUpsert(
        supabase,
        "gerentes",
        updates,
        { onConflict: "id", count: "exact" },
        errores,
        "gerentes celula metas_gerentes",
      );
    }
  } catch (e) {
    errores.push(`Enriquecimiento de gerentes desde metas_gerentes falló: ${String(e)}`);
  }

  return {
    total_rows: rows.length,
    deduplicadas: uniqueRows.length,
    metas_gerentes_sincronizadas: synced,
    gerentes_celula_enriquecida: gerentesEnriquecidos,
    errores: errores.slice(0, 20),
  };
}

// ============================================================
// NEW SYNC 2: Metas Asesores → metas_asesores
// ============================================================
async function syncMetasAsesoresData(supabase: any, rows: Record<string, any>[]) {
  let synced = 0;
  const errores: string[] = [];

  // Build current month as anio_mes default
  const now = new Date();
  const defaultAnioMes = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  // DIAGNOSTIC: log sample of incoming raw rows + key field counts
  const sample = rows.slice(0, 2);
  const conGerente = rows.filter((r) => r.gerente).length;
  const conCelula = rows.filter((r) => r.celula).length;
  const conNombre = rows.filter((r) => r.nombre_asesor).length;
  console.log(`[metas_asesores] Total: ${rows.length} | con_gerente: ${conGerente} | con_celula: ${conCelula} | con_nombre: ${conNombre}`);
  console.log(`[metas_asesores] Sample row keys:`, Object.keys(rows[0] || {}));
  console.log(`[metas_asesores] Sample row[0]:`, JSON.stringify(sample[0] || {}));

  const upsertRows = rows.map((row) => {
    const fechaIngreso = row.fecha_ingreso_asesor ? String(row.fecha_ingreso_asesor).trim().split('T')[0] : null;
    return {
      documento_asesor: String(row.documento_asesor || "").trim(),
      pais: normalizeCountry(row.pais),
      canal_direccion: normalizeCanalDireccion(row.canal_direccion),
      meta_fe: toRoundedInt(row.meta_fe),
      meta_nube: toRoundedInt(row.meta_nube),
      meta_total: toRoundedInt(row.meta_total),
      novedad: row.novedad ? String(row.novedad).trim() : null,
      celula: row.celula ? String(row.celula).trim() : null,
      nombre_asesor: row.nombre_asesor ? String(row.nombre_asesor).trim() : null,
      gerente: row.gerente ? String(row.gerente).trim() : null,
      anio_mes: defaultAnioMes,
      // Nuevos campos extendidos
      proyecto: row.proyecto ? String(row.proyecto).trim() : null,
      fecha_ingreso_asesor: fechaIngreso && /^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso) ? fechaIngreso : null,
      m_de_antiguedad: toNumber(row.m_de_antiguedad),
      dias_novedad: toRoundedInt(row.dias_novedad),
      reingreso: row.reingreso ? String(row.reingreso).trim() : null,
      dias_softlanding: toRoundedInt(row.dias_softlanding),
      caso_salud_ocupacional: row.caso_salud_ocupacional ? String(row.caso_salud_ocupacional).trim() : null,
      aplica_cuota_lider: row.aplica_cuota_lider ? String(row.aplica_cuota_lider).trim() : null,
      aplica_ejecucion_lider: row.aplica_ejecucion_lider ? String(row.aplica_ejecucion_lider).trim() : null,
      aplica_hc_minimo: row.aplica_hc_minimo ? String(row.aplica_hc_minimo).trim() : null,
      meta_sql_bono: toRoundedInt(row.meta_sql_bono),
      meta_recomendados_bono: toRoundedInt(row.meta_recomendados_bono),
      fe_bono: toRoundedInt(row.fe_bono),
      nube_bono: toRoundedInt(row.nube_bono),
      total_bono: toRoundedInt(row.total_bono),
    };
  }).filter((r) => r.documento_asesor && r.canal_direccion);

  // Dedup by (documento_asesor, canal_direccion, anio_mes) to avoid Postgres upsert duplicate key errors
  const metasDedupMap = new Map<string, typeof upsertRows[number]>();
  for (const r of upsertRows) {
    metasDedupMap.set(`${r.documento_asesor}|${r.canal_direccion}|${r.anio_mes}`, r);
  }
  const uniqueMetasRows = [...metasDedupMap.values()];
  console.log(`[metas_asesores] Total rows: ${upsertRows.length} → únicas: ${uniqueMetasRows.length}`);

  synced += await parallelUpsert(supabase, "metas_asesores", uniqueMetasRows, { onConflict: "documento_asesor,canal_direccion,anio_mes", count: "exact" }, errores, "metas_asesores");

  // Also update asesores table with documento and canal_direccion
  for (const row of rows) {
    const doc = String(row.documento_asesor || "").trim();
    const canal = normalizeCanalDireccion(row.canal_direccion);
    const nombre = String(row.nombre_asesor || "").trim();
    if (doc && nombre) {
      await supabase.from("asesores").update({ documento: doc, canal_direccion: canal }).eq("nombre", nombre);
    }
  }

  // ============================================================
  // POST-PROCESS: Auto-agregar metas_gerentes desde metas_asesores
  // Suma por (celula, canal_direccion) los meta_fe, meta_nube, meta_total
  // ============================================================
  let metasGerentesAgregadas = 0;
  try {
    const aggMap = new Map<string, { celula: string; canal_direccion: string; pais_gestion: string | null; fe: number; nube: number; meta_total_und: number; gerente_nombre: string | null }>();
    for (const r of upsertRows) {
      if (!r.celula) continue;
      const key = `${r.celula}|${r.canal_direccion}`;
      const cur = aggMap.get(key) || { celula: r.celula, canal_direccion: r.canal_direccion, pais_gestion: r.pais, fe: 0, nube: 0, meta_total_und: 0, gerente_nombre: r.gerente || null };
      cur.fe += r.meta_fe || 0;
      cur.nube += r.meta_nube || 0;
      cur.meta_total_und += r.meta_total || 0;
      if (!cur.gerente_nombre && r.gerente) cur.gerente_nombre = r.gerente;
      aggMap.set(key, cur);
    }
    const aggRows = Array.from(aggMap.values()).map((a) => ({
      celula: a.celula,
      canal_direccion: a.canal_direccion,
      pais_gestion: a.pais_gestion,
      fe: a.fe,
      nube: a.nube,
      meta_total_und: a.meta_total_und,
      director: a.gerente_nombre, // store gerente name as director fallback
    }));
    if (aggRows.length > 0) {
      const { error: aggErr, count: aggCount } = await supabase.from("metas_gerentes").upsert(aggRows, { onConflict: "celula,canal_direccion", count: "exact" });
      if (aggErr) errores.push(`metas_gerentes auto-agregado: ${aggErr.message}`);
      else metasGerentesAgregadas = aggCount || aggRows.length;
    }
    console.log(`[metas_asesores] Auto-agregado metas_gerentes: ${metasGerentesAgregadas} celulas`);
  } catch (e) {
    errores.push(`Auto-agregado metas_gerentes falló: ${String(e)}`);
  }

  // ============================================================
  // POST-PROCESS: Enriquecer gerentes.celula desde metas_asesores
  // Si un gerente VN tiene celula NULL pero su nombre aparece en metas_asesores.gerente,
  // poblar gerentes.celula con la primera celula encontrada.
  // ============================================================
  let gerentesEnriquecidos = 0;
  try {
    const gerenteCelulaMap = new Map<string, string>();
    for (const r of upsertRows) {
      if (r.gerente && r.celula && !gerenteCelulaMap.has(r.gerente.toLowerCase())) {
        gerenteCelulaMap.set(r.gerente.toLowerCase(), r.celula);
      }
    }
    const { data: gerentes } = await supabase.from("gerentes").select("id, nombre, celula, canal").in("canal", ["VN_ALIADOS", "VN_EMPRESARIOS"]);
    for (const g of gerentes || []) {
      if (g.celula) continue;
      const cel = gerenteCelulaMap.get(String(g.nombre || "").toLowerCase().trim());
      if (cel) {
        await supabase.from("gerentes").update({ celula: cel }).eq("id", g.id);
        gerentesEnriquecidos++;
      }
    }
    console.log(`[metas_asesores] Gerentes con celula enriquecida: ${gerentesEnriquecidos}`);
  } catch (e) {
    errores.push(`Enriquecimiento gerentes.celula falló: ${String(e)}`);
  }

  return {
    total_rows: rows.length,
    metas_asesores_sincronizadas: synced,
    metas_gerentes_auto_agregadas: metasGerentesAgregadas,
    gerentes_celula_enriquecida: gerentesEnriquecidos,
    diagnostico: { con_gerente: conGerente, con_celula: conCelula, con_nombre: conNombre },
    errores: errores.slice(0, 20),
  };
}

// ============================================================
// Product family normalization by country
// For tbl_gld_Ventas_SA (Aliados): use tipo_producto1 directly (already "FE" or "NUBE")
// For tbl_gld_Ventas_MX (Empresarios): pass Producto + asesor's country
// ============================================================
const FE_PRODUCTS_BY_COUNTRY: Record<string, string[]> = {
  COL: [
    "FE (24 Doc)", "FE (24 Doc) WP", "FE (60 Doc)", "FE (80 Doc)", "FE (100 Doc)",
    "FE (120 Doc)", "FE (120 Doc) WP", "FE (260 Doc)", "FE (300 Doc)", "FE (1500 Doc)",
    "FE PRO", "Nomina Base", "Nomina Lite 2 (24 Doc)", "Nomina Lite 10 (120 Doc)",
    "Nomina Lite 25 (300 Doc)", "Nomina Plus", "Nomina Pro", "POS", "POS INICIO",
    "POS AVANZADO", "POS ESENCIAL", "Pos Gastrobar PRO", "Siigo POS"
  ],
  ECU: [
    "FE (10 Doc)", "FE (20 Doc)", "FE (48 Doc)", "FE (50 Doc)", "FE (96 Doc)",
    "FE (100 Doc)", "FE (120 Doc)", "FE (240 Doc)", "FE (480 Doc)", "FE (600 Doc)",
    "FE (1200 Doc)", "FE (2400 Doc)", "FE ILI", "POS",
    "Contador 3", "Contador 5", "Contador 10", "Contador 15", "Contador Ilimitado"
  ],
  MEX: [
    "ADM Basica", "ADM Basica (20 Tim)", "ADM Basica (50 Tim)", "ADM Basica (100 Tim)",
    "Aspel BANCO", "Aspel CAJA", "Aspel Fact 1 Emp", "Aspel Fact 2 a 99 Emp",
    "NOI Asist (6 a 25 Emp)", "NOI Asist (26 a 50 Emp)", "NOI Asist (51 a 100 Emp)",
    "NOI Asist (101 a 200 Emp)", "NOI Asist (201 a 500 Emp)", "NOI Asist (501 a 1000 Emp)",
    "NOI Asist (+1000 Emp)", "Nube Facturacion", "Nube Facturacion Duo"
  ],
  URU: [
    "API", "FE (5 Doc)", "FE (5 Doc 2023)", "FE (50 Doc)", "FE (100 Doc)",
    "FE (Geocom)", "FE (Libre)", "FE (Literal E) POS", "FE (Monotributo)",
    "FE (PRO)", "FE (Resonance)", "POS", "POS Movil"
  ],
};

const NUBE_PRODUCTS_BY_COUNTRY: Record<string, string[]> = {
  COL: [
    "Contai Ili", "Mto", "Nomina Ili", "Nuevo Siigo Nube", "Nuevo Siigo Nube Emprendedor",
    "Nuevo Siigo Nube Premium", "Nube Profesional Independiente", "SCI Ili",
    "SCI - Fusionado Ili", "Siigo Nube Lite", "Siigo Pyme"
  ],
  ECU: ["Esencial", "Gestion Plus", "Nube", "Plus", "Premium"],
  MEX: [
    "ADM Premium", "Aspel COI", "Aspel NOI", "Aspel SAE", "Gestion Avanzado",
    "Gestion Inicio", "Gestion Premium", "Gestion Total Avanzado", "Gestion Total Inicio",
    "Gestion Total Premium", "Fiscal Corporativo", "Fiscal Descargas", "Fiscal Despachos",
    "Fiscal Empresarial", "Fiscal Pyme"
  ],
  URU: [
    "Emprendedor", "Figaro", "Figaro + FE", "Figaro Educativo", "POS", "Premium",
    "Pyme", "Recibos SE", "Recibos SE 1 a 15", "Recibos SE 16 a 30",
    "Recibos SE 31 a 60", "Recibos SE 60 a 120", "Worky", "Worky Educativo",
    "Contador", "Conty Educativo", "Conty Educativo(Inst)", "Conty Full"
  ],
};

// Strip accents + lowercase, normalize common Databricks typos
const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const fixCommonTypos = (s: string) =>
  s.replace(/premiun/g, "premium").replace(/\s+/g, " ");

function normalizeProductFamily(productName: string, pais: string): "FE" | "NUBE" | "OTRO" {
  const name = (productName || "").trim();
  if (!name) return "OTRO";
  const country = normalizeCountry(pais);

  const feList = FE_PRODUCTS_BY_COUNTRY[country] || [];
  const nubeList = NUBE_PRODUCTS_BY_COUNTRY[country] || [];

  const nameNorm = fixCommonTypos(stripAccents(name));

  // Exact match (accent-insensitive + typo-tolerant)
  if (feList.some((p) => fixCommonTypos(stripAccents(p)) === nameNorm)) return "FE";
  if (nubeList.some((p) => fixCommonTypos(stripAccents(p)) === nameNorm)) return "NUBE";

  // Fuzzy fallback: STARTS WITH or CONTAINS
  if (feList.some((p) => {
    const lp = fixCommonTypos(stripAccents(p));
    return nameNorm.startsWith(lp) || nameNorm.includes(lp);
  })) return "FE";
  if (nubeList.some((p) => {
    const lp = fixCommonTypos(stripAccents(p));
    return nameNorm.startsWith(lp) || nameNorm.includes(lp);
  })) return "NUBE";

  return "OTRO";
}

// ============================================================
// NEW SYNC 3: Ventas Empresarios → ventas_diarias
// ============================================================
async function syncVentasEmpresarios(supabase: any, rows: Record<string, any>[]) {
  let synced = 0;
  const errores: string[] = [];

  const currentYear = new Date().getFullYear();
  const { error: clearVentasError } = await supabase
    .from("ventas_diarias")
    .delete()
    .eq("canal_direccion", "Empresarios")
    .gte("fecha", `${currentYear}-01-01`);
  if (clearVentasError) errores.push(`Limpieza ventas_diarias Empresarios: ${clearVentasError.message}`);

  const { error: clearEjecError } = await supabase
    .from("ejecucion_asesores")
    .delete()
    .eq("canal_direccion", "Empresarios")
    .gte("periodo", `${currentYear}01`);
  if (clearEjecError) errores.push(`Limpieza ejecucion_asesores Empresarios: ${clearEjecError.message}`);

  const registroCounters = new Map<string, number>();
  const upsertRows: any[] = [];
  for (const row of rows) {
    const fecha = row.FECHA ? String(row.FECHA).trim().slice(0, 10) : null;
    const asesor = String(row.ASESOR || "").trim();
    const producto = String(row.Producto || "").trim();
    if (!fecha || !asesor) continue;

    const pais = normalizeCountry(row.pais || row.PAIS || "MEX");
    const familiaCanon = normalizeProductFamily(producto, pais);
    const counterKey = `${fecha}|${asesor}|${familiaCanon}|Empresarios`;
    const registro_idx = registroCounters.get(counterKey) ?? 0;
    registroCounters.set(counterKey, registro_idx + 1);

    upsertRows.push({
      fecha,
      asesor,
      celula: String(row.CELULA || "").trim() || null,
      director: String(row.Director || "").trim() || null,
      equipo: String(row.Equipo || "").trim() || null,
      tipo_producto: familiaCanon,
      producto: producto || null,
      unidades: Math.max(0, toRoundedInt(row.Unidades)),
      acv: toRoundedInt(row.ACV),
      recurrencia: String(row.Recurrencia || "").trim() || null,
      origen: String(row.ORIGEN || "").trim() || null,
      canal_direccion: normalizeCanalDireccion("Empresarios"),
      pais,
      registro_idx,
    });
  }

  synced += await parallelUpsert(
    supabase,
    "ventas_diarias",
    upsertRows,
    { onConflict: "fecha,asesor,tipo_producto,canal_direccion,producto,registro_idx", count: "exact" },
    errores,
    "ventas_diarias empresarios",
  );

  await updateEjecucionFromVentasDiarias(supabase, upsertRows, "Empresarios", errores);
  await aggregateVentasDiariasToKpis(supabase, upsertRows, "VN_EMPRESARIOS", errores);

  return { total_rows: rows.length, ventas_diarias_sincronizadas: synced, filas_preservadas: upsertRows.length, errores: errores.slice(0, 20) };
}

// ============================================================
// NEW SYNC 4: Ventas Aliados → ventas_diarias
// ============================================================
async function syncVentasAliados(supabase: any, rows: Record<string, any>[]) {
  let synced = 0;
  const errores: string[] = [];

  const currentYear = new Date().getFullYear();
  const { error: clearVentasError } = await supabase
    .from("ventas_diarias")
    .delete()
    .eq("canal_direccion", "Aliados")
    .gte("fecha", `${currentYear}-01-01`);
  if (clearVentasError) errores.push(`Limpieza ventas_diarias Aliados: ${clearVentasError.message}`);

  const { error: clearEjecError } = await supabase
    .from("ejecucion_asesores")
    .delete()
    .eq("canal_direccion", "Aliados")
    .gte("periodo", `${currentYear}01`);
  if (clearEjecError) errores.push(`Limpieza ejecucion_asesores Aliados: ${clearEjecError.message}`);

  const registroCounters = new Map<string, number>();
  const upsertRows: any[] = [];
  for (const row of rows) {
    const fecha = row.fecha ? String(row.fecha).trim().slice(0, 10) : null;
    const asesor = String(row.fullname || "").trim();
    if (!fecha || !asesor) continue;

    const familiaRaw = String(row.tipo_producto1 || "").trim().toUpperCase();
    const familiaCanon: "FE" | "NUBE" | "CONTADOR" | "OTRO" =
      familiaRaw === "FE" ? "FE"
      : familiaRaw === "NUBE" ? "NUBE"
      : familiaRaw === "CONTADOR" ? "CONTADOR"
      : "OTRO";
    const counterKey = `${fecha}|${asesor}|${familiaCanon}|Aliados`;
    const registro_idx = registroCounters.get(counterKey) ?? 0;
    registroCounters.set(counterKey, registro_idx + 1);

    // unidades = cuenta_finanzas (Databricks ya trae el conteo real por
    // factura/SKU). Antes asumíamos 1 por fila y eso desfasaba a la baja
    // (ej. Equipo Antioquia: 215 contra 212 reales). Si viene NULL/0 caemos
    // a 1 para no perder la fila.
    const unidadesRaw = Number(row.cuenta_finanzas);
    const unidades = Number.isFinite(unidadesRaw) && unidadesRaw > 0
      ? Math.round(unidadesRaw)
      : 1;

    upsertRows.push({
      fecha,
      asesor,
      celula: String(row.celula || "").trim() || null,
      director: String(row.Director || "").trim() || null,
      equipo: String(row.equipo || "").trim() || null,
      tipo_producto: familiaCanon,
      producto: String(row.tipo_producto1 || "").trim() || null,
      unidades,
      acv: toRoundedInt(row.ACV),
      recurrencia: null,
      origen: String(row.origen || "").trim() || null,
      canal_direccion: normalizeCanalDireccion("Aliados"),
      pais: normalizeCountry(row.pais || "COL"),
      registro_idx,
    });
  }

  synced += await parallelUpsert(
    supabase,
    "ventas_diarias",
    upsertRows,
    { onConflict: "fecha,asesor,tipo_producto,canal_direccion,producto,registro_idx", count: "exact" },
    errores,
    "ventas_diarias aliados",
  );

  await updateEjecucionFromVentasDiarias(supabase, upsertRows, "Aliados", errores);
  await aggregateVentasDiariasToKpis(supabase, upsertRows, "VN_ALIADOS", errores);

  return { total_rows: rows.length, ventas_diarias_sincronizadas: synced, filas_preservadas: upsertRows.length, errores: errores.slice(0, 20) };
}

// ============================================================
// Helper: Update ejecucion_asesores from ventas_diarias rows
// ============================================================
async function updateEjecucionFromVentasDiarias(supabase: any, rows: any[], canalDireccion: string, errores: string[]) {
  // Group by asesor + pais + month → summarize FE, Nube, total.
  // CRITICAL: include pais in the key so MEX/ECU/URU don't collide with COL
  // when the same asesor name (or null doc) repeats across countries.
  const grouped = new Map<string, { ventas_fe: number; ventas_nube: number; ventas_total: number; acv_total: number; documento_asesor: string; periodo: string; pais: string }>();

  for (const row of rows) {
    const fecha = String(row.fecha || "");
    const periodo = fecha.length >= 7 ? fecha.substring(0, 7).replace("-", "") : new Date().toISOString().substring(0, 7).replace("-", "");
    const periodoClean = periodo.replace(/[^0-9]/g, "").substring(0, 6);
    const pais = String(row.pais || "COL").toUpperCase();
    const key = `${row.asesor}|${pais}|${periodoClean}`;
    const cat = String(row.tipo_producto || "").trim().toUpperCase();

    if (!grouped.has(key)) {
      grouped.set(key, { ventas_fe: 0, ventas_nube: 0, ventas_total: 0, acv_total: 0, documento_asesor: row.asesor, periodo: periodoClean, pais });
    }
    const g = grouped.get(key)!;
    const unidades = Math.round(row.unidades || 0);
    g.ventas_total += unidades;
    g.acv_total += Math.round(row.acv || 0);
    if (cat === "FE") g.ventas_fe += unidades;
    if (cat === "NUBE") g.ventas_nube += unidades;
  }

  const ejRows = [...grouped.values()].map((g) => ({
    documento_asesor: g.documento_asesor,
    periodo: g.periodo,
    canal_direccion: canalDireccion,
    pais: g.pais,
    ventas_fe: g.ventas_fe,
    ventas_nube: g.ventas_nube,
    ventas_total: g.ventas_total,
    acv_total: g.acv_total,
  }));

  if (ejRows.length > 0) {
    await parallelUpsert(supabase, "ejecucion_asesores", ejRows, { onConflict: "documento_asesor,canal_direccion,periodo" }, errores, "ejecucion_asesores");
  }
}

// ============================================================
// NEW SYNC 5: Productividad Asesores → productividad_asesores
// ============================================================
async function syncProductividadAsesores(supabase: any, rows: Record<string, any>[]) {
  let synced = 0;
  const errores: string[] = [];

  const upsertRows = rows.map((row) => ({
    anio_mes: String(row.ANIO_MES || "").trim(),
    asesor: String(row.ASESOR || "").trim(),
    pais: normalizeCountry(row.PAIS),
    celula: String(row.CELULA || "").trim() || null,
    area: String(row.AREA || "").trim() || null,
    rango_antiguedad: String(row.RANGO_ANTIGUEDAD_SIIGO || "").trim() || null,
    cant_recomendados: toRoundedInt(row.CANT_RECOMENDADOS),
    ventas_mm_recomendados: toRoundedInt(row.VENTAS_MM_RECOMENDADOS),
    sc_creados: toRoundedInt(row.SC_Creados_MM),
    ventas_mm_sql: toRoundedInt(row.VENTAS_MM_SQL),
    meta: toRoundedInt(row.META),
    ventas: toRoundedInt(row.VENTAS),
    acv_f: normalizeStoredAcvInt(row.ACV_F),
    director: String(row.Director || "").trim() || null,
  })).filter((r) => r.asesor && r.anio_mes);

  // Dedup by (asesor, anio_mes) — sum numeric fields, last non-empty wins for strings
  const prodDedupMap = new Map<string, typeof upsertRows[number]>();
  for (const r of upsertRows) {
    const key = `${r.asesor}|${r.anio_mes}`;
    const existing = prodDedupMap.get(key);
    if (!existing) {
      prodDedupMap.set(key, { ...r });
    } else {
      existing.cant_recomendados = (existing.cant_recomendados || 0) + (r.cant_recomendados || 0);
      existing.ventas_mm_recomendados = (existing.ventas_mm_recomendados || 0) + (r.ventas_mm_recomendados || 0);
      existing.sc_creados = (existing.sc_creados || 0) + (r.sc_creados || 0);
      existing.ventas_mm_sql = (existing.ventas_mm_sql || 0) + (r.ventas_mm_sql || 0);
      existing.meta = (existing.meta || 0) + (r.meta || 0);
      existing.ventas = (existing.ventas || 0) + (r.ventas || 0);
      existing.acv_f = (existing.acv_f || 0) + (r.acv_f || 0);
      existing.celula = existing.celula || r.celula;
      existing.area = existing.area || r.area;
      existing.director = existing.director || r.director;
      existing.rango_antiguedad = existing.rango_antiguedad || r.rango_antiguedad;
    }
  }
  const uniqueProdRows = [...prodDedupMap.values()];
  console.log(`[productividad_asesores] Total: ${upsertRows.length} → únicas: ${uniqueProdRows.length}`);

  synced += await parallelUpsert(supabase, "productividad_asesores", uniqueProdRows, { onConflict: "asesor,anio_mes", count: "exact" }, errores, "productividad_asesores");

  // Also update ejecucion_asesores cant_recomendados and productividad
  // Dedup by (asesor, anio_mes, canal_direccion) before bulk upsert
  const ejMap = new Map<string, any>();
  for (const row of uniqueProdRows) {
    if (row.cant_recomendados > 0 || row.ventas > 0) {
      const productividad = row.meta > 0 ? Math.round((row.ventas / row.meta) * 100) : 0;
      const canal_direccion = normalizeCanalDireccion(row.area || row.celula || "VC");
      const key = `${row.asesor}|${row.anio_mes}|${canal_direccion}`;
      ejMap.set(key, {
        documento_asesor: row.asesor,
        periodo: String(row.anio_mes),
        canal_direccion,
        cant_recomendados: row.cant_recomendados,
        productividad,
      });
    }
  }
  if (ejMap.size > 0) {
    await parallelUpsert(supabase, "ejecucion_asesores", [...ejMap.values()], { onConflict: "documento_asesor,canal_direccion,periodo" }, errores, "ejecucion_asesores prod");
  }

  return { total_rows: rows.length, deduplicadas: uniqueProdRows.length, productividad_sincronizada: synced, errores: errores.slice(0, 20) };
}

// ============================================================
// Helper: Aggregate ventas_diarias into kpis_mensuales for VN gerentes
// Bridges the gap so SP calculation works uniformly
// ============================================================
async function aggregateVentasDiariasToKpis(supabase: any, rows: any[], canal: string, errores: string[]) {
  // Get all gerentes for this canal
  const { data: gerentes } = await supabase
    .from("gerentes")
    .select("id, nombre, canal, pais, celula")
    .eq("canal", canal)
    .eq("activo", true);

  if (!gerentes || gerentes.length === 0) return;

  const gerenteByName = new Map<string, any>();
  for (const g of gerentes) {
    gerenteByName.set(normalizeText(g.nombre), g);
  }

  // Group sales by asesor name + month
  const asesorSales = new Map<string, { ventas: number; acv: number; periodo: string }>();
  for (const row of rows) {
    const asesor = String(row.asesor || "").trim();
    const fecha = String(row.fecha || "");
    const periodo = fecha.length >= 7 ? fecha.substring(0, 7).replace("-", "") : new Date().toISOString().substring(0, 7).replace("-", "");
    const periodoClean = periodo.replace(/[^0-9]/g, "").substring(0, 6);
    if (!asesor) continue;
    const key = `${normalizeText(asesor)}|${periodoClean}`;
    if (!asesorSales.has(key)) asesorSales.set(key, { ventas: 0, acv: 0, periodo: periodoClean });
    const s = asesorSales.get(key)!;
    s.ventas += row.unidades || 0;
    s.acv += row.acv || 0;
  }

  // Match asesor names to gerentes (in VN, "gerentes" ARE the individual sellers)
  const kpiUpdates = new Map<string, any>();
  for (const [key, sales] of asesorSales) {
    const [asesorNorm, periodo] = key.split("|");
    const gerente = gerenteByName.get(asesorNorm);
    if (!gerente) continue;

    const kpiKey = `${gerente.id}|${periodo}`;
    if (!kpiUpdates.has(kpiKey)) {
      kpiUpdates.set(kpiKey, { gerente_id: gerente.id, anio_mes: periodo, canal, ventas: 0, acv_f: 0, meta: 0, moneda: "COP" });
    }
    const kpi = kpiUpdates.get(kpiKey)!;
      kpi.ventas += Math.round(sales.ventas);
      kpi.acv_f += Math.round(sales.acv);
  }

  // Try to fill meta from metas_gerentes
  const canalNorm = canal === "VN_ALIADOS" ? "Aliados" : "Empresarios";
  const { data: metasGerentes } = await supabase
    .from("metas_gerentes")
    .select("celula, canal_direccion, meta_total_und, meta_total_acv")
    .eq("canal_direccion", canalNorm);

  const metaByCelula = new Map<string, any>();
  for (const m of (metasGerentes || [])) {
    metaByCelula.set(normalizeText(m.celula), m);
  }

  for (const [, kpi] of kpiUpdates) {
    const gerente = gerentes.find((g: any) => g.id === kpi.gerente_id);
    if (gerente) {
      // Cross by celula (correct), with fallback to name for legacy cases
      const meta = (gerente.celula && metaByCelula.get(normalizeText(gerente.celula)))
        || metaByCelula.get(normalizeText(gerente.nombre));
      if (meta) kpi.meta = Math.round(meta.meta_total_acv || meta.meta_total_und || 0);
    }
  }

  // Upsert to kpis_mensuales
  const kpiRows = [...kpiUpdates.values()];
  if (kpiRows.length > 0) {
    await parallelUpsert(supabase, "kpis_mensuales", kpiRows, { onConflict: "gerente_id,anio_mes" }, errores, "kpis_mensuales VN");
  }
}

// ============================================================
// Ventas VN Completo (composite: Aliados + Empresarios → ventas table)
// ============================================================
async function runVentasVnCompleto({ supabase, supabaseUrl, serviceRoleKey, mesFilter, mode }: { supabase: any; supabaseUrl: string; serviceRoleKey: string; mesFilter?: string; mode: string }) {
  const limitClause = mode === "preview" ? "LIMIT 10" : "";

  const [aliRows, empRows] = await Promise.all([
    runDatabricksQuery("ventas_aliados", TABLE_CONFIGS.ventas_aliados.sql(limitClause, mesFilter)),
    runDatabricksQuery("ventas_empresarios", TABLE_CONFIGS.ventas_empresarios.sql(limitClause, mesFilter)),
  ]);

  if (mode === "preview") {
    return {
      table: "Ventas VN Completo (Aliados + Empresarios → ventas)",
      ventas_vn_aliados: { total_rows: aliRows.length, sample: aliRows.slice(0, 3) },
      ventas_vn_empresarios: { total_rows: empRows.length, sample: empRows.slice(0, 3) },
    };
  }

  const [aliResult, empResult] = await Promise.all([
    syncVentasVN(supabase, aliRows, "VN_ALIADOS"),
    syncVentasVN(supabase, empRows, "VN_EMPRESARIOS"),
  ]);

  // SP recalculation decoupled — admin triggers it manually from /admin/calculos.
  return { ventas_vn_aliados: aliResult, ventas_vn_empresarios: empResult };
}

// ============================================================
// SYNC: Ventas VN → ventas table (individual transactions)
// ============================================================
async function syncVentasVN(supabase: any, rows: Record<string, any>[], canal: "VN_ALIADOS" | "VN_EMPRESARIOS") {
  let insertedVentas = 0;
  const errores: string[] = [];

  const MONTH_NAMES: Record<number, string> = {
    1:"Enero",2:"Febrero",3:"Marzo",4:"Abril",5:"Mayo",6:"Junio",
    7:"Julio",8:"Agosto",9:"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre"
  };

  // Build gerente map
  const { data: gerentes } = await supabase
    .from("gerentes")
    .select("id, nombre, email, canal, pais, celula")
    .in("canal", ["VN_ALIADOS", "VN_EMPRESARIOS"]);

  const gerenteMap = new Map<string, any>();
  const gerentesByCelula = new Map<string, any[]>();
  (gerentes || []).forEach((g: any) => {
    if (g.nombre) gerenteMap.set(normalizeText(g.nombre), g);
    if (g.celula) {
      const key = normalizeText(g.celula);
      const current = gerentesByCelula.get(key) || [];
      current.push(g);
      gerentesByCelula.set(key, current);
    }
  });

  const { data: metasGerentes } = await supabase
    .from("metas_gerentes")
    .select("celula, director, canal_direccion")
    .eq("canal_direccion", canal === "VN_ALIADOS" ? "Aliados" : "Empresarios");

  const directorByCelula = new Map<string, string>();
  (metasGerentes || []).forEach((row: any) => {
    const celula = normalizeText(row.celula);
    const director = normalizeText(row.director);
    if (celula && director && !directorByCelula.has(celula)) {
      directorByCelula.set(celula, director);
    }
  });

  const advisorUpdates = new Map<string, { id: string; celula: string }>();
  for (const row of rows) {
    const advisorName = normalizeText(String(row.comercial || row.ASESOR || row.fullname || ""));
    const celula = String(row.celula || row.CELULA || "").trim();
    if (!advisorName || !celula) continue;
    const gerente = gerenteMap.get(advisorName);
    if (gerente && !gerente.celula) {
      advisorUpdates.set(gerente.id, { id: gerente.id, celula });
      gerente.celula = celula;
    }
  }

  if (advisorUpdates.size > 0) {
    await parallelUpsert(supabase, "gerentes", [...advisorUpdates.values()], { onConflict: "id", count: "exact" }, errores, "gerentes celula ventas_vn");
  }

  // Auto-create missing gerentes from lider/director data (only if we cannot match by celula either)
  const missingGerentes = new Map<string, any>();
  for (const row of rows) {
    const liderName = String(row.Director || row.lider || "").trim();
    const celula = String(row.celula || row.CELULA || "").trim();
    if (!liderName) continue;
    if (gerenteMap.get(normalizeText(liderName))) continue;
    if (celula && (directorByCelula.get(normalizeText(celula)) || (gerentesByCelula.get(normalizeText(celula)) || []).length > 0)) continue;

    const email = buildEmailFromName(liderName);
    if (!missingGerentes.has(email)) {
      const equipo = String(row.equipo || row.Equipo || "").toLowerCase();
      const inferredCanal = equipo.includes("aliado") ? "VN_ALIADOS" : canal;
      const pais = normalizeCountry(row.pais || row.PAIS || "COL");
      missingGerentes.set(email, { nombre: liderName, email, canal: inferredCanal, pais, celula: celula || null, activo: true });
    }
  }

  if (missingGerentes.size > 0) {
    const { data: created } = await supabase
      .from("gerentes")
      .upsert([...missingGerentes.values()], { onConflict: "email" })
      .select("id, nombre, email, canal, pais, celula");
    (created || []).forEach((g: any) => {
      if (g.nombre) gerenteMap.set(normalizeText(g.nombre), g);
      if (g.celula) {
        const key = normalizeText(g.celula);
        const current = gerentesByCelula.get(key) || [];
        current.push(g);
        gerentesByCelula.set(key, current);
      }
    });
  }

  // Build venta rows — resolve the team leader from metas_gerentes by celula first.
  const ventaRows: any[] = [];
  const noMatchByCelula = new Set<string>();
  for (const row of rows) {
    const liderName = normalizeText(String(row.Director || row.lider || ""));
    const celula = normalizeText(String(row.celula || row.CELULA || ""));
    const directorName = celula ? directorByCelula.get(celula) : null;
    let gerente = directorName ? gerenteMap.get(directorName) : null;
    if (!gerente) gerente = gerenteMap.get(liderName);
    if (!gerente && celula) {
      const candidates = (gerentesByCelula.get(celula) || []).filter((candidate: any) => normalizeText(candidate.nombre) === liderName);
      if (candidates.length === 1) gerente = candidates[0];
    }
    if (!gerente) {
      const key = `${row.Director || row.lider || "?"} | celula=${row.celula || row.CELULA || "?"}`;
      noMatchByCelula.add(key);
      if (errores.length < 20) errores.push(`Gerente no encontrado: ${key}`);
      continue;
    }

    const fechaStr = row.fecha || row.FECHA || row.fecha_facturacion;
    if (!fechaStr) continue;

    const fecha = new Date(String(fechaStr));
    if (isNaN(fecha.getTime())) continue;
    const mes = MONTH_NAMES[fecha.getMonth() + 1] || "";
    const anio = fecha.getFullYear();
    const producto = String(row.producto || row.Producto || row.tipo_producto1 || "").trim();
    const pais = normalizeCountry(row.pais || row.PAIS || gerente.pais || "COL");
    const tipoProductoRaw = String(row.tipo_producto || row.TIPO_PRODUCTO || row.tipo_producto1 || "").trim();
    const tipoProductoUpper = tipoProductoRaw.toUpperCase();
    const tipoProducto = canal === "VN_ALIADOS"
      ? (tipoProductoUpper === "FE" || tipoProductoUpper === "NUBE" || tipoProductoUpper === "CONTADOR" ? tipoProductoUpper : "OTRO")
      : normalizeProductFamily(producto, pais);
    const acv = normalizeStoredAcvInt(row.acv || row.ACV);
    const unidades = toRoundedInt(row.unidades, row.Unidades, row.cuenta_finanzas, row.Cuenta_comercial);
    const comercial = String(row.comercial || row.ASESOR || row.fullname || "").trim();
    const origenVal = String(row.origen || row.ORIGEN || "").trim();
    const equipo = String(row.equipo || row.Equipo || "").trim();
    const recurrencia = String(row.Recurrencia || row.recurrencia || "").trim();

    // Determine canal from equipo
    const rowCanal = equipo.toLowerCase().includes("aliado") ? "VN_ALIADOS" : canal;

    // Create unique documento_factura with VN- prefix
    const fechaKey = fecha.toISOString().split("T")[0];
    const docKey = `VN-${rowCanal}-${fechaKey}-${buildStableHash(
      celula,
      comercial,
      producto,
      tipoProducto,
      acv,
      unidades,
      origenVal,
      recurrencia,
      row.Director || row.lider || ""
    )}`;

    ventaRows.push({
      gerente_id: gerente.id,
      canal: rowCanal,
      fecha_facturacion: fechaKey,
      mes,
      anio,
      bloque_venta: tipoProducto,
      categoria_producto_venta: tipoProducto,
      producto: producto || tipoProducto || "Sin categoría",
      documento_factura: docKey,
      acv_plus: acv,
      valor_producto: acv,
      meta: 0,
      comercial,
      lider: String(row.Director || row.lider || ""),
      pais,
      sc_creados_ind: unidades,
      origen: origenVal || null,
      recurrencia: recurrencia || null,
    });
  }

  // Deduplicate by documento_factura+producto+fecha
  const deduped = new Map<string, any>();
  for (const row of ventaRows) {
    const key = `${row.documento_factura}|${row.producto}|${row.fecha_facturacion}`;
    if (!deduped.has(key)) deduped.set(key, { ...row });
    else {
      const ex = deduped.get(key)!;
      ex.acv_plus += row.acv_plus;
      ex.valor_producto += row.valor_producto;
      ex.sc_creados_ind += row.sc_creados_ind;
    }
  }
  const uniqueRows = [...deduped.values()];

  insertedVentas += await parallelUpsert(supabase, "ventas", uniqueRows, { onConflict: "documento_factura,producto,fecha_facturacion", count: "exact" }, errores, "ventas VN");

  return { total_rows: rows.length, ventas_sincronizadas: insertedVentas, deduplicadas: uniqueRows.length, errores: errores.slice(0, 20) };
}

// ============================================================
// NEW SYNC: Ventas Gerente Mensual (FE/NUBE/CONTADOR por gerente)
// Fuente: tbl_gld_Ventas_SA + tbl_brz_cuotas_asesores (celula→gerente)
// Esta es la fuente de verdad para el desempeño de gerentes VN.
// ============================================================
async function syncVentasGerenteMensual(supabase: any, rows: Record<string, any>[]) {
  const errores: string[] = [];
  const currentYear = new Date().getFullYear();

  // 1) Limpieza del año en curso
  const { error: clearErr } = await supabase
    .from("ventas_gerente_mensual")
    .delete()
    .gte("anio", currentYear);
  if (clearErr) errores.push(`Limpieza ventas_gerente_mensual: ${clearErr.message}`);

  // 2) Mapear filas Databricks → registros tabla
  const upsertRows: any[] = [];
  for (const row of rows) {
    const gerente = String(row.gerente || "").trim();
    if (!gerente) continue;

    const mesNro = Number(row.mes_nro);
    if (!Number.isFinite(mesNro) || mesNro < 1 || mesNro > 12) continue;

    const familiaRaw = String(row.tipo_producto1 || "").trim().toUpperCase();
    const familia: "FE" | "NUBE" | "CONTADOR" | "OTRO" =
      familiaRaw === "FE" ? "FE"
      : familiaRaw === "NUBE" ? "NUBE"
      : familiaRaw === "CONTADOR" ? "CONTADOR"
      : "OTRO";

    const pais = normalizeCountry(row.pais || "COL");
    const anio = currentYear;
    const periodo = `${anio}${String(mesNro).padStart(2, "0")}`;
    const unidadesRaw = Number(row.ventas);
    const unidades = Number.isFinite(unidadesRaw) ? Math.round(unidadesRaw) : 0;
    const acvRaw = Number(row.acv_total);
    const acv = Number.isFinite(acvRaw) ? acvRaw : 0;

    // Inferir canal_direccion: tbl_gld_Ventas_SA es Aliados; las celulas de
    // Empresarios viven en tbl_gld_Ventas_MX. Si en el futuro se unifica,
    // se puede determinar por celula. Por ahora todas las filas son Aliados.
    const canalDireccion = "Aliados";
    const gerenteNorm = normalizeText(gerente);

    upsertRows.push({
      pais,
      anio,
      mes: mesNro,
      periodo,
      canal_direccion: canalDireccion,
      gerente,
      gerente_normalizado: gerenteNorm,
      celula: String(row.celula || "").trim() || null,
      familia,
      unidades,
      acv,
      updated_at: new Date().toISOString(),
    });
  }

  // 3) Agregar duplicados por (pais, periodo, canal, gerente_norm, familia)
  //    porque pueden venir múltiples celulas mapeadas al mismo gerente.
  const grouped = new Map<string, any>();
  for (const r of upsertRows) {
    const key = `${r.pais}|${r.periodo}|${r.canal_direccion}|${r.gerente_normalizado}|${r.familia}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.unidades += r.unidades;
      existing.acv += r.acv;
      // Mantén la primera celula encontrada como referencia
    } else {
      grouped.set(key, { ...r });
    }
  }
  const finalRows = [...grouped.values()];

  const synced = await parallelUpsert(
    supabase,
    "ventas_gerente_mensual",
    finalRows,
    { onConflict: "pais,periodo,canal_direccion,gerente_normalizado,familia", count: "exact" },
    errores,
    "ventas_gerente_mensual",
  );

  return {
    total_rows: rows.length,
    registros_sincronizados: synced,
    filas_finales: finalRows.length,
    errores: errores.slice(0, 20),
  };
}

// ============================================================
// COMBO SYNCS — descargan UNA sola vez de Databricks y procesan ambos destinos
// (ventas_diarias + ejecucion_asesores + kpis_mensuales) y (ventas tabla VC unificada).
// Antes ejecutábamos la misma query 2 veces por canal — esto reduce ~50% el tiempo.
// ============================================================
async function runVentasEmpresariosCombo({ supabase, mesFilter }: { supabase: any; mesFilter?: string }) {
  const config = TABLE_CONFIGS.ventas_empresarios;
  const rows = await runDatabricksQuery("ventas_empresarios_combo", config.sql("", mesFilter));
  console.log(`[ventas_empresarios_combo] Databricks returned ${rows.length} rows — procesando ambos destinos`);

  const [empresariosResult, vnResult] = await Promise.allSettled([
    syncVentasEmpresarios(supabase, rows),
    syncVentasVN(supabase, rows, "VN_EMPRESARIOS"),
  ]);

  return {
    total_rows: rows.length,
    ventas_diarias: empresariosResult.status === "fulfilled" ? empresariosResult.value : { error: String(empresariosResult.reason) },
    ventas_vn: vnResult.status === "fulfilled" ? vnResult.value : { error: String(vnResult.reason) },
  };
}

async function runVentasAliadosCombo({ supabase, mesFilter }: { supabase: any; mesFilter?: string }) {
  const config = TABLE_CONFIGS.ventas_aliados;
  const rows = await runDatabricksQuery("ventas_aliados_combo", config.sql("", mesFilter));
  console.log(`[ventas_aliados_combo] Databricks returned ${rows.length} rows — procesando ambos destinos`);

  const [aliadosResult, vnResult] = await Promise.allSettled([
    syncVentasAliados(supabase, rows),
    syncVentasVN(supabase, rows, "VN_ALIADOS"),
  ]);

  return {
    total_rows: rows.length,
    ventas_diarias: aliadosResult.status === "fulfilled" ? aliadosResult.value : { error: String(aliadosResult.reason) },
    ventas_vn: vnResult.status === "fulfilled" ? vnResult.value : { error: String(vnResult.reason) },
  };
}
