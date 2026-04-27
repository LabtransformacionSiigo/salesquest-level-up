// Edge function: sync-metas-acv-databricks
// Lee hive_metastore.db_comercial.tbl_brz_cuotas (NO _asesores ni _gerentes).
// Esta tabla es la VERDAD para metas ACV de gerentes de Venta Nueva
// (Aliados y Empresarios/SMBS). Incluye:
//   - meta_total_acv (monetario real, ej: "$ 355,110,717")
//   - meta_total_und (unidades)
//   - mes (palabra completa: "Enero", "Febrero"... → normalizamos a "Ene", "Feb"...)
//   - archivo ("Inicio" / "Cierre")
//   - cuota (ej: "100%")
// Cubre Enero–Abril 2026 para todos los países.

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

    // Filtros opcionales sobre tbl_brz_cuotas.
    // - mes: palabra completa "Enero", "Febrero", ... (case-insensitive, prefix match).
    // - pais: nombre completo "Colombia", "Mexico", ...
    const where: string[] = [
      "celula IS NOT NULL",
      "celula <> ''",
      "mes IS NOT NULL",
      "archivo IS NOT NULL",
      "canal_direccion IN ('Aliados','SMBS','Empresarios')",
    ];
    if (filterMes) {
      const safe = filterMes.replace(/'/g, "''").toLowerCase();
      where.push(`LOWER(mes) LIKE '${safe}%'`);
    }
    if (filterPais) {
      where.push(`LOWER(pais_gestion) = LOWER('${filterPais.replace(/'/g, "''")}')`);
    }

    // Una fila por célula+mes+archivo. La columna mes viene como palabra completa
    // ("Enero"), la normalizamos a 3 letras Title-case ("Ene") al escribir.
    // Una fila por célula+mes+archivo. La columna mes viene como palabra completa
    // ("Enero"), la normalizamos a 3 letras Title-case ("Ene") al escribir.
    // Incluimos fe y nube — meta de unidades por familia a nivel gerente
    // (ya agregadas en tbl_brz_cuotas), fuente única para meta_fe / meta_nube.
    const sql = `
      SELECT
        pais_gestion AS pais,
        canal_direccion,
        director,
        celula,
        mes,
        archivo,
        fe,
        nube,
        meta_total_und,
        meta_total_acv,
        cuota
      FROM hive_metastore.db_comercial.tbl_brz_cuotas
      WHERE ${where.join(" AND ")}
      ORDER BY mes, pais_gestion, canal_direccion, celula,
               CASE WHEN LOWER(archivo) LIKE '%inicio%' THEN 0 ELSE 1 END
    `;

    const { rows } = await executeDatabricksQuery(sql);

    const summary = {
      total: rows.length,
      inserted: 0,
      updated_inicio: 0,
      upgraded_to_cierre: 0,
      backfilled_fe_nube: 0,
      skipped_cierre_existente: 0,
      invalid: 0,
    };
    const errors: Array<{ row: any; error: string }> = [];

    for (const r of rows) {
      const [pais, canal, director, celula, mesRaw, archivoRaw, feRaw, nubeRaw, metaUnd, metaAcv, cuota] = r;
      const archivo = deriveArchivo(String(archivoRaw || ""));
      const mes = normMes(String(mesRaw || ""));
      if (!archivo || !celula || !mes || !pais || !canal) {
        summary.invalid++;
        continue;
      }

      const meta_total_und = Math.round(toNum(metaUnd));
      // ACV monetario REAL (ej: "$ 355,110,717" → 355110717). toNum limpia
      // símbolos y separadores. NUNCA es igual a unidades.
      const meta_total_acv = toNum(metaAcv);
      const cuotaNum = toNum(cuota);
      // fe / nube vienen ya agregados por gerente desde tbl_brz_cuotas.
      const meta_fe = Math.round(toNum(feRaw));
      const meta_nube = Math.round(toNum(nubeRaw));

      const { data, error } = await supabase.rpc("upsert_meta_acv_gerente", {
        p_pais: normPais(String(pais)),
        p_canal: normCanal(String(canal)),
        p_director: director ? String(director) : null,
        p_celula: String(celula).trim(),
        p_esquema: null,
        p_cuota: cuotaNum,
        p_meta_total_und: meta_total_und,
        p_meta_total_acv: meta_total_acv,
        p_mes: mes,
        p_archivo: archivo,
        p_meta_fe: meta_fe,
        p_meta_nube: meta_nube,
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
