// Recovery one-shot: rellena metas_acv_gerentes EXCLUSIVAMENTE desde la fuente oficial
// tbl_brz_cuotas_gerentes. No usa fallback de asesores ni rellena con datos derivados.
// Si una (celula, mes, archivo) no existe o viene en NULL/0 en la fuente oficial,
// se respeta tal cual y NO se inserta. Esto garantiza que la app muestre siempre el dato real.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOST = Deno.env.get("DATABRICKS_HOST")!;
const TOKEN = Deno.env.get("DATABRICKS_TOKEN")!;
const WH = Deno.env.get("DATABRICKS_WAREHOUSE_ID")!;

async function dbx(sql: string) {
  const r = await fetch(`${HOST}/api/2.0/sql/statements`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ warehouse_id: WH, statement: sql, wait_timeout: "50s", disposition: "INLINE", format: "JSON_ARRAY" }),
  });
  if (!r.ok) throw new Error(`dbx ${r.status}: ${await r.text()}`);
  let j = await r.json();
  const id = j.statement_id;
  while (j.status?.state === "PENDING" || j.status?.state === "RUNNING") {
    await new Promise((res) => setTimeout(res, 1500));
    const p = await fetch(`${HOST}/api/2.0/sql/statements/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    j = await p.json();
  }
  if (j.status?.state !== "SUCCEEDED") throw new Error(`dbx state ${j.status?.state}: ${JSON.stringify(j.status?.error)}`);
  const cols = (j.manifest?.schema?.columns || []).map((c: any) => c.name);
  const rows: any[] = [];
  for (const row of j.result?.data_array || []) {
    const o: any = {};
    cols.forEach((c: string, i: number) => (o[c] = row[i]));
    rows.push(o);
  }
  return rows;
}

const toNum = (v: unknown) => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const MES3: Record<string, string> = {
  enero: "Ene", febrero: "Feb", marzo: "Mar", abril: "Abr", mayo: "May", junio: "Jun",
  julio: "Jul", agosto: "Ago", septiembre: "Sep", octubre: "Oct", noviembre: "Nov", diciembre: "Dic",
};
const normMes = (s: unknown) => {
  const k = String(s ?? "").trim().toLowerCase();
  return MES3[k] || (k.length >= 3 ? k.charAt(0).toUpperCase() + k.slice(1, 3) : "");
};
const deriveMesFromArchivo = (s: string) => {
  const m = (s || "").match(/\s([A-Za-zÁÉÍÓÚáéíóú]{3,})_/);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1, 3).toLowerCase() : "";
};
const normArchivo = (s: unknown): "Inicio" | "Cierre" => {
  return String(s || "").toLowerCase().includes("cier") ? "Cierre" : "Inicio";
};

async function processPais(sb: any, pais: string, archivoWhere: string) {
  const sqlGer = `
    SELECT pais_gestion AS pais, canal_direccion, director, celula, mes, archivo,
           CAST(fe AS BIGINT) fe, CAST(nube AS BIGINT) nube,
           CAST(meta_total_und AS BIGINT) meta_total_und,
           meta_total_acv, cuota
    FROM analyticdl.db_comercial.tbl_brz_cuotas_gerentes
    WHERE LOWER(pais_gestion) = LOWER('${pais.replace(/'/g, "''")}')
      ${archivoWhere}
      AND celula IS NOT NULL AND celula <> ''
  `;
  const gerRows = await dbx(sqlGer);

  const finalRows: any[] = [];
  for (const r of gerRows) {
    const mes = deriveMesFromArchivo(String(r.archivo || "")) || normMes(r.mes);
    const celula = String(r.celula || "").trim();
    const archivo = normArchivo(r.archivo);
    const fe = toNum(r.fe), nube = toNum(r.nube), und = toNum(r.meta_total_und), acv = toNum(r.meta_total_acv);
    if (fe + nube + und + acv > 0) {
      finalRows.push({ ...r, _mes: mes, _celula: celula, _archivo: archivo, _fe: fe, _nube: nube, _und: und, _acv: acv });
    }
  }

  let inserted = 0, updated = 0, upgraded = 0, skipped = 0, errors = 0;
  const detail: any[] = [];

  for (const r of finalRows) {
    const { data: rpcData, error: eRpc } = await sb.rpc("upsert_meta_acv_gerente", {
      p_pais: String(r.pais || pais),
      p_canal: String(r.canal_direccion || ""),
      p_director: r.director ? String(r.director) : null,
      p_celula: r._celula,
      p_esquema: null,
      p_cuota: toNum(r.cuota),
      p_meta_total_und: r._und,
      p_meta_total_acv: r._acv,
      p_mes: r._mes,
      p_archivo: r._archivo,
      p_meta_fe: r._fe,
      p_meta_nube: r._nube,
    });
    if (eRpc) { errors++; detail.push({ reason: "rpc_err", celula: r._celula, mes: r._mes, error: eRpc.message }); continue; }
    const action = (rpcData as any)?.action;
    if (action === "inserted") inserted++;
    else if (action === "upgraded_to_cierre") upgraded++;
    else if (action === "backfilled_cierre" || action === "updated_inicio" || action === "backfilled_fe_nube") updated++;
    else skipped++;
    detail.push({ celula: r._celula, mes: r._mes, archivo: r._archivo, action, fe: r._fe, nube: r._nube, und: r._und, acv: r._acv });
  }

  return { pais, gerentes_rows: gerRows.length, processed: finalRows.length, inserted, updated, upgraded, skipped, errors, sample: detail.slice(0, 40) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const archivoFilter: string = body?.archivo_filter || "all";
    const archivoWhere =
      archivoFilter === "inicio" ? "AND LOWER(archivo) LIKE '%inicio%'" :
      archivoFilter === "cierre" ? "AND LOWER(archivo) LIKE '%cierre%'" : "";

    const paisParam: string = body?.pais || "all";
    const paises = paisParam.toLowerCase() === "all"
      ? ["Colombia", "Mexico", "Ecuador", "Uruguay"]
      : [paisParam];

    const results: any[] = [];
    for (const p of paises) {
      try {
        results.push(await processPais(sb, p, archivoWhere));
      } catch (e) {
        results.push({ pais: p, error: (e as Error).message });
      }
    }

    const totals = results.reduce((a, r) => ({
      gerentes_rows: a.gerentes_rows + (r.gerentes_rows || 0),
      processed: a.processed + (r.processed || 0),
      inserted: a.inserted + (r.inserted || 0),
      updated: a.updated + (r.updated || 0),
      upgraded: a.upgraded + (r.upgraded || 0),
      skipped: a.skipped + (r.skipped || 0),
      errors: a.errors + (r.errors || 0),
    }), { gerentes_rows: 0, processed: 0, inserted: 0, updated: 0, upgraded: 0, skipped: 0, errors: 0 });

    return new Response(JSON.stringify({ success: true, paises, totals, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
