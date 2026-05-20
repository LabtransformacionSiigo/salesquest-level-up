// Recovery one-shot: re-lee tbl_brz_cuotas_gerentes en Databricks SOLO para
// archivos Inicio 2026 (todos los meses) y rellena valores en metas_acv_gerentes
// que actualmente están en 0. Nunca pisa valores >0. Filtrable por país.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const pais: string = body?.pais || "Mexico";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const archivoFilter: string = body?.archivo_filter || "all"; // all | inicio | cierre
    const archivoWhere =
      archivoFilter === "inicio" ? "AND LOWER(archivo) LIKE '%inicio%'" :
      archivoFilter === "cierre" ? "AND LOWER(archivo) LIKE '%cierre%'" : "";
    const sql = `
      SELECT pais_gestion AS pais, canal_direccion, director, celula, mes, archivo,
             CAST(fe AS BIGINT) fe, CAST(nube AS BIGINT) nube,
             CAST(meta_total_und AS BIGINT) meta_total_und,
             meta_total_acv, cuota
      FROM analyticdl.db_comercial.tbl_brz_cuotas_gerentes
      WHERE LOWER(pais_gestion) = LOWER('${pais.replace(/'/g, "''")}')
        ${archivoWhere}
        AND celula IS NOT NULL AND celula <> ''
    `;
    const rows = await dbx(sql);

    let updated = 0, skipped = 0, errors = 0;
    const detail: any[] = [];

    for (const r of rows) {
      const mes = deriveMesFromArchivo(String(r.archivo || "")) || normMes(r.mes);
      const celula = String(r.celula || "").trim();
      if (!mes || !celula) { skipped++; continue; }
      const fe = toNum(r.fe), nube = toNum(r.nube), und = toNum(r.meta_total_und), acv = toNum(r.meta_total_acv);
      if (fe === 0 && nube === 0 && und === 0 && acv === 0) { skipped++; detail.push({ reason: "zero_dbx", celula, mes }); continue; }

      // Lee fila actual
      const { data: cur, error: eSel } = await sb
        .from("metas_acv_gerentes")
        .select("id, meta_fe, meta_nube, meta_total_und, meta_total_acv")
        .eq("celula", celula).eq("mes", mes).maybeSingle();
      if (eSel) { errors++; detail.push({ reason: "sel_err", celula, mes }); continue; }
      if (!cur) { skipped++; detail.push({ reason: "no_match", celula, mes }); continue; }

      const patch: any = {};
      if ((cur.meta_fe || 0) === 0 && fe > 0) patch.meta_fe = fe;
      if ((cur.meta_nube || 0) === 0 && nube > 0) patch.meta_nube = nube;
      if ((cur.meta_total_und || 0) === 0 && und > 0) patch.meta_total_und = und;
      if (Number(cur.meta_total_acv || 0) === 0 && acv > 0) patch.meta_total_acv = acv;
      if (Object.keys(patch).length === 0) { skipped++; continue; }

      const { error: eUp } = await sb.from("metas_acv_gerentes").update(patch).eq("id", cur.id);
      if (eUp) { errors++; continue; }
      updated++;
      detail.push({ celula, mes, ...patch });
    }

    return new Response(JSON.stringify({ success: true, pais, dbx_rows: rows.length, updated, skipped, errors, sample: detail.slice(0, 40) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
