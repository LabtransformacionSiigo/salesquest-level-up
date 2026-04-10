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
  celula?: string | null;
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
  meta_acv: number;
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
        const canalNorm = profile.canal === 'VN_ALIADOS' ? 'Aliados' : profile.canal === 'VN_EMPRESARIOS' ? 'Empresarios' : '';

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
            : (isVN && profile.celula
              ? supabase.from('gerentes').select('id, nombre, email, canal, pais, activo, avatar_url').eq('celula', profile.celula).neq('id', profile.id).order('nombre')
              : supabase.from('asesores').select('*').eq('gerente_id', profile.id).order('nombre')),
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
          /* 14 – productividad_asesores aggregated by celula for VN gerente */
          isVN && profile.role !== 'asesor' && profile.celula
            ? supabase.from('productividad_asesores').select('anio_mes, ventas, meta, acv_f, cant_recomendados, sc_creados')
                .eq('celula', profile.celula)
                .gte('anio_mes', `${anioActual}01`)
                .lte('anio_mes', `${anioActual}12`)
                .limit(1000)
            : Promise.resolve({ data: [] }),
          /* 15 – metas_asesores for VN gerente: sum meta_total of asesores sin novedad */
          isVN && profile.role !== 'asesor' && profile.celula
            ? supabase.from('metas_asesores' as any).select('documento_asesor, meta_fe, meta_nube, meta_total, novedad, celula')
                .eq('celula', profile.celula)
                .eq('anio_mes', mesActual)
                .limit(1000)
            : Promise.resolve({ data: [] }),
          /* 16 – kpis_mensuales history for VN gerente (all months this year) */
          isVN
            ? supabase.from('kpis_mensuales').select('anio_mes, ventas, meta, acv_f, cant_recomendados, sc_creados')
                .eq('gerente_id', profile.id)
                .gte('anio_mes', `${anioActual}01`)
                .lte('anio_mes', `${anioActual}12`)
                .order('anio_mes', { ascending: false })
            : Promise.resolve({ data: [] }),
        ];

        const results = await Promise.all(queries);
        if (cancelled) return;

        const [rachaRes, kpisRes, medallasRes, feedRes, unidadesRes, ventasSemanaRes, acvRes, productRes, rankingRes, teamRes, acvAllMonthsRes, canjeablesRes, ejecRes, metasRes, celulaProductividadRes, vnMetasRes, vnHistoryRes] = results as any[];

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
          // VN gerente path: prefer productividad_asesores by celula
          const celulaRows = celulaProductividadRes?.data || [];
          const vnMetasAsesores = vnMetasRes?.data || [];

          // Calculate team meta units: sum meta_total of asesores WITHOUT novedad
          const asesoresSinNovedad = vnMetasAsesores.filter((r: any) => !r.novedad || r.novedad === '' || r.novedad.toLowerCase() === 'sin novedad');
          const metaEquipoUnidades = asesoresSinNovedad.reduce((s: number, r: any) => s + (Number(r.meta_total) || 0), 0);
          const metaFe = asesoresSinNovedad.reduce((s: number, r: any) => s + (Number(r.meta_fe) || 0), 0);
          const metaNube = asesoresSinNovedad.reduce((s: number, r: any) => s + (Number(r.meta_nube) || 0), 0);

          // Calculate team ACV meta from productividad_asesores.meta (current month, same celula)
          const currentMonthProductividad = celulaRows.filter((r: any) => r.anio_mes === mesActual);
          const metaAcvEquipo = currentMonthProductividad.reduce((s: number, r: any) => s + (Number(r.meta) || 0), 0);

          // Aggregate current month from celula productividad
          const currentMonthRows = celulaRows.filter((r: any) => r.anio_mes === mesActual);

          if (currentMonthRows.length > 0) {
            const totalVentas = currentMonthRows.reduce((s: number, r: any) => s + (Number(r.ventas) || 0), 0);
            const totalMetaUnidades = metaEquipoUnidades || currentMonthRows.reduce((s: number, r: any) => s + (Number(r.meta) || 0), 0);
            const totalAcv = currentMonthRows.reduce((s: number, r: any) => s + (Number(r.acv_f) || 0), 0);
            const totalReferidos = currentMonthRows.reduce((s: number, r: any) => s + (Number(r.cant_recomendados) || 0), 0);
            const totalSC = currentMonthRows.reduce((s: number, r: any) => s + (Number(r.sc_creados) || 0), 0);

            acvMes = totalAcv;
            // % cumplimiento basado en ACV / Meta ACV (como VC) para SP Convención
            // Si no hay meta ACV, fallback a unidades
            if (metaAcvEquipo > 0) {
              pctCumplimiento = Math.round((totalAcv / metaAcvEquipo) * 100);
            } else {
              pctCumplimiento = totalMetaUnidades > 0 ? Math.round((totalVentas / totalMetaUnidades) * 100) : 0;
            }

            ejecucion = {
              ventas_fe: 0,
              ventas_nube: 0,
              ventas_total: totalVentas,
              acv_total: totalAcv,
              cant_recomendados: totalReferidos,
              productividad: totalMetaUnidades > 0 ? Math.round((totalVentas / totalMetaUnidades) * 100) : 0,
            };
            metaAsesor = {
              meta_fe: metaFe,
              meta_nube: metaNube,
              meta_total: totalMetaUnidades,
              meta_acv: metaAcvEquipo,
            };
          } else {
            // Fallback to kpis_mes_actual
            const kpiData = kpisRes.data;
            acvMes = Number(kpiData?.acv_f) || 0;
            const metaFallback = metaEquipoUnidades || Number(kpiData?.meta) || 0;
            // % cumplimiento basado en ACV si hay meta ACV
            if (metaAcvEquipo > 0) {
              pctCumplimiento = Math.round((acvMes / metaAcvEquipo) * 100);
            } else {
              pctCumplimiento = metaFallback > 0 ? Math.round((Number(kpiData?.ventas || 0) / metaFallback) * 100) : 0;
            }

            if (kpiData && (Number(kpiData.ventas) > 0 || Number(kpiData.meta) > 0)) {
              const ventasTotal = Number(kpiData.ventas) || 0;
              ejecucion = {
                ventas_fe: 0,
                ventas_nube: 0,
                ventas_total: ventasTotal,
                acv_total: acvMes,
                cant_recomendados: Number(kpiData.cant_recomendados) || 0,
                productividad: metaFallback > 0 ? Math.round((ventasTotal / metaFallback) * 100) : 0,
              };
              metaAsesor = {
                meta_fe: metaFe,
                meta_nube: metaNube,
                meta_total: metaFallback,
                meta_acv: metaAcvEquipo,
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
                meta_acv: 0,
              };
            }
          }
        }

        // Build VN monthly cumplimiento from celula productividad or kpis_mensuales history
        let vnMonthlyCumpl: MonthlyCumplimiento[] = [];
        if (isVN && !isVC) {
          const celulaRows = celulaProductividadRes?.data || [];
          const metaGerenteData = metasGerentesRes?.data;
          const metaAcvEquipo = Number(metaGerenteData?.meta_total_acv) || Number(metaGerenteData?.cuota) || 0;

          if (celulaRows.length > 0 && profile.role !== 'asesor') {
            // Aggregate by month from celula productividad
            const monthAgg = new Map<string, { ventas: number; meta: number; acv: number; referidos: number }>();
            celulaRows.forEach((row: any) => {
              const period = String(row.anio_mes || '');
              const cur = monthAgg.get(period) || { ventas: 0, meta: 0, acv: 0, referidos: 0 };
              cur.ventas += Number(row.ventas) || 0;
              cur.meta += Number(row.meta) || 0;
              cur.acv += Number(row.acv_f) || 0;
              cur.referidos += Number(row.cant_recomendados) || 0;
              monthAgg.set(period, cur);
            });
            vnMonthlyCumpl = [...monthAgg.entries()]
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([period, { ventas, meta, acv, referidos }]) => {
                const monthNum = parseInt(period.slice(4), 10);
                const mesName = MONTH_NAMES_ES[monthNum - 1] || period;
                // % cumplimiento basado en ACV si hay meta ACV, sino unidades
                const pctVal = metaAcvEquipo > 0
                  ? Math.round((acv / metaAcvEquipo) * 100)
                  : (meta > 0 ? Math.round((ventas / meta) * 100) : 0);
                return { mes: mesName, acv, meta: metaAcvEquipo || meta, pct: pctVal };
              });
          } else {
            // Fallback to kpis_mensuales
            const vnHistoryRows = vnHistoryRes?.data || [];
            vnMonthlyCumpl = vnHistoryRows.map((row: any) => {
              const period = String(row.anio_mes || '');
              const monthNum = parseInt(period.slice(4), 10);
              const mesName = MONTH_NAMES_ES[monthNum - 1] || period;
              const ventas = Number(row.ventas) || 0;
              const meta = Number(row.meta) || 0;
              const acvF = Number(row.acv_f) || 0;
              const pctVal = metaAcvEquipo > 0
                ? Math.round((acvF / metaAcvEquipo) * 100)
                : (meta > 0 ? Math.round((ventas / meta) * 100) : 0);
              return { mes: mesName, acv: acvF || ventas, meta: metaAcvEquipo || meta, pct: pctVal };
            });
          }
          vcMonthlyCumplimiento = vnMonthlyCumpl;
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
          unidades: ejecucion?.ventas_total || Number(kpisRes.data?.ventas) || unidadesRes.count || 0,
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
  }, [profile?.id, profile?.canal, profile?.nombre, profile?.gerente_id, profile?.role, profile?.celula, isVcAdvisor, isVC, isVN]);

  return { ...state, isVcAdvisor, isVC, isVN };
};
