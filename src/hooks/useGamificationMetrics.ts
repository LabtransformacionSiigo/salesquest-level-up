import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getVcAdvisorSnapshot, isVcAdvisorProfile, type VcAdvisorSnapshot } from '@/lib/vc-advisor-data';
import { aggregateProductBreakdown, type ProductBreakdownItem } from '@/lib/product-breakdown';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GamificationProfile {
  id: string;
  nombre?: string | null;
  canal?: string | null;
  pais?: string | null;
  gerente_id?: string | null;
  role?: string | null;
  sp_totales?: number;
}

interface MonthlyCumplimiento {
  mes: string;
  acv: number;
  meta: number;
  pct: number;
}

export interface EjecucionAsesor {
  ventas_fe: number;
  ventas_nube: number;
  ventas_total: number;
  acv_total: number;
  cant_recomendados: number;
  productividad: number;
}

export interface MetaAsesor {
  meta_fe: number;
  meta_nube: number;
  meta_total: number;
}

export interface GamificationMetrics {
  /* shared */
  loading: boolean;
  error: string | null;

  /* kpis_mes_actual row (gerentes) */
  kpis: any | null;

  /* racha */
  racha: any | null;

  /* medallas (latest 3) */
  medallas: any[];

  /* feed reconocimientos */
  feed: any[];

  /* headline numbers */
  acvMes: number;
  ventasSemana: number;
  pctCumplimiento: number;
  unidades: number;

  /* VC specific */
  vcSnapshot: VcAdvisorSnapshot | null;
  vcCumplimiento: { acv: number; meta: number; pct: number } | null;
  vcMonthlyCumplimiento: MonthlyCumplimiento[];
  acvData: any[];
  productBreakdown: ProductBreakdownItem[];
  upgradesCount: number;

  /* top ranking (for TopSiigoPointers widget) */
  topRanking: any[];

  /* team (for MiEquipo) */
  team: any[];

  /* Aliados/Empresarios specific */
  ejecucion: EjecucionAsesor | null;
  metaAsesor: MetaAsesor | null;

  /* VN product breakdown */
  vnProductBreakdown: ProductBreakdownItem[];
}

/* ------------------------------------------------------------------ */
/*  ISO-week helpers                                                   */
/* ------------------------------------------------------------------ */

const getISOWeek = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

