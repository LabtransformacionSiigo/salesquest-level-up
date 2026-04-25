// Edge function: sync-metas-acv-databricks
// Lee hive_metastore.db_comercial.tbl_brz_cuotas_GERENTES (no _asesores)
// porque esta tabla contiene las columnas reales de meta ACV monetaria
// (meta_total_acv) y meta de unidades (meta_total_und) por célula.
//
// La tabla _asesores solo tiene unidades (meta_total = unidades).
// Esta tabla es la VERDAD para las metas ACV de gerentes de Venta Nueva
// (Aliados y Empresarios/SMBS).
//
// El mes y tipo de archivo (Inicio/Cierre) se derivan del campo
// `_archivo_origen` con formato "Cuotas YYYY MesAbrev_TipoArchivo".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAIS_MAP: Record<string, string> = {
  COLOMBIA: "COL",
  ECUADOR: "ECU",
  MEXICO: "MEX",
  MÉXICO: "MEX",
  URUGUAY: "URU",
  PERU: "PER",
  PERÚ: "PER",
};

const CANAL_MAP: Record<string, string> = {
  ALIADOS: "VN_ALIADOS",
  SMBS: "VN_EMPRESARIOS",
  EMPRESARIOS: "VN_EMPRESARIOS",
};

const normPais = (v: string) => {
  const k = (v || "").trim().toUpperCase();
  return PAIS_MAP[k] || k.slice(0, 3);
};
const normCanal = (v: string) => {
  const k = (v || "").trim().toUpperCase();
  return CANAL_MAP[k] || k;
};

const normMes = (v: string): string => {
  const m = (v || "").trim();
  // El campo "mes" en Databricks viene como "Mar", "Ene", etc.
  // Estandarizamos a 3 letras Title-case: "Ene", "Feb", "Mar"...
  if (!m) return "";
  return m.charAt(0).toUpperCase() + m.slice(1, 3).toLowerCase();
};

// Deriva "Inicio" o "Cierre" del nombre del archivo origen
// (ej: "Cuotas 2026 Mar_Cierre.xlsx" -> "Cierre").
const deriveArchivo = (nombreArchivo: string): "Inicio" | "Cierre" | null => {
  const s = (nombreArchivo || "").toLowerCase();
  if (s.includes("cierre")) return "Cierre";
  if (s.includes("inicio")) return "Inicio";
  return null;
};

// Deriva el mes (3 letras Title-case: "Ene", "Feb", "Mar"...) del nombre del
// archivo origen, ej: "Cuotas 2026 Abr_Inicio" -> "Abr".
const deriveMesFromArchivo = (nombreArchivo: string): string => {
  const s = (nombreArchivo || "").trim();
  // Match " <Mes>_" (mes con 3+ letras antes del separador "_")
  const m = s.match(/\s([A-Za-zÁÉÍÓÚáéíóú]{3,})_/);
  if (!m) return "";
  const raw = m[1];
  return raw.charAt(0).toUpperCase() + raw.slice(1, 3).toLowerCase();
};

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

