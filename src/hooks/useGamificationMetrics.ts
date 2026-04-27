import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getVcAdvisorSnapshot, isVcAdvisorProfile, type VcAdvisorSnapshot } from '@/lib/vc-advisor-data';
import { aggregateProductBreakdown, type ProductBreakdownItem } from '@/lib/product-breakdown';
import { resolveProductFamily } from '@/lib/product-families';

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
  sp?: number;
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

const matchesNormalizedPerson = (candidate: string, aliases: Set<string>) => {
  if (!candidate || aliases.size === 0) return false;
  if (aliases.has(candidate)) return true;

  const candidateShort = candidate.slice(0, 28);
  for (const alias of aliases) {
    const aliasShort = alias.slice(0, 28);
    if (
      candidateShort === aliasShort ||
      candidate.startsWith(aliasShort) ||
      alias.startsWith(candidateShort)
    ) {
      return true;
    }
  }

  return false;
};

const META_ACV_SCALE_BY_COUNTRY: Record<string, number> = {
  COL: 1_000_000,
  MEX: 1_000,
  ECU: 100,
  URU: 100,
};

const resolveCountryCode = (pais?: string | null): string | null => {
  if (!pais) return null;
  const normalized = String(pais).trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'MX' || normalized.startsWith('MEX')) return 'MEX';
  if (normalized === 'CO' || normalized.startsWith('COL')) return 'COL';
  if (normalized === 'EC' || normalized.startsWith('ECU')) return 'ECU';
  if (normalized === 'UY' || normalized.startsWith('URU')) return 'URU';
  return normalized;
};

const normalizeVnMetaAcv = (value: number | null | undefined, pais?: string | null) => {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  if (Math.abs(n) >= 100_000) return Math.round(n);
  const country = resolveCountryCode(pais);
  const factor = (country && META_ACV_SCALE_BY_COUNTRY[country]) || 1_000_000;
  return Math.round(n * factor);
};

const normalizeStoredAcv = (value: number | null | undefined) => {
  const n = Number(value) || 0;
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 1_000_000_000_000) return Math.round(n / 1_000_000_000);
  return Math.round(n);
};

