// Computes SP Convención anual for the currently logged-in user (asesor o gerente VN).
// Used by Sidebar/Header so the badge stays correct on every page, not just /mi-performance.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeSpConvencionAnualForCelula, normalizeSpText } from '@/lib/sp-convencion-anual';
import { setSpConvencionAnual } from '@/lib/sp-convencion-store';

export function useSpConvencionAnualSelf(profile: any): number | null {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.canal) { setTotal(null); return; }
    const isVN = profile.canal === 'VN_ALIADOS' || profile.canal === 'VN_EMPRESARIOS';
    if (!isVN) { setTotal(null); return; }

    (async () => {
      const year = String(new Date().getFullYear());
      const isAsesor = profile.role === 'asesor';

      let celula = profile.celula || null;
      if (!celula && isAsesor && profile.nombre) {
        const { data } = await supabase
          .from('metas_asesores')
          .select('celula')
          .ilike('nombre_asesor', profile.nombre)
          .gte('anio_mes', `${year}01`)
          .lte('anio_mes', `${year}12`)
          .limit(1);
        celula = data?.[0]?.celula || null;
      }

      const vnMetGerenteQuery = !isAsesor
        ? (() => {
            let q = (supabase
              .from('vn_metricas_optimizadas' as any) as any)
              .select('mes_nro, tipo_producto1, familia, ventas, acv_total, celula, gerente_normalizado, gerente')
              .eq('scope', 'gerente')
              .gte('mes_nro', 1)
              .lte('mes_nro', 12)
              .limit(5000);
            if (profile.pais) q = q.eq('pais', String(profile.pais).toUpperCase());
            return q;
          })()
        : Promise.resolve({ data: [] as any[] });

      const [vgmRes, metasRes, metasAcvRes, vnMetGerenteRes] = await Promise.all([
        supabase
          .from('ventas_gerente_mensual')
          .select('periodo, familia, unidades, acv, celula, gerente, gerente_normalizado')
          .gte('periodo', `${year}01`)
          .lte('periodo', `${year}12`)
          .limit(10000),
        supabase
          .from('metas_asesores')
          .select('anio_mes, novedad, celula, gerente, meta_fe, meta_nube, meta_total, nombre_asesor')
          .gte('anio_mes', `${year}01`)
          .lte('anio_mes', `${year}12`)
          .limit(20000),
        supabase
          .from('metas_acv_gerentes')
          .select('celula, mes, meta_fe, meta_nube, meta_total_acv, meta_total_und, archivo')
          .limit(2000),
        vnMetGerenteQuery,
      ]);

      const totalSp = computeSpConvencionAnualForCelula(
        {
          vgmRows: vgmRes.data || [],
          metaAsesorRows: metasRes.data || [],
          metaAcvRows: metasAcvRes.data || [],
          year,
          vnMetricasGerenteRows: ((vnMetGerenteRes as any)?.data as any[]) || [],
        },
        celula,
        profile.nombre || null
      );

      if (!cancelled) {
        setTotal(totalSp);
        setSpConvencionAnual(totalSp);
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.canal, profile?.role, profile?.celula, profile?.nombre, profile?.pais]);

  return total;
}