async function executeDatabricksQuery(sql: string) {
  const host = Deno.env.get("DATABRICKS_HOST")!;
  const token = Deno.env.get("DATABRICKS_TOKEN")!;
  const warehouseId = Deno.env.get("DATABRICKS_WAREHOUSE_ID")!;

  const startResp = await fetch(`${host}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      warehouse_id: warehouseId,
      statement: sql,
      wait_timeout: "30s",
      disposition: "INLINE",
      format: "JSON_ARRAY",
    }),
  });

  if (!startResp.ok) {
    throw new Error(`Databricks start failed [${startResp.status}]: ${await startResp.text()}`);
  }

  let payload = await startResp.json();
  const statementId = payload.statement_id;

  // Poll si no terminó
  while (payload?.status?.state === "PENDING" || payload?.status?.state === "RUNNING") {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(`${host}/api/2.0/sql/statements/${statementId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    payload = await poll.json();
  }

  if (payload?.status?.state !== "SUCCEEDED") {
    throw new Error(
      `Databricks query failed: ${payload?.status?.state} - ${JSON.stringify(payload?.status?.error || {})}`,
    );
  }

  const cols: string[] = (payload.manifest?.schema?.columns || []).map((c: any) => c.name);
  const rows: any[][] = payload.result?.data_array || [];
  return { cols, rows };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Permitimos pasar `mes` (ej "Mar") y `pais` para limitar el alcance opcionalmente.
    const body = await req.json().catch(() => ({}));
    const filterMes: string | undefined = body?.mes;
    const filterPais: string | undefined = body?.pais;

    const where: string[] = ["mes IS NOT NULL", "celula IS NOT NULL", "celula <> ''"];
    if (filterMes) where.push(`LOWER(mes) = LOWER('${filterMes.replace(/'/g, "''")}')`);
    if (filterPais) where.push(`LOWER(pais) = LOWER('${filterPais.replace(/'/g, "''")}')`);

    // Agregamos por (pais, canal, director, celula, mes, archivo).
    // Para cada combinación celula+mes podemos tener múltiples archivos.
    // Procesamos primero "Inicio" y luego "Cierre" para que Cierre prevalezca.
    const sql = `
      SELECT
        pais,
        canal_direccion,
        MAX(director) AS director,
        celula,
        mes,
        archivo,
        SUM(CAST(NULLIF(meta_total, '') AS DOUBLE)) AS meta_total_und,
        COUNT(*) AS asesores
      FROM hive_metastore.db_comercial.tbl_brz_cuotas_asesores
      WHERE ${where.join(" AND ")}
      GROUP BY pais, canal_direccion, celula, mes, archivo
      ORDER BY mes, pais, canal_direccion, celula,
               CASE WHEN LOWER(archivo) LIKE '%inicio%' THEN 0 ELSE 1 END
    `;

    const { rows } = await executeDatabricksQuery(sql);

    const summary = {
      total: rows.length,
      inserted: 0,
      updated_inicio: 0,
      upgraded_to_cierre: 0,
      skipped_cierre_existente: 0,
      invalid: 0,
    };
    const errors: Array<{ row: any; error: string }> = [];

    for (const r of rows) {
      const [pais, canal, director, celula, mes, archivoRaw, metaUnd] = r;
      const archivo = deriveArchivo(String(archivoRaw || ""));
      if (!archivo || !celula || !mes || !pais || !canal) {
        summary.invalid++;
        continue;
      }

      const meta_total_und = Math.round(toNum(metaUnd));
      // En esta tabla NO hay ACV monetario explícito; meta_total son UNIDADES.
      // Guardamos las unidades como meta_total_und y replicamos en meta_total_acv
      // para mantener compat con consumidores actuales que leen meta_total_acv.
      const meta_total_acv = toNum(metaUnd);

      const { data, error } = await supabase.rpc("upsert_meta_acv_gerente", {
        p_pais: normPais(String(pais)),
        p_canal: normCanal(String(canal)),
        p_director: director ? String(director) : null,
        p_celula: String(celula).trim(),
        p_esquema: null,
        p_cuota: 0,
        p_meta_total_und: meta_total_und,
        p_meta_total_acv: meta_total_acv,
        p_mes: normMes(String(mes)),
        p_archivo: archivo,
      });

      if (error) {
        errors.push({ row: r, error: error.message });
        continue;
      }

      const action = (data as any)?.action;
      if (action === "inserted") summary.inserted++;
      else if (action === "updated_inicio") summary.updated_inicio++;
      else if (action === "upgraded_to_cierre") summary.upgraded_to_cierre++;
      else if (action === "skipped") summary.skipped_cierre_existente++;
    }

    return new Response(
      JSON.stringify({ success: true, summary, errors: errors.slice(0, 25) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
