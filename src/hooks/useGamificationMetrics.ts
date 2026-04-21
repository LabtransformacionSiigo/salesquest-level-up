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
  ventas_fe?: number;
  ventas_nube?: number;
  ventas_total?: number;
  meta_fe?: number;
  meta_nube?: number;
  meta_total?: number;
  pct_fe?: number;
  pct_nube?: number;
  pct_total?: number;
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

export interface AsesorPerformance {
  nombre: string;
  documento: string;
  pct_acv: number;
  pct_fe: number;
  pct_nube: number;
  pct_total: number;
  acv: number;
  meta_acv: number;
  ventas_fe: number;
  meta_fe: number;
  ventas_nube: number;
  meta_nube: number;
  ventas_total: number;
  meta_total: number;
  recomendados: number;
  tiene_novedad: boolean;
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

  /* VN team performance dashboard (only gerentes VN) */
  teamAsesorPerformance: AsesorPerformance[];
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

const normalizeComparableText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeVnMetaAcv = (value: number | null | undefined) => {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  return Math.abs(n) < 100_000 ? Math.round(n * 1_000_000) : Math.round(n);
};

const normalizeStoredAcv = (value: number | null | undefined) => {
  const n = Number(value) || 0;
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 1_000_000_000_000) return Math.round(n / 1_000_000_000);
  return Math.round(n);
};

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const useGamificationMetrics = (
  profile: GamificationProfile | null | undefined,
  periodoOverride?: string,
) => {
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
    teamAsesorPerformance: [],
  });

  const isVcAdvisor = useMemo(() => isVcAdvisorProfile(profile), [profile?.canal, profile?.role, profile?.gerente_id, profile?.nombre]);
  const isVC = profile?.canal === 'VC';
  const isVN = profile?.canal === 'VN_ALIADOS' || profile?.canal === 'VN_EMPRESARIOS';

  useEffect(() => {
    if (!profile?.id) return;

    let cancelled = false;
    const now = new Date();
    // Resolve periodo (YYYYMM). Defaults to current month if no override provided.
    const periodoSel = periodoOverride && /^\d{6}$/.test(periodoOverride)
      ? periodoOverride
      : `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const anioActual = parseInt(periodoSel.slice(0, 4), 10);
    const mesIdx = parseInt(periodoSel.slice(4), 10) - 1;
    const semanaISO = getISOWeek(now);
    const weekStart = getISOWeekStartDate(semanaISO, anioActual);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const currentMonthName = MONTH_NAMES_ES[mesIdx];
    const mesActual = periodoSel;

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
          const monthOrderAdv = [...MONTH_NAMES_ES];
          const monthlyCumpl = [...monthlyMap.entries()]
            .map(([mes, { acv, meta }]) => ({
              mes, acv, meta, pct: meta > 0 ? Math.round((acv / meta) * 100) : 0,
            }))
            .sort((a, b) => monthOrderAdv.indexOf(a.mes) - monthOrderAdv.indexOf(b.mes));
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
            teamAsesorPerformance: [],
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
            .gte('fecha_facturacion', `${anioActual}-${String(mesIdx + 1).padStart(2, '0')}-01`)
            .lt('fecha_facturacion', `${anioActual}-${String(mesIdx + 2).padStart(2, '0')}-01`),
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
          /* 12 – ejecucion_asesores for VN (gerente OR asesor) - ALL months this year */
          isVN
            ? supabase.from('ejecucion_asesores').select('*')
                .gte('periodo', `${anioActual}01`)
                .lte('periodo', `${anioActual}12`)
                .limit(10000)
            : Promise.resolve({ data: [] }),
          /* 13 – metas_asesores for VN asesor role */
          isVN && profile.role === 'asesor'
            ? supabase.from('metas_asesores').select('*').eq('anio_mes', mesActual).limit(1000)
            : Promise.resolve({ data: [] }),
          /* 14 – productividad_asesores aggregated by celula for VN gerente */
          isVN && profile.role !== 'asesor' && profile.celula
            ? supabase.from('productividad_asesores').select('asesor, anio_mes, ventas, meta, acv_f, cant_recomendados, sc_creados')
                .eq('celula', profile.celula)
                .gte('anio_mes', `${anioActual}01`)
                .lte('anio_mes', `${anioActual}12`)
                .limit(1000)
            : Promise.resolve({ data: [] }),
          /* 15 – metas_asesores for VN gerente: fetch by gerente name for team aggregation */
          isVN && profile.role !== 'asesor' && profile.nombre
            ? supabase.from('metas_asesores' as any).select('anio_mes, documento_asesor, nombre_asesor, meta_fe, meta_nube, meta_total, novedad, celula, gerente')
                .gte('anio_mes', `${anioActual}01`)
                .lte('anio_mes', `${anioActual}12`)
                .limit(5000)
            : Promise.resolve({ data: [] }),
          /* 16 – kpis_mensuales history for VN gerente (all months this year) */
          isVN
            ? supabase.from('kpis_mensuales').select('anio_mes, ventas, meta, acv_f, cant_recomendados, sc_creados')
                .eq('gerente_id', profile.id)
                .gte('anio_mes', `${anioActual}01`)
                .lte('anio_mes', `${anioActual}12`)
                .order('anio_mes', { ascending: false })
            : Promise.resolve({ data: [] }),
          /* 17 – metas_gerentes for VN gerente: meta_total_acv */
          isVN && profile.role !== 'asesor' && profile.celula
            ? supabase.from('metas_gerentes' as any).select('meta_total_acv, meta_total_und, fe, nube, celula')
                .eq('celula', profile.celula)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ];

        const results = await Promise.all(queries);
        if (cancelled) return;

        const [rachaRes, kpisRes, medallasRes, feedRes, unidadesRes, ventasSemanaRes, acvRes, productRes, rankingRes, teamRes, acvAllMonthsRes, canjeablesRes, ejecRes, metasRes, celulaProductividadRes, vnMetasRes, vnHistoryRes, metasGerentesRes] = results as any[];

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
        let vnMetaAcvActual = 0;
        let vnAsesoresConNovedad = new Set<string>();
        let vnCelulaRows: any[] = [];
        let vnTeamEjecAll: any[] = [];
        let vnCurrentMetaFe = 0;
        let vnCurrentMetaNube = 0;
        let vnCurrentMetaTotal = 0;
        let getMetaContextForPeriod = (_period: string) => ({
          rows: [] as any[],
          asesoresConNovedad: new Set<string>(),
          metaFe: 0,
          metaNube: 0,
          metaTotal: 0,
        });

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
          vnCelulaRows = celulaRows;

          // Build team asesor names from productividad_asesores (celula)
          const teamAsesorNames = new Set<string>();
          celulaRows.forEach((r: any) => {
            if (r.asesor) teamAsesorNames.add(normalizeComparableText(r.asesor));
          });

          const gerenteNombre = normalizeComparableText(profile.nombre);
          const celulaGerente = normalizeComparableText(profile.celula);

          const getTeamMetaRowsForPeriod = (period: string) => {
            const periodRows = vnMetasAsesores.filter((row: any) => String(row.anio_mes || '') === period);
            const rowsByCelula = celulaGerente
              ? periodRows.filter((row: any) => normalizeComparableText(row.celula) === celulaGerente)
              : [];

            const gerenteNamesFromCelula = new Set(
              rowsByCelula
                .map((row: any) => normalizeComparableText(row.gerente))
                .filter(Boolean)
            );

            if (gerenteNamesFromCelula.size > 0) {
              return periodRows.filter((row: any) => gerenteNamesFromCelula.has(normalizeComparableText(row.gerente)));
            }

            if (rowsByCelula.length > 0) {
              return rowsByCelula;
            }

            if (gerenteNombre) {
              const rowsByGerente = periodRows.filter((row: any) => normalizeComparableText(row.gerente) === gerenteNombre);
              if (rowsByGerente.length > 0) return rowsByGerente;
            }

            if (teamAsesorNames.size > 0) {
              return periodRows.filter((row: any) => teamAsesorNames.has(normalizeComparableText(row.nombre_asesor)));
            }

            return [];
          };

          getMetaContextForPeriod = (period: string) => {
            const rows = getTeamMetaRowsForPeriod(period);
            const asesoresConNovedad = new Set<string>();

            rows.forEach((row: any) => {
              const novedad = normalizeComparableText(row.novedad);
              if (novedad && novedad !== 'sin novedad') {
                const nombre = normalizeComparableText(row.nombre_asesor);
                const documento = normalizeComparableText(row.documento_asesor);
                if (nombre) asesoresConNovedad.add(nombre);
                if (documento) asesoresConNovedad.add(documento);
              }
            });

            const rowsSinNovedad = rows.filter((row: any) => {
              const novedad = normalizeComparableText(row.novedad);
              return !novedad || novedad === 'sin novedad';
            });

            return {
              rows,
              asesoresConNovedad,
              metaFe: rowsSinNovedad.reduce((s: number, row: any) => s + (Number(row.meta_fe) || 0), 0),
              metaNube: rowsSinNovedad.reduce((s: number, row: any) => s + (Number(row.meta_nube) || 0), 0),
              metaTotal: rowsSinNovedad.reduce((s: number, row: any) => s + (Number(row.meta_total) || 0), 0),
            };
          };

          const metaContextActual = getMetaContextForPeriod(mesActual);
          const metaFe = metaContextActual.metaFe;
          const metaNube = metaContextActual.metaNube;
          const metaEquipoUnidades = metaContextActual.metaTotal;
          vnAsesoresConNovedad = metaContextActual.asesoresConNovedad;

          // Meta ACV: prefer metas_gerentes.meta_total_acv, fallback to productividad_asesores.meta
          const metaGerenteData = metasGerentesRes?.data;
          let metaAcvEquipo = 0;
          if (metaGerenteData && Number(metaGerenteData.meta_total_acv) > 0) {
            metaAcvEquipo = normalizeVnMetaAcv(metaGerenteData.meta_total_acv);
          } else {
            // Fallback: sum from productividad_asesores.meta (current month, excluding novedad)
             const currentMonthProductividad = celulaRows.filter((r: any) => {
              const period = String(r.anio_mes || '');
               const asesorName = normalizeComparableText(r.asesor);
               return period === mesActual && !metaContextActual.asesoresConNovedad.has(asesorName);
            });
            metaAcvEquipo = currentMonthProductividad.reduce((s: number, r: any) => s + normalizeVnMetaAcv(r.meta), 0);
          }
          vnMetaAcvActual = metaAcvEquipo;

          // Aggregate ejecucion from ejecucion_asesores matched by team names (CURRENT MONTH only)
          const allEjecRows = ejecRes?.data || [];
          const teamEjecRowsAll = allEjecRows.filter((e: any) => {
            const nombre = normalizeComparableText(e.documento_asesor);
            return teamAsesorNames.has(nombre);
          });
          const teamEjecRows = teamEjecRowsAll.filter((e: any) => String(e.periodo) === mesActual);
          const teamVentasFe = teamEjecRows.reduce((s: number, r: any) => s + (Number(r.ventas_fe) || 0), 0);
          const teamVentasNube = teamEjecRows.reduce((s: number, r: any) => s + (Number(r.ventas_nube) || 0), 0);
          const teamVentasTotal = teamEjecRows.reduce((s: number, r: any) => s + (Number(r.ventas_total) || 0), 0);
          vnTeamEjecAll = teamEjecRowsAll;
          vnCurrentMetaFe = metaFe;
          vnCurrentMetaNube = metaNube;
          vnCurrentMetaTotal = metaEquipoUnidades;

          // Aggregate current month from celula productividad
          const currentMonthRows = celulaRows.filter((r: any) => r.anio_mes === mesActual);

          if (currentMonthRows.length > 0) {
            const totalVentas = currentMonthRows.reduce((s: number, r: any) => s + (Number(r.ventas) || 0), 0);
            const totalMetaUnidades = metaEquipoUnidades || currentMonthRows.reduce((s: number, r: any) => s + (Number(r.meta) || 0), 0);
            const totalAcv = currentMonthRows.reduce((s: number, r: any) => s + normalizeStoredAcv(r.acv_f), 0);
            const totalReferidos = currentMonthRows.reduce((s: number, r: any) => s + (Number(r.cant_recomendados) || 0), 0);

            acvMes = totalAcv;
            pctCumplimiento = metaAcvEquipo > 0 ? Math.round((totalAcv / metaAcvEquipo) * 100) : 0;

            // Use ejecucion_asesores for FE/Nube, productividad for totals
            ejecucion = {
              ventas_fe: teamVentasFe || 0,
              ventas_nube: teamVentasNube || 0,
              ventas_total: teamVentasTotal || totalVentas,
              acv_total: totalAcv,
              cant_recomendados: totalReferidos,
              productividad: totalMetaUnidades > 0 ? Math.round((teamVentasTotal || totalVentas) / totalMetaUnidades * 100) : 0,
            };
            metaAsesor = {
              meta_fe: metaFe,
              meta_nube: metaNube,
              meta_total: metaEquipoUnidades || totalMetaUnidades,
              meta_acv: metaAcvEquipo,
            };
            vcCumplimiento = metaAcvEquipo > 0 ? { acv: totalAcv, meta: metaAcvEquipo, pct: pctCumplimiento } : null;
          } else {
            // Fallback to kpis_mes_actual
            const kpiData = kpisRes.data;
            acvMes = normalizeStoredAcv(kpiData?.acv_f);
            const metaFallback = metaEquipoUnidades || Number(kpiData?.meta) || 0;
            pctCumplimiento = metaAcvEquipo > 0 ? Math.round((acvMes / metaAcvEquipo) * 100) : 0;

            if (kpiData && (Number(kpiData.ventas) > 0 || Number(kpiData.meta) > 0)) {
              const ventasTotal = Number(kpiData.ventas) || 0;
              ejecucion = {
                ventas_fe: teamVentasFe || 0,
                ventas_nube: teamVentasNube || 0,
                ventas_total: teamVentasTotal || ventasTotal,
                acv_total: acvMes,
                cant_recomendados: Number(kpiData.cant_recomendados) || 0,
                productividad: metaFallback > 0 ? Math.round((teamVentasTotal || ventasTotal) / metaFallback * 100) : 0,
              };
              metaAsesor = {
                meta_fe: metaFe,
                meta_nube: metaNube,
                meta_total: metaFallback,
                meta_acv: metaAcvEquipo,
              };
            }
            vcCumplimiento = metaAcvEquipo > 0 ? { acv: acvMes, meta: metaAcvEquipo, pct: pctCumplimiento } : null;
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

          if (asesorData?.documento || profile.nombre) {
            const { data: productividadAdvisorRows } = await supabase
              .from('productividad_asesores')
              .select('asesor, meta, acv_f, ventas, cant_recomendados')
              .eq('anio_mes', mesActual)
              .limit(2000);

            const docAsesor = asesorData?.documento || '';
            const canalAsesor = asesorData?.canal_direccion || '';
            const nombreNorm = normalizeComparableText(profile.nombre);

            // Match ejecucion: 1) por documento exacto, 2) por nombre normalizado en documento_asesor (VN guarda nombre)
            const matchingEjec = (ejecRes.data || []).find((e: any) => {
              if (String(e.periodo) !== mesActual) return false;
              if (canalAsesor && e.canal_direccion !== canalAsesor) return false;
              if (docAsesor && e.documento_asesor === docAsesor) return true;
              return nombreNorm && normalizeComparableText(e.documento_asesor) === nombreNorm;
            });
            const matchingMeta = (metasRes.data || []).find((m: any) => {
              if (canalAsesor && m.canal_direccion !== canalAsesor) return false;
              if (docAsesor && m.documento_asesor === docAsesor) return true;
              return nombreNorm && normalizeComparableText(m.nombre_asesor) === nombreNorm;
            });
            const matchingProductividad = (productividadAdvisorRows || []).find(
              (p: any) => normalizeComparableText(p.asesor) === nombreNorm
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
                meta_acv: normalizeVnMetaAcv(matchingProductividad?.meta),
              };
              vnCurrentMetaFe = Number(matchingMeta.meta_fe) || 0;
              vnCurrentMetaNube = Number(matchingMeta.meta_nube) || 0;
              vnCurrentMetaTotal = Number(matchingMeta.meta_total) || 0;
            }
            // Populate per-month ejec rows for this advisor (history) — match by doc OR by normalized name
            vnTeamEjecAll = (ejecRes.data || []).filter((e: any) => {
              if (canalAsesor && e.canal_direccion !== canalAsesor) return false;
              if (docAsesor && e.documento_asesor === docAsesor) return true;
              return nombreNorm && normalizeComparableText(e.documento_asesor) === nombreNorm;
            });

            const advisorAcv = normalizeStoredAcv(matchingProductividad?.acv_f) || Number(matchingEjec?.acv_total) || 0;
            const advisorMetaAcv = normalizeVnMetaAcv(matchingProductividad?.meta);
            if (advisorAcv > 0) acvMes = advisorAcv;
            pctCumplimiento = advisorMetaAcv > 0 ? Math.round((advisorAcv / advisorMetaAcv) * 100) : 0;
            vcCumplimiento = advisorMetaAcv > 0 ? { acv: advisorAcv, meta: advisorMetaAcv, pct: pctCumplimiento } : null;
          }
        }

        // Build VN monthly cumplimiento from celula productividad or kpis_mensuales history
        let vnMonthlyCumpl: MonthlyCumplimiento[] = [];
        if (isVN && !isVC) {
          const celulaRows = vnCelulaRows;
          // Calculate ACV meta from productividad_asesores.meta by month
          const buildMonthMetaAcv = (period: string) =>
            celulaRows
              .filter((r: any) => r.anio_mes === period && !getMetaContextForPeriod(period).asesoresConNovedad.has(normalizeComparableText(r.asesor)))
              .reduce((s: number, r: any) => s + normalizeVnMetaAcv(r.meta), 0);

          // Aggregate FE/Nube/Total per month from team ejecucion rows
          const ejecByPeriod = new Map<string, { fe: number; nube: number; total: number }>();
          vnTeamEjecAll.forEach((e: any) => {
            const period = String(e.periodo || '');
            const cur = ejecByPeriod.get(period) || { fe: 0, nube: 0, total: 0 };
            cur.fe += Number(e.ventas_fe) || 0;
            cur.nube += Number(e.ventas_nube) || 0;
            cur.total += Number(e.ventas_total) || 0;
            ejecByPeriod.set(period, cur);
          });

          const enrich = (period: string, base: MonthlyCumplimiento): MonthlyCumplimiento => {
            const ej = ejecByPeriod.get(period) || { fe: 0, nube: 0, total: 0 };
            const metaContext = getMetaContextForPeriod(period);
            const mFe = metaContext.metaFe;
            const mNube = metaContext.metaNube;
            const mTotal = metaContext.metaTotal;
            return {
              ...base,
              ventas_fe: ej.fe,
              ventas_nube: ej.nube,
              ventas_total: ej.total,
              meta_fe: mFe,
              meta_nube: mNube,
              meta_total: mTotal,
              pct_fe: mFe > 0 ? Math.round((ej.fe / mFe) * 100) : 0,
              pct_nube: mNube > 0 ? Math.round((ej.nube / mNube) * 100) : 0,
              pct_total: mTotal > 0 ? Math.round((ej.total / mTotal) * 100) : 0,
            };
          };

          if (celulaRows.length > 0 && profile.role !== 'asesor') {
            // Aggregate by month from celula productividad
            const monthAgg = new Map<string, { ventas: number; meta: number; acv: number; referidos: number }>();
            celulaRows.forEach((row: any) => {
              const period = String(row.anio_mes || '');
              const cur = monthAgg.get(period) || { ventas: 0, meta: 0, acv: 0, referidos: 0 };
              cur.ventas += Number(row.ventas) || 0;
              cur.meta += Number(row.meta) || 0;
              cur.acv += normalizeStoredAcv(row.acv_f);
              cur.referidos += Number(row.cant_recomendados) || 0;
              monthAgg.set(period, cur);
            });
            // Include any periods present in ejecucion but missing from productividad
            ejecByPeriod.forEach((_, period) => {
              if (!monthAgg.has(period)) monthAgg.set(period, { ventas: 0, meta: 0, acv: 0, referidos: 0 });
            });
            vnMonthlyCumpl = [...monthAgg.entries()]
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([period, { ventas, meta, acv }]) => {
                const monthNum = parseInt(period.slice(4), 10);
                const mesName = MONTH_NAMES_ES[monthNum - 1] || period;
                const monthMetaAcv = buildMonthMetaAcv(period);
                const pctVal = monthMetaAcv > 0 ? Math.round((acv / monthMetaAcv) * 100) : 0;
                return enrich(period, { mes: mesName, acv, meta: monthMetaAcv || meta, pct: pctVal });
              });
          } else {
            // Fallback to kpis_mensuales (also enrich with team ejec data)
            const vnHistoryRows = vnHistoryRes?.data || [];
            const periodSet = new Set<string>(vnHistoryRows.map((r: any) => String(r.anio_mes || '')));
            ejecByPeriod.forEach((_, period) => periodSet.add(period));
            vnMonthlyCumpl = [...periodSet]
              .sort((a, b) => b.localeCompare(a))
              .map((period) => {
                const row = vnHistoryRows.find((r: any) => String(r.anio_mes) === period) || {};
                const monthNum = parseInt(period.slice(4), 10);
                const mesName = MONTH_NAMES_ES[monthNum - 1] || period;
                const ventas = Number(row.ventas) || 0;
                const meta = Number(row.meta) || 0;
                const acvF = normalizeStoredAcv(row.acv_f);
                const monthMetaAcv = buildMonthMetaAcv(period);
                const pctVal = monthMetaAcv > 0 ? Math.round((acvF / monthMetaAcv) * 100) : 0;
                return enrich(period, { mes: mesName, acv: acvF || ventas, meta: monthMetaAcv || meta, pct: pctVal });
              });
          }
          vcMonthlyCumplimiento = vnMonthlyCumpl;
        }

        if (isVN && !vcCumplimiento && vnMetaAcvActual > 0) {
          vcCumplimiento = { acv: acvMes, meta: vnMetaAcvActual, pct: pctCumplimiento };
        }

        // Build VN team asesor performance dashboard (only for gerentes VN)
        let teamAsesorPerformance: AsesorPerformance[] = [];
        if (isVN && profile.role !== 'asesor' && vnCelulaRows.length > 0) {
          const metaContextActual = getMetaContextForPeriod(mesActual);
          const teamMetaRows = metaContextActual.rows;

          // Map metas by normalized asesor name
          const metasPorAsesor = new Map<string, any>();
          const docPorNombre = new Map<string, string>();
          teamMetaRows.forEach((m: any) => {
            if (!m.nombre_asesor) return;
            const key = normalizeComparableText(m.nombre_asesor);
            metasPorAsesor.set(key, m);
            if (m.documento_asesor) {
              docPorNombre.set(key, String(m.documento_asesor).trim().toLowerCase());
            }
          });

          // Map ejecucion by BOTH documento and nombre normalizado (ejecucion_asesores.documento_asesor
          // suele contener el NOMBRE del asesor en VN, no el documento numérico)
          const ejecPorDoc = new Map<string, any>();
          const ejecPorNombre = new Map<string, any>();
          (ejecRes?.data || []).forEach((e: any) => {
            if (String(e.periodo) !== mesActual) return;
            const raw = String(e.documento_asesor || '').trim();
            if (!raw) return;
            ejecPorDoc.set(raw.toLowerCase(), e);
            ejecPorNombre.set(normalizeComparableText(raw), e);
          });

          const currentMonthProd = vnCelulaRows.filter((r: any) => r.anio_mes === mesActual);

          for (const prodRow of currentMonthProd) {
            const asesorNorm = normalizeComparableText(prodRow.asesor);
            const meta = metasPorAsesor.get(asesorNorm);
            const doc = docPorNombre.get(asesorNorm) || '';
            // Match ejecucion: 1) por nombre normalizado del asesor, 2) por documento si existiera
            const ejec = ejecPorNombre.get(asesorNorm) || ejecPorDoc.get(doc) || null;
            const tiene_novedad = !!(meta?.novedad && normalizeComparableText(meta.novedad) !== 'sin novedad');

            const acv = normalizeStoredAcv(prodRow.acv_f);
            const meta_acv = normalizeVnMetaAcv(prodRow.meta);
            const ventas_fe = Number(ejec?.ventas_fe) || 0;
            const meta_fe = meta ? (Number(meta.meta_fe) || 0) : 0;
            const ventas_nube = Number(ejec?.ventas_nube) || 0;
            const meta_nube = meta ? (Number(meta.meta_nube) || 0) : 0;
            const ventas_total = Number(ejec?.ventas_total) || Number(prodRow.ventas) || 0;
            const meta_total = meta ? (Number(meta.meta_total) || 0) : 0;

            teamAsesorPerformance.push({
              nombre: prodRow.asesor,
              documento: doc,
              pct_acv: meta_acv > 0 ? Math.round((acv / meta_acv) * 100) : 0,
              pct_fe: meta_fe > 0 ? Math.round((ventas_fe / meta_fe) * 100) : 0,
              pct_nube: meta_nube > 0 ? Math.round((ventas_nube / meta_nube) * 100) : 0,
              pct_total: meta_total > 0 ? Math.round((ventas_total / meta_total) * 100) : 0,
              acv, meta_acv, ventas_fe, meta_fe, ventas_nube, meta_nube,
              ventas_total, meta_total,
              recomendados: Number(prodRow.cant_recomendados) || 0,
              tiene_novedad,
            });
          }

          teamAsesorPerformance.sort((a, b) => {
            if (a.tiene_novedad && !b.tiene_novedad) return 1;
            if (!a.tiene_novedad && b.tiene_novedad) return -1;
            return b.pct_acv - a.pct_acv;
          });
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
          teamAsesorPerformance,
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
  }, [profile?.id, profile?.canal, profile?.nombre, profile?.gerente_id, profile?.role, profile?.celula, isVcAdvisor, isVC, isVN, periodoOverride]);

  return { ...state, isVcAdvisor, isVC, isVN };
};
