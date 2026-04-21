// Validación de consistencia FE / NUBE / Total por país y familia.
//
// Cruza `ejecucion_asesores` contra las reglas de medallas y retos
// (`catalogo_medallas`, `catalogo_retos`) y alerta cuando:
//
//   1. Existen unidades_total > 0 pero ventas_fe = 0 y ventas_nube = 0
//      (ejecución parcial sospechosa — típico fallo de categorización).
//   2. ventas_fe + ventas_nube > ventas_total (inconsistencia aritmética).
//   3. El país del registro no tiene la familia evaluada en el catálogo
//      oficial (`PRODUCT_FAMILIES_BY_COUNTRY`) — ej. familia CONTADOR
//      en MEX.
//   4. Existen medallas o retos activos para una familia (FE/NUBE) en un
//      país pero ningún asesor de ese país muestra ejecución para esa
//      familia en el período.
//
// Endpoint:
//   GET /functions/v1/validar-consistencia-familias
//        ?periodo=YYYYMM       (opcional; default = todos los del año actual)
//        &pais=COL|ECU|MEX|URU (opcional)
//        &canal=VN_ALIADOS|VN_EMPRESARIOS (opcional)
//        &limit=500            (opcional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

type Family = 'FE' | 'NUBE' | 'CONTADOR';
type Country = 'COL' | 'ECU' | 'MEX' | 'URU';

const FAMILIES_BY_COUNTRY: Record<Country, Family[]> = {
  COL: ['FE', 'NUBE', 'CONTADOR'],
  ECU: ['FE', 'NUBE'],
  MEX: ['FE', 'NUBE'], // No CONTADOR en MEX
  URU: ['FE', 'NUBE'],
};

interface Alert {
  tipo: string;
  severidad: 'alta' | 'media' | 'baja';
  pais: string | null;
  canal_direccion: string | null;
  periodo: string | null;
  documento_asesor?: string | null;
  familia?: string | null;
  detalle: string;
  ventas_fe?: number;
  ventas_nube?: number;
  ventas_total?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const periodo = url.searchParams.get('periodo');
    const paisFiltro = url.searchParams.get('pais');
    const canalFiltro = url.searchParams.get('canal');
    const limit = Number(url.searchParams.get('limit') || '500');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const year = new Date().getFullYear();
    const fromPeriod = periodo || `${year}01`;
    const toPeriod = periodo || `${year}12`;

    let ejecQuery = supabase
      .from('ejecucion_asesores')
      .select('periodo, documento_asesor, canal_direccion, pais, ventas_fe, ventas_nube, ventas_total')
      .gte('periodo', fromPeriod)
      .lte('periodo', toPeriod)
      .limit(50000);
    if (paisFiltro) ejecQuery = ejecQuery.eq('pais', paisFiltro);
    if (canalFiltro) ejecQuery = ejecQuery.eq('canal_direccion', canalFiltro);

    let medallasQuery = supabase
      .from('catalogo_medallas')
      .select('pais, canal, producto, activo')
      .eq('activo', true)
      .limit(5000);
    if (paisFiltro) medallasQuery = medallasQuery.eq('pais', paisFiltro);

    let retosQuery = supabase
      .from('catalogo_retos')
      .select('pais, familia, activo')
      .eq('activo', true)
      .limit(5000);
    if (paisFiltro) retosQuery = retosQuery.eq('pais', paisFiltro);

    const [ejecRes, medRes, retRes] = await Promise.all([
      ejecQuery,
      medallasQuery,
      retosQuery,
    ]);
    if (ejecRes.error) throw ejecRes.error;
    if (medRes.error) throw medRes.error;
    if (retRes.error) throw retRes.error;

    const alerts: Alert[] = [];

    // --- 1, 2: validación a nivel registro ---
    const ejecucionPorPaisFamilia = new Map<string, number>(); // `${pais}|${familia}` → suma ventas
    let totalRegistros = 0;
    let alertasParcial = 0;
    let alertasAritmetica = 0;

