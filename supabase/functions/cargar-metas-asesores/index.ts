// Edge function: cargar-metas-asesores
// Upsert masivo de metas individuales por asesor (metas_asesores).
// Recibe rows parseados desde XLSX/CSV en el cliente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RowIn {
  documento_asesor?: string;
  nombre_asesor?: string;
  celula?: string;
  gerente?: string;
  canal_direccion?: string;
  pais?: string;
  meta_fe?: number | string;
  meta_nube?: number | string;
  meta_total?: number | string;
  anio_mes?: string;
  novedad?: string;
}

const PAIS_MAP: Record<string, string> = {
  COLOMBIA: "COL", COL: "COL",
  ECUADOR: "ECU", ECU: "ECU",
  MEXICO: "MEX", "MÉXICO": "MEX", MEX: "MEX",
  URUGUAY: "URU", URU: "URU",
};

const normPais = (v: unknown) => {
  const k = String(v ?? "").trim().toUpperCase();
  return PAIS_MAP[k] || (k ? k.slice(0, 3) : "COL");
};

const normCanal = (v: unknown) => {
  const k = String(v ?? "").trim().toLowerCase();
  if (k.startsWith("ali")) return "Aliados";
  if (k.startsWith("emp") || k === "smbs") return "Empresarios";
  return String(v ?? "").trim();
};

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const norm = (v: unknown) => (v == null ? "" : String(v).trim());

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

    const summary = { total: rows.length, inserted: 0, updated: 0, skipped: 0, invalid: 0 };
    const errors: Array<{ index: number; row: RowIn; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const documento = norm(r.documento_asesor);
      const canal = normCanal(r.canal_direccion);
      const anio_mes = norm(r.anio_mes);
      if (!documento || !canal || !anio_mes) {
        summary.invalid++;
        errors.push({ index: i, row: r, error: "Faltan campos requeridos (documento_asesor, canal_direccion, anio_mes)" });
        continue;
      }

      const payload = {
        documento_asesor: documento,
        nombre_asesor: norm(r.nombre_asesor) || null,
        celula: norm(r.celula) || null,
        gerente: norm(r.gerente) || null,
        canal_direccion: canal,
        pais: normPais(r.pais),
        meta_fe: Math.round(toNum(r.meta_fe)),
        meta_nube: Math.round(toNum(r.meta_nube)),
        meta_total: Math.round(toNum(r.meta_total)),
        anio_mes,
        novedad: norm(r.novedad) || "Sin novedad",
      };

      // Buscar existente por (documento_asesor, canal_direccion, anio_mes)
      const { data: existing, error: selErr } = await supabase
        .from("metas_asesores" as any)
        .select("id")
        .eq("documento_asesor", documento)
        .eq("canal_direccion", canal)
        .eq("anio_mes", anio_mes)
        .maybeSingle();

      if (selErr) {
        errors.push({ index: i, row: r, error: selErr.message });
        continue;
      }

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("metas_asesores" as any)
          .update(payload)
          .eq("id", existing.id);
        if (updErr) {
          errors.push({ index: i, row: r, error: updErr.message });
          continue;
        }
        summary.updated++;
      } else {
        const { error: insErr } = await supabase
          .from("metas_asesores" as any)
          .insert(payload);
        if (insErr) {
          errors.push({ index: i, row: r, error: insErr.message });
          continue;
        }
        summary.inserted++;
      }
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
