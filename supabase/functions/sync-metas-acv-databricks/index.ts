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

const MES_ALIASES: Record<string, { mes3: string; text: string[]; numeric: string[]; period: string }> = {
  ene: { mes3: "Ene", text: ["enero", "ene", "jan", "january"], numeric: ["1", "01"], period: "202601" },
  feb: { mes3: "Feb", text: ["febrero", "feb", "february"], numeric: ["2", "02"], period: "202602" },
  mar: { mes3: "Mar", text: ["marzo", "mar", "march"], numeric: ["3", "03"], period: "202603" },
  abr: { mes3: "Abr", text: ["abril", "abr", "apr", "april"], numeric: ["4", "04"], period: "202604" },
  may: { mes3: "May", text: ["mayo", "may"], numeric: ["5", "05"], period: "202605" },
  jun: { mes3: "Jun", text: ["junio", "jun", "june"], numeric: ["6", "06"], period: "202606" },
  jul: { mes3: "Jul", text: ["julio", "jul", "july"], numeric: ["7", "07"], period: "202607" },
  ago: { mes3: "Ago", text: ["agosto", "ago", "aug", "august"], numeric: ["8", "08"], period: "202608" },
  sep: { mes3: "Sep", text: ["septiembre", "sept", "sep", "september"], numeric: ["9", "09"], period: "202609" },
  oct: { mes3: "Oct", text: ["octubre", "oct", "october"], numeric: ["10"], period: "202610" },
  nov: { mes3: "Nov", text: ["noviembre", "nov", "november"], numeric: ["11"], period: "202611" },
  dic: { mes3: "Dic", text: ["diciembre", "dic", "dec", "december"], numeric: ["12"], period: "202612" },
};

const normalizeMesFilter = (v: unknown): typeof MES_ALIASES[keyof typeof MES_ALIASES] | null => {
  const raw = String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (!raw) return null;
  const maybePeriod = raw.match(/2026(0[1-9]|1[0-2])/);
  if (maybePeriod) return Object.values(MES_ALIASES).find((m) => m.period === maybePeriod[0]) || null;
  const compact = raw.replace(/[^a-z0-9]/g, "");
  return Object.values(MES_ALIASES).find((m) =>
    m.text.includes(compact) || m.numeric.includes(compact) || m.mes3.toLowerCase() === compact.slice(0, 3)
  ) || null;
};