    (ejecRes.data || []).forEach((row: any) => {
      totalRegistros++;
      const pais = String(row.pais || '').toUpperCase();
      const fe = Number(row.ventas_fe) || 0;
      const nube = Number(row.ventas_nube) || 0;
      const total = Number(row.ventas_total) || 0;

      // Acumular por país/familia para validación 4
      ejecucionPorPaisFamilia.set(
        `${pais}|FE`,
        (ejecucionPorPaisFamilia.get(`${pais}|FE`) || 0) + fe,
      );
      ejecucionPorPaisFamilia.set(
        `${pais}|NUBE`,
        (ejecucionPorPaisFamilia.get(`${pais}|NUBE`) || 0) + nube,
      );

      // (1) Ejecución parcial sospechosa
      if (total > 0 && fe === 0 && nube === 0) {
        alertasParcial++;
        alerts.push({
          tipo: 'ejecucion_parcial',
          severidad: 'alta',
          pais,
          canal_direccion: row.canal_direccion,
          periodo: row.periodo,
          documento_asesor: row.documento_asesor,
          ventas_fe: fe,
          ventas_nube: nube,
          ventas_total: total,
          detalle:
            'ventas_total > 0 con FE y NUBE en 0 — posible fallo de categorización por SKU',
        });
      }

      // (2) Inconsistencia aritmética
      if (fe + nube > total) {
        alertasAritmetica++;
        alerts.push({
          tipo: 'inconsistencia_aritmetica',
          severidad: 'alta',
          pais,
          canal_direccion: row.canal_direccion,
          periodo: row.periodo,
          documento_asesor: row.documento_asesor,
          ventas_fe: fe,
          ventas_nube: nube,
          ventas_total: total,
          detalle: `FE (${fe}) + NUBE (${nube}) = ${fe + nube} > total (${total})`,
        });
      }
    });

    // --- 3: medallas/retos con familia inválida para el país ---
    let alertasFamiliaInvalida = 0;
    (medRes.data || []).forEach((m: any) => {
      const pais = String(m.pais || '').toUpperCase() as Country;
      const familias = FAMILIES_BY_COUNTRY[pais];
      if (!familias) return;
      // Inferir familia desde "producto" si coincide con un nombre de familia
      const producto = String(m.producto || '').trim().toUpperCase();
      if (['FE', 'NUBE', 'CONTADOR'].includes(producto)) {
        if (!familias.includes(producto as Family)) {
          alertasFamiliaInvalida++;
          alerts.push({
            tipo: 'familia_no_aplica_pais',
            severidad: 'media',
            pais,
            canal_direccion: m.canal,
            periodo: null,
            familia: producto,
            detalle: `Medalla activa con familia ${producto} en ${pais} (no soportada)`,
          });
        }
      }
    });

    (retRes.data || []).forEach((r: any) => {
      const pais = String(r.pais || '').toUpperCase() as Country;
      const familias = FAMILIES_BY_COUNTRY[pais];
      if (!familias) return;
      const fam = String(r.familia || '').trim().toUpperCase();
      if (['FE', 'NUBE', 'CONTADOR'].includes(fam)) {
        if (!familias.includes(fam as Family)) {
          alertasFamiliaInvalida++;
          alerts.push({
            tipo: 'familia_no_aplica_pais',
            severidad: 'media',
            pais,
            canal_direccion: null,
            periodo: null,
            familia: fam,
            detalle: `Reto activo con familia ${fam} en ${pais} (no soportada)`,
          });
        }
      }
    });

    // --- 4: medallas/retos activos por familia sin ejecución agregada ---
    let alertasSinEjecucion = 0;
    const reglasPorPaisFamilia = new Set<string>();
    (medRes.data || []).forEach((m: any) => {
      const producto = String(m.producto || '').trim().toUpperCase();
      const pais = String(m.pais || '').toUpperCase();
      if (['FE', 'NUBE'].includes(producto) && pais) {
        reglasPorPaisFamilia.add(`${pais}|${producto}`);
      }
    });
    (retRes.data || []).forEach((r: any) => {
      const fam = String(r.familia || '').trim().toUpperCase();
      const pais = String(r.pais || '').toUpperCase();
      if (['FE', 'NUBE'].includes(fam) && pais) {
        reglasPorPaisFamilia.add(`${pais}|${fam}`);
      }
    });

    reglasPorPaisFamilia.forEach((key) => {
      const ejecucion = ejecucionPorPaisFamilia.get(key) || 0;
      if (ejecucion === 0) {
        const [pais, familia] = key.split('|');
        alertasSinEjecucion++;
        alerts.push({
          tipo: 'regla_sin_ejecucion',
          severidad: 'baja',
          pais,
          canal_direccion: null,
          periodo: `${fromPeriod}–${toPeriod}`,
          familia,
          detalle: `Existen medallas/retos activos para ${familia} en ${pais} pero ejecución agregada = 0`,
        });
      }
    });

    const summary = {
      periodo_desde: fromPeriod,
      periodo_hasta: toPeriod,
      pais: paisFiltro || 'TODOS',
      canal: canalFiltro || 'TODOS',
      registros_evaluados: totalRegistros,
      alertas: {
        ejecucion_parcial: alertasParcial,
        inconsistencia_aritmetica: alertasAritmetica,
        familia_no_aplica_pais: alertasFamiliaInvalida,
        regla_sin_ejecucion: alertasSinEjecucion,
        total: alerts.length,
      },
      ejecucion_por_pais_familia: Object.fromEntries(ejecucionPorPaisFamilia),
    };

    return new Response(
      JSON.stringify({ summary, alerts: alerts.slice(0, limit) }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[validar-consistencia-familias] error', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
