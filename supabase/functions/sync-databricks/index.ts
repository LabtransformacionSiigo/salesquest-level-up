import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPANISH_MONTHS: Record<string, string> = {
  "Enero": "01", "Febrero": "02", "Marzo": "03", "Abril": "04",
  "Mayo": "05", "Junio": "06", "Julio": "07", "Agosto": "08",
  "Septiembre": "09", "Octubre": "10", "Noviembre": "11", "Diciembre": "12",
};

// Table configurations
const TABLE_CONFIGS: Record<string, { sql: (limit: string, mesFilter?: string) => string; label: string }> = {
  productividad: {
    label: "Productividad Progresiva",
    sql: (limit: string) => `SELECT * FROM analyticdl.db_comercial.tbl_slv_Productividad_Progresiva WHERE ANIO_MES >= 202601 AND ANIO_MES <= 202612 ${limit}`,
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
    SELECT 
        comercial, lider, Anio, mes,
        SUM(CAST(ACV_PLUS AS BIGINT)) AS total_logrado_mes
    FROM analyticdl.db_comercial.tbl_gld_Ventas_VC
    ${ventasWhere}
    GROUP BY comercial, lider, Anio, mes
),
metas_mensuales AS (
    SELECT 
        Comercial, Lider AS Lider_Meta, \`Año_Meta\`, Mes_meta,
        SUM(meta_todo) AS meta_del_mes
    FROM analyticdl.db_servicios.tbl_slv_metas_venta_cruzada
    ${metasWhere}
    GROUP BY Comercial, Lider, \`Año_Meta\`, Mes_meta
)
SELECT 
    m.Comercial AS Asesor,
    m.Lider_Meta AS Lider,
    m.\`Año_Meta\` AS Anio,
    m.Mes_meta AS Mes,
    m.meta_del_mes AS Meta_Objetivo,
    COALESCE(v.total_logrado_mes, 0) AS Saldo_ACV_Actual
FROM metas_mensuales m
LEFT JOIN ventas_mensuales v 
    ON LOWER(m.Comercial) = LOWER(v.comercial) 
    AND m.Mes_meta = v.mes
${limit}
`;
    },
  },
  ventas_vc_producto: {
    label: "Ventas VC Desglose por Producto",
    sql: (limit: string, mesFilter?: string) => {
      const ventasWhere = mesFilter
        ? `WHERE Anio = 2026 AND categoria_producto_Venta NOT IN ('Ecuador', 'Uruguay') AND mes = '${mesFilter}'`
        : `WHERE Anio = 2026 AND categoria_producto_Venta NOT IN ('Ecuador', 'Uruguay')`;
      return `
SELECT 
    comercial AS Asesor,
    lider AS Lider,
    Anio,
    mes AS Mes,
    categoria_producto_Venta AS Producto,
    bloque_venta AS Bloque,
    SUM(CAST(ACV_PLUS AS BIGINT)) AS ACV_Producto,
    COUNT(*) AS Unidades
FROM analyticdl.db_comercial.tbl_gld_Ventas_VC
${ventasWhere}
GROUP BY comercial, lider, Anio, mes, categoria_producto_Venta, bloque_venta
${limit}
`;
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;
    let authUserId: string | null = null;

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authUser }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !authUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authUserId = authUser.id;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Solo admins pueden sincronizar" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "preview";
    const table = body.table || "productividad";
    const mesFilter = body.mes || undefined;
    const jobId = body.jobId || undefined;

    if (mode === "sync" && !jobId) {
      const { data: job, error: jobError } = await supabase
        .from("sync_jobs")
        .insert({
          table_name: table,
          mode,
          status: "pending",
          requested_by: authUserId,
          started_at: new Date().toISOString(),
        })
        .select("id, table_name, status, created_at")
        .single();

      if (jobError || !job) {
        return new Response(JSON.stringify({ error: jobError?.message || "No se pudo crear el trabajo" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      EdgeRuntime.waitUntil(processSyncJob({
        supabaseUrl,
        serviceRoleKey,
        table,
        mesFilter,
        jobId: job.id,
      }));

      return new Response(JSON.stringify({
        queued: true,
        job,
        message: "Sincronización iniciada en segundo plano",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "job_status") {
      if (!jobId) {
        return new Response(JSON.stringify({ error: "jobId es requerido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: job, error: jobError } = await supabase
        .from("sync_jobs")
        .select("id, table_name, mode, status, requested_by, started_at, finished_at, result, error_message, created_at")
        .eq("id", jobId)
        .maybeSingle();

      if (jobError) {
        return new Response(JSON.stringify({ error: jobError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!job) {
        return new Response(JSON.stringify({ error: "Trabajo no encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(job), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (table === "ventas_vc_completo") {
      const result = await runVentasVcCompleto({ supabase, supabaseUrl, serviceRoleKey, mesFilter, mode });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await runSingleTableSync({ supabase, supabaseUrl, serviceRoleKey, table, mesFilter, mode });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-databricks error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processSyncJob({
  supabaseUrl,
  serviceRoleKey,
  table,
  mesFilter,
  jobId,
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  table: string;
  mesFilter?: string;
  jobId: string;
}) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    await supabase
      .from("sync_jobs")
      .update({ status: "running", started_at: new Date().toISOString(), error_message: null })
      .eq("id", jobId);

    const result = table === "ventas_vc_completo"
      ? await runVentasVcCompleto({ supabase, supabaseUrl, serviceRoleKey, mesFilter, mode: "sync" })
      : await runSingleTableSync({ supabase, supabaseUrl, serviceRoleKey, table, mesFilter, mode: "sync" });

    await supabase
      .from("sync_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        result,
        error_message: null,
      })
      .eq("id", jobId);
  } catch (error) {
    console.error("processSyncJob error:", error);
    await supabase
      .from("sync_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: String(error),
      })
      .eq("id", jobId);
  }
}

async function runVentasVcCompleto({
  supabase,
  supabaseUrl,
  serviceRoleKey,
  mesFilter,
  mode,
}: {
  supabase: any;
  supabaseUrl: string;
  serviceRoleKey: string;
  mesFilter?: string;
  mode: string;
}) {
  const DATABRICKS_HOST = Deno.env.get("DATABRICKS_HOST");
  const DATABRICKS_TOKEN = Deno.env.get("DATABRICKS_TOKEN");
  const DATABRICKS_WAREHOUSE_ID = Deno.env.get("DATABRICKS_WAREHOUSE_ID");

  if (!DATABRICKS_HOST || !DATABRICKS_TOKEN || !DATABRICKS_WAREHOUSE_ID) {
    throw new Error("Faltan credenciales de Databricks.");
  }

  const databricksUrl = `${DATABRICKS_HOST.replace(/\/+$/, '')}/api/2.0/sql/statements`;
  const limitClause = mode === "preview" ? "LIMIT 10" : "";

  const runQuery = async (queryName: string, sql: string) => {
    console.log(`[${queryName}] Querying Databricks:`, sql.trim());
    const resp = await fetch(databricksUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ warehouse_id: DATABRICKS_WAREHOUSE_ID, statement: sql, wait_timeout: "50s", disposition: "INLINE", format: "JSON_ARRAY" }),
    });
    let data = await resp.json();
    if (!resp.ok && !data.statement_id) throw new Error(data.status?.error?.message || data.message || JSON.stringify(data));

    let polls = 0;
    while ((data.status?.state === "PENDING" || data.status?.state === "RUNNING") && polls < 24) {
      polls++;
      await new Promise((r) => setTimeout(r, 5000));
      const pr = await fetch(`${databricksUrl}/${data.statement_id}`, { headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}` } });
      data = await pr.json();
      console.log(`[${queryName}] Poll #${polls}: state=${data.status?.state}`);
    }
    if (data.status?.state === "FAILED") throw new Error(data.status?.error?.message || "Query failed");
    if (data.status?.state === "PENDING" || data.status?.state === "RUNNING") throw new Error("Query timeout after 2 min");

    const cols = (data.manifest?.schema?.columns || []).map((c: any) => c.name);
    return (data.result?.data_array || []).map((row: any[]) => {
      const obj: Record<string, any> = {};
      cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
      return obj;
    });
  };

  const [vcRows, prodRows] = await Promise.all([
    runQuery("ventas_vc", TABLE_CONFIGS.ventas_vc.sql(limitClause, mesFilter)),
    runQuery("ventas_vc_producto", TABLE_CONFIGS.ventas_vc_producto.sql(limitClause, mesFilter)),
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

  const spResult = await triggerSpRecalculation(supabaseUrl, serviceRoleKey, "ventas_vc_completo");

  return {
    ventas_vc: vcResult,
    ventas_vc_producto: prodResult,
    sp_recalculo: spResult,
  };
}

async function runSingleTableSync({
  supabase,
  supabaseUrl,
  serviceRoleKey,
  table,
  mesFilter,
  mode,
}: {
  supabase: any;
  supabaseUrl: string;
  serviceRoleKey: string;
  table: string;
  mesFilter?: string;
  mode: string;
}) {
  const tableConfig = TABLE_CONFIGS[table];
  if (!tableConfig) {
    throw new Error(`Tabla no soportada: ${table}. Opciones: ${Object.keys(TABLE_CONFIGS).join(", ")}, ventas_vc_completo`);
  }

  const DATABRICKS_HOST = Deno.env.get("DATABRICKS_HOST");
  const DATABRICKS_TOKEN = Deno.env.get("DATABRICKS_TOKEN");
  const DATABRICKS_WAREHOUSE_ID = Deno.env.get("DATABRICKS_WAREHOUSE_ID");

  if (!DATABRICKS_HOST || !DATABRICKS_TOKEN || !DATABRICKS_WAREHOUSE_ID) {
    throw new Error("Faltan credenciales de Databricks.");
  }

  const databricksUrl = `${DATABRICKS_HOST.replace(/\/+$/, '')}/api/2.0/sql/statements`;
  const limitClause = mode === "preview" ? "LIMIT 10" : "";
  const sql = tableConfig.sql(limitClause, mesFilter);

  console.log(`[${table}] Querying Databricks:`, sql.trim());

  const dbResponse = await fetch(databricksUrl, {
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

  let dbData = await dbResponse.json();

  if (!dbResponse.ok && !dbData.statement_id) {
    throw new Error(dbData.status?.error?.message || dbData.message || JSON.stringify(dbData));
  }

  const statementId = dbData.statement_id;
  let pollAttempts = 0;
  const MAX_POLLS = 24;
  while ((dbData.status?.state === "PENDING" || dbData.status?.state === "RUNNING") && pollAttempts < MAX_POLLS) {
    pollAttempts++;
    await new Promise((r) => setTimeout(r, 5000));
    const pollResp = await fetch(`${databricksUrl}/${statementId}`, {
      headers: { Authorization: `Bearer ${DATABRICKS_TOKEN}` },
    });
    dbData = await pollResp.json();
    console.log(`[${table}] Poll #${pollAttempts}: state=${dbData.status?.state}`);
  }

  if (dbData.status?.state === "FAILED") {
    throw new Error(dbData.status?.error?.message || JSON.stringify(dbData));
  }

  if (dbData.status?.state === "PENDING" || dbData.status?.state === "RUNNING") {
    return { status: "pending", statement_id: dbData.statement_id, message: "Query aún en ejecución tras 2 min de espera. Intente de nuevo." };
  }

  const columns = dbData.manifest?.schema?.columns || [];
  const columnNames = columns.map((c: any) => c.name);
  const dataChunks = dbData.result?.data_array || [];
  const rows = dataChunks.map((row: any[]) => {
    const obj: Record<string, any> = {};
    columnNames.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });

  console.log(`[${table}] Databricks returned ${rows.length} rows, columns: ${columnNames.join(", ")}`);

  if (mode === "preview") {
    return {
      table: tableConfig.label,
      columns: columnNames,
      total_rows: rows.length,
      sample: rows.slice(0, 5),
    };
  }

  const syncResult = table === "ventas_vc"
    ? await syncVentasVC(supabase, rows)
    : table === "ventas_vc_producto"
      ? await syncVentasVCProducto(supabase, rows)
      : await syncProductividad(supabase, rows);

  const spResult = await triggerSpRecalculation(supabaseUrl, serviceRoleKey, table);

  return { ...syncResult, sp_recalculo: spResult };
}

async function triggerSpRecalculation(supabaseUrl: string, serviceRoleKey: string, context: string) {
  try {
    const spUrl = `${supabaseUrl}/functions/v1/calcular-sp-semanal`;
    const spResponse = await fetch(spUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    const spResult = await spResponse.json();
    console.log(`[${context}] SP recalculation triggered:`, JSON.stringify(spResult));
    return spResult;
  } catch (spErr) {
    console.error(`[${context}] SP recalculation error:`, spErr);
    return { error: String(spErr) };
  }
}

// Sync Productividad Progresiva → kpis_mensuales
async function syncProductividad(supabase: any, rows: Record<string, any>[]) {
  let insertedKpis = 0;
  let createdGerentes = 0;
  const errores: string[] = [];

  const normalizeText = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9@.\s_-]/g, "")
      .replace(/\s+/g, " ");

  const buildEmailFromName = (name: string) => {
    const slug = normalizeText(name)
      .replace(/[@]/g, "")
      .replace(/[._-]+/g, " ")
      .trim()
      .replace(/\s+/g, ".");
    return `${slug || "sin.nombre"}@siigo.com`;
  };

  const inferCanal = (row: Record<string, any>) => {
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

  const gerenteMap = new Map<string, any>();
  const registerGerente = (gerente: any) => {
    const normalizedName = normalizeText(gerente?.nombre);
    const normalizedEmail = normalizeText(gerente?.email);
    if (normalizedName) gerenteMap.set(normalizedName, gerente);
    if (normalizedEmail) gerenteMap.set(normalizedEmail, gerente);
  };

  const { data: gerentes } = await supabase.from("gerentes").select("id, nombre, email, canal, pais, lider");
  (gerentes || []).forEach(registerGerente);

  const missingGerentes = new Map<string, any>();
  for (const row of rows) {
    const asesorNombre = String(row.ASESOR || row.GERENTE || row.NOMBRE_GERENTE || "").trim();
    const asesorEmail = String(row.EMAIL || row.CORREO || "").trim().toLowerCase();
    const lookupKey = normalizeText(asesorEmail || asesorNombre);

    if (!lookupKey) {
      if (errores.length < 20) errores.push(`Fila sin asesor identificable: ${JSON.stringify(row).slice(0, 120)}`);
      continue;
    }

    if (!gerenteMap.get(lookupKey)) {
      const nombre = asesorNombre || asesorEmail.split("@")[0].replace(/\./g, " ").trim();
      const email = asesorEmail || buildEmailFromName(nombre);
      const key = normalizeText(email);

      if (!missingGerentes.has(key)) {
        missingGerentes.set(key, {
          nombre,
          email,
          canal: inferCanal(row),
          pais: "COL",
          lider: String(row.Director || row.DIRECTOR || "").trim() || null,
          activo: true,
        });
      }
    }
  }

  if (missingGerentes.size > 0) {
    const { data: created, error: batchErr } = await supabase
      .from("gerentes")
      .upsert([...missingGerentes.values()], { onConflict: "email" })
      .select("id, nombre, email, canal, pais, lider");

    if (batchErr) {
      errores.push(`Error creando participantes de productividad: ${batchErr.message}`);
    } else {
      createdGerentes = created?.length || 0;
      (created || []).forEach(registerGerente);
    }
  }

  const kpiRows = new Map<string, any>();

  for (const row of rows) {
    try {
      const asesorNombre = String(row.ASESOR || row.GERENTE || row.NOMBRE_GERENTE || "").trim();
      const asesorEmail = String(row.EMAIL || row.CORREO || "").trim().toLowerCase();
      const gerente =
        gerenteMap.get(normalizeText(asesorEmail)) ||
        gerenteMap.get(normalizeText(asesorNombre)) ||
        gerenteMap.get(normalizeText(buildEmailFromName(asesorNombre)));

      if (!gerente) {
        if (errores.length < 20) errores.push(`Gerente no encontrado: ${JSON.stringify(row).slice(0, 120)}`);
        continue;
      }

      const anioMes = String(row.ANIO_MES || row.anio_mes || "").trim();
      if (!anioMes) continue;

      const kpiRow = {
        gerente_id: gerente.id,
        anio_mes: anioMes,
        canal: gerente.canal || inferCanal(row),
        moneda: "COP",
        ventas: toNumber(row.VENTAS, row.ventas, row.VENTA_TOTAL),
        meta: toNumber(row.META, row.meta),
        acv_f: toNumber(row.ACV_F, row.acv_f),
        cant_recomendados: toNumber(row.CANT_RECOMENDADOS, row.cant_recomendados),
        ventas_recomendados: toNumber(row.VENTAS_MM_RECOMENDADOS, row.VENTAS_RECOMENDADOS, row.ventas_recomendados),
        sa_creados: toNumber(row.SA_Creados_MM, row.SA_CREADOS, row.sa_creados),
        sc_creados: toNumber(row.SC_Creados_MM, row.SC_CREADOS, row.sc_creados),
        ventas_sql: toNumber(row.VENTAS_MM_SQL, row.VENTAS_SQL, row.ventas_sql),
        hc_final: toNumber(row.HC_final, row.HC_FINAL, row.hc_final),
        hc_inicial: toNumber(row.HC_inicial, row.HC_INICIAL, row.hc_inicial),
        terminaciones: toNumber(row.terminaciones, row.TERMINACIONES),
      };

      kpiRows.set(`${gerente.id}|${anioMes}`, kpiRow);
    } catch (err) {
      if (errores.length < 20) errores.push(`Row error: ${String(err)}`);
    }
  }

  const uniqueKpiRows = [...kpiRows.values()];
  const BATCH = 500;
  for (let i = 0; i < uniqueKpiRows.length; i += BATCH) {
    const chunk = uniqueKpiRows.slice(i, i + BATCH);
    const { error, count } = await supabase.from("kpis_mensuales").upsert(chunk, {
      onConflict: "gerente_id,anio_mes",
      count: "exact",
    });

    if (error) errores.push(`KPI batch ${i}-${i + chunk.length}: ${error.message}`);
    else insertedKpis += count || chunk.length;
  }

  return {
    total_rows: rows.length,
    participantes_creados: createdGerentes,
    kpis_sincronizados: insertedKpis,
    filas_unicas: uniqueKpiRows.length,
    errores: errores.slice(0, 20),
  };
}

// Sync Ventas VC → ventas table (monthly summaries with metas)
async function syncVentasVC(supabase: any, rows: Record<string, any>[]) {
  let insertedVentas = 0;
  const errores: string[] = [];

  const { data: gerentes } = await supabase.from("gerentes").select("id, nombre, email, canal");
  const gerenteMap = new Map<string, any>();
  (gerentes || []).forEach((g: any) => {
    gerenteMap.set(g.nombre?.toLowerCase()?.trim(), g);
  });

  // Auto-create gerentes from lider column
  const liderNames = new Set<string>();
  for (const row of rows) {
    const lider = (row.Lider || "").trim();
    if (lider && !gerenteMap.get(lider.toLowerCase())) liderNames.add(lider);
  }

  if (liderNames.size > 0) {
    const newGerentes = [...liderNames].map(name => ({
      nombre: name,
      email: name.toLowerCase().replace(/\s+/g, '.').normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "@siigo.com",
      canal: "VC", pais: "COL", activo: true,
    }));
    const { data: created, error: batchErr } = await supabase.from("gerentes").upsert(newGerentes, { onConflict: "email" }).select("id, nombre, email, canal");
    if (batchErr) errores.push(`Error creando gerentes: ${batchErr.message}`);
    (created || []).forEach((g: any) => gerenteMap.set(g.nombre?.toLowerCase()?.trim(), g));
  }

  // Build venta rows from monthly summary data
  const ventaRows: any[] = [];
  for (const row of rows) {
    const liderName = (row.Lider || "").toLowerCase().trim();
    const gerente = gerenteMap.get(liderName);
    if (!gerente) {
      if (errores.length < 20) errores.push(`Gerente no encontrado: ${row.Lider || "?"}`);
      continue;
    }

    const monthNum = SPANISH_MONTHS[row.Mes] || "01";
    const anio = Number(row.Anio) || 2026;
    const asesor = String(row.Asesor || row.comercial || "");

    ventaRows.push({
      gerente_id: gerente.id,
      fecha_facturacion: `${anio}-${monthNum}-01`,
      canal: "VC",
      anio,
      mes: String(row.Mes || ""),
      producto: "Resumen Mensual VC",
      bloque_venta: "",
      documento_factura: `SUM-${anio}-${row.Mes}-${asesor}`,
      valor_producto: Number(row.Saldo_ACV_Actual || 0),
      acv_plus: Number(row.Saldo_ACV_Actual || 0),
      meta: Number(row.Meta_Objetivo || 0),
      comercial: asesor,
      lider: String(row.Lider || ""),
      categoria_producto_venta: "",
    });
  }

  // Deduplicate
  const deduped = new Map<string, any>();
  for (const row of ventaRows) {
    const key = `${row.documento_factura}|${row.producto}|${row.fecha_facturacion}`;
    if (deduped.has(key)) {
      const existing = deduped.get(key);
      existing.acv_plus += row.acv_plus;
      existing.valor_producto += row.valor_producto;
      existing.meta = Math.max(existing.meta, row.meta);
    } else {
      deduped.set(key, { ...row });
    }
  }
  const uniqueRows = [...deduped.values()];

  const BATCH = 500;
  for (let i = 0; i < uniqueRows.length; i += BATCH) {
    const chunk = uniqueRows.slice(i, i + BATCH);
    const { error, count } = await supabase.from("ventas").upsert(chunk, {
      onConflict: "documento_factura,producto,fecha_facturacion", count: "exact",
    });
    if (error) errores.push(`Batch ${i}-${i + chunk.length}: ${error.message}`);
    else insertedVentas += (count || chunk.length);
  }

  return { total_rows: rows.length, ventas_sincronizadas: insertedVentas, deduplicadas: uniqueRows.length, errores: errores.slice(0, 20) };
}

// Sync Ventas VC Product Breakdown → ventas table (product-level rows per advisor per month)
async function syncVentasVCProducto(supabase: any, rows: Record<string, any>[]) {
  let insertedVentas = 0;
  const errores: string[] = [];

  const { data: gerentes } = await supabase.from("gerentes").select("id, nombre, email, canal");
  const gerenteMap = new Map<string, any>();
  (gerentes || []).forEach((g: any) => {
    gerenteMap.set(g.nombre?.toLowerCase()?.trim(), g);
  });

  const ventaRows: any[] = [];
  for (const row of rows) {
    const liderName = (row.Lider || "").toLowerCase().trim();
    const gerente = gerenteMap.get(liderName);
    if (!gerente) {
      if (errores.length < 20) errores.push(`Gerente no encontrado: ${row.Lider || "?"}`);
      continue;
    }

    const monthNum = SPANISH_MONTHS[row.Mes] || "01";
    const anio = Number(row.Anio) || 2026;
    const asesor = String(row.Asesor || "").trim();
    const producto = String(row.Producto || "Sin categoría").trim();
    const bloque = String(row.Bloque || "").trim();
    const acv = Number(row.ACV_Producto || 0);
    const unidades = Number(row.Unidades || 0);

    if (acv === 0 && unidades === 0) continue;

    const docKey = `PROD-${anio}-${row.Mes}-${asesor}-${producto}-${bloque}`;
    ventaRows.push({
      gerente_id: gerente.id,
      fecha_facturacion: `${anio}-${monthNum}-01`,
      canal: "VC",
      anio,
      mes: String(row.Mes || ""),
      producto: producto,
      bloque_venta: bloque,
      documento_factura: docKey,
      valor_producto: acv,
      acv_plus: acv,
      meta: 0,
      comercial: asesor,
      lider: String(row.Lider || ""),
      categoria_producto_venta: producto,
    });
  }

  // Deduplicate by documento_factura+producto+fecha to avoid "cannot affect row a second time"
  const deduped = new Map<string, any>();
  for (const row of ventaRows) {
    const key = `${row.documento_factura}|${row.producto}|${row.fecha_facturacion}`;
    if (deduped.has(key)) {
      const existing = deduped.get(key);
      existing.acv_plus += row.acv_plus;
      existing.valor_producto += row.valor_producto;
    } else {
      deduped.set(key, { ...row });
    }
  }
  const uniqueRows = [...deduped.values()];

  // Batch upsert in chunks of 500
  const BATCH = 500;
  for (let i = 0; i < uniqueRows.length; i += BATCH) {
    const chunk = uniqueRows.slice(i, i + BATCH);
    const { error, count } = await supabase.from("ventas").upsert(chunk, {
      onConflict: "documento_factura,producto,fecha_facturacion", count: "exact",
    });
    if (error) errores.push(`Batch ${i}-${i + chunk.length}: ${error.message}`);
    else insertedVentas += (count || chunk.length);
  }

  return { total_rows: rows.length, ventas_producto_sincronizadas: insertedVentas, deduplicadas: uniqueRows.length, errores: errores.slice(0, 20) };
}
