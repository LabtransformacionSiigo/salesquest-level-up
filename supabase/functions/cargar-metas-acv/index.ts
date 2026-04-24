// Edge function: cargar-metas-acv
// Recibe un array de filas (parseadas desde CSV/XLSX en el cliente) y
// las inserta en metas_acv_gerentes respetando la regla "Cierre bloquea Inicio".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RowIn {
  pais?: string;
  canal?: string;
  director?: string | null;
  celula?: string;
  esquema?: string | null;
  cuota?: number | string | null;
  meta_total_und?: number | string | null;
  meta_total_acv?: number | string | null;
  mes?: string;
  archivo?: string;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const norm = (v: unknown) => (v == null ? "" : String(v).trim());

const normArchivo = (v: unknown): "Inicio" | "Cierre" | null => {
  const s = norm(v).toLowerCase();
  if (s.startsWith("cier")) return "Cierre";
  if (s.startsWith("ini")) return "Inicio";
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const rows: RowIn[] = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No rows provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const summary = {
      total: rows.length,
      inserted: 0,
      updated_inicio: 0,
      upgraded_to_cierre: 0,
      skipped_cierre_existente: 0,
      invalid: 0,
    };
    const errors: Array<{ index: number; row: RowIn; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const archivo = normArchivo(r.archivo);
      const celula = norm(r.celula);
      const mes = norm(r.mes);
      const pais = norm(r.pais);
      const canal = norm(r.canal);

      if (!archivo || !celula || !mes || !pais || !canal) {
        summary.invalid++;
        errors.push({
          index: i,
          row: r,
          error: "Campos requeridos faltantes (pais, canal, celula, mes, archivo)",
        });
        continue;
      }

      const { data, error } = await supabase.rpc("upsert_meta_acv_gerente", {
        p_pais: pais,
        p_canal: canal,
        p_director: norm(r.director) || null,
        p_celula: celula,
        p_esquema: norm(r.esquema) || null,
        p_cuota: toNum(r.cuota),
        p_meta_total_und: Math.round(toNum(r.meta_total_und)),
        p_meta_total_acv: toNum(r.meta_total_acv),
        p_mes: mes,
        p_archivo: archivo,
      });

      if (error) {
        errors.push({ index: i, row: r, error: error.message });
        continue;
      }

      const action = (data as any)?.action;
      if (action === "inserted") summary.inserted++;
      else if (action === "updated_inicio") summary.updated_inicio++;
      else if (action === "upgraded_to_cierre") summary.upgraded_to_cierre++;
      else if (action === "skipped") summary.skipped_cierre_existente++;
    }

    return new Response(
      JSON.stringify({ success: true, summary, errors: errors.slice(0, 50) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
