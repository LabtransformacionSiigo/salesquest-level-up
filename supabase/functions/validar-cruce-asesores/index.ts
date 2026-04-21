// Validación de cruce metas_asesores ↔ ejecucion_asesores
// Detecta advisors VN con metas asignadas pero FE/Nube en 0 mientras tienen unidades parciales,
// señal típica de fallos de match por documento_asesor (ID vs nombre).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isNumericDoc = (value: string) => /^\d{5,}$/.test(value.trim());

interface Alert {
  periodo: string;
  documento_meta: string;
  nombre_asesor: string | null;
  celula: string | null;
  canal_direccion: string;
  pais: string | null;
  meta_fe: number;
  meta_nube: number;
  meta_total: number;
  ventas_fe: number;
  ventas_nube: number;
  ventas_total: number;
  motivo: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const periodo = url.searchParams.get('periodo'); // YYYYMM opcional
    const canal = url.searchParams.get('canal'); // VN_ALIADOS | VN_EMPRESARIOS
    const limit = Number(url.searchParams.get('limit') || '500');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const year = new Date().getFullYear();
    const fromPeriod = periodo || `${year}01`;
    const toPeriod = periodo || `${year}12`;

    let metaQuery = supabase
      .from('metas_asesores')
      .select('anio_mes, documento_asesor, nombre_asesor, celula, canal_direccion, pais, meta_fe, meta_nube, meta_total, novedad')
      .gte('anio_mes', fromPeriod)
      .lte('anio_mes', toPeriod)
      .limit(20000);
    if (canal) metaQuery = metaQuery.eq('canal_direccion', canal);

    const ejecQuery = supabase
      .from('ejecucion_asesores')
      .select('periodo, documento_asesor, canal_direccion, pais, ventas_fe, ventas_nube, ventas_total')
      .gte('periodo', fromPeriod)
      .lte('periodo', toPeriod)
      .limit(50000);

    const [metaRes, ejecRes] = await Promise.all([metaQuery, ejecQuery]);
    if (metaRes.error) throw metaRes.error;
    if (ejecRes.error) throw ejecRes.error;

    // Indexar ejecución por (periodo|documento) y (periodo|nombreNormalizado)
    const ejecByDoc = new Map<string, any>();
    const ejecByName = new Map<string, any>();
    (ejecRes.data || []).forEach((row: any) => {
      const period = String(row.periodo);
      const docRaw = String(row.documento_asesor || '').trim();
      ejecByDoc.set(`${period}|${docRaw}`, row);
      ejecByName.set(`${period}|${normalize(docRaw)}`, row);
    });

    const alerts: Alert[] = [];
    let totalMetas = 0;
    let matchByDoc = 0;
    let matchByName = 0;
    let unmatched = 0;

    (metaRes.data || []).forEach((meta: any) => {
      const nov = meta.novedad ? String(meta.novedad).trim().toLowerCase() : '';
      if (nov && nov !== 'sin novedad') return;

      const period = String(meta.anio_mes);
      const metaDoc = String(meta.documento_asesor || '').trim();
      const metaName = meta.nombre_asesor ? normalize(meta.nombre_asesor) : '';

      totalMetas++;

      // Intento 1: match por documento exacto
      let ejec = ejecByDoc.get(`${period}|${metaDoc}`);
      if (ejec) {
        matchByDoc++;
      } else if (metaName) {
        // Intento 2: match por nombre normalizado
        ejec = ejecByName.get(`${period}|${metaName}`);
        if (ejec) matchByName++;
      }

      const metaFe = Number(meta.meta_fe) || 0;
      const metaNube = Number(meta.meta_nube) || 0;
      const metaTotal = Number(meta.meta_total) || 0;

      if (!ejec) {
        unmatched++;
        if (metaFe > 0 || metaNube > 0 || metaTotal > 0) {
          alerts.push({
            periodo: period,
            documento_meta: metaDoc,
            nombre_asesor: meta.nombre_asesor,
            celula: meta.celula,
            canal_direccion: meta.canal_direccion,
            pais: meta.pais,
            meta_fe: metaFe,
            meta_nube: metaNube,
            meta_total: metaTotal,
            ventas_fe: 0,
            ventas_nube: 0,
            ventas_total: 0,
            motivo: isNumericDoc(metaDoc)
              ? 'Sin ejecución cruzada (meta usa ID numérico, ejecución usa nombre)'
              : 'Sin ejecución cruzada para este advisor en el periodo',
          });
        }
        return;
      }

      const ventasFe = Number(ejec.ventas_fe) || 0;
      const ventasNube = Number(ejec.ventas_nube) || 0;
      const ventasTotal = Number(ejec.ventas_total) || 0;

      // Caso crítico: tiene ventas_total > 0 pero FE y Nube en 0 con metas activas
      const tieneMetaProducto = metaFe > 0 || metaNube > 0;
      const ejecucionParcial = ventasTotal > 0 && ventasFe === 0 && ventasNube === 0;

      if (tieneMetaProducto && ejecucionParcial) {
        alerts.push({
          periodo: period,
          documento_meta: metaDoc,
          nombre_asesor: meta.nombre_asesor,
          celula: meta.celula,
          canal_direccion: meta.canal_direccion,
          pais: meta.pais,
          meta_fe: metaFe,
          meta_nube: metaNube,
          meta_total: metaTotal,
          ventas_fe: ventasFe,
          ventas_nube: ventasNube,
          ventas_total: ventasTotal,
          motivo: 'Cruce parcial: ventas_total > 0 pero FE y Nube en 0 con metas asignadas',
        });
      }
    });

    const summary = {
      periodo_desde: fromPeriod,
      periodo_hasta: toPeriod,
      canal: canal || 'TODOS',
      total_metas_evaluadas: totalMetas,
      match_por_documento: matchByDoc,
      match_por_nombre: matchByName,
      sin_match: unmatched,
      alertas_generadas: alerts.length,
    };

    return new Response(
      JSON.stringify({
        summary,
        alerts: alerts.slice(0, limit),
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[validar-cruce-asesores] error', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