function getISOWeekStartDate(week: number, year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const useGamificationMetrics = (profile: GamificationProfile | null | undefined) => {
  const [state, setState] = useState<GamificationMetrics>({
    loading: true,
    error: null,
    kpis: null,
    racha: null,
    medallas: [],
    feed: [],
    acvMes: 0,
    ventasSemana: 0,
    pctCumplimiento: 0,
    unidades: 0,
    vcSnapshot: null,
    vcCumplimiento: null,
    vcMonthlyCumplimiento: [],
    acvData: [],
    productBreakdown: [],
    upgradesCount: 0,
    topRanking: [],
    team: [],
    ejecucion: null,
    metaAsesor: null,
    vnProductBreakdown: [],
  });

  const isVcAdvisor = useMemo(() => isVcAdvisorProfile(profile), [profile?.canal, profile?.role, profile?.gerente_id, profile?.nombre]);
  const isVC = profile?.canal === 'VC';
  const isVN = profile?.canal === 'VN_ALIADOS' || profile?.canal === 'VN_EMPRESARIOS';

  useEffect(() => {
    if (!profile?.id) return;

    let cancelled = false;
    const now = new Date();
    const anioActual = now.getFullYear();
    const semanaISO = getISOWeek(now);
    const weekStart = getISOWeekStartDate(semanaISO, anioActual);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const currentMonthName = MONTH_NAMES_ES[now.getMonth()];
    const mesActual = `${anioActual}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const fetchAll = async () => {
      try {
        /* ============================================================ */
        /*  VC Advisor path                                              */
        /* ============================================================ */
        if (isVcAdvisor) {
          const [feedRes, snapshot, ventasMetaRes, upgradesRes, teamRes] = await Promise.all([
            supabase.from('feed_reconocimientos').select('*').limit(5),
            getVcAdvisorSnapshot(profile as any),
            supabase.from('ventas').select('acv_plus, meta, mes')
              .eq('gerente_id', profile.gerente_id!)
              .eq('canal', 'VC')
              .eq('anio', anioActual)
              .like('documento_factura', 'SUM-%')
              .eq('comercial', profile.nombre!),
            supabase.from('ventas').select('id', { count: 'exact', head: true })
              .eq('gerente_id', profile.gerente_id!)
              .eq('canal', 'VC')
              .eq('comercial', profile.nombre!)
              .eq('categoria_producto_venta', 'Upgrade')
              .eq('anio', anioActual),
            supabase.from('comerciales_por_gerente' as any).select('nombre, gerente_id')
              .eq('gerente_id', profile.gerente_id!),
          ]);

          if (cancelled) return;

          const metrics = snapshot?.metrics;

          const monthlyMap = new Map<string, { acv: number; meta: number }>();
          (ventasMetaRes.data || []).forEach((v: any) => {
            const mes = v.mes || 'Unknown';
            const entry = monthlyMap.get(mes) || { acv: 0, meta: 0 };
            entry.acv += Number(v.acv_plus) || 0;
            entry.meta += Number(v.meta) || 0;
            monthlyMap.set(mes, entry);
          });
          const monthlyCumpl = [...monthlyMap.entries()].map(([mes, { acv, meta }]) => ({
            mes, acv, meta, pct: meta > 0 ? Math.round((acv / meta) * 100) : 0,
          }));
          const totalAcv = monthlyCumpl.reduce((s, m) => s + m.acv, 0);
          const totalMeta = monthlyCumpl.reduce((s, m) => s + m.meta, 0);

          setState({
            loading: false,
            error: null,
            kpis: {
              ventas: metrics?.currentMonthRevenue || 0,
              acv_f: metrics?.currentMonthAcv || 0,
              sc_creados: metrics?.currentMonthUnits || 0,
            },
            racha: null,
            medallas: snapshot?.medals || [],
            feed: feedRes.data || [],
            acvMes: metrics?.totalAcv || 0,
            ventasSemana: metrics?.currentWeekRevenue || 0,
            pctCumplimiento: 0,
            unidades: metrics?.currentMonthUnits || 0,
            vcSnapshot: snapshot,
            vcCumplimiento: { acv: totalAcv, meta: totalMeta, pct: totalMeta > 0 ? Math.round((totalAcv / totalMeta) * 100) : 0 },
            vcMonthlyCumplimiento: monthlyCumpl,
            acvData: [],
            productBreakdown: [],
            upgradesCount: upgradesRes.count || 0,
            topRanking: [],
            team: (teamRes.data || []).map((c: any) => ({
              id: c.nombre, nombre: c.nombre, activo: true, canal: 'VC', pais: profile.pais, email: '',
            })),
            ejecucion: null,
            metaAsesor: null,
            vnProductBreakdown: [],
          });
          return;
        }

        /* ============================================================ */
        /*  Gerente path (VC or VN)                                      */
        /* ============================================================ */
        const queries = [
          /* 0 */ supabase.from('racha_activa').select('*').eq('gerente_id', profile.id).maybeSingle(),
          /* 1 */ supabase.from('kpis_mes_actual').select('*').eq('gerente_id', profile.id).maybeSingle(),
          /* 2 */ supabase.from('medallas').select('*').eq('gerente_id', profile.id).order('fecha_desbloqueo', { ascending: false }).limit(3),
          /* 3 */ supabase.from('feed_reconocimientos').select('*').limit(5),
          /* 4 */ supabase.from('ventas').select('id', { count: 'exact', head: true })
            .eq('gerente_id', profile.id)
            .gte('fecha_facturacion', `${anioActual}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
            .lt('fecha_facturacion', `${anioActual}-${String(now.getMonth() + 2).padStart(2, '0')}-01`),
          /* 5 */ supabase.from('ventas').select('valor_producto')
            .eq('gerente_id', profile.id)
            .gte('fecha_facturacion', weekStart.toISOString().split('T')[0])
            .lt('fecha_facturacion', weekEnd.toISOString().split('T')[0]),
          /* 6 */ isVC
            ? supabase.from('acv_vc_mensual').select('*').eq('gerente_id', profile.id).eq('mes', currentMonthName).eq('anio', anioActual).limit(1)
            : Promise.resolve({ data: [] }),
          /* 7 */ isVC
            ? supabase.from('desglose_producto_vc').select('producto, acv_total, unidades, mes').eq('gerente_id', profile.id).eq('anio', anioActual).eq('mes', currentMonthName)
            : Promise.resolve({ data: null }),
          /* 8 */
          supabase.from('ranking_general').select('*').order('sp_totales', { ascending: false }).limit(5),
          /* 9 */
          isVC
            ? supabase.from('comerciales_por_gerente' as any).select('nombre, gerente_id').eq('gerente_id', profile.id)
            : supabase.from('asesores').select('*').eq('gerente_id', profile.id).order('nombre'),
          /* 10 */ isVC
            ? supabase.from('acv_vc_mensual').select('*').eq('gerente_id', profile.id).eq('anio', anioActual)
            : Promise.resolve({ data: [] }),
          /* 11 */
          supabase.from('gerentes').select('id, sp_canje'),
          /* 12 – ejecucion_asesores for VN asesor role */
          isVN && profile.role === 'asesor'
            ? supabase.from('ejecucion_asesores').select('*').eq('periodo', mesActual).limit(1000)
            : Promise.resolve({ data: [] }),
          /* 13 – metas_asesores for VN asesor role */
          isVN && profile.role === 'asesor'
            ? supabase.from('metas_asesores').select('*').eq('anio_mes', mesActual).limit(1000)
            : Promise.resolve({ data: [] }),
          /* 14 – ventas_diarias for VN gerente (read own sales by name) */
          isVN && profile.role !== 'asesor'
            ? supabase.from('ventas_diarias').select('fecha, unidades, acv, tipo_producto, canal_direccion')
                .eq('canal_direccion', profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Empresarios')
                .ilike('asesor', `%${profile.nombre}%`)
            : Promise.resolve({ data: [] }),
          /* 15 – metas_gerentes for VN gerente */
          isVN && profile.role !== 'asesor'
            ? supabase.from('metas_gerentes').select('meta_total_und, meta_total_acv, fe, nube, recomendados')
                .eq('canal_direccion', profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Empresarios')
                .ilike('celula', `%${profile.nombre}%`)
                .limit(1)
            : Promise.resolve({ data: [] }),
        ];

        const results = await Promise.all(queries);
        if (cancelled) return;

        const [rachaRes, kpisRes, medallasRes, feedRes, unidadesRes, ventasSemanaRes, acvRes, productRes, rankingRes, teamRes, acvAllMonthsRes, canjeablesRes, ejecRes, metasRes, vnVentasRes, vnMetasRes] = results as any[];

        const weekRevenue = (ventasSemanaRes.data || []).reduce((s: number, v: any) => s + (Number(v.valor_producto) || 0), 0);
        const acvRows = acvRes.data || [];

        let acvMes = 0;
        let pctCumplimiento = 0;
        let vcCumplimiento: { acv: number; meta: number; pct: number } | null = null;
        let vcMonthlyCumplimiento: MonthlyCumplimiento[] = [];
        let productBreakdown: ProductBreakdownItem[] = [];
        let upgradesCount = 0;
        let ejecucion: EjecucionAsesor | null = null;
        let metaAsesor: MetaAsesor | null = null;

        if (isVC) {
          const acvRow = acvRows[0];
          acvMes = Number(acvRow?.acv_plus_total) || 0;
          const metaRow = Number(acvRow?.meta_total) || 0;
          pctCumplimiento = metaRow > 0 ? Math.round((acvMes / metaRow) * 100) : 0;

          vcCumplimiento = { acv: acvMes, meta: metaRow, pct: pctCumplimiento };

          const allMonthRows = acvAllMonthsRes.data || [];
          const monthOrder = [...MONTH_NAMES_ES].reverse();
          vcMonthlyCumplimiento = (allMonthRows as any[]).map((row: any) => {
            const acv = Number(row.acv_plus_total) || 0;
            const meta = Number(row.meta_total) || 0;
            return { mes: row.mes || 'Unknown', acv, meta, pct: meta > 0 ? Math.round((acv / meta) * 100) : 0 };
          }).sort((a, b) => monthOrder.indexOf(a.mes) - monthOrder.indexOf(b.mes));

          if (productRes.data) {
            const items = (productRes.data as any[]);
            productBreakdown = aggregateProductBreakdown(
              items.map((r: any) => ({ label: r.producto, value: Number(r.acv_total) || 0, units: Number(r.unidades) || 0 }))
            );
            const upgradeRow = productBreakdown.find((r) => r.label.toLowerCase() === 'upgrade');
            upgradesCount = upgradeRow ? Number(upgradeRow.units) || 0 : 0;
          }
        } else {
          // VN gerente path: prefer ventas_diarias + metas_gerentes over kpis_mes_actual
          const vnVentas = vnVentasRes?.data || [];
          const vnMeta = vnMetasRes?.data?.[0] || null;

          if (vnVentas.length > 0) {
            // Filter current month only
            const currentMonthPrefix = `${anioActual}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const currentMonthVentas = vnVentas.filter((v: any) => String(v.fecha || '').startsWith(currentMonthPrefix));
            const totalUnidades = currentMonthVentas.reduce((s: number, v: any) => s + (Number(v.unidades) || 0), 0);
            const totalAcv = currentMonthVentas.reduce((s: number, v: any) => s + (Number(v.acv) || 0), 0);
            const metaTotal = Number(vnMeta?.meta_total_und) || Number(vnMeta?.meta_total_acv) || 0;

            acvMes = totalAcv;
            pctCumplimiento = metaTotal > 0 ? Math.round((totalUnidades / metaTotal) * 100) : 0;

            // Build ejecucion-like data for VN gerente dashboard
            const feVentas = currentMonthVentas
              .filter((v: any) => {
                const tp = String(v.tipo_producto || '').toUpperCase();
                return tp.includes('FE') || tp.includes('FACTUR');
              })
              .reduce((s: number, v: any) => s + (Number(v.unidades) || 0), 0);
            const nubeVentas = currentMonthVentas
              .filter((v: any) => {
                const tp = String(v.tipo_producto || '').toUpperCase();
                return tp.includes('NUBE') || tp.includes('CLOUD');
              })
              .reduce((s: number, v: any) => s + (Number(v.unidades) || 0), 0);

            ejecucion = {
              ventas_fe: feVentas,
              ventas_nube: nubeVentas,
              ventas_total: totalUnidades,
              acv_total: totalAcv,
              cant_recomendados: 0,
              productividad: metaTotal > 0 ? Math.round((totalUnidades / metaTotal) * 100) : 0,
            };
            metaAsesor = {
              meta_fe: Number(vnMeta?.fe) || 0,
              meta_nube: Number(vnMeta?.nube) || 0,
              meta_total: metaTotal,
            };
          } else {
            // Fallback to kpis_mes_actual (populated by productividad sync)
            const kpiData = kpisRes.data;
            acvMes = Number(kpiData?.acv_f) || 0;
            pctCumplimiento = Number(kpiData?.pct_cumplimiento) || 0;

            // Build ejecucion/metaAsesor from kpis so VN progress bars render
            if (kpiData && (Number(kpiData.ventas) > 0 || Number(kpiData.meta) > 0)) {
              const ventasTotal = Number(kpiData.ventas) || 0;
              const metaTotal = Number(kpiData.meta) || 0;
              ejecucion = {
                ventas_fe: 0,
                ventas_nube: 0,
                ventas_total: ventasTotal,
                acv_total: acvMes,
                cant_recomendados: Number(kpiData.cant_recomendados) || 0,
                productividad: metaTotal > 0 ? Math.round((ventasTotal / metaTotal) * 100) : 0,
              };
              metaAsesor = {
                meta_fe: 0,
                meta_nube: 0,
                meta_total: metaTotal,
              };
            }
          }
        }

        // Parse ejecucion/meta for VN asesor
        if (isVN && profile.role === 'asesor') {
          // Find matching row by asesor documento from asesores table
          const { data: asesorData } = await supabase
            .from('asesores')
            .select('documento, canal_direccion')
            .eq('id', profile.id)
            .maybeSingle();

          if (asesorData?.documento) {
            const matchingEjec = (ejecRes.data || []).find(
              (e: any) => e.documento_asesor === asesorData.documento && e.canal_direccion === asesorData.canal_direccion
            );
            const matchingMeta = (metasRes.data || []).find(
              (m: any) => m.documento_asesor === asesorData.documento && m.canal_direccion === asesorData.canal_direccion
            );

            if (matchingEjec) {
              ejecucion = {
                ventas_fe: Number(matchingEjec.ventas_fe) || 0,
                ventas_nube: Number(matchingEjec.ventas_nube) || 0,
                ventas_total: Number(matchingEjec.ventas_total) || 0,
                acv_total: Number(matchingEjec.acv_total) || 0,
                cant_recomendados: Number(matchingEjec.cant_recomendados) || 0,
                productividad: Number(matchingEjec.productividad) || 0,
              };
            }
            if (matchingMeta) {
              metaAsesor = {
                meta_fe: Number(matchingMeta.meta_fe) || 0,
                meta_nube: Number(matchingMeta.meta_nube) || 0,
                meta_total: Number(matchingMeta.meta_total) || 0,
              };
            }
          }
        }

        // Format top ranking
        const canjeablesMap = new Map<string, number>();
        (canjeablesRes.data || []).forEach((row: any) => {
          if (row.id) canjeablesMap.set(row.id, Number(row.sp_canje) || 0);
        });

        const topRanking = (rankingRes.data || []).map((r: any) => ({
          id: r.id, nombre: r.nombre,
          sp_totales: Number(r.sp_totales) || 0,
          sp_canje: canjeablesMap.get(r.id) || 0,
          canal: r.canal,
          nivel: r.nivel,
        }));

        const team = isVC
          ? (teamRes.data || []).map((c: any) => ({
              id: c.nombre, nombre: c.nombre, activo: true, canal: 'VC', pais: profile.pais, email: '',
            }))
          : teamRes.data || [];

        setState({
          loading: false,
          error: null,
          kpis: kpisRes.data,
          racha: rachaRes.data,
          medallas: medallasRes.data || [],
          feed: feedRes.data || [],
          acvMes,
          ventasSemana: weekRevenue,
          pctCumplimiento,
          unidades: unidadesRes.count || 0,
          vcSnapshot: null,
          vcCumplimiento,
          vcMonthlyCumplimiento,
          acvData: acvRows,
          productBreakdown,
          upgradesCount,
          topRanking,
          team,
          ejecucion,
          metaAsesor,
          vnProductBreakdown: [],
        });
      } catch (err: any) {
        if (!cancelled) {
          console.error('useGamificationMetrics error:', err);
          setState(prev => ({ ...prev, loading: false, error: err.message || 'Error cargando métricas' }));
        }
      }
    };

    setState(prev => ({ ...prev, loading: true, error: null }));
    fetchAll();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.canal, profile?.nombre, profile?.gerente_id, profile?.role, isVcAdvisor, isVC, isVN]);

  return { ...state, isVcAdvisor, isVC, isVN };
};
