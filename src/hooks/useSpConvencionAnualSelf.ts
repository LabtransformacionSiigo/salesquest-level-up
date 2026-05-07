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

      const metasGerentesMexQuery = !isAsesor && String(profile.pais || '').toUpperCase() === 'MEX' && celula
        ? supabase
            .from('metas_gerentes')
            .select('celula, anio_mes, coi, noi')
            .eq('celula', celula)
            .gte('anio_mes', `${year}01`)
            .lte('anio_mes', `${year}12`)
        : Promise.resolve({ data: [] as any[] });

      const [vgmRes, metasRes, metasAcvRes, vnMetGerenteRes, metasGerentesMexRes] = await Promise.all([
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
        metasGerentesMexQuery,
      ]);

      const metasAcvRows = [...(metasAcvRes.data || [])] as any[];
      const mexRows = [...(((metasGerentesMexRes as any)?.data as any[]) || [])]
        .sort((a, b) => String(b.anio_mes || '').localeCompare(String(a.anio_mes || '')));
      if (mexRows.length > 0) {
        const mes3to2: Record<string, string> = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
        const byPeriod = new Map<string, any>();
        mexRows.forEach((r) => { if (!byPeriod.has(String(r.anio_mes || ''))) byPeriod.set(String(r.anio_mes || ''), r); });
        const latest = mexRows[0];
        metasAcvRows.forEach((row) => {
          if (normalizeSpText(row.celula) !== normalizeSpText(celula)) return;
          const mm = mes3to2[String(row.mes || '').trim().toLowerCase().slice(0, 3)] || '';
          const mg = byPeriod.get(`${year}${mm}`) || latest;
          const nube = (Number(mg?.coi) || 0) + (Number(mg?.noi) || 0);
          if ((Number(row.meta_nube) || 0) === 0 && nube > 0) row.meta_nube = nube;
        });
      }

      const totalSp = computeSpConvencionAnualForCelula(
        {
          vgmRows: vgmRes.data || [],
          metaAsesorRows: metasRes.data || [],
          metaAcvRows: metasAcvRows,
          year,
          vnMetricasGerenteRows: ((vnMetGerenteRes as any)?.data as any[]) || [],
        },
        celula,
        profile.nombre || null
      );

      if (!cancelled) {
        setTotal(totalSp);
        if (totalSp > 0) setSpConvencionAnual(totalSp);
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.canal, profile?.role, profile?.celula, profile?.nombre, profile?.pais]);

  return total;
}
