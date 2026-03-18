import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Table configurations
const TABLE_CONFIGS: Record<string, { sql: (limit: string) => string; label: string }> = {
  productividad: {
    label: "Productividad Progresiva",
    sql: (limit: string) => `SELECT * FROM db_comercial.tbl_slv_Productividad_Progresiva WHERE ANIO_MES >= 202601 AND ANIO_MES <= 202612 ${limit}`,
  },
  ventas_vc: {
    label: "Ventas VC",
    sql: (limit: string) => `SELECT * FROM db_comercial.tbl_gld_Ventas_VC WHERE Anio = 2026 AND categoria_producto_Venta NOT IN ('Ecuador','Uruguay') ${limit}`,
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

    // Allow service role key calls (for internal/automated sync)
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      // Verify admin via user auth
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

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "preview";
    const table = body.table || "productividad";

    const tableConfig = TABLE_CONFIGS[table];
    if (!tableConfig) {
      return new Response(
        JSON.stringify({ error: `Tabla no soportada: ${table}. Opciones: ${Object.keys(TABLE_CONFIGS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Databricks config
    const DATABRICKS_HOST = Deno.env.get("DATABRICKS_HOST");
    const DATABRICKS_TOKEN = Deno.env.get("DATABRICKS_TOKEN");
    const DATABRICKS_WAREHOUSE_ID = Deno.env.get("DATABRICKS_WAREHOUSE_ID");

    if (!DATABRICKS_HOST || !DATABRICKS_TOKEN || !DATABRICKS_WAREHOUSE_ID) {
      return new Response(
        JSON.stringify({ error: "Faltan credenciales de Databricks." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const databricksUrl = `${DATABRICKS_HOST.replace(/\/+$/, '')}/api/2.0/sql/statements`;
    const limitClause = mode === "preview" ? "LIMIT 10" : "";
    const sql = tableConfig.sql(limitClause);

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

    const dbData = await dbResponse.json();

    if (!dbResponse.ok || dbData.status?.state === "FAILED") {
      console.error("Databricks error:", JSON.stringify(dbData));
      return new Response(
        JSON.stringify({
          error: "Error al consultar Databricks",
          detail: dbData.status?.error?.message || dbData.message || JSON.stringify(dbData),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dbData.status?.state === "PENDING" || dbData.status?.state === "RUNNING") {
      return new Response(
        JSON.stringify({ status: "pending", statement_id: dbData.statement_id, message: "Query aún en ejecución. Reintenta en unos segundos." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract columns and data
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

    // Preview mode
    if (mode === "preview") {
      return new Response(
        JSON.stringify({
          table: tableConfig.label,
          columns: columnNames,
          total_rows: rows.length,
          sample: rows.slice(0, 5),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync mode
    let syncResult;
    if (table === "ventas_vc") {
      syncResult = await syncVentasVC(supabase, rows);
    } else {
      syncResult = await syncProductividad(supabase, rows);
    }

    // Auto-trigger SP calculation after successful sync
    let spResult = null;
    try {
      const spUrl = `${supabaseUrl}/functions/v1/calcular-sp-semanal`;
      const spResponse = await fetch(spUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
      });
      spResult = await spResponse.json();
      console.log("[sync-databricks] SP recalculation triggered:", JSON.stringify(spResult));
    } catch (spErr) {
      console.error("[sync-databricks] SP recalculation error:", spErr);
      spResult = { error: String(spErr) };
    }

    return new Response(JSON.stringify({ ...syncResult, sp_recalculo: spResult }), {
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

// Sync Productividad Progresiva → kpis_mensuales
async function syncProductividad(supabase: any, rows: Record<string, any>[]) {
  let insertedKpis = 0;
  const errores: string[] = [];

  const { data: gerentes } = await supabase.from("gerentes").select("id, nombre, email, canal");
  const gerenteMap = new Map<string, any>();
  (gerentes || []).forEach((g: any) => {
    gerenteMap.set(g.nombre?.toLowerCase()?.trim(), g);
    gerenteMap.set(g.email?.toLowerCase()?.trim(), g);
  });

  for (const row of rows) {
    try {
      const gerenteNombre = (row.GERENTE || row.NOMBRE_GERENTE || "").toLowerCase().trim();
      const gerenteEmail = (row.EMAIL || row.CORREO || "").toLowerCase().trim();
      const gerente = gerenteMap.get(gerenteEmail) || gerenteMap.get(gerenteNombre);

      if (!gerente) {
        errores.push(`Gerente no encontrado: ${gerenteNombre || gerenteEmail || JSON.stringify(row).slice(0, 100)}`);
        continue;
      }

      const anioMes = String(row.ANIO_MES || row.anio_mes || "");
      if (anioMes) {
        const kpiRow = {
          gerente_id: gerente.id,
          anio_mes: anioMes,
          canal: gerente.canal,
          ventas: Number(row.VENTAS || row.ventas || row.VENTA_TOTAL || 0),
          meta: Number(row.META || row.meta || 0),
          acv_f: Number(row.ACV_F || row.acv_f || 0),
          cant_recomendados: Number(row.CANT_RECOMENDADOS || row.cant_recomendados || 0),
          ventas_recomendados: Number(row.VENTAS_RECOMENDADOS || row.ventas_recomendados || 0),
          sc_creados: Number(row.SC_CREADOS || row.sc_creados || 0),
          ventas_sql: Number(row.VENTAS_SQL || row.ventas_sql || 0),
          hc_final: Number(row.HC_FINAL || row.hc_final || 0),
          hc_inicial: Number(row.HC_INICIAL || row.hc_inicial || 0),
          terminaciones: Number(row.TERMINACIONES || row.terminaciones || 0),
        };

        const { error } = await supabase.from("kpis_mensuales").upsert(kpiRow, {
          onConflict: "gerente_id,anio_mes",
        });

        if (error) errores.push(`KPI ${gerente.nombre} ${anioMes}: ${error.message}`);
        else insertedKpis++;
      }
    } catch (err) {
      errores.push(`Row error: ${String(err)}`);
    }
  }

  return { total_rows: rows.length, kpis_sincronizados: insertedKpis, errores: errores.slice(0, 20) };
}

// Sync Ventas VC → ventas table (batch optimized)
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
    const lider = (row.lider || "").trim();
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

  // Build all venta rows
  const ventaRows: any[] = [];
  for (const row of rows) {
    const liderName = (row.lider || "").toLowerCase().trim();
    const gerente = gerenteMap.get(liderName);
    if (!gerente) {
      if (errores.length < 20) errores.push(`Gerente no encontrado: ${row.lider || "?"}`);
      continue;
    }
    ventaRows.push({
      gerente_id: gerente.id,
      fecha_facturacion: row.Fecha_Facturacion || new Date().toISOString().split('T')[0],
      canal: "VC", anio: Number(row.Anio || 2026), mes: String(row.mes || ""),
      producto: String(row.Producto || ""), bloque_venta: String(row.Bloque_Venta || ""),
      documento_factura: String(row.Documento_Factura || ""),
      valor_producto: Number(row.Valor_Producto || 0), acv_plus: Number(row.ACV_PLUS || 0),
      comercial: String(row.comercial || ""), lider: String(row.lider || ""),
      categoria_producto_venta: String(row.categoria_producto_Venta || ""),
    });
  }

  // Batch upsert in chunks of 500
  const BATCH = 500;
  for (let i = 0; i < ventaRows.length; i += BATCH) {
    const chunk = ventaRows.slice(i, i + BATCH);
    const { error, count } = await supabase.from("ventas").upsert(chunk, {
      onConflict: "documento_factura,producto,fecha_facturacion", count: "exact",
    });
    if (error) errores.push(`Batch ${i}-${i+chunk.length}: ${error.message}`);
    else insertedVentas += (count || chunk.length);
  }

  return { total_rows: rows.length, ventas_sincronizadas: insertedVentas, errores: errores.slice(0, 20) };
}