const currentMesFilter = () => Object.values(MES_ALIASES)[new Date().getMonth()];

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

    // Permitimos pasar `mes` (ej "May"/"Mayo"/"202605") y `pais` para limitar el alcance opcionalmente.
    // Por defecto sincroniza el mes actual para evitar timeouts y dejar el botón listo mes a mes.
    // Si `all_2026=true` (o `mes='all_2026'`/`'all'`), iteramos Ene..mes actual.
    const body = await req.json().catch(() => ({}));
    const wantsAll2026 =
      body?.all_2026 === true ||
      ["all_2026", "all"].includes(String(body?.mes || "").toLowerCase());

    if (wantsAll2026) {
      const currentIdx = new Date().getMonth(); // 0-based, mes actual incluido
      const meses = Object.values(MES_ALIASES).slice(0, currentIdx + 1);
      const results: any[] = [];
      for (const m of meses) {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/sync-metas-acv-databricks`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mes: m.mes3, pais: body?.pais }),
        });
        const j = await r.json().catch(() => ({ raw: "non-json" }));
        results.push({ mes: m.mes3, status: r.status, summary: j?.summary, error: j?.error });
      }
      return new Response(
        JSON.stringify({ success: true, all_2026: true, meses: meses.map((m) => m.mes3), results }, null, 2),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const filterMes = body?.all ? null : (normalizeMesFilter(body?.mes) || currentMesFilter());
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
      const textChecks = filterMes.text
        .map((m) => `LOWER(mes) LIKE '${m.replace(/'/g, "''")}%' OR LOWER(archivo) LIKE '%${m.replace(/'/g, "''")}%'`)
        .join(" OR ");
      const numericChecks = filterMes.numeric
        .map((m) => `CAST(mes AS STRING) = '${m}'`)
        .join(" OR ");
      where.push(`(${textChecks} OR ${numericChecks} OR CAST(mes AS STRING) = '${filterMes.period}' OR LOWER(archivo) LIKE '%${filterMes.period}%')`);
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
        CAST(fe AS BIGINT)             AS fe,
        CAST(nube AS BIGINT)           AS nube,
        CAST(meta_total_und AS BIGINT) AS meta_total_und,
        meta_total_acv,
        cuota
      FROM analyticdl.db_comercial.tbl_brz_cuotas_gerentes
      WHERE ${where.join(" AND ")}
      ORDER BY mes, pais_gestion, canal_direccion, celula,
               CASE WHEN LOWER(archivo) LIKE '%inicio%' THEN 0 ELSE 1 END
    `;

    let { rows } = await executeDatabricksQuery(sql);
    let source = "tbl_brz_cuotas_gerentes";

    // Si la fuente agregada de gerentes todavía no publica el mes (caso Mayo),
    // usamos el agregado oficial por célula ya sincronizado en metas_asesores.
    // Cuando gerentes publique Cierre, reemplazará Inicio.
    if (rows.length === 0 && filterMes) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("metas_asesores")
        .select("pais, canal_direccion, gerente, celula, meta_fe, meta_nube, meta_total")
        .eq("anio_mes", filterMes.period)
        .like("documento_asesor", "CEL_%");
      if (fallbackError) throw fallbackError;
      rows = (fallbackRows || []).map((r: any) => [
        r.pais,
        r.canal_direccion,
        r.gerente,
        r.celula,
        filterMes.mes3,
        "Inicio",
        r.meta_fe,
        r.meta_nube,
        r.meta_total,
        0,
        100,
      ]);
      source = "metas_asesores_aggregated_local";
    }

    const summary = {
      total: rows.length,
      inserted: 0,
      updated_inicio: 0,
      upgraded_to_cierre: 0,
      backfilled_fe_nube: 0,
      skipped_cierre_existente: 0,
      invalid: 0,
      source,
      mes: filterMes?.mes3 || "todos",
    };
    const errors: Array<{ row: any; error: string }> = [];

    // Deduplica la respuesta de Databricks: si vienen filas idénticas por
    // (celula, mes, archivo), conserva solo la última. Evita doble upsert.
    const dedupMap = new Map<string, any[]>();
    for (const r of rows) {
      const [, , , celulaDd, mesRawDd, archivoRawDd] = r;
      const ddKey = `${String(celulaDd || '').trim().toLowerCase()}|${String(mesRawDd || '').toLowerCase()}|${String(archivoRawDd || '').toLowerCase()}`;
      dedupMap.set(ddKey, r);
    }
    const dedupedRows = Array.from(dedupMap.values());
    console.log(`[sync-metas-acv] Total Databricks: ${rows.length} → deduped: ${dedupedRows.length}`);
    summary.total = dedupedRows.length;

    // ─────────────────────────────────────────────────────────────
    // Override FE/NUBE con el agregado oficial desde metas_asesores
    // (ya filtrado por aplica_cuota_lider = 'Si'). ACV/und/cuota
    // siguen viniendo de tbl_brz_cuotas_gerentes.
    // ─────────────────────────────────────────────────────────────
    const MES3_TO_PERIOD: Record<string, string> = {
      ene: "202601", feb: "202602", mar: "202603", abr: "202604",
      may: "202605", jun: "202606", jul: "202607", ago: "202608",
      sep: "202609", oct: "202610", nov: "202611", dic: "202612",
    };
    const periodosNecesarios = new Set<string>();
    for (const r of dedupedRows) {
      const [, , , , mesRaw, archivoRaw] = r;
      const mes3 = (deriveMesFromArchivo(String(archivoRaw || "")) || normMes(String(mesRaw || ""))).toLowerCase();
      const p = MES3_TO_PERIOD[mes3];
      if (p) periodosNecesarios.add(p);
    }
    const cellFeNubeMap = new Map<string, { fe: number; nube: number }>();
    if (periodosNecesarios.size > 0) {
      const { data: celRows, error: celErr } = await supabase
        .from("metas_asesores")
        .select("celula, canal_direccion, anio_mes, meta_fe, meta_nube")
        .in("anio_mes", Array.from(periodosNecesarios))
        .like("documento_asesor", "CEL_%");
      if (celErr) {
        console.error("[sync-metas-acv] No se pudo precargar CEL_ overrides:", celErr.message);
      } else {
        for (const c of celRows || []) {
          const key = `${String(c.celula).trim().toLowerCase()}|${c.canal_direccion}|${c.anio_mes}`;
          cellFeNubeMap.set(key, { fe: Number(c.meta_fe) || 0, nube: Number(c.meta_nube) || 0 });
        }
        console.log(`[sync-metas-acv] CEL_ overrides cargados: ${cellFeNubeMap.size}`);
      }
    }


    // Procesar RPCs en paralelo por lotes para evitar timeout (150s)
    const CONCURRENCY = 25;
    const processOne = async (r: any[]) => {
      const [pais, canal, director, celula, mesRaw, archivoRaw, feRaw, nubeRaw, metaUnd, metaAcv, cuota] = r;
      const archivoRawText = String(archivoRaw || "");
      const archivo = deriveArchivo(archivoRawText);
      // Databricks a veces deja `mes` con el mes anterior y el mes real viene en el nombre de archivo.
      // Por eso el archivo gana prioridad; si no trae mes, usamos la columna `mes`.
      const mes = deriveMesFromArchivo(archivoRawText) || normMes(String(mesRaw || ""));
      if (!archivo || !celula || !mes || !pais || !canal) {
        summary.invalid++;
        return;
      }
      // Override FE/NUBE con el agregado oficial de asesores (aplica_cuota_lider = Si).
      // Si no hay override, mantenemos lo de Databricks.
      const mes3lower = mes.toLowerCase();
      const periodoBuscado = MES3_TO_PERIOD[mes3lower];
      const overrideKey = `${String(celula).trim().toLowerCase()}|${normCanal(String(canal))}|${periodoBuscado}`;
      const override = cellFeNubeMap.get(overrideKey);
      const feFinal = override ? override.fe : Math.round(toNum(feRaw));
      const nubeFinal = override ? override.nube : Math.round(toNum(nubeRaw));
      const metaUndFinal = override ? feFinal + nubeFinal : Math.round(toNum(metaUnd));

      const { data, error } = await supabase.rpc("upsert_meta_acv_gerente", {
        p_pais: normPais(String(pais)),
        p_canal: normCanal(String(canal)),
        p_director: director ? String(director) : null,
        p_celula: String(celula).trim(),
        p_esquema: null,
        p_cuota: toNum(cuota),
        p_meta_total_und: metaUndFinal,
        p_meta_total_acv: toNum(metaAcv),
        p_mes: mes,
        p_archivo: archivo,
        p_meta_fe: feFinal,
        p_meta_nube: nubeFinal,
      });
      if (error) {
        errors.push({ row: r, error: error.message });
        return;
      }
      const action = (data as any)?.action;
      if (action === "inserted") summary.inserted++;
      else if (action === "updated_inicio") summary.updated_inicio++;
      else if (action === "upgraded_to_cierre") summary.upgraded_to_cierre++;
      else if (action === "skipped") summary.skipped_cierre_existente++;
      else if (action === "backfilled_fe_nube") summary.backfilled_fe_nube++;
    };

    for (let i = 0; i < dedupedRows.length; i += CONCURRENCY) {
      const batch = dedupedRows.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(processOne));
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
