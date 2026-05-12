import { useEffect, useState, useMemo } from 'react';
import { setSpConvencionAnual } from '@/lib/sp-convencion-store';
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

  /* Last time data was refreshed (for UI indicator) */
  lastUpdated: Date | null;
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

const normalizeVnChannel = (value: unknown) => {
  const normalized = normalizeComparableText(value).replace(/_/g, ' ');
  if (normalized.includes('aliad')) return 'aliados';
  if (normalized.includes('empres')) return 'empresarios';
  return normalized;
};

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
    lastUpdated: null,
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
            lastUpdated: new Date(),
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
          /* 15 – metas_asesores for VN gerente: fetch by celula OR gerente name (server-side filter para no chocar con el cap de 1000 filas) */
          isVN && profile.role !== 'asesor' && profile.nombre
            ? (() => {
                const safeNombre = String(profile.nombre).replace(/[%,()]/g, ' ').trim();
                const orParts: string[] = [];
                if (profile.celula) orParts.push(`celula.eq.${String(profile.celula).replace(/,/g, ' ')}`);
                if (safeNombre) orParts.push(`gerente.ilike.%${safeNombre}%`);
                let q = supabase.from('metas_asesores' as any)
                  .select('anio_mes, documento_asesor, nombre_asesor, meta_fe, meta_nube, meta_total, novedad, celula, gerente')
                  .gte('anio_mes', `${anioActual}01`)
                  .lte('anio_mes', `${anioActual}12`)
                  .limit(5000);
                if (orParts.length > 0) q = q.or(orParts.join(','));
                return q;
              })()
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
                  Filtramos por celula (más confiable que nombre). Si no hay
                  celula en el perfil, traemos por canal_direccion+pais y
                  filtramos en cliente con normalización por nombre. */
          isVN && profile.role !== 'asesor' && profile.nombre
            ? (() => {
                let q = supabase
                  .from('ventas_gerente_mensual' as any)
                  .select('pais, anio, mes, periodo, canal_direccion, gerente, gerente_normalizado, celula, familia, unidades, acv')
                  .gte('periodo', `${anioActual}01`)
                  .lte('periodo', `${anioActual}12`)
                  .limit(5000);
                if (profile.celula) {
                  q = q.eq('celula', profile.celula);
                } else {
                  const canalDir = profile.canal === 'VN_ALIADOS' ? 'Aliados'
                                 : profile.canal === 'VN_EMPRESARIOS' ? 'Empresarios'
                                 : null;
                  if (canalDir) q = q.eq('canal_direccion', canalDir);
                  if (profile.pais) q = q.eq('pais', String(profile.pais).toUpperCase());
                }
                return q;
              })()
            : Promise.resolve({ data: [] }),
          /* 21 – metas_acv_gerentes: VERDAD oficial de meta ACV (Databricks).
                  No filtrar por celula en DB: hay diferencias de tildes (México/Mexico).
                  El match se hace normalizado en getAcvCatalogRowForPeriod. */
          isVN && profile.role !== 'asesor' && profile.celula
            ? supabase
                .from('metas_acv_gerentes' as any)
                .select('pais, canal, director, celula, mes, meta_fe, meta_nube, meta_total_acv, meta_total_und, archivo')
                .eq('pais', String(profile.pais || '').toUpperCase())
                .limit(1000)
            : Promise.resolve({ data: [] }),
          /* 22 – vn_metricas_optimizadas (scope=asesor): FUENTE DE VERDAD para
                  ventas FE/NUBE por asesor del equipo de un gerente VN.
                  No filtramos por canal_direccion: Databricks puede traer la
                  célula con el canal anterior después de una reasignación. */
          isVN && profile.role !== 'asesor' && profile.nombre
            ? (() => {
                // No filtramos por celula server-side porque la grafía puede diferir
                // entre `gerentes` y `vn_metricas_optimizadas` (acentos, p.ej.
                // "México" vs "Mexico"). Filtramos por canal+pais y dejamos que el
                // matchVnRow client-side (normalizado sin acentos) haga el match
                // exacto por celula o nombre. Esto generaliza para CUALQUIER gerente VN.
                let q = supabase
                  .from('vn_metricas_optimizadas' as any)
                  .select('pais, mes_nro, canal_direccion, celula, gerente, gerente_responsable:gerente, gerente_normalizado, asesor, tipo_producto1, familia, ventas, acv_total')
                  .eq('scope', 'asesor')
                  .eq('anio', anioActual)
                  .eq('mes_nro', mesIdx + 1)
                  .limit(8000);
                if (profile.pais) q = q.eq('pais', String(profile.pais).toUpperCase());
                return q;
              })()
            : Promise.resolve({ data: [] }),
          /* 23 – vn_metricas_optimizadas (scope=gerente): FUENTE PRIMARIA del
                  Rendimiento del Mes y del Historial Mensual del gerente VN.
                  Misma fuente que se usa hoy para "Rendimiento del Mes" — al
                  consumirla también para el Historial garantizamos consistencia.
                  No filtrar por canal_direccion para soportar reasignaciones
                  Aliados ↔ Empresarios con datos todavía marcados en el canal anterior. */
          isVN && profile.role !== 'asesor' && profile.nombre
            ? (() => {
                // Igual que scope=asesor: evitamos .eq('celula', ...) server-side y
                // delegamos el match exacto al filtro client-side normalizado.
                let q = supabase
                  .from('vn_metricas_optimizadas' as any)
                  .select('pais, anio, mes_nro, canal_direccion, celula, gerente, gerente_normalizado, tipo_producto1, familia, ventas, acv_total')
                  .eq('scope', 'gerente')
                  .eq('anio', anioActual)
                  .limit(5000);
                if (profile.pais) q = q.eq('pais', String(profile.pais).toUpperCase());
                return q;
              })()
            : Promise.resolve({ data: [] }),
          /* 24 – metas_gerentes (solo MEX VN): fallback meta_nube = coi + noi
                  cuando metas_acv_gerentes.meta_nube viene en 0 desde Databricks. */
          isVN && profile.role !== 'asesor'
            && String(profile.pais || '').toUpperCase() === 'MEX'
            && profile.celula
            ? supabase
                .from('metas_gerentes')
                .select('celula, anio_mes, coi, noi, fe, nube, canal_direccion, pais_gestion')
                .eq('celula', profile.celula)
                .gte('anio_mes', `${anioActual}01`)
                .lte('anio_mes', `${anioActual}12`)
            : Promise.resolve({ data: [] }),
        ];

        const results = await Promise.all(queries);
        if (cancelled) return;

        const [rachaRes, kpisRes, medallasRes, feedRes, unidadesRes, ventasSemanaRes, acvRes, productRes, rankingRes, teamRes, acvAllMonthsRes, canjeablesRes, ejecRes, metasRes, celulaProductividadRes, vnMetasRes, vnHistoryRes, _legacy17, vcTeamRes, ventasDiariasRes, ventasGerenteMensualRes, metasAcvCatalogRes, vnMetricasAsesorRes, vnMetricasGerenteRes, metasGerentesMexRes] = results as any[];

        // ───────────────────────────────────────────────────────────────
        // Fallback MÉXICO VN (Aliados/Empresarios): cuando Databricks deja
        // metas_acv_gerentes.meta_nube en 0 para México, la meta de Nube
        // real es la suma de columnas COI + NOI dentro de metas_gerentes.
        // Sobreescribimos las filas del catálogo IN-PLACE para que toda la
        // lógica downstream (Mi Progreso , Panel General, Historial) use
        // el valor correcto sin tocar el resto del flujo.
        // ───────────────────────────────────────────────────────────────
        if (
          isVN
          && String(profile.pais || '').toUpperCase() === 'MEX'
          && Array.isArray(metasGerentesMexRes?.data)
          && metasGerentesMexRes.data.length > 0
          && Array.isArray(metasAcvCatalogRes?.data)
        ) {
          const mes3to2: Record<string, string> = {
            ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
            jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
          };
          const mgRows = (metasGerentesMexRes.data as any[]).slice().sort(
            (a: any, b: any) => String(b.anio_mes || '').localeCompare(String(a.anio_mes || ''))
          );
          const mgByPeriod = new Map<string, any>();
          mgRows.forEach((r: any) => {
            const p = String(r.anio_mes || '');
            if (!mgByPeriod.has(p)) mgByPeriod.set(p, r);
          });
          // Fila más reciente: usada como fallback cuando el período exacto no
          // tiene registro en metas_gerentes (Databricks aún no sincronizó el mes).
          const mgLatest = mgRows[0];
          (metasAcvCatalogRes.data as any[]).forEach((r: any) => {
            const mes2 = mes3to2[String(r.mes || '').trim().toLowerCase().slice(0, 3)] || '';
            if (!mes2) return;
            const period = `${anioActual}${mes2}`;
            const mg = mgByPeriod.get(period) || mgLatest;
            if (!mg) return;
            const sumNube = (Number(mg.coi) || 0) + (Number(mg.noi) || 0);
            if ((Number(r.meta_nube) || 0) === 0 && sumNube > 0) {
              r.meta_nube = sumNube;
            }
          });
        }

        // Filtrado client-side robusto para gerentes VN: si la query trajo más
        // filas de las del propio gerente (caso fallback sin celula), nos
        // quedamos solo con su celula o, en su defecto, con su nombre normalizado.
        if (isVN && profile.role !== 'asesor' && profile.nombre) {
          const targetCelula = normalizeComparableText(profile.celula ?? '');
          const targetNombre = normalizeComparableText(profile.nombre);
          const targetNameWords = targetNombre.split(' ').filter((w: string) => w.length > 3);
          const matchesTargetManager = (rowNombre: string) => {
            if (!rowNombre || !targetNombre) return false;
            if (rowNombre === targetNombre || rowNombre.includes(targetNombre) || targetNombre.includes(rowNombre)) return true;
            const rowWords = new Set(rowNombre.split(' ').filter((w: string) => w.length > 3));
            const shared = targetNameWords.filter((w: string) => rowWords.has(w));
            return shared.length >= 2;
          };
          const matchVnRow = (r: any) => {
            const rowCelula = normalizeComparableText(r.celula ?? '');
            const rowNombre = normalizeComparableText(r.gerente_normalizado ?? r.gerente ?? '');
            if (targetCelula && rowCelula === targetCelula) return true;
            if (matchesTargetManager(rowNombre)) return true;
            return false;
          };
          const targetAdvisorNamesFromMetas = new Set(
            ((vnMetasRes?.data as any[]) || [])
              .map((row: any) => normalizeComparableText(row.nombre_asesor))
              .filter(Boolean)
          );
          const scopedVnAsesorRows = (rows: any[] = []) => rows.filter((r: any) => {
            const rowAsesor = normalizeComparableText(r.asesor ?? '');
            const rowCelula = normalizeComparableText(r.celula ?? '');
            const rowGerente = normalizeComparableText(r.gerente_normalizado ?? r.gerente ?? r.gerente_responsable ?? '');
            const rowCanal = normalizeVnChannel(r.canal_direccion ?? r.equipo ?? '');
            const profileCanal = normalizeVnChannel(profile.canal ?? '');
            const hasTeamHint = !!(rowCelula || rowGerente);
            if (rowAsesor && matchesNormalizedPerson(rowAsesor, targetAdvisorNamesFromMetas)) return true;
            if (targetCelula && rowCelula === targetCelula) return true;
            if (matchesTargetManager(rowGerente)) return true;
            if (!hasTeamHint && profileCanal && rowCanal === profileCanal) return true;
            return false;
          });
          if (ventasGerenteMensualRes?.data) {
            ventasGerenteMensualRes.data = (ventasGerenteMensualRes.data as any[]).filter(matchVnRow);
          }
          if (vnMetricasAsesorRes?.data) {
            vnMetricasAsesorRes.data = scopedVnAsesorRows(vnMetricasAsesorRes.data as any[]);
          }
          if (vnMetricasGerenteRes?.data) {
            vnMetricasGerenteRes.data = (vnMetricasGerenteRes.data as any[]).filter(matchVnRow);
          }
        }

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
        // FUENTE ÚNICA VN GERENTES — compartido entre Rendimiento del Mes (gerente block)
        // e Historial Mensual (vnMonthlyCumpl block).
        let vgmDeduped = new Map<string, { fe: number; nube: number; total: number; acv: number }>();
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
          // Palabras significativas (>3 chars) del nombre del gerente para fuzzy match
          // contra células de Databricks que se llaman "Equipo Ciudad NombreGerente"
          // mientras Supabase usa "Cuarzo", "Rubí", etc.
          const gerenteNameWords = gerenteNombre
            .split(' ')
            .filter((w: string) => w.length > 3);
          const matchesGerenteName = (candidate: string) => {
            if (!candidate || !gerenteNombre) return false;
            if (candidate === gerenteNombre || candidate.includes(gerenteNombre) || gerenteNombre.includes(candidate)) return true;
            const candidateWords = new Set(candidate.split(' ').filter((w: string) => w.length > 3));
            return gerenteNameWords.filter((w: string) => candidateWords.has(w)).length >= 2;
          };
          const matchesGerenteCelula = (rowCelula: string, rowGerente = '') => {
            if (celulaGerente && rowCelula === celulaGerente) return true;
            // Si el gerente tiene célula definida, NO usar fuzzy match por palabras
            // del nombre — eso mezclaba datos entre células que comparten un nombre
            // común (ej. "Equipo DianaM" vs "Equipo Bogota Diana").
            if (celulaGerente) return false;
            if (matchesGerenteName(rowGerente)) return true;
            return gerenteNameWords.length >= 2 && gerenteNameWords.slice(1).some((word: string) => rowCelula.includes(word));
          };
          // FIX: NO agregar al gerente al set de asesores del equipo — causaba que
          // el propio gerente apareciera como un "asesor" con FE=0 en la lista de
          // Rendimiento del Equipo. El gerente se identifica por celula/gerente,
          // no debe ser tratado como asesor.

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
            if (matchesGerenteCelula(rowCelula, rowGerente)) {
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
              if (matchesGerenteCelula(rowCelula, rowGerente)) return true;
              return false;
            });

            if (rowsByTeam.length > 0) return rowsByTeam;

            // Fallback 1: por nombres de asesores conocidos del equipo
            if (teamAsesorNames.size > 0) {
              const byName = periodRows.filter((row: any) =>
                row.nombre_asesor && teamAsesorNames.has(normalizeComparableText(row.nombre_asesor))
              );
              if (byName.length > 0) return byName;
            }

            // Fallback 2: por documento_asesor identificado en otros meses
            if (teamAdvisorDocs.size > 0) {
              const byDoc = periodRows.filter((row: any) =>
                row.documento_asesor && teamAdvisorDocs.has(String(row.documento_asesor).trim().toLowerCase())
              );
              if (byDoc.length > 0) return byDoc;
            }

            // Fallback 3: match directo con la célula del gerente (sin depender del set)
            if (celulaGerente) {
              const byCelulaDirecta = periodRows.filter((row: any) => {
                const rowCelula = normalizeComparableText(row.celula ?? '');
                return rowCelula && rowCelula === celulaGerente;
              });
              if (byCelulaDirecta.length > 0) return byCelulaDirecta;
            }

            return [];
          };

          vnMetasAsesores.forEach((row: any) => {
            const rowCelula = normalizeComparableText(row.celula);
            const rowGerente = normalizeComparableText(row.gerente);
            const rowAsesor = normalizeComparableText(row.nombre_asesor);
            const sameCelula = matchesGerenteCelula(rowCelula, rowGerente);
            const sameGerente = matchesGerenteName(rowGerente);
            const knownAsesor = !!rowAsesor && matchesNormalizedPerson(rowAsesor, teamAsesorNames);

            if (sameCelula || sameGerente || knownAsesor) {
              if (row.nombre_asesor) teamAsesorNames.add(normalizeComparableText(row.nombre_asesor));
              if (row.documento_asesor) teamAdvisorDocs.add(String(row.documento_asesor).trim().toLowerCase());
            }
          });

          // Garantizar que teamAdvisorDocs incluya TODOS los documentos del equipo
          // identificados por celula o gerente en cualquier mes del año.
          vnMetasAsesores.forEach((row: any) => {
            const rowCelula = normalizeComparableText(row.celula);
            const rowGerente = normalizeComparableText(row.gerente);
            const isSameTeam = matchesGerenteCelula(rowCelula, rowGerente);
            if (isSameTeam && row.documento_asesor) {
              teamAdvisorDocs.add(String(row.documento_asesor).trim().toLowerCase());
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
            const rowPais = String(row.pais || '').toUpperCase().trim();
            const samePais = !paisProfile || !rowPais || rowPais === paisProfile;
            if (!samePais) return false;

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
              // Excluir filas agregadas CEL_* (nombre_asesor null) — ya son la suma de
              // los asesores individuales, incluirlas duplicaría las metas del equipo.
              if (!row.nombre_asesor) return false;
              const novedadRaw = String(row.novedad || '').trim();
              return novedadRaw === '' || novedadRaw === 'Sin novedad';
            });

            const metaFe = validRows.reduce((s: number, r: any) => s + (Number(r.meta_fe) || 0), 0);
            const metaNube = validRows.reduce((s: number, r: any) => s + (Number(r.meta_nube) || 0), 0);
            const metaTotal = validRows.reduce((s: number, r: any) => s + (Number(r.meta_total) || 0), 0);

            return { rows: rows.filter((row: any) => !!row.nombre_asesor), asesoresConNovedad, metaFe, metaNube, metaTotal };
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
          let { metaFe, metaNube, metaTotal: metaEquipoUnidades } = metaContextActual;

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
            const filterByMes = (r: any) =>
              String(r.mes || '').trim().toLowerCase().slice(0, 3) === mes3;

            // Estrategia 1 (exacta): celula del perfil
            let rows = acvCatalogRows.filter((r: any) => {
              if (!filterByMes(r)) return false;
              const rowCelulaNorm = normalizeComparableText(r.celula);
              const rowDirectorNorm = normalizeComparableText(r.director);
              return matchesGerenteCelula(rowCelulaNorm, rowDirectorNorm);
            });

            // Estrategia 2 (fuzzy): SOLO cuando el gerente NO tiene célula asignada.
            // Antes esto traía metas de células ajenas que compartían palabras del
            // nombre (ej. "Equipo Bogota Diana" se contaba para gerentes con "Diana"
            // en el nombre aunque tuvieran su propia célula "Equipo DianaM").
            if (rows.length === 0 && !celulaGerente && gerenteNameWords.length > 0) {
              rows = acvCatalogRows.filter((r: any) => {
                if (!filterByMes(r)) return false;
                const rowCelulaNorm = normalizeComparableText(r.celula);
                const rowDirectorNorm = normalizeComparableText(r.director);
                return matchesGerenteName(rowDirectorNorm) || matchesGerenteCelula(rowCelulaNorm, rowDirectorNorm);
              });
            }

            // Prioridad Cierre > Inicio para evitar duplicación de meta.
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

          // Sobreescribir metas del mes actual con metas_acv_gerentes (fuente única,
          // misma que enrich() del historial). Evita "Meta: 0 UDS" cuando el match
          // por celula/gerente en metas_asesores no coincide.
          const _catalogFeMes = Math.round(Number(acvOficial?.meta_fe) || 0);
          const _catalogNubeMes = Math.round(Number(acvOficial?.meta_nube) || 0);
          const _catalogUndMes = Math.round(Number(acvOficial?.meta_total_und) || 0);
          if (_catalogFeMes > 0 || _catalogNubeMes > 0) {
            metaFe = _catalogFeMes;
            metaNube = _catalogNubeMes;
            metaEquipoUnidades = _catalogUndMes > 0
              ? _catalogUndMes
              : (_catalogFeMes + _catalogNubeMes);
          }

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
            return matchesNormalizedPerson(nombre, teamAsesorNames) || teamAdvisorDocs.has(documento);
          });
          const teamVentasDiariasMonth = teamVentasDiariasAll.filter((row: any) => getPeriodFromDate(row.fecha) === mesActual);
          const teamEjecRows = teamEjecRowsAll.filter((e: any) => String(e.periodo) === mesActual);

          // ⭐ FUENTE DE VERDAD #1: vn_metricas_optimizadas (scope='asesor', Databricks pre-agregado).
          // Las filas pueden venir duplicadas por variantes del nombre del gerente
          // (ej. "Diana Naranjo" y "Diana Maria Naranjo Mattheus"), por lo que
          // deduplicamos por (asesor, familia) tomando el valor más alto disponible.
          const mesNroActual = parseInt(mesActual.slice(4), 10);
          const vnMetAsesorRowsAll: any[] = (vnMetricasAsesorRes?.data || [])
            .filter((r: any) => Number(r.mes_nro) === mesNroActual);
          const vmaMap = new Map<string, { ventas: number; acv: number; familia: string }>();
          for (const r of vnMetAsesorRowsAll) {
            const fam = String(r.familia || r.tipo_producto1 || '').toUpperCase();
            const asesor = String(r.asesor || '').trim().toLowerCase();
            if (!asesor || !fam) continue;
            const key = `${asesor}::${fam}`;
            const v = Number(r.total_productos ?? r.ventas) || 0;
            const a = Number(r.acv_total) || 0;
            const prev = vmaMap.get(key);
            if (!prev || v > prev.ventas) vmaMap.set(key, { ventas: v, acv: a, familia: fam });
          }
          const vmaHasMonth = vmaMap.size > 0;
          let vmaFe = 0, vmaNube = 0, vmaContador = 0, vmaAcv = 0;
          for (const v of vmaMap.values()) {
            if (v.familia === 'FE') vmaFe += v.ventas;
            else if (v.familia === 'NUBE') vmaNube += v.ventas;
            else if (v.familia === 'CONTADOR') vmaContador += v.ventas;
            vmaAcv += v.acv;
          }
          const vmaTotal = vmaFe + vmaNube + vmaContador;

          // ⭐ FUENTE ÚNICA VN GERENTES:
          //   ventas_gerente_mensual (filtrada por celula) → vgmDeduped Map
          //   → vgmHasMonth + vgmFe/Nube/Acv (Rendimiento del Mes)
          //   → ejecByPeriod (Historial Mensual)
          //   NUNCA usar fuentes distintas para estos dos componentes.
          // ⭐ FUENTE ÚNICA VN GERENTES — Rendimiento del Mes + Historial Mensual:
          //   PRIMARIA: vn_metricas_optimizadas (scope='gerente') — misma tabla que
          //             alimenta hoy "Rendimiento del Mes". Datos directos Databricks.
          //   FALLBACK: ventas_gerente_mensual filtrada por celula (replicación interna)
          //             — solo para periodos donde vn_metricas_optimizadas no tiene datos.
          //   Ambas alimentan el MISMO Map vgmDeduped → mismo objeto en memoria
          //   para "Rendimiento del Mes" y para "Historial Mensual". Nunca pueden diferir.
          vgmDeduped = new Map<string, { fe: number; nube: number; total: number; acv: number }>();
          const _yearNumGer = Number(anioActual);

          // 1) PRIMARIA — vn_metricas_optimizadas (scope=gerente)
          const vnMetGerenteRows: any[] = vnMetricasGerenteRes?.data || [];
          const vmgFamMax = new Map<string, { uds: number; acv: number }>();
          vnMetGerenteRows.forEach((r: any) => {
            const mesNro = Number(r.mes_nro);
            if (!mesNro || mesNro < 1 || mesNro > 12) return;
            const period = `${_yearNumGer}${String(mesNro).padStart(2, '0')}`;
            const fam = String(r.familia || r.tipo_producto1 || '').toUpperCase().trim();
            if (!fam) return;
            // Mapear nomenclaturas de Databricks (México: CAMPANA → NUBE)
            const famNorm = fam === 'CAMPANA' ? 'NUBE'
                          : (fam === 'FE' || fam === 'NUBE' || fam === 'CONTADOR') ? fam
                          : 'OTRO';
            const k = `${period}::${famNorm}`;
            const uds = Math.round(Number(r.ventas) || 0);
            const acvV = Math.round(Number(r.acv_total) || 0);
            const prev = vmgFamMax.get(k);
            // Tomamos MAX para colapsar variantes del nombre del gerente sin doblar.
            if (!prev || uds > prev.uds) vmgFamMax.set(k, { uds, acv: acvV });
          });
          const vmgPeriodsWithData = new Set<string>();
          vmgFamMax.forEach((val, k) => {
            const [period, fam] = k.split('::');
            const cur = vgmDeduped.get(period) || { fe: 0, nube: 0, total: 0, acv: 0 };
            if (fam === 'FE') cur.fe += val.uds;
            else if (fam === 'NUBE') cur.nube += val.uds;
            cur.total += val.uds;
            cur.acv += val.acv;
            vgmDeduped.set(period, cur);
            vmgPeriodsWithData.add(period);
          });

          // 2) FALLBACK — ventas_gerente_mensual SOLO para periodos no cubiertos arriba.
          const vgmAllRowsForMap: any[] = ventasGerenteMensualRes?.data || [];
          const vgmFamMax = new Map<string, { uds: number; acv: number }>();
          vgmAllRowsForMap.forEach((r: any) => {
            const period = String(r.periodo || '');
            const fam = String(r.familia || '').toUpperCase();
            if (!period || !fam) return;
            if (vmgPeriodsWithData.has(period)) return; // ya cubierto por fuente primaria
            const k = `${period}::${fam}`;
            const uds = Math.round(Number(r.unidades) || 0);
            const acvV = Math.round(Number(r.acv) || 0);
            const prev = vgmFamMax.get(k);
            if (!prev || uds > prev.uds) vgmFamMax.set(k, { uds, acv: acvV });
          });
          vgmFamMax.forEach((val, k) => {
            const [period, fam] = k.split('::');
            const cur = vgmDeduped.get(period) || { fe: 0, nube: 0, total: 0, acv: 0 };
            if (fam === 'FE') cur.fe += val.uds;
            else if (fam === 'NUBE') cur.nube += val.uds;
            cur.total += val.uds; // FE + NUBE + CONTADOR + OTRO
            cur.acv += val.acv;
            vgmDeduped.set(period, cur);
          });
          const vgmMesActual = vgmDeduped.get(mesActual) || { fe: 0, nube: 0, total: 0, acv: 0 };
          const vgmHasMonth = vgmDeduped.has(mesActual);
          const vgmFe = vgmMesActual.fe;
          const vgmNube = vgmMesActual.nube;
          const vgmTotal = vgmMesActual.total;
          const vgmAcv = vgmMesActual.acv;

          // SOURCE OF TRUTH for VN gerente totals: vn_metricas_optimizadas scope=gerente
          // → ventas_gerente_mensual → scope=asesor → ventas_diarias/ejecucion fallback.
          // El bloque "Avance del Mes" debe coincidir con el agregado oficial del gerente,
          // no con un dedup por asesor que puede subcontar productos de la misma familia.
          const ventasDiariasHasMonth = teamVentasDiariasMonth.length > 0;
          const teamVentasFe = vgmHasMonth
            ? vgmFe
            : (vmaHasMonth
                ? vmaFe
                : (ventasDiariasHasMonth
                    ? teamVentasDiariasMonth.reduce((s: number, row: any) => s + (classifyFamily(row) === 'FE' ? Math.round(Number(row.unidades) || 0) : 0), 0)
                    : teamEjecRows.reduce((s: number, r: any) => s + Math.round(Number(r.ventas_fe) || 0), 0)));
          const teamVentasNube = vgmHasMonth
            ? vgmNube
            : (vmaHasMonth
                ? vmaNube
                : (ventasDiariasHasMonth
                    ? teamVentasDiariasMonth.reduce((s: number, row: any) => s + (classifyFamily(row) === 'NUBE' ? Math.round(Number(row.unidades) || 0) : 0), 0)
                    : teamEjecRows.reduce((s: number, r: any) => s + Math.round(Number(r.ventas_nube) || 0), 0)));
          const teamVentasTotal = vgmHasMonth
            ? vgmTotal
            : (vmaHasMonth
                ? vmaTotal
                : (ventasDiariasHasMonth
                    ? teamVentasDiariasMonth.reduce((s: number, row: any) => s + Math.round(Number(row.unidades) || 0), 0)
                    : teamEjecRows.reduce((s: number, r: any) => s + Math.round(Number(r.ventas_total) || 0), 0)));
          const teamAcvFromVgm = vgmHasMonth ? Math.round(vgmAcv) : (vmaHasMonth ? Math.round(vmaAcv) : 0);
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

            // ACV: prioriza vn_metricas_optimizadas / ventas_gerente_mensual (Databricks oficial)
            const totalAcv = (vmaHasMonth || vgmHasMonth) && teamAcvFromVgm > 0 ? teamAcvFromVgm : totalAcvProd;

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
            acvMes = (vmaHasMonth || vgmHasMonth) && teamAcvFromVgm > 0 ? teamAcvFromVgm : kpiAcv;
            const metaFallback = metaEquipoUnidades || Number(kpiData?.meta) || 0;
            pctCumplimiento = metaAcvEquipo > 0 ? Math.round((acvMes / metaAcvEquipo) * 100) : 0;

            if (vmaHasMonth || vgmHasMonth || (kpiData && (Number(kpiData.ventas) > 0 || Number(kpiData.meta) > 0))) {
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
                ventas_fe: Math.round(Number(matchingEjec?.ventas_fe) || 0) || ventasDiariasFe,
                ventas_nube: Math.round(Number(matchingEjec?.ventas_nube) || 0) || ventasDiariasNube,
                ventas_total: Math.round(Number(matchingEjec?.ventas_total) || 0) || ventasDiariasTotal,
                acv_total: Math.round(Number(matchingEjec?.acv_total) || 0) || Math.round(matchingVentasDiarias.reduce((s: number, row: any) => s + (Number(row.acv) || 0), 0)),
                cant_recomendados: Number(matchingEjec?.cant_recomendados) || 0,
                productividad: Number(matchingEjec?.productividad) || 0,
              };
            }
            if (matchingMeta) {
              // meta_acv del asesor: 1) productividad_asesores.meta del mes
              //                      2) fallback proporcional usando el catálogo
              //                         metas_acv_gerentes (cuando productividad
              //                         aún no tiene datos del mes — caso Mayo).
              let metaAcvAsesor = normalizeVnMetaAcv(matchingProductividad?.meta);
              if (metaAcvAsesor === 0) {
                const mes3Map: Record<string, string> = { '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun', '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic' };
                const mes3 = mes3Map[mesActual.slice(-2)] || '';
                const celulaAsesor = normalizeComparableText(matchingMeta.celula);
                const catalogList: any[] = (metasAcvCatalogRes?.data as any[]) || [];
                const matches = catalogList.filter((r: any) =>
                  String(r.mes || '').trim().toLowerCase().slice(0, 3) === mes3 &&
                  normalizeComparableText(r.celula) === celulaAsesor
                );
                const acvOficialAsesor = matches.find((r: any) => String(r.archivo || '').toLowerCase().includes('cierre')) ?? matches[0];
                const teamMetaAcv = normalizeVnMetaAcv(acvOficialAsesor?.meta_total_acv, acvOficialAsesor?.pais);
                const teamMetaTotal = Math.round(Number(acvOficialAsesor?.meta_total_und) || 0);
                const asesorMetaTotal = Number(matchingMeta.meta_total) || 0;
                if (teamMetaAcv > 0 && teamMetaTotal > 0 && asesorMetaTotal > 0) {
                  metaAcvAsesor = Math.round((teamMetaAcv * asesorMetaTotal) / teamMetaTotal);
                }
              }
              metaAsesor = {
                meta_fe: Number(matchingMeta.meta_fe) || 0,
                meta_nube: Number(matchingMeta.meta_nube) || 0,
                meta_total: Number(matchingMeta.meta_total) || 0,
                meta_acv: metaAcvAsesor,
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

            const advisorAcv = Math.round(Number(matchingEjec?.acv_total) || 0) || normalizeStoredAcv(matchingProductividad?.acv_f);
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
          // ⭐ FUENTE ÚNICA: vgmDeduped (ventas_gerente_mensual filtrada por celula
          // y deduplicada por periodo+familia). Garantiza que Rendimiento del Mes
          // e Historial Mensual coincidan exactamente — ambos leen del mismo Map.
          const ejecByPeriod = new Map<string, { fe: number; nube: number; total: number; acv: number }>();
          const vgmPeriodsWithData = new Set<string>(vgmDeduped.keys());
          vgmDeduped.forEach((v, period) => {
            ejecByPeriod.set(period, { fe: v.fe, nube: v.nube, total: v.total, acv: v.acv });
          });

          // Periodos sin data en vgm: NO usar vma como fallback (causaba desajustes).
          // Mantener fallback final a ventas_diarias / ejecucion_asesores solo si
          // tampoco hay vgm para ese periodo.
          const vmaPeriodsWithData = new Set<string>(); // legado: vacío para no contaminar.

          // Para periodos SIN data en vgm, usar ventas_diarias o ejecucion_asesores
          const ventasBaseForHistory = vnVentasDiariasRows.length > 0
            ? vnVentasDiariasRows.map((row: any) => {
                const fam = resolveProductFamily(row.producto, row.pais || profile.pais)
                  ?? (String(row.tipo_producto || '').toUpperCase() as 'FE' | 'NUBE' | 'CONTADOR' | 'OTRO');
                const uds = Math.round(Number(row.unidades) || 0);
                return {
                  periodo: getPeriodFromDate(row.fecha),
                  ventas_fe: fam === 'FE' ? uds : 0,
                  ventas_nube: fam === 'NUBE' ? uds : 0,
                  ventas_total: uds,
                  acv: Math.round(Number(row.acv) || 0),
                };
              })
            : vnTeamEjecAll;
          ventasBaseForHistory.forEach((e: any) => {
            const period = String(e.periodo || '');
            if (vmaPeriodsWithData.has(period)) return; // ya cubierto por vma
            if (vgmPeriodsWithData.has(period)) return; // ya cubierto por vgm
            const cur = ejecByPeriod.get(period) || { fe: 0, nube: 0, total: 0, acv: 0 };
            cur.fe += Math.round(Number(e.ventas_fe) || 0);
            cur.nube += Math.round(Number(e.ventas_nube) || 0);
            cur.total += Math.round(Number(e.ventas_total) || 0);
            cur.acv += Math.round(Number(e.acv) || 0);
            ejecByPeriod.set(period, cur);
          });

          const enrich = (period: string, base: MonthlyCumplimiento): MonthlyCumplimiento => {
            const ej = ejecByPeriod.get(period) || { fe: 0, nube: 0, total: 0, acv: 0 };
            // FUENTE ÚNICA para meta_fe / meta_nube / meta_total_acv: metas_acv_gerentes.
            // Priorizar Cierre > Inicio. NO usar fallback proporcional desde metas_asesores
            // (causaba desajustes entre Rendimiento del Mes e Historial Mensual).
            const acvCatalogRows: any[] = (metasAcvCatalogRes?.data as any[]) || [];
            const mes3ForAcv: Record<string, string> = {
              '01': 'ene', '02': 'feb', '03': 'mar', '04': 'abr', '05': 'may', '06': 'jun',
              '07': 'jul', '08': 'ago', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dic',
            };
            const targetMes3 = mes3ForAcv[String(period).slice(-2)] || '';
            const celulaGerenteNorm = normalizeComparableText(profile.celula);
            const gerenteNombreNorm = normalizeComparableText(profile.nombre);
            const gerenteNameWords = gerenteNombreNorm.split(' ').filter((w: string) => w.length > 3);
            const filterEnrichByMes = (r: any) =>
              String(r.mes || '').trim().toLowerCase().slice(0, 3) === targetMes3;
            // FUENTE ÚNICA: match estricto por célula del gerente.
            // El fallback por palabras del nombre se ELIMINA porque mezclaba metas de
            // otras células (ej. "Equipo DianaM" tomaba metas de "Equipo Bogota Diana"
            // por compartir la palabra "diana"), inflando Historial Mensual y SP anual.
            // Solo se permite fallback por nombre cuando el gerente NO tiene célula
            // asignada (caso límite de configuración).
            let catalogMatches = celulaGerenteNorm
              ? acvCatalogRows.filter(
                  (r: any) => filterEnrichByMes(r) && normalizeComparableText(r.celula) === celulaGerenteNorm
                )
              : [];
            if (catalogMatches.length === 0 && !celulaGerenteNorm && gerenteNameWords.length > 0) {
              catalogMatches = acvCatalogRows.filter((r: any) => {
                if (!filterEnrichByMes(r)) return false;
                const rowCelulaNorm = normalizeComparableText(r.celula);
                return gerenteNameWords.some((word: string) => rowCelulaNorm.includes(word));
              });
            }
            const catalogRowForAcv = catalogMatches.find((r: any) => String(r.archivo || '').toLowerCase().includes('cierre')) ?? catalogMatches[0];
            const mFe = Number(catalogRowForAcv?.meta_fe) || 0;
            const mNube = Number(catalogRowForAcv?.meta_nube) || 0;
            const mTotal = (mFe + mNube) || Number(catalogRowForAcv?.meta_total_und) || 0;
            // Si vgm tiene ACV para este periodo, sobreescribe el ACV base
            const acvFinal = ej.acv > 0 ? Math.round(ej.acv) : base.acv;
            const catalogMetaAcv = catalogRowForAcv?.meta_total_acv
              ? normalizeVnMetaAcv(catalogRowForAcv.meta_total_acv, catalogRowForAcv.pais)
              : 0;
            const metaAcvFromProd = base.meta;
            const esActual = period === mesActual;
            const metaAcvFinal = catalogMetaAcv > 0
              ? catalogMetaAcv
              : metaAcvFromProd > 0
                ? metaAcvFromProd
                : (esActual && vnMetaAcvActual > 0 ? vnMetaAcvActual : 0);
            const pctAcvFinal = metaAcvFinal > 0 ? Math.round((acvFinal / metaAcvFinal) * 100) : 0;
            const pctFeFinal = mFe > 0 ? Math.round((ej.fe / mFe) * 100) : 0;
            const pctNubeFinal = mNube > 0 ? Math.round((ej.nube / mNube) * 100) : 0;
            // SP del mes (cap por componente, sin %Uds)
            const cap = (v: number) => Math.min(300, Math.max(0, Math.round(v || 0)));
            const spMes = cap(pctFeFinal) + cap(pctNubeFinal) * 2 + cap(pctAcvFinal);
            return {
              ...base,
              acv: acvFinal,
              meta: metaAcvFinal,
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
          if (vnMonthlyCumpl.length > 0) {
            const annualSpTotal = vnMonthlyCumpl.reduce((s, m) => s + (m.sp ?? 0), 0);
            if (annualSpTotal > 0) setSpConvencionAnual(annualSpTotal);
          }
        }

        if (isVN && !vcCumplimiento && vnMetaAcvActual > 0) {
          vcCumplimiento = { acv: acvMes, meta: vnMetaAcvActual, pct: pctCumplimiento };
        }

        // Build VN team asesor performance dashboard (only for gerentes VN)
        let teamAsesorPerformance: AsesorPerformance[] = [];
        if (isVN && profile.role !== 'asesor' && (vnCelulaRows.length > 0 || vnVentasDiariasRows.length > 0 || (vnMetricasAsesorRes?.data || []).length > 0)) {
          const metaContextActual = getMetaContextForPeriod(mesActual);
          const teamMetaRows = metaContextActual.rows;

          // Map metas by normalized asesor name
          const metasPorAsesor = new Map<string, any>();
          teamMetaRows.forEach((m: any) => {
            if (!m.nombre_asesor) return;
            const key = normalizeComparableText(m.nombre_asesor);
            metasPorAsesor.set(key, m);
          });

          const gerenteKey = normalizeComparableText(profile.nombre ?? '');
          // mes_nro derivado del periodo seleccionado (mesActual = YYYYMM), no del reloj del navegador
          const mesActualNro = parseInt(mesActual.slice(4), 10);
          const ventasPorAsesor = new Map<string, {fe:number; nube:number; total:number; acv:number}>();
          // FUENTE ÚNICA: vn_metricas_optimizadas scope=asesor — datos ACUMULADOS por mes
          // NO usar ventas_diarias (tiene filas diarias → suma incorrecta)
          const vnAsesorData: any[] = (typeof vnMetricasAsesorRes !== 'undefined' ? vnMetricasAsesorRes?.data : null) || [];

          // DEDUP: la tabla puede tener filas duplicadas para el mismo asesor cuando
          // el campo `gerente` viene con dos variantes ("Diana Naranjo" vs "Diana Maria
          // Naranjo Mattheus"). Como `gerente_normalizado` también difiere, ambas filas
          // pasan los filtros. Dedup por (asesor, tipo_producto1) tomando MAX(ventas/acv).
          const dedupAsesor = new Map<string, { uds: number; acv: number; tipo: string; key: string }>();
          const metaKeys = [...metasPorAsesor.keys()];
          const resolveTeamAsesorKey = (rawKey: string) => {
            if (!rawKey || metasPorAsesor.size === 0 || metasPorAsesor.has(rawKey)) return rawKey;
            const matched = metaKeys.find((metaKey) => matchesNormalizedPerson(rawKey, new Set([metaKey])));
            return matched || rawKey;
          };
          vnAsesorData
            .filter((r: any) => Number(r.mes_nro) === mesActualNro)
            .forEach((r: any) => {
              const rawKey = normalizeComparableText(r.asesor ?? '');
              const key = resolveTeamAsesorKey(rawKey);
              if (!rawKey || key === gerenteKey) return;
              if (metasPorAsesor.size > 0 && !metasPorAsesor.has(key)) return;
              const resolvedFam =
                resolveProductFamily(r.tipo_producto1, r.pais || profile.pais) ||
                resolveProductFamily(r.familia, r.pais || profile.pais);
              const famRaw = String(r.familia ?? r.tipo_producto1 ?? '').toUpperCase().trim();
              // Fallback robusto: si resolveProductFamily falla, usa contains sobre el
              // string crudo (ej. "FE ILI", "NUBE PYME", "CAMPAÑA POS").
              let tipo: string = resolvedFam || '';
              if (!tipo) {
                if (famRaw === 'FE' || famRaw.startsWith('FE ') || famRaw.includes('FACTURA')) tipo = 'FE';
                else if (famRaw === 'NUBE' || famRaw.startsWith('NUBE') || famRaw === 'CAMPANA' || famRaw.startsWith('CAMPAN')) tipo = 'NUBE';
                else tipo = famRaw;
              }
              // Granularidad por tipo_producto1 para no colisionar dedupKey entre
              // dos SKUs distintos del mismo asesor que mapean a la misma familia.
              const granKey = String(r.tipo_producto1 ?? r.familia ?? '').toUpperCase().trim();
              const dedupKey = `${key}|${tipo}|${granKey}`;
              const uds = Math.round(Number(r.total_productos ?? r.ventas) || 0);
              const acv = Math.round(Number(r.acv_total) || 0);
              const prev = dedupAsesor.get(dedupKey);
              if (!prev || uds > prev.uds) {
                dedupAsesor.set(dedupKey, { uds, acv, tipo, key });
              }
            });

          dedupAsesor.forEach(({ uds, acv, tipo, key }) => {
            const cur = ventasPorAsesor.get(key) || {fe:0, nube:0, total:0, acv:0};
            if (tipo === 'FE')                          cur.fe   += uds;
            if (tipo === 'NUBE' || tipo === 'CAMPANA')  cur.nube += uds;
            cur.total += uds;
            cur.acv   += acv;
            ventasPorAsesor.set(key, cur);
          });

          // Fallback: si Databricks aún no publicó los datos del mes en
          // vn_metricas_optimizadas, tomar ventas del día desde ventas_diarias
          const vnAsesorHasCurrentMonth = vnAsesorData.some(
            (r: any) => Number(r.mes_nro) === mesActualNro
          );
          if (!vnAsesorHasCurrentMonth && vnVentasDiariasRows.length > 0) {
            const mesStart = `${anioActual}-${String(mesActualNro).padStart(2,'0')}-01`;
            const nextMesNro = mesActualNro === 12 ? 1 : mesActualNro + 1;
            const nextMesAnio = mesActualNro === 12 ? anioActual + 1 : anioActual;
            const mesEnd = `${nextMesAnio}-${String(nextMesNro).padStart(2,'0')}-01`;
            vnVentasDiariasRows
              .filter((row: any) => {
                const fecha = String(row.fecha || '');
                return fecha >= mesStart && fecha < mesEnd;
              })
              .forEach((row: any) => {
                const key = normalizeComparableText(row.asesor ?? '');
                if (!key || key === gerenteKey) return;
                const fam = resolveProductFamily(row.producto, row.pais || profile.pais)
                            || String(row.tipo_producto || '').toUpperCase().trim();
                const tipo = fam === 'CAMPANA' ? 'NUBE' : fam;
                const uds = Math.round(Number(row.unidades) || 0);
                const acv = Math.round(Number(row.acv) || 0);
                const cur = ventasPorAsesor.get(key) || {fe:0, nube:0, total:0, acv:0};
                if (tipo === 'FE') cur.fe += uds;
                if (tipo === 'NUBE' || tipo === 'CAMPANA') cur.nube += uds;
                cur.total += uds;
                cur.acv += acv;
                ventasPorAsesor.set(key, cur);
              });
          }

          const currentMonthProd = vnCelulaRows.filter((r: any) => r.anio_mes === mesActual);
          const prodByName = new Map<string, any>();
          currentMonthProd.forEach((r: any) => {
            prodByName.set(normalizeComparableText(r.asesor), r);
          });

          const allAsesorKeys = new Set<string>();
          // Fuente maestra ÚNICA de identidad: metas_asesores del mes actual (sin novedad).
          // No agregamos asesores desde ventasPorAsesor para evitar incluir asesores
          // que ya no pertenecen al equipo en el mes en curso (p.ej. movimientos previos).
          metasPorAsesor.forEach((m, k) => {
            if (k === gerenteKey) return;
            const nov = String(m?.novedad ?? '').trim();
            if (nov === '' || nov === 'Sin novedad') allAsesorKeys.add(k);
          });
          // Fallback: si no hay metas_asesores cargadas para este periodo (típico en MEX
          // a inicio de mes mientras Databricks publica las metas), incluir a los asesores
          // que SÍ tienen ventas en vn_metricas_optimizadas para no mostrar el equipo vacío.
          if (allAsesorKeys.size === 0) {
            ventasPorAsesor.forEach((_v, k) => {
              if (k && k !== gerenteKey) allAsesorKeys.add(k);
            });
          }
          // NO usar prodByName.keys() — tiene nombres truncados y al gerente

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
            // Solo omitir si NO hay absolutamente nada: ni ventas, ni meta alguna, ni acv, ni novedad.
            // Asesores con meta > 0 y 0 ventas deben aparecer (inicio de mes).
            if (
              ventas_total === 0 &&
              meta_fe === 0 &&
              meta_nube === 0 &&
              meta_total === 0 &&
              meta_acv === 0 &&
              acv === 0 &&
              !tiene_novedad
            ) continue;

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
          lastUpdated: new Date(),
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

    // Realtime subscription: re-run fetchAll on any INSERT/UPDATE in vn_metricas_optimizadas
    // for the current month/year. Applies to all VN/VC channels and countries.
    const mesNroActual = parseInt(periodoSel.slice(4), 10);
    const channel = supabase
      .channel(`gamification-metrics-${profile.id}-${periodoSel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vn_metricas_optimizadas',
          filter: `anio=eq.${anioActual}`,
        },
        (payload: any) => {
          const row = (payload?.new || {}) as any;
          if (Number(row.mes_nro) === mesNroActual && !cancelled) fetchAll();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vn_metricas_optimizadas',
          filter: `anio=eq.${anioActual}`,
        },
        (payload: any) => {
          const row = (payload?.new || {}) as any;
          if (Number(row.mes_nro) === mesNroActual && !cancelled) fetchAll();
        },
      )
      .subscribe();

    // Realtime para ventas_diarias (solo VN) – refresca al instante
    const channelVd = isVN
      ? supabase
          .channel(`vn-ventas-diarias-${profile.id}-${periodoSel}`)
          .on('postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'ventas_diarias' },
              () => { if (!cancelled) fetchAll(); })
          .on('postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'ventas_diarias' },
              () => { if (!cancelled) fetchAll(); })
          .subscribe()
      : null;

    // Auto-refresh cada 5 minutos
    const refreshInterval = setInterval(() => {
      if (!cancelled) fetchAll();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
      if (channelVd) supabase.removeChannel(channelVd);
    };
  }, [profile?.id, profile?.canal, profile?.nombre, profile?.gerente_id, profile?.role, profile?.celula, isVcAdvisor, isVC, isVN, periodoOverride]);

  return { ...state, isVcAdvisor, isVC, isVN };
};