const getPeriodFromDate = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.slice(0, 7).replace(/-/g, '');
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
          /* 4 */ isVC
            ? supabase.from('ventas').select('id', { count: 'exact', head: true })
                .eq('gerente_id', profile.id)
                .gte('fecha_facturacion', `${anioActual}-${String(mesIdx + 1).padStart(2, '0')}-01`)
                .lt('fecha_facturacion', `${anioActual}-${String(mesIdx + 2).padStart(2, '0')}-01`)
            : Promise.resolve({ count: 0 }),
          /* 5 */ isVC
            ? supabase.from('ventas').select('valor_producto')
                .eq('gerente_id', profile.id)
                .gte('fecha_facturacion', weekStart.toISOString().split('T')[0])
                .lt('fecha_facturacion', weekEnd.toISOString().split('T')[0])
            : Promise.resolve({ data: [] }),
          /* 6 */ isVC
            ? supabase.from('acv_vc_mensual').select('*').eq('gerente_id', profile.id).eq('mes', currentMonthName).eq('anio', anioActual).limit(1)
            : Promise.resolve({ data: [] }),
          /* 7 */ isVC
            ? supabase.from('desglose_producto_vc').select('producto, acv_total, unidades, mes').eq('gerente_id', profile.id).eq('anio', anioActual).eq('mes', currentMonthName)
            : Promise.resolve({ data: null }),
          /* 8 */
          isVN
            ? Promise.resolve({ data: [] })
            : supabase.from('ranking_general').select('*').order('sp_totales', { ascending: false }).limit(5),
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
          isVN
            ? Promise.resolve({ data: [] })
            : supabase.from('gerentes').select('id, sp_canje'),
          /* 12 – ejecucion_asesores for VN (gerente OR asesor) - ALL months this year */
          isVN
            ? supabase.from('ejecucion_asesores').select('*')
                .gte('periodo', `${anioActual}01`)
                .lte('periodo', `${anioActual}12`)
                .limit(10000)
            : Promise.resolve({ data: [] }),
          /* 13 – metas_asesores for VN asesor role */
          isVN && profile.role === 'asesor'
            ? supabase.from('metas_asesores').select('*')
                .gte('anio_mes', `${anioActual}01`)
                .lte('anio_mes', `${anioActual}12`)
                .limit(5000)
            : Promise.resolve({ data: [] }),
          /* 14 – productividad_asesores aggregated by celula for VN gerente */
          isVN && profile.role !== 'asesor' && profile.celula
            ? supabase.from('productividad_asesores').select('asesor, anio_mes, ventas, meta, acv_f, cant_recomendados, sc_creados, pais')
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
                .limit(50000)
            : Promise.resolve({ data: [] }),
          /* 16 – kpis_mensuales history for VN gerente (all months this year) */
          isVN
            ? supabase.from('kpis_mensuales').select('anio_mes, ventas, meta, acv_f, cant_recomendados, sc_creados')
                .eq('gerente_id', profile.id)
                .gte('anio_mes', `${anioActual}01`)
                .lte('anio_mes', `${anioActual}12`)
                .order('anio_mes', { ascending: false })
            : Promise.resolve({ data: [] }),
          /* 17 – ELIMINADO: metas_gerentes reemplazada por metas_acv_gerentes (query 21) */
          Promise.resolve({ data: null }),
          /* 18 – VC team per-comercial ACV vs meta for selected month */
          isVC
            ? supabase.from('ventas')
                .select('comercial, acv_plus, meta')
                .eq('gerente_id', profile.id)
                .eq('canal', 'VC')
                .eq('anio', anioActual)
                .eq('mes', currentMonthName)
                .like('documento_factura', 'SUM-%')
            : Promise.resolve({ data: [] }),
          /* 19 – ventas_diarias raw para VN exact FE/Nube/Total aggregation
                  Para gerentes VN se refina luego con una consulta paginada del equipo
                  para evitar el recorte backend de 1000 filas. */
          isVN
            ? supabase
                .from('ventas_diarias')
                .select('fecha, asesor, celula, equipo, director, tipo_producto, producto, unidades, acv, canal_direccion, pais')
                .gte('fecha', `${anioActual}-01-01`)
                .lt('fecha', `${anioActual + 1}-01-01`)
                .eq('canal_direccion', canalNorm)
                .eq('pais', String(profile.pais || '').toUpperCase())
                .range(0, 999)
            : Promise.resolve({ data: [] }),
          /* 20 – ventas_gerente_mensual: FUENTE DE VERDAD para gerentes VN
                  (FE/NUBE/CONTADOR pre-agregado por Databricks).
                  Filtra por nombre del gerente normalizado. */
          isVN && profile.role !== 'asesor' && profile.nombre
            ? supabase
                .from('ventas_gerente_mensual' as any)
                .select('pais, anio, mes, periodo, canal_direccion, gerente, gerente_normalizado, celula, familia, unidades, acv')
                .ilike('gerente_normalizado', normalizeComparableText(profile.nombre))
                .gte('periodo', `${anioActual}01`)
                .lte('periodo', `${anioActual}12`)
                .limit(500)
            : Promise.resolve({ data: [] }),
          /* 21 – metas_acv_gerentes: VERDAD oficial de meta ACV (Databricks).
                  No filtrar por celula en DB: hay diferencias de tildes (México/Mexico).
                  El match se hace normalizado en getAcvCatalogRowForPeriod. */
          isVN && profile.role !== 'asesor' && profile.celula
            ? supabase
                .from('metas_acv_gerentes' as any)
                .select('pais, canal, celula, mes, meta_fe, meta_nube, meta_total_acv, meta_total_und, archivo')
                .eq('pais', String(profile.pais || '').toUpperCase())
                .limit(1000)
            : Promise.resolve({ data: [] }),
          /* 22 – vn_metricas_optimizadas (scope=asesor): FUENTE DE VERDAD para
                  ventas FE/NUBE por asesor del equipo de un gerente VN. Reemplaza
                  el fallback inexacto desde ejecucion_asesores/ventas_diarias. */
          isVN && profile.role !== 'asesor' && profile.nombre
            ? supabase
                .from('vn_metricas_optimizadas' as any)
                .select('pais, mes_nro, gerente_normalizado, asesor, tipo_producto1, familia, ventas, acv_total')
                .ilike('gerente_normalizado', normalizeComparableText(profile.nombre))
                .eq('scope', 'asesor')
                .gte('mes_nro', 1)
                .lte('mes_nro', 12)
                .limit(5000)
            : Promise.resolve({ data: [] }),
        ];

        const results = await Promise.all(queries);
        if (cancelled) return;

        const [rachaRes, kpisRes, medallasRes, feedRes, unidadesRes, ventasSemanaRes, acvRes, productRes, rankingRes, teamRes, acvAllMonthsRes, canjeablesRes, ejecRes, metasRes, celulaProductividadRes, vnMetasRes, vnHistoryRes, _legacy17, vcTeamRes, ventasDiariasRes, ventasGerenteMensualRes, metasAcvCatalogRes, vnMetricasAsesorRes] = results as any[];

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
        let vnVentasDiariasRows: any[] = [];
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
        let getMetaTotalUndForPeriod = (_period: string) => 0;
        let getMetaSplitFallbackForPeriod = (_period: string, metaTotal: number, metaFe: number, metaNube: number) => ({
          metaTotal,
          metaFe,
          metaNube,
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
          let allVentasDiarias = ventasDiariasRes?.data || [];
          vnCelulaRows = celulaRows;

          // Build team advisor identifiers from productividad + metas_asesores.
          // En Aliados/Empresarios no podemos depender solo del primer bloque de ventas_diarias
          // porque el backend devuelve páginas de 1000 filas; por eso refinamos la carga al equipo exacto.
          const teamAsesorNames = new Set<string>();
          const teamAdvisorDocs = new Set<string>();
          celulaRows.forEach((r: any) => {
            if (r.asesor) teamAsesorNames.add(normalizeComparableText(r.asesor));
          });

          const gerenteNombre = normalizeComparableText(profile.nombre);
          const celulaGerente = normalizeComparableText(profile.celula);
          if (gerenteNombre) teamAsesorNames.add(gerenteNombre);

          // Paso 1: identificar TODAS las células del equipo (en cualquier mes del año).
          // Una fila pertenece al equipo si:
          //  - su célula coincide con la del gerente (en ese o en cualquier otro mes), o
          //  - su gerente coincide con el gerente del perfil.
          const teamCelulas = new Set<string>();
          if (celulaGerente) teamCelulas.add(celulaGerente);
          vnMetasAsesores.forEach((row: any) => {
            const rowCelula = normalizeComparableText(row.celula);
            const rowGerente = normalizeComparableText(row.gerente);
            if (!rowCelula) return;
            if ((celulaGerente && rowCelula === celulaGerente) || (gerenteNombre && rowGerente === gerenteNombre)) {
              teamCelulas.add(rowCelula);
            }
          });

          const getTeamMetaRowsForPeriod = (period: string) => {
            const periodRows = vnMetasAsesores.filter((row: any) => String(row.anio_mes || '') === period);

            // Paso 2: filtrar por células identificadas o por nombre de gerente
            const rowsByTeam = periodRows.filter((row: any) => {
              const rowCelula = normalizeComparableText(row.celula);
              const rowGerente = normalizeComparableText(row.gerente);
              if (rowCelula && teamCelulas.has(rowCelula)) return true;
              if (gerenteNombre && rowGerente === gerenteNombre) return true;
              return false;
            });

            if (rowsByTeam.length > 0) return rowsByTeam;

            // Fallback: por nombres de asesores conocidos del equipo
            if (teamAsesorNames.size > 0) {
              return periodRows.filter((row: any) => teamAsesorNames.has(normalizeComparableText(row.nombre_asesor)));
            }

            return [];
          };

          vnMetasAsesores.forEach((row: any) => {
            const rowCelula = normalizeComparableText(row.celula);
            const rowGerente = normalizeComparableText(row.gerente);
            const rowAsesor = normalizeComparableText(row.nombre_asesor);
            const sameCelula = !!celulaGerente && rowCelula === celulaGerente;
            const sameGerente = !!gerenteNombre && rowGerente === gerenteNombre;
            const knownAsesor = !!rowAsesor && matchesNormalizedPerson(rowAsesor, teamAsesorNames);

            if (sameCelula || sameGerente || knownAsesor) {
              if (row.nombre_asesor) teamAsesorNames.add(normalizeComparableText(row.nombre_asesor));
              if (row.documento_asesor) teamAdvisorDocs.add(String(row.documento_asesor).trim().toLowerCase());
            }
          });

          const paisProfile = String(profile.pais || '').toUpperCase();

          if (isVN && profile.role !== 'asesor' && (profile.celula || profile.nombre)) {
            const teamVentasPaged: any[] = [];
            const pageSize = 1000;
            for (let from = 0; from < 10000; from += pageSize) {
              const filters = [
                profile.celula ? `celula.eq.${profile.celula}` : '',
                profile.nombre ? `director.eq.${profile.nombre}` : '',
              ].filter(Boolean).join(',');

              const query = supabase
                .from('ventas_diarias')
                .select('fecha, asesor, celula, equipo, director, tipo_producto, producto, unidades, acv, canal_direccion, pais')
                .gte('fecha', `${anioActual}-01-01`)
                .lt('fecha', `${anioActual + 1}-01-01`)
                .eq('canal_direccion', canalNorm)
                .eq('pais', paisProfile)
                .range(from, from + pageSize - 1);

              const { data: pageRows } = filters ? await query.or(filters) : await query;
              if (!pageRows || pageRows.length === 0) break;
              teamVentasPaged.push(...pageRows);
              if (pageRows.length < pageSize) break;
            }
            allVentasDiarias = teamVentasPaged;
          }

          const teamVentasDiariasAll = allVentasDiarias.filter((row: any) => {
            const rowCanal = String(row.canal_direccion || '').trim();
            const rowPais = String(row.pais || '').toUpperCase().trim();
            const sameCanal = !canalNorm || rowCanal === canalNorm;
            const samePais = !paisProfile || !rowPais || rowPais === paisProfile;
            if (!sameCanal || !samePais) return false;

            const asesorNorm = normalizeComparableText(row.asesor);
            const rowCelulaNorm = normalizeComparableText(row.celula);
            const rowEquipoNorm = normalizeComparableText(row.equipo);
            const rowDirectorNorm = normalizeComparableText(row.director);

            if (matchesNormalizedPerson(asesorNorm, teamAsesorNames)) return true;
            if (celulaGerente && (rowCelulaNorm === celulaGerente || rowEquipoNorm === celulaGerente)) return true;
            if (gerenteNombre && rowDirectorNorm === gerenteNombre) return true;
            return false;
          });
          vnVentasDiariasRows = teamVentasDiariasAll;

          getMetaContextForPeriod = (period: string) => {
            const rows = getTeamMetaRowsForPeriod(period);
            const asesoresConNovedad = new Set<string>();

            rows.forEach((row: any) => {
              const novedadRaw = String(row.novedad || '').trim();
              const isExcluded = novedadRaw !== '' && novedadRaw !== 'Sin novedad';
              if (isExcluded && row.nombre_asesor) {
                asesoresConNovedad.add(normalizeComparableText(row.nombre_asesor));
              }
            });

            const validRows = rows.filter((row: any) => {
              const novedadRaw = String(row.novedad || '').trim();
              return novedadRaw === '' || novedadRaw === 'Sin novedad';
            });

            const metaFe = validRows.reduce((s: number, r: any) => s + (Number(r.meta_fe) || 0), 0);
            const metaNube = validRows.reduce((s: number, r: any) => s + (Number(r.meta_nube) || 0), 0);
            const metaTotal = validRows.reduce((s: number, r: any) => s + (Number(r.meta_total) || 0), 0);

            return { rows: validRows, asesoresConNovedad, metaFe, metaNube, metaTotal };
          };

          // Helper: clasifica una fila a familia oficial usando producto+pais.
          // Cae a tipo_producto si resolveProductFamily no encuentra match.
          const classifyFamily = (row: any): 'FE' | 'NUBE' | 'CONTADOR' | 'OTRO' => {
            const fam = resolveProductFamily(row.producto, row.pais || paisProfile);
            if (fam) return fam;
            const tp = String(row.tipo_producto || '').toUpperCase();
            if (tp === 'FE' || tp === 'NUBE' || tp === 'CONTADOR') return tp;
            return 'OTRO';
          };

          const metaContextActual = getMetaContextForPeriod(mesActual);
          const { metaFe, metaNube, metaTotal: metaEquipoUnidades } = metaContextActual;

          // VN: meta ACV (mensual) — PRIORIDAD:
          //   1) metas_acv_gerentes (VERDAD oficial Databricks)
          //   2) metas_gerentes.meta_total_acv (legacy)
          //   3) suma productividad_asesores.meta del mes (último recurso)
          const acvCatalogRows: any[] = (metasAcvCatalogRes?.data as any[]) || [];
          // Mapea YYYYMM -> 'ene'/'feb'/... para hacer match con metas_acv_gerentes.mes
          const mesNumToMes3: Record<string, string> = {
            '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun',
            '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic',
          };
          const getAcvCatalogRowForPeriod = (period: string) => {
            const mes3 = mesNumToMes3[String(period).slice(-2)] || '';
            // Prioridad Cierre > Inicio para evitar duplicación de meta por celula+mes.
            const rows = acvCatalogRows.filter((r: any) => {
              const rowMes = String(r.mes || '').trim().toLowerCase().slice(0, 3);
              return rowMes === mes3 && normalizeComparableText(r.celula) === celulaGerente;
            });
            return rows.find((r: any) => String(r.archivo || '').toLowerCase().includes('cierre')) ?? rows[0] ?? null;
          };
          getMetaTotalUndForPeriod = (period: string) => Math.round(Number(getAcvCatalogRowForPeriod(period)?.meta_total_und) || 0);
          // FUENTE ÚNICA para meta_fe/meta_nube por gerente: metas_acv_gerentes
          // (origen Databricks tbl_brz_cuotas_gerentes). El catálogo trae el
          // split FE/Nube ya agregado a nivel célula/mes, sin fallback proporcional.
          getMetaSplitFallbackForPeriod = (period: string, metaTotal: number, metaFe: number, metaNube: number) => {
            const catalogRow = getAcvCatalogRowForPeriod(period);
            const catalogFe = Math.round(Number(catalogRow?.meta_fe) || 0);
            const catalogNube = Math.round(Number(catalogRow?.meta_nube) || 0);
            const catalogTotalUnd = Math.round(Number(catalogRow?.meta_total_und) || 0);
            if (catalogFe > 0 || catalogNube > 0) {
              return {
                metaTotal: catalogTotalUnd > 0 ? catalogTotalUnd : (catalogFe + catalogNube),
                metaFe: catalogFe,
                metaNube: catalogNube,
              };
            }
            // Sin datos en metas_acv_gerentes para este periodo: respetar lo que
            // venga de metas_asesores (puede ser 0).
            const total = metaTotal > 0 ? metaTotal : catalogTotalUnd;
            return { metaTotal: total, metaFe, metaNube };
          };
          const acvOficial = getAcvCatalogRowForPeriod(mesActual);

          let metaAcvEquipo = 0;
          if (acvOficial?.meta_total_acv) {
            metaAcvEquipo = normalizeVnMetaAcv(acvOficial.meta_total_acv, acvOficial.pais);
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
            const documento = String(e.documento_asesor || '').trim().toLowerCase();
            const sameCanal = !canalNorm || e.canal_direccion === canalNorm;
            return sameCanal && (matchesNormalizedPerson(nombre, teamAsesorNames) || teamAdvisorDocs.has(documento));
          });
          const teamVentasDiariasMonth = teamVentasDiariasAll.filter((row: any) => getPeriodFromDate(row.fecha) === mesActual);
          const teamEjecRows = teamEjecRowsAll.filter((e: any) => String(e.periodo) === mesActual);

          // ⭐ FUENTE DE VERDAD: ventas_gerente_mensual (Databricks pre-agregado por gerente).
          // Si hay filas para este gerente en este mes, sobreescribe los conteos
          // FE / NUBE / TOTAL / ACV con los valores oficiales de Databricks.
          const vgmRows: any[] = (ventasGerenteMensualRes?.data || [])
            .filter((r: any) => String(r.periodo) === mesActual);
          const vgmHasMonth = vgmRows.length > 0;
          const vgmFe = vgmRows.reduce((s, r) => s + (String(r.familia).toUpperCase() === 'FE' ? (Number(r.unidades) || 0) : 0), 0);
          const vgmNube = vgmRows.reduce((s, r) => s + (String(r.familia).toUpperCase() === 'NUBE' ? (Number(r.unidades) || 0) : 0), 0);
          const vgmContador = vgmRows.reduce((s, r) => s + (String(r.familia).toUpperCase() === 'CONTADOR' ? (Number(r.unidades) || 0) : 0), 0);
          const vgmTotal = vgmFe + vgmNube + vgmContador;
          const vgmAcv = vgmRows.reduce((s, r) => s + (Number(r.acv) || 0), 0);

          // SOURCE OF TRUTH for VN gerente team totals = ventas_gerente_mensual,
          // luego ventas_diarias raw, luego ejecucion_asesores como último respaldo.
          const ventasDiariasHasMonth = teamVentasDiariasMonth.length > 0;
          const teamVentasFe = vgmHasMonth
            ? vgmFe
            : (ventasDiariasHasMonth
                ? teamVentasDiariasMonth.reduce((s: number, row: any) => s + (classifyFamily(row) === 'FE' ? Math.round(Number(row.unidades) || 0) : 0), 0)
                : teamEjecRows.reduce((s: number, r: any) => s + Math.round(Number(r.ventas_fe) || 0), 0));
          const teamVentasNube = vgmHasMonth
            ? vgmNube
            : (ventasDiariasHasMonth
                ? teamVentasDiariasMonth.reduce((s: number, row: any) => s + (classifyFamily(row) === 'NUBE' ? Math.round(Number(row.unidades) || 0) : 0), 0)
                : teamEjecRows.reduce((s: number, r: any) => s + Math.round(Number(r.ventas_nube) || 0), 0));
          const teamVentasTotal = vgmHasMonth
            ? vgmTotal
            : (ventasDiariasHasMonth
                ? teamVentasDiariasMonth.reduce((s: number, row: any) => s + Math.round(Number(row.unidades) || 0), 0)
                : teamEjecRows.reduce((s: number, r: any) => s + Math.round(Number(r.ventas_total) || 0), 0));
          const teamAcvFromVgm = vgmHasMonth ? Math.round(vgmAcv) : 0;
          vnTeamEjecAll = teamEjecRowsAll;
          vnCurrentMetaFe = metaFe;
          vnCurrentMetaNube = metaNube;
          vnCurrentMetaTotal = metaEquipoUnidades;

          // Aggregate current month from celula productividad
          const currentMonthRows = celulaRows.filter((r: any) => r.anio_mes === mesActual);

          if (currentMonthRows.length > 0) {
            const totalVentas = currentMonthRows.reduce((s: number, r: any) => s + (Number(r.ventas) || 0), 0);
            const totalMetaUnidades = metaEquipoUnidades || currentMonthRows.reduce((s: number, r: any) => s + (Number(r.meta) || 0), 0);
            const totalAcvProd = currentMonthRows.reduce((s: number, r: any) => s + normalizeStoredAcv(r.acv_f), 0);
            const totalReferidos = currentMonthRows.reduce((s: number, r: any) => s + (Number(r.cant_recomendados) || 0), 0);

            // ACV: prioriza ventas_gerente_mensual (Databricks oficial)
            const totalAcv = vgmHasMonth && teamAcvFromVgm > 0 ? teamAcvFromVgm : totalAcvProd;

            acvMes = totalAcv;
            pctCumplimiento = metaAcvEquipo > 0 ? Math.round((totalAcv / metaAcvEquipo) * 100) : 0;

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
            const kpiAcv = normalizeStoredAcv(kpiData?.acv_f);
            acvMes = vgmHasMonth && teamAcvFromVgm > 0 ? teamAcvFromVgm : kpiAcv;
            const metaFallback = metaEquipoUnidades || Number(kpiData?.meta) || 0;
            pctCumplimiento = metaAcvEquipo > 0 ? Math.round((acvMes / metaAcvEquipo) * 100) : 0;

            if (vgmHasMonth || (kpiData && (Number(kpiData.ventas) > 0 || Number(kpiData.meta) > 0))) {
              const ventasTotal = Number(kpiData?.ventas) || 0;
              ejecucion = {
                ventas_fe: teamVentasFe || 0,
                ventas_nube: teamVentasNube || 0,
                ventas_total: teamVentasTotal || ventasTotal,
                acv_total: acvMes,
                cant_recomendados: Number(kpiData?.cant_recomendados) || 0,
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
            const matchingVentasDiarias = (ventasDiariasRes?.data || []).filter((row: any) => {
              if (getPeriodFromDate(row.fecha) !== mesActual) return false;
              if (canalAsesor && row.canal_direccion !== canalAsesor) return false;
              return nombreNorm && normalizeComparableText(row.asesor) === nombreNorm;
            });
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

            const classifyAdvisorFamily = (row: any): 'FE' | 'NUBE' | 'CONTADOR' | 'OTRO' => {
              const fam = resolveProductFamily(row.producto, row.pais || profile.pais);
              if (fam) return fam;
              const tp = String(row.tipo_producto || '').toUpperCase();
              if (tp === 'FE' || tp === 'NUBE' || tp === 'CONTADOR') return tp;
              return 'OTRO';
            };
            const ventasDiariasFe = matchingVentasDiarias.reduce((s: number, row: any) => s + (classifyAdvisorFamily(row) === 'FE' ? Math.round(Number(row.unidades) || 0) : 0), 0);
            const ventasDiariasNube = matchingVentasDiarias.reduce((s: number, row: any) => s + (classifyAdvisorFamily(row) === 'NUBE' ? Math.round(Number(row.unidades) || 0) : 0), 0);
            const ventasDiariasTotal = matchingVentasDiarias.reduce((s: number, row: any) => s + Math.round(Number(row.unidades) || 0), 0);

            if (matchingEjec || matchingVentasDiarias.length > 0) {
              ejecucion = {
                ventas_fe: ventasDiariasFe || Math.round(Number(matchingEjec?.ventas_fe) || 0),
                ventas_nube: ventasDiariasNube || Math.round(Number(matchingEjec?.ventas_nube) || 0),
                ventas_total: ventasDiariasTotal || Math.round(Number(matchingEjec?.ventas_total) || 0),
                acv_total: Math.round(Number(matchingEjec?.acv_total) || matchingVentasDiarias.reduce((s: number, row: any) => s + (Number(row.acv) || 0), 0)),
                cant_recomendados: Number(matchingEjec?.cant_recomendados) || 0,
                productividad: Number(matchingEjec?.productividad) || 0,
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

            const advisorAcv = normalizeStoredAcv(matchingProductividad?.acv_f) || Math.round(Number(matchingEjec?.acv_total) || 0);
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
              .reduce((s: number, r: any) => s + normalizeVnMetaAcv(r.meta, r.pais), 0);

          // Aggregate FE/Nube/Total per month.
          // ⭐ Prioridad: ventas_gerente_mensual (Databricks oficial por gerente),
          // luego ventas_diarias, luego ejecucion_asesores como respaldo.
          const ejecByPeriod = new Map<string, { fe: number; nube: number; total: number; acv: number }>();
          const vgmAllRows: any[] = ventasGerenteMensualRes?.data || [];
          const vgmPeriodsWithData = new Set<string>(vgmAllRows.map((r: any) => String(r.periodo || '')));

          if (vgmAllRows.length > 0) {
            vgmAllRows.forEach((r: any) => {
              const period = String(r.periodo || '');
              const fam = String(r.familia || '').toUpperCase();
              const cur = ejecByPeriod.get(period) || { fe: 0, nube: 0, total: 0, acv: 0 };
              const uds = Math.round(Number(r.unidades) || 0);
              if (fam === 'FE') cur.fe += uds;
              else if (fam === 'NUBE') cur.nube += uds;
              cur.total += uds; // FE + NUBE + CONTADOR
              cur.acv += Math.round(Number(r.acv) || 0);
              ejecByPeriod.set(period, cur);
            });
          }

          // Para periodos SIN data en vgm, usar ventas_diarias o ejecucion_asesores
          const ventasBaseForHistory = vnVentasDiariasRows.length > 0
            ? vnVentasDiariasRows.map((row: any) => {
                const fam = resolveProductFamily(row.producto, row.pais || profile.pais)
                  ?? (String(row.tipo_producto || '').toUpperCase() as 'FE' | 'NUBE' | 'CONTADOR' | 'OTRO');
                return {
                  periodo: getPeriodFromDate(row.fecha),
                  ventas_fe: fam === 'FE' ? Math.round(Number(row.unidades) || 0) : 0,
                  ventas_nube: fam === 'NUBE' ? Math.round(Number(row.unidades) || 0) : 0,
                  ventas_total: Math.round(Number(row.unidades) || 0),
                };
              })
            : vnTeamEjecAll;
          ventasBaseForHistory.forEach((e: any) => {
            const period = String(e.periodo || '');
            if (vgmPeriodsWithData.has(period)) return; // ya cubierto por vgm
            const cur = ejecByPeriod.get(period) || { fe: 0, nube: 0, total: 0, acv: 0 };
            cur.fe += Math.round(Number(e.ventas_fe) || 0);
            cur.nube += Math.round(Number(e.ventas_nube) || 0);
            cur.total += Math.round(Number(e.ventas_total) || 0);
            ejecByPeriod.set(period, cur);
          });

          const enrich = (period: string, base: MonthlyCumplimiento): MonthlyCumplimiento => {
            const ej = ejecByPeriod.get(period) || { fe: 0, nube: 0, total: 0, acv: 0 };
            const metaContext = getMetaContextForPeriod(period);
            const metas = getMetaSplitFallbackForPeriod(period, metaContext.metaTotal, metaContext.metaFe, metaContext.metaNube);
            const mFe = metas.metaFe;
            const mNube = metas.metaNube;
            const mTotal = metas.metaTotal;
            // Si vgm tiene ACV para este periodo, sobreescribe el ACV base
            const acvFinal = ej.acv > 0 ? Math.round(ej.acv) : base.acv;
            // Meta ACV: priorizar metas_acv_gerentes (Cierre > Inicio, NUNCA sumar ambas)
            const acvCatalogRows: any[] = (metasAcvCatalogRes?.data as any[]) || [];
            const mes3ForAcv: Record<string, string> = {
              '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun',
              '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic',
            };
            const targetMes3 = mes3ForAcv[String(period).slice(-2)] || '';
            const celulaGerenteNorm = normalizeComparableText(profile.celula);
            const catalogMatches = acvCatalogRows.filter((r: any) => {
              const rowMes = String(r.mes || '').trim().toLowerCase().slice(0, 3);
              return rowMes === targetMes3 && normalizeComparableText(r.celula) === celulaGerenteNorm;
            });
            const catalogRowForAcv = catalogMatches.find((r: any) => String(r.archivo || '').toLowerCase().includes('cierre')) ?? catalogMatches[0];
            const catalogMetaAcv = catalogRowForAcv?.meta_total_acv
              ? normalizeVnMetaAcv(catalogRowForAcv.meta_total_acv, catalogRowForAcv.pais)
              : 0;
            const metaAcvFinal = catalogMetaAcv > 0 ? catalogMetaAcv : base.meta;
            const pctAcvFinal = metaAcvFinal > 0 ? Math.round((acvFinal / metaAcvFinal) * 100) : 0;
            const pctFeFinal = mFe > 0 ? Math.round((ej.fe / mFe) * 100) : 0;
            const pctNubeFinal = mNube > 0 ? Math.round((ej.nube / mNube) * 100) : 0;
            // SP del mes (cap por componente, sin %Uds)
            const cap = (v: number) => Math.min(300, Math.max(0, Math.round(v || 0)));
            const spMes = cap(pctFeFinal) + cap(pctNubeFinal) * 2 + cap(pctAcvFinal);
            return {
              ...base,
              acv: acvFinal,
              pct: pctAcvFinal,
              ventas_fe: ej.fe,
              ventas_nube: ej.nube,
              ventas_total: ej.total,
              meta_fe: mFe,
              meta_nube: mNube,
              meta_total: mTotal,
              pct_fe: pctFeFinal,
              pct_nube: pctNubeFinal,
              pct_total: mTotal > 0 ? Math.round((ej.total / mTotal) * 100) : 0,
              sp: spMes,
            };
          };

          // Recolectar todos los periodos donde haya metas para el equipo del gerente
          const metaPeriods = new Set<string>();
          ((vnMetasRes?.data as any[]) || []).forEach((r: any) => {
            const p = String(r.anio_mes || '');
            if (!/^\d{6}$/.test(p)) return;
            const ctx = getMetaContextForPeriod(p);
            if (ctx.metaFe > 0 || ctx.metaNube > 0 || ctx.metaTotal > 0) metaPeriods.add(p);
          });
          Array.from({ length: 12 }, (_, i) => `${anioActual}${String(i + 1).padStart(2, '0')}`).forEach((period) => {
            if (getMetaTotalUndForPeriod(period) > 0) metaPeriods.add(period);
          });

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
            // Include any periods present in ejecucion/vgm/metas but missing from productividad
            ejecByPeriod.forEach((_, period) => {
              if (!monthAgg.has(period)) monthAgg.set(period, { ventas: 0, meta: 0, acv: 0, referidos: 0 });
            });
            metaPeriods.forEach((period) => {
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
            metaPeriods.forEach((period) => periodSet.add(period));
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
        if (isVN && profile.role !== 'asesor' && (vnCelulaRows.length > 0 || vnVentasDiariasRows.length > 0)) {
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

          // SOURCE OF TRUTH per asesor: ventas_diarias raw aggregated by asesor name,
          // reclasificada por familia oficial (producto + país).
          const paisProfileForAsesor = String(profile.pais || '').toUpperCase();
          const ventasPorAsesor = new Map<string, { fe: number; nube: number; total: number; acv: number }>();
          vnVentasDiariasRows
            .filter((row: any) => getPeriodFromDate(row.fecha) === mesActual)
            .forEach((row: any) => {
              const key = normalizeComparableText(row.asesor);
              if (!key) return;
              const cur = ventasPorAsesor.get(key) || { fe: 0, nube: 0, total: 0, acv: 0 };
              const u = Number(row.unidades) || 0;
              const fam = resolveProductFamily(row.producto, row.pais || paisProfileForAsesor)
                ?? (String(row.tipo_producto || '').toUpperCase() as 'FE' | 'NUBE' | 'CONTADOR' | 'OTRO');
              cur.total += u;
              cur.acv += Number(row.acv) || 0;
              if (fam === 'FE') cur.fe += u;
              else if (fam === 'NUBE') cur.nube += u;
              ventasPorAsesor.set(key, cur);
            });

          const currentMonthProd = vnCelulaRows.filter((r: any) => r.anio_mes === mesActual);
          const prodByName = new Map<string, any>();
          currentMonthProd.forEach((r: any) => {
            prodByName.set(normalizeComparableText(r.asesor), r);
          });

          // Union of all asesor identities seen this month: productividad ∪ ventas_diarias ∪ metas (sin novedad)
          const allAsesorKeys = new Set<string>([
            ...prodByName.keys(),
            ...ventasPorAsesor.keys(),
            ...[...metasPorAsesor.keys()].filter((k) => {
              const m = metasPorAsesor.get(k);
              const nov = (m?.novedad ?? '').toString().trim();
              return nov === '' || nov === 'Sin novedad';
            }),
          ]);

          for (const asesorKey of allAsesorKeys) {
            const meta = metasPorAsesor.get(asesorKey);
            const prodRow = prodByName.get(asesorKey);
            const ventas = ventasPorAsesor.get(asesorKey) || { fe: 0, nube: 0, total: 0, acv: 0 };
            const tiene_novedad = !!(meta?.novedad && (meta.novedad ?? '').toString().trim() !== '' && (meta.novedad ?? '').toString().trim() !== 'Sin novedad');

            const nombre = prodRow?.asesor || meta?.nombre_asesor || asesorKey;
            const doc = (meta?.documento_asesor && String(meta.documento_asesor)) || '';

            const acv = normalizeStoredAcv(prodRow?.acv_f) || ventas.acv;
            const meta_acv = normalizeVnMetaAcv(prodRow?.meta);
            const ventas_fe = ventas.fe;
            const meta_fe = meta ? (Number(meta.meta_fe) || 0) : 0;
            const ventas_nube = ventas.nube;
            const meta_nube = meta ? (Number(meta.meta_nube) || 0) : 0;
            const ventas_total = ventas.total || Number(prodRow?.ventas) || 0;
            const meta_total = meta ? (Number(meta.meta_total) || 0) : 0;

            // Skip totally empty rows (no ventas, no meta, no acv)
            if (ventas_total === 0 && meta_total === 0 && acv === 0 && !tiene_novedad) continue;

            teamAsesorPerformance.push({
              nombre,
              documento: doc,
              pct_acv: meta_acv > 0 ? Math.round((acv / meta_acv) * 100) : 0,
              pct_fe: meta_fe > 0 ? Math.round((ventas_fe / meta_fe) * 100) : 0,
              pct_nube: meta_nube > 0 ? Math.round((ventas_nube / meta_nube) * 100) : 0,
              pct_total: meta_total > 0 ? Math.round((ventas_total / meta_total) * 100) : 0,
              acv, meta_acv, ventas_fe, meta_fe, ventas_nube, meta_nube,
              ventas_total, meta_total,
              recomendados: Number(prodRow?.cant_recomendados) || 0,
              tiene_novedad,
            });
          }

          teamAsesorPerformance.sort((a, b) => {
            if (a.tiene_novedad && !b.tiene_novedad) return 1;
            if (!a.tiene_novedad && b.tiene_novedad) return -1;
            return b.pct_acv - a.pct_acv;
          });
        }

        // Build VC team performance dashboard (only for gerentes VC) — only ACV
        if (isVC && profile.role !== 'asesor') {
          const ventasRows = (vcTeamRes?.data || []) as any[];
          const porComercial = new Map<string, { acv: number; meta: number }>();
          ventasRows.forEach((v: any) => {
            const nombre = String(v.comercial || '').trim();
            if (!nombre) return;
            const cur = porComercial.get(nombre) || { acv: 0, meta: 0 };
            cur.acv += Number(v.acv_plus) || 0;
            cur.meta += Number(v.meta) || 0;
            porComercial.set(nombre, cur);
          });

          teamAsesorPerformance = [...porComercial.entries()].map(([nombre, { acv, meta }]) => ({
            nombre,
            documento: '',
            pct_acv: meta > 0 ? Math.round((acv / meta) * 100) : 0,
            pct_fe: 0,
            pct_nube: 0,
            pct_total: 0,
            acv,
            meta_acv: meta,
            ventas_fe: 0,
            meta_fe: 0,
            ventas_nube: 0,
            meta_nube: 0,
            ventas_total: 0,
            meta_total: 0,
            recomendados: 0,
            tiene_novedad: false,
          }));
          teamAsesorPerformance.sort((a, b) => b.pct_acv - a.pct_acv);
        }

        const canjeablesMap = new Map<string, number>();
        (canjeablesRes.data || []).forEach((row: any) => {
          if (row.id) canjeablesMap.set(row.id, Number(row.sp_canje) || 0);
        });

        const topRanking = isVN
          ? []
          : (rankingRes.data || []).map((r: any) => ({
              id: r.id,
              nombre: r.nombre,
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
