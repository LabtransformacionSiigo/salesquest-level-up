// Temp probe: introspect Databricks for MX VN COI/NOI meta location.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function executeDatabricksQuery(sql: string) {
  const host = Deno.env.get("DATABRICKS_HOST")!;
  const token = Deno.env.get("DATABRICKS_TOKEN")!;
  const warehouseId = Deno.env.get("DATABRICKS_WAREHOUSE_ID")!;

  const startResp = await fetch(`${host}/api/2.0/sql/statements`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      warehouse_id: warehouseId,
      statement: sql,
      wait_timeout: "30s",
      disposition: "INLINE",
      format: "JSON_ARRAY",
    }),
  });
  if (!startResp.ok) {
    return { error: `start ${startResp.status}: ${await startResp.text()}` };
  }
  let payload = await startResp.json();
  const statementId = payload.statement_id;
  while (payload?.status?.state === "PENDING" || payload?.status?.state === "RUNNING") {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(`${host}/api/2.0/sql/statements/${statementId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    payload = await poll.json();
  }
  if (payload?.status?.state !== "SUCCEEDED") {
    return { error: `${payload?.status?.state}: ${JSON.stringify(payload?.status?.error || {})}` };
  }
  const cols: string[] = (payload.manifest?.schema?.columns || []).map((c: any) => c.name);
  const rows: any[][] = payload.result?.data_array || [];
  return { cols, rows };
}

async function safeRun(sql: string) {
  try {
    const r = await executeDatabricksQuery(sql);
    return { sql, ...r };
  } catch (e) {
    return { sql, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const probeA = await safeRun(
    `SELECT * FROM analyticdl.db_comercial.tbl_brz_cuotas_asesores WHERE LOWER(celula) LIKE '%mexico lina%' LIMIT 5`,
  );
  const probeB = await safeRun(
    `SELECT * FROM analyticdl.db_comercial.tbl_brz_cuotas_gerentes WHERE LOWER(celula) LIKE '%mexico lina%' LIMIT 30`,
  );
  let probeC = await safeRun(`SHOW TABLES IN analyticdl.db_comercial LIKE '*cuota*|*meta*|*gerente*'`);
  if ((probeC as any).error) {
    probeC = await safeRun(`SHOW TABLES IN analyticdl.db_comercial`);
  }

  return new Response(JSON.stringify({ probeA, probeB, probeC }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
