import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, podiumBounce } from '@/lib/animations';
import { normalizePersonName } from '@/lib/vc-advisor-metrics';
import { buildVnConventionMonthlyRows, normalizeStoredAcv, normalizeVnMetaAcv } from '@/lib/vn-convention';
import { computeSpConvencionAnualForCelula, computeSpConvencionAnualForAsesor, normalizeSpText } from '@/lib/sp-convencion-anual';
import { getNivelData } from '@/lib/niveles';
import { useSpConvencionAnual } from '@/lib/sp-convencion-store';
import { useSpConvencionAnualSelf } from '@/hooks/useSpConvencionAnualSelf';
import { pickVnLeaderCandidate } from '@/lib/vn-leaders';
import colombiaFlag from '@/assets/flags/colombia.svg';
import mexicoFlag from '@/assets/flags/mexico.svg';
import ecuadorFlag from '@/assets/flags/ecuador.svg';
import uruguayFlag from '@/assets/flags/uruguay.svg';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

const FLAG_IMG: Record<string, string> = { COL: colombiaFlag, CO: colombiaFlag, MEX: mexicoFlag, MX: mexicoFlag, ECU: ecuadorFlag, EC: ecuadorFlag, URU: uruguayFlag, URY: uruguayFlag, UY: uruguayFlag };
const CANALES_LABEL: Record<string, string> = { VN_EMPRESARIOS: 'Empresarios', VN_ALIADOS: 'Aliados', VC: 'Venta Cruzada' };
const REFERIDOS_LABEL: Record<string, string> = { VN_ALIADOS: 'Ref. Contador', VN_EMPRESARIOS: 'Referidos' };
const PAIS_LABEL: Record<string, string> = { COL: 'Colombia', MEX: 'México', ECU: 'Ecuador', URU: 'Uruguay', URY: 'Uruguay', ARG: 'Argentina', CHL: 'Chile' };
// Normaliza códigos ISO a los códigos internos usados en las tablas (URY→URU, etc.)
const normalizePaisCode = (p?: string | null): string => {
  const v = String(p || '').trim().toUpperCase();
  if (v === 'URY' || v === 'UY') return 'URU';
  if (v === 'MX') return 'MEX';
  if (v === 'CO') return 'COL';
  if (v === 'EC') return 'ECU';
  return v || 'COL';
};
const PODIUM_EMOJIS = ['🥇', '🥈', '🥉'];
const PODIUM_COLORS = ['border-yellow bg-siigo-yellow/5', 'border-muted-foreground/30', 'border-orange/40'];
type PanelGeneralTab = 'comerciales' | 'gerentes';

const FlagIcon = ({ pais }: { pais?: string | null }) => {
  const src = FLAG_IMG[pais?.trim().toUpperCase() || ''];
  return src ? <img src={src} alt={pais || ''} className="h-4 w-4 rounded-full object-cover" /> : <span className="text-base">🌎</span>;
};

const formatMoney = (val: number | null | undefined) => {
  const n = Number(val) || 0;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

const normalizeComparableText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getCurrentConventionYear = () => new Date().getFullYear();

const PAIS_FULL_NAME: Record<string, string> = { COL: 'COLOMBIA', MEX: 'MEXICO', ECU: 'ECUADOR', URU: 'URUGUAY' };

// Fetch all rows from metas_asesores for a year, paginated (PostgREST caps at 1000 per request)
async function fetchAllMetasAsesores(year: number, paisCode?: string, canal?: string) {
  const paisFull = paisCode ? PAIS_FULL_NAME[paisCode] : undefined;
  const canalDir = canal === 'VN_ALIADOS' ? 'VN_ALIADOS' : canal === 'VN_EMPRESARIOS' ? 'VN_EMPRESARIOS' : undefined;
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  // Safety cap: 20 pages = 20,000 rows
  for (let i = 0; i < 20; i++) {
    let q: any = supabase
      .from('metas_asesores')
      .select('anio_mes, nombre_asesor, documento_asesor, novedad, meta_total, meta_fe, meta_nube, celula, gerente, pais, canal_direccion')
      .gte('anio_mes', `${year}01`)
      .lte('anio_mes', `${year}12`)
      .order('anio_mes', { ascending: true })
      .order('documento_asesor', { ascending: true })
      .range(from, from + pageSize - 1);
    if (paisFull) q = q.eq('pais', paisFull);
    if (canalDir) q = q.eq('canal_direccion', canalDir);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all };
}

async function fetchAllVentasDiarias(year: number, paisCode?: string) {
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  for (let i = 0; i < 80; i++) {
    let q: any = supabase
      .from('ventas_diarias')
      .select('fecha, asesor, tipo_producto, producto, unidades, acv, celula, equipo, director, pais')
      .gte('fecha', `${year}-01-01`)
      .lt('fecha', `${year + 1}-01-01`)
      .range(from, from + pageSize - 1);
    if (paisCode) q = q.eq('pais', paisCode);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all };
}

async function fetchAllVnMetricasAsesores(year: number, paisCode?: string, canal?: string) {
  const canalDir = paisCode === 'MEX'
    ? (canal === 'VN_ALIADOS' ? 'Aliados' : canal === 'VN_EMPRESARIOS' ? 'Empresarios' : undefined)
    : undefined;
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  for (let i = 0; i < 20; i++) {
    let q: any = (supabase.from('vn_metricas_optimizadas' as any) as any)
      .select('periodo, mes_nro, asesor, tipo_producto1, familia, ventas, pais, canal_direccion')
      .eq('scope', 'asesor')
      .eq('anio', year)
      .range(from, from + pageSize - 1);
    if (paisCode) q = q.eq('pais', String(paisCode).toUpperCase());
    if (canalDir) q = q.eq('canal_direccion', canalDir);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all };
}

const sumMonthlyConvention = <T extends { sp?: number | null }>(rows: T[]) =>
  (rows || []).reduce((total, row) => total + (Number(row.sp) || 0), 0);

const aggregateVnGerenteMetricRows = (rows: any[], currentMonth: string) => {
  const currentMonthNumber = Number(currentMonth.slice(-2));
  const byCelula = new Map<string, { celulaNombre: string; gerente: string; fe: number; nube: number; acv: number; feMes: number; nubeMes: number; acvMes: number }>();

  (rows || []).forEach((r: any) => {
    const celulaRaw = String(r.celula ?? '').trim();
    if (!celulaRaw) return;
    const key = normalizeComparableText(celulaRaw);
    const cur = byCelula.get(key) ?? {
      celulaNombre: celulaRaw,
      gerente: r.gerente ?? '',
      fe: 0,
      nube: 0,
      acv: 0,
      feMes: 0,
      nubeMes: 0,
      acvMes: 0,
    };
    if (!cur.gerente && r.gerente) cur.gerente = r.gerente;
    const tipo = String(r.familia ?? r.tipo_producto1 ?? '').toUpperCase().trim();
    const ventas = Math.round(Number(r.ventas) || 0);
    const acv = Math.round(Number(r.acv_total) || 0);
    if (tipo === 'FE') cur.fe += ventas;
    if (tipo === 'CAMPANA' || tipo === 'CAMPAÑA' || tipo === 'NUBE') cur.nube += ventas;
    cur.acv += acv;
    if (Number(r.mes_nro) === currentMonthNumber) {
      if (tipo === 'FE') cur.feMes += ventas;
      if (tipo === 'CAMPANA' || tipo === 'CAMPAÑA' || tipo === 'NUBE') cur.nubeMes += ventas;
      cur.acvMes += acv;
    }
    byCelula.set(key, cur);
  });

  return byCelula;
};

const fetchVcSumVentasForGerentes = async (year: number, gerenteIds: string[]) => {
  if (!gerenteIds.length) return [] as any[];

  // Leemos de la vista `acv_vc_mensual`, que ya agrega ventas por NOMBRE del gerente
  // (no por gerente_id). Esto elimina la fragmentación causada por gerentes duplicados
  // (login + orphan del ETL) y garantiza que el SP mostrado en el ranking coincida con
  // el que ve el propio gerente en Mi Progreso / sidebar.
  const pageSize = 1000;
  let from = 0;
  const rows: any[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('acv_vc_mensual')
      .select('gerente_id, anio, mes, acv_plus_total, meta_total')
      .eq('anio', year)
      .in('gerente_id', gerenteIds)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
};

const Rankings = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [ranking, setRankingState] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState<PanelGeneralTab>('comerciales');
  const tabRef = useRef<PanelGeneralTab>('comerciales');
  useEffect(() => { tabRef.current = tab; }, [tab]);
  const isVC = profile?.canal === 'VC';
  const isVN = profile?.canal === 'VN_ALIADOS' || profile?.canal === 'VN_EMPRESARIOS';
  const isDirector = profile?.role === 'director';
  const directorPaises = (profile?.director_paises || []).filter(Boolean);
  useEffect(() => { if (isDirector && tab !== 'gerentes') setTab('gerentes'); }, [isDirector]);
  const [selectedPais, setSelectedPais] = useState<string>(normalizePaisCode(profile?.pais));
  useEffect(() => { setSelectedPais(normalizePaisCode(profile?.pais)); }, [profile?.pais]);
  const userPais = normalizePaisCode(isDirector && directorPaises.length > 0 ? selectedPais : (profile?.pais || 'COL'));
  const spAnualStore = useSpConvencionAnual();
  const spAnualSelf = useSpConvencionAnualSelf(profile);
  const currentUserAnnualSp = spAnualStore ?? spAnualSelf;

  const fetchRanking = async (requestedTab: PanelGeneralTab = tabRef.current) => {
    // Guarded setter: ignora resultados obsoletos cuando el usuario ya cambió de tab.
    const setRanking = (val: any) => {
      if (tabRef.current !== requestedTab) return;
      setRankingState(val);
    };
    if (!profile?.canal) {
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    try {
      const currentConventionYear = getCurrentConventionYear();

    if (isVC) {
      if (tab === 'comerciales') {
        const [comRes, gerentesRes, asesoresRes, ventasRes] = await Promise.all([
          supabase.from('ranking_vc_comerciales' as any).select('*'),
          supabase.from('gerentes').select('nombre, pais').eq('canal', 'VC'),
          supabase.from('asesores').select('nombre, sp_canje').eq('canal', 'VC'),
          supabase.from('ventas').select('comercial, anio, mes, acv_plus, meta').eq('canal', 'VC').eq('anio', currentConventionYear).like('documento_factura', 'SUM-%').range(0, 5000),
        ]);
        const gerentePaisMap = new Map<string, string>();
        (gerentesRes.data || []).forEach((g: any) => {
          if (g.nombre) gerentePaisMap.set(g.nombre, g.pais || 'COL');
        });
        const monthlyByComercial = new Map<string, Map<string, { acv: number; meta: number }>>();
        (ventasRes.data || []).forEach((row: any) => {
          const comercial = normalizePersonName(row.comercial);
          const monthNumber = ({ Enero: '01', Febrero: '02', Marzo: '03', Abril: '04', Mayo: '05', Junio: '06', Julio: '07', Agosto: '08', Septiembre: '09', Octubre: '10', Noviembre: '11', Diciembre: '12' } as Record<string, string>)[row.mes || ''];
          if (!comercial || !row.anio || !monthNumber) return;

          const period = `${row.anio}${monthNumber}`;
          const monthly = monthlyByComercial.get(comercial) || new Map<string, { acv: number; meta: number }>();
          const current = monthly.get(period) || { acv: 0, meta: 0 };
          current.acv += Number(row.acv_plus) || 0;
          current.meta += Number(row.meta) || 0;
          monthly.set(period, current);
          monthlyByComercial.set(comercial, monthly);
        });
        const spByComercial = new Map<string, number>();
        monthlyByComercial.forEach((months, comercial) => {
          const rows = [...months.values()].map((month) => ({ sp: month.meta > 0 && month.acv > 0 ? Math.round((month.acv / month.meta) * 100) : 0 }));
          spByComercial.set(comercial, sumMonthlyConvention(rows));
        });
        const canjeablesByComercial = new Map<string, number>();
        (asesoresRes.data || []).forEach((a: any) => {
          if (a.nombre) canjeablesByComercial.set(normalizePersonName(a.nombre), Number(a.sp_canje) || 0);
        });
        const currentName = normalizePersonName(profile?.nombre);
        const mapped = (comRes.data || []).map((r: any) => ({
          id: `${r.nombre}-${r.gerente_nombre}`,
          nombre: r.nombre,
          gerente_nombre: r.gerente_nombre,
          kpi_value: Math.round(Number(r.acv_total) || 0),
          meta_total: Math.round(Number(r.meta_total) || 0),
          sp_totales: spByComercial.get(normalizePersonName(r.nombre)) || 0,
          pct_cumplimiento: Number(r.pct_cumplimiento) || 0,
          ventas_count: r.ventas_count,
          posicion: r.posicion,
          canal: 'VC',
          pais: gerentePaisMap.get(r.gerente_nombre) || 'COL',
          sp_canje: canjeablesByComercial.get(normalizePersonName(r.nombre)) || 0,
          nivel: getNivelData(spByComercial.get(normalizePersonName(r.nombre)) || 0, 'VC').nivel,
          isCurrent: profile?.role === 'asesor' && normalizePersonName(r.nombre) === currentName,
        }));
        // Filter by user's country
        setRanking(mapped.filter(r => r.pais === userPais));
      } else {
        // Gerentes VC — SP calculado en tiempo real desde tabla ventas (mismo patrón
        // que comerciales) en vez de sp_acumulados (que es eventos-driven y queda obsoleto).
        const currentConventionYear2 = getCurrentConventionYear();
        const [vcGerentesRes, gerentesRes] = await Promise.all([
          supabase
            .from('ranking_vc_gerentes' as any)
            .select('*')
            .eq('pais', userPais),
          supabase
            .from('gerentes')
            .select('id, sp_canje, nombre, user_id, avatar_url')
            .eq('canal', 'VC')
            .eq('pais', userPais),
        ]);
        // Limitar el query de ventas a los gerente_id del país del usuario para que
        // la respuesta de PostgREST quepa en su tope (1000 filas) y los totales
        // coincidan exactamente con el cálculo del badge (useSupabaseAuth).
        const gerenteIdsPais = (gerentesRes.data || []).map((g: any) => g.id).filter(Boolean);
        const ventasAnualRows = await fetchVcSumVentasForGerentes(currentConventionYear2, gerenteIdsPais);
        const MES_NUM: Record<string, string> = {
          Enero: '01', Febrero: '02', Marzo: '03', Abril: '04',
          Mayo: '05', Junio: '06', Julio: '07', Agosto: '08',
          Septiembre: '09', Octubre: '10', Noviembre: '11', Diciembre: '12',
        };
        const monthlyByGerente = new Map<string, Map<string, { acv: number; meta: number }>>();
        ventasAnualRows.forEach((row: any) => {
          const gId = row.gerente_id;
          const monthNum = MES_NUM[row.mes || ''];
          if (!gId || !row.anio || !monthNum) return;
          const period = `${row.anio}${monthNum}`;
          const monthly = monthlyByGerente.get(gId) || new Map<string, { acv: number; meta: number }>();
          const cur = monthly.get(period) || { acv: 0, meta: 0 };
          cur.acv += Number(row.acv_plus_total) || 0;
          cur.meta += Number(row.meta_total) || 0;
          monthly.set(period, cur);
          monthlyByGerente.set(gId, monthly);
        });
        const spByGerente = new Map<string, number>();
        monthlyByGerente.forEach((months, gId) => {
          const spTotal = [...months.values()].reduce((sum, m) => {
            if (m.meta > 0 && m.acv > 0) sum += Math.round((m.acv / m.meta) * 100);
            return sum;
          }, 0);
          spByGerente.set(gId, spTotal);
        });
        const canjeByName = new Map<string, number>();
        const gerenteExtraByName = new Map<string, { user_id: string | null; avatar_url: string | null }>();
        (gerentesRes.data || []).forEach((g: any) => {
          if (!g.nombre) return;
          const nk = normalizePersonName(g.nombre);
          canjeByName.set(nk, (canjeByName.get(nk) || 0) + (Number(g.sp_canje) || 0));
          const prev = gerenteExtraByName.get(nk);
          if (!prev || (!prev.user_id && g.user_id)) {
            gerenteExtraByName.set(nk, { user_id: g.user_id || null, avatar_url: g.avatar_url || null });
          }
        });
        const mapped = (vcGerentesRes.data || []).map((r: any) => {
          const spVivo = spByGerente.get(r.gerente_id) || 0;
          const extra = gerenteExtraByName.get(normalizePersonName(r.nombre));
          const nivel = getNivelData(spVivo, 'VC').nivel;
          return {
            id: r.gerente_id,
            nombre: r.nombre,
            pais: r.pais,
            canal: 'VC',
            kpi_value: Math.round(Number(r.acv_total) || 0),
            meta_total: Math.round(Number(r.meta_total) || 0),
            pct_cumplimiento: Number(r.pct_cumplimiento) || 0,
            sp_totales: spVivo,
            sp_canje: canjeByName.get(normalizePersonName(r.nombre)) || 0,
            nivel,
            user_id: extra?.user_id || null,
            avatar_url: extra?.avatar_url || null,
            posicion: r.posicion,
          };
        });
        mapped.sort((a, b) => b.sp_totales - a.sp_totales);
        mapped.forEach((r, i) => { r.posicion = i + 1; });
        setRanking(mapped);
      }
    } else if (isVN) {
      // VN channels
      const areaFilter = profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Leads Mercadeo Digital';
      if (tab === 'comerciales') {
        // Build ranking directly from productividad_asesores
        const currentMonth = `${currentConventionYear}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [productividadRes, asesoresRes, metasAsesoresRes, ventasDiariasRes, vnMetricasAsesorRes] = await Promise.all([
          supabase.from('productividad_asesores').select('asesor, anio_mes, ventas, meta, cant_recomendados, ventas_mm_sql, sc_creados, pais, celula, acv_f').eq('area', areaFilter).gte('anio_mes', `${currentConventionYear}01`).lte('anio_mes', `${currentConventionYear}12`).eq('pais', userPais).range(0, 5000),
          supabase.from('asesores').select('id, nombre, sp_canje, sp_convencion, pais').eq('canal', profile.canal).eq('pais', userPais),
          fetchAllMetasAsesores(currentConventionYear, userPais, profile.canal),
          fetchAllVentasDiarias(currentConventionYear, userPais),
          fetchAllVnMetricasAsesores(currentConventionYear, userPais, profile.canal),
        ]);
        const asesorInfoMap = new Map<string, { id?: string; sp_canje: number; sp_convencion: number }>();
        (asesoresRes.data || []).forEach((a: any) => {
          if (a.nombre) {
            asesorInfoMap.set(normalizePersonName(a.nombre), {
              id: a.id,
              sp_canje: Number(a.sp_canje) || 0,
              sp_convencion: Number(a.sp_convencion) || 0,
            });
          }
        });
        // Aggregate by advisor
        const advisorAgg = new Map<string, { ventas: number; meta: number; recomendados: number; unidades: number; acv: number; currentAcv: number; celula: string; months: Map<string, { ventas: number; meta: number; acv: number }> }>();
        (productividadRes.data || []).forEach((row: any) => {
          const name = row.asesor;
          if (!name) return;
          const key = normalizePersonName(name);
          const agg = advisorAgg.get(key) || { ventas: 0, meta: 0, recomendados: 0, unidades: 0, acv: 0, currentAcv: 0, celula: '', months: new Map() };
          agg.celula = row.celula || agg.celula;
          // Monthly aggregation for SP calculation
          const period = String(row.anio_mes || '');
          const cm = agg.months.get(period) || { ventas: 0, meta: 0, acv: 0 };
          cm.ventas += Number(row.ventas) || 0;
          cm.meta += normalizeVnMetaAcv(row.meta);
          cm.acv += normalizeStoredAcv(row.acv_f);
          agg.months.set(period, cm);
          // Current month totals
          if (period === currentMonth) {
            agg.ventas += Number(row.ventas) || 0;
            agg.meta += normalizeVnMetaAcv(row.meta);
            agg.recomendados += Number(row.cant_recomendados) || 0;
            agg.currentAcv += normalizeStoredAcv(row.acv_f);
          }
          // Totals across all months
          agg.unidades += Number(row.ventas) || 0;
          agg.acv += normalizeStoredAcv(row.acv_f);
          advisorAgg.set(key, agg);
          // Keep original name
          if (!agg.celula) agg.celula = row.celula || '';
        });
        // Build ranking entries
        const entries: any[] = [];
        const mesActualNro = new Date().getMonth() + 1;

        // ─── Ventas reales por asesor desde fuente consolidada ───────────────
        // Fuente de verdad para Unidades / %FE / %Nube por asesor: vn_metricas_optimizadas.
        // ventas_diarias queda como respaldo sólo si no existe consolidado para el asesor.
        // Agregamos FE/NUBE del mes actual y del año.
        type VdAgg = { feCurrent: number; nubeCurrent: number; feYear: number; nubeYear: number };
        const metricasByAsesor = new Map<string, VdAgg>();
        (((vnMetricasAsesorRes as any)?.data as any[]) || []).forEach((row: any) => {
          const name = row.asesor;
          if (!name) return;
          const k = normalizePersonName(name);
          const period = String(row.periodo || (row.mes_nro ? `${currentConventionYear}${String(row.mes_nro).padStart(2, '0')}` : ''));
          if (!period.startsWith(String(currentConventionYear))) return;
          const tipo = String(row.familia || row.tipo_producto1 || '').toUpperCase().trim();
          const fam = tipo === 'CAMPANA' || tipo === 'CAMPAÑA' ? 'NUBE'
                    : (tipo === 'FE' || tipo === 'NUBE') ? tipo : 'OTRO';
          if (fam === 'OTRO') return;
          const u = Math.round(Number(row.ventas ?? row.total_productos) || 0);
          const cur = metricasByAsesor.get(k) || { feCurrent: 0, nubeCurrent: 0, feYear: 0, nubeYear: 0 };
          if (fam === 'FE') { cur.feYear += u; if (period === currentMonth) cur.feCurrent += u; }
          else { cur.nubeYear += u; if (period === currentMonth) cur.nubeCurrent += u; }
          metricasByAsesor.set(k, cur);
        });
        const ventasDiariasByAsesor = new Map<string, VdAgg>();
        const currentMonthPrefix = `${currentConventionYear}-${String(mesActualNro).padStart(2, '0')}`;
        ((ventasDiariasRes as any)?.data as any[] || []).forEach((row: any) => {
          const name = row.asesor;
          if (!name) return;
          const k = normalizePersonName(name);
          const fecha = String(row.fecha || '');
          if (!fecha.startsWith(String(currentConventionYear))) return;
          const tipo = String(row.tipo_producto || '').toUpperCase().trim();
          const fam = tipo === 'CAMPANA' || tipo === 'CAMPAÑA' ? 'NUBE'
                    : (tipo === 'FE' || tipo === 'NUBE') ? tipo : 'OTRO';
          if (fam === 'OTRO') return; // CONTADOR u otros no cuentan a unidades VN
          const u = Math.round(Number(row.unidades) || 0);
          const cur = ventasDiariasByAsesor.get(k) || { feCurrent: 0, nubeCurrent: 0, feYear: 0, nubeYear: 0 };
          if (fam === 'FE') { cur.feYear += u; if (fecha.startsWith(currentMonthPrefix)) cur.feCurrent += u; }
          else { cur.nubeYear += u; if (fecha.startsWith(currentMonthPrefix)) cur.nubeCurrent += u; }
          ventasDiariasByAsesor.set(k, cur);
        });

        const spAsesorInputs = {
          metaAsesorRows: metasAsesoresRes.data || [],
          ventasDiariasRows: ((ventasDiariasRes as any)?.data as any[]) || [],
          ejecAsesorRows: [],
          productividadRows: productividadRes.data || [],
          vnMetricasRows: ((vnMetricasAsesorRes as any)?.data as any[]) || [],
          year: String(currentConventionYear),
        };
        advisorAgg.forEach((agg, key) => {
          const asesorInfo = asesorInfoMap.get(key);
          const currentAcv = agg.currentAcv;
          const currentMetaAcv = agg.meta;
          const pct = currentMetaAcv > 0 && currentAcv > 0 ? Math.round((currentAcv / currentMetaAcv) * 100) : 0;
          // SP Convención = suma ANUAL de SP por mes del ASESOR individual (fórmula única).
          const originalName = (productividadRes.data || []).find((r: any) => normalizePersonName(r.asesor) === key)?.asesor || key;
          const spFinal = computeSpConvencionAnualForAsesor(spAsesorInputs, originalName);

          const vdAgg = metricasByAsesor.get(key) || ventasDiariasByAsesor.get(key);
          const currentFe = vdAgg?.feCurrent || 0;
          const currentNube = vdAgg?.nubeCurrent || 0;
          const unidadesMesActual = currentFe + currentNube;
          const unidadesAnoTotal = (vdAgg?.feYear || 0) + (vdAgg?.nubeYear || 0);

          // Metas FE/Nube del mes actual desde metas_asesores (excluir novedades)
          const metasMesActual = (metasAsesoresRes.data || []).filter((r: any) => normalizePersonName(r.nombre_asesor) === key && String(r.anio_mes) === currentMonth);
          const currentMetaFe = metasMesActual.reduce((s: number, r: any) => s + (Number(r.meta_fe) || 0), 0);
          const currentMetaNube = metasMesActual.reduce((s: number, r: any) => s + (Number(r.meta_nube) || 0), 0);
          const capPctAsesor = (v: number) => Math.min(300, Math.max(0, Math.round(v)));
          const pctFeMes = currentMetaFe > 0 ? capPctAsesor((currentFe / currentMetaFe) * 100) : 0;
          const pctNubeMes = currentMetaNube > 0 ? capPctAsesor((currentNube / currentMetaNube) * 100) : 0;

          // Meta unidades del mes actual: tomar únicamente meta_total del periodo.
          const metaTotalMesActual = (metasAsesoresRes.data || [])
            .filter((r: any) => normalizePersonName(r.nombre_asesor) === key && String(r.anio_mes) === currentMonth)
            .reduce((s: number, r: any) => s + (Number(r.meta_total) || 0), 0);
          const metaUnidadesFinal = metaTotalMesActual || 0;
          const prodCurrent = (productividadRes.data || []).find((r: any) => normalizePersonName(r.asesor) === key && String(r.anio_mes) === currentMonth);
          const calcCanje = (() => {
            const recomendados = Number(prodCurrent?.cant_recomendados) || 0;
            const ventasSql = Number((prodCurrent as any)?.ventas_mm_sql) || 0;
            const scCreados = Number((prodCurrent as any)?.sc_creados) || 0;
            let total = ventasSql * 50;
            if (recomendados >= 20) total += 500;
            else if (recomendados >= 10) total += 300;
            else if (recomendados >= 5) total += 150;
            if (scCreados >= 10) total += 250;
            else if (scCreados >= 5) total += 100;
            return total;
          })();

          // SP CONVENCIÓN — SIEMPRE por asesor individual. NO sustituir por la fórmula
          // de célula aunque el asesor aparezca también en `gerentes` (todos los VN
          // tienen un registro espejo en gerentes con la misma celula, lo que hacía
          // que TODOS los asesores de una célula reportaran el mismo SP).
          const spForRanking = spFinal;
          entries.push({
            id: asesorInfo?.id || key,
            nombre: originalName,
            gerente_nombre: agg.celula,
            kpi_value: Math.round(currentAcv || agg.acv),
            meta_acv: currentMetaAcv,
            meta_unidades: metaUnidadesFinal,
            unidades_logradas: unidadesMesActual,
            unidades_total: unidadesAnoTotal,
            cant_recomendados: agg.recomendados,
            pct_cumplimiento: pct,
            pct_fe: pctFeMes,
            pct_nube: pctNubeMes,
            ventas_count: agg.ventas,
            posicion: 0,
            canal: profile.canal,
            pais: userPais,
            sp_totales: spForRanking,
            sp_canje: 0,
            nivel: getNivelData(spForRanking, profile.canal).nivel,
          });
        });

        setRanking(entries);
      } else {
        // Gerentes tab for VN: aggregate productividad_asesores by celula (team)
        const areaFilter = profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Leads Mercadeo Digital';
        const vnCanalDireccion = profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Empresarios';
        const metasGerentesCanal = profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'SMBS';
        const currentMonth = `${currentConventionYear}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [productividadRes, gerentesRes, rolesRes, metasAsesoresRes, ejecAsesoresGerenteRes, vgmGerRes, metasAcvGerRes, vnMetricasMexGerRes, ventasDiariasGerRes, metasGerentesMexRes, spConvencionLeadersRes] = await Promise.all([
          supabase.from('productividad_asesores').select('asesor, celula, anio_mes, ventas, meta, cant_recomendados, acv_f, pais').eq('area', areaFilter).gte('anio_mes', `${currentConventionYear}01`).lte('anio_mes', `${currentConventionYear}12`).eq('pais', userPais).order('anio_mes', { ascending: true }).order('celula', { ascending: true }).order('asesor', { ascending: true }).range(0, 5000),
          supabase.from('gerentes').select('id, nombre, email, celula, sp_canje, sp_convencion, user_id').eq('canal', profile.canal).eq('pais', userPais).eq('activo', true),
          supabase.from('user_roles').select('user_id, role'),
          fetchAllMetasAsesores(currentConventionYear, userPais, profile.canal),
          supabase.from('ejecucion_asesores').select('periodo, documento_asesor, ventas_fe, ventas_nube, ventas_total, canal_direccion').gte('periodo', `${currentConventionYear}01`).lte('periodo', `${currentConventionYear}12`).limit(20000),
          supabase.from('ventas_gerente_mensual').select('periodo, familia, unidades, acv, celula, gerente, gerente_normalizado').gte('periodo', `${currentConventionYear}01`).lte('periodo', `${currentConventionYear}12`).eq('pais', userPais).limit(10000),
          supabase.from('metas_acv_gerentes').select('celula, mes, meta_fe, meta_nube, meta_total_acv, meta_total_und, archivo').eq('pais', userPais).eq('canal', profile.canal).limit(2000),
          (() => {
            let q = (supabase.from('vn_metricas_optimizadas' as any) as any)
              .select('mes_nro, tipo_producto1, familia, ventas, acv_total, celula, gerente_normalizado, gerente, pais, asesor')
              .eq('scope', 'gerente')
              .gte('mes_nro', 1)
              .lte('mes_nro', 12)
              .limit(5000);
            if (userPais) q = q.eq('pais', String(userPais).toUpperCase());
            return q;
          })(),
          supabase.from('ventas_diarias').select('fecha, tipo_producto, producto, unidades, acv, celula, equipo, director, pais').gte('fecha', `${currentConventionYear}-01-01`).lt('fecha', `${currentConventionYear + 1}-01-01`).eq('pais', userPais).order('fecha', { ascending: true }).range(0, 49999),
          userPais === 'MEX'
            ? supabase.from('metas_gerentes').select('celula, anio_mes, coi, noi').eq('pais_gestion', 'MEX').eq('canal_direccion', metasGerentesCanal).gte('anio_mes', `${currentConventionYear}01`).lte('anio_mes', `${currentConventionYear}12`).limit(5000)
            : Promise.resolve({ data: [] as any[] }),
          // Set de gerente_id que efectivamente recibieron SP de convención al menos
          // una vez en el año (identifica líderes reales y excluye asesores mal
          // clasificados en la tabla `gerentes`, que solo reciben SP de canje).
          supabase.from('sp_acumulados').select('gerente_id').eq('tipo_sp', 'convencion').gte('periodo', `${currentConventionYear}01`).lte('periodo', `${currentConventionYear}12`).limit(50000),
        ]);

        // Build set of asesor names WITH novedad
        const asesoresConNovedadTeam = new Set<string>();
        (metasAsesoresRes.data || []).forEach((r: any) => {
          const nov = r.novedad ? String(r.novedad).trim().toLowerCase() : '';
          if (nov && nov !== 'sin novedad' && r.nombre_asesor) {
            asesoresConNovedadTeam.add(String(r.nombre_asesor).trim().toLowerCase());
          }
        });
        // Meta ACV oficial por celula+mes desde metas_acv_gerentes.meta_total_acv
        // (Cierre prioritario sobre Inicio). Se guarda como entero por mes.
        const MES3_TO_NUM: Record<string, string> = {
          ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',
          jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12',
        };
        const metaAcvByCelulaTeam = new Map<string, Map<string, number>>();
        const metaAcvArchivoByCelula = new Map<string, Map<string, string>>();
        (metasAcvGerRes.data || []).forEach((row: any) => {
          const celula = normalizeComparableText(row.celula);
          const mes3 = String(row.mes ?? '').trim().toLowerCase().slice(0, 3);
          const mm = MES3_TO_NUM[mes3];
          if (!celula || !mm) return;
          const period = `${currentConventionYear}${mm}`;
          const archivo = String(row.archivo ?? '').toLowerCase();
          const periodMap = metaAcvByCelulaTeam.get(celula) || new Map<string, number>();
          const archivoMap = metaAcvArchivoByCelula.get(celula) || new Map<string, string>();
          // Si ya hay Cierre registrado, no sobreescribir con Inicio.
          const prevArchivo = archivoMap.get(period) || '';
          if (prevArchivo.includes('cierre') && !archivo.includes('cierre')) return;
          periodMap.set(period, Math.round(Number(row.meta_total_acv) || 0));
          archivoMap.set(period, archivo);
          metaAcvByCelulaTeam.set(celula, periodMap);
          metaAcvArchivoByCelula.set(celula, archivoMap);
        });

        const asesorNames = new Set<string>();
        (productividadRes.data || []).forEach((row: any) => {
          if (row.asesor) asesorNames.add(normalizePersonName(row.asesor));
        });

        const roleByUserId = new Map<string, string>();
        (rolesRes.data || []).forEach((row: any) => {
          if (row.user_id && row.role) roleByUserId.set(row.user_id, row.role);
        });

        // Nombre del gerente por célula — fuente: metas_asesores.gerente (Databricks RRHH)
        // Preferimos el nombre más largo (más completo) cuando hay variantes.
        const gerenteNombreByCelula = new Map<string, string>();
        (metasAsesoresRes.data || []).forEach((row: any) => {
          const celulaKey = normalizeComparableText(row.celula);
          const gerenteName = row.gerente ? String(row.gerente).trim() : '';
          if (!celulaKey || !gerenteName || gerenteName === '0') return;
          const existing = gerenteNombreByCelula.get(celulaKey);
          if (!existing || gerenteName.length > existing.length) {
            gerenteNombreByCelula.set(celulaKey, gerenteName);
          }
        });

        // Líderes reales VN: solo gerentes que han recibido SP de tipo 'convencion'
        // al menos una vez en el año. Los asesores mal clasificados en `gerentes`
        // nunca reciben convención (solo canje por retos), así que se excluyen del
        // ranking automáticamente. Aplica para COL/ECU/URU/MEX.
        const conventionLeaderIds = new Set<string>();
        ((spConvencionLeadersRes as any)?.data || []).forEach((r: any) => {
          if (r?.gerente_id) conventionLeaderIds.add(String(r.gerente_id));
        });

        // Mapa nombre→sp_convencion cubriendo AMBOS canales VN del país, para
        // resolver el SP almacenado incluso cuando la célula viene del canal
        // opuesto (caso MEX: VN_EMPRESARIOS visible desde VN_ALIADOS y viceversa).
        const { data: vnSpConvRows } = await supabase
          .from('gerentes')
          .select('nombre, sp_convencion')
          .in('canal', ['VN_ALIADOS', 'VN_EMPRESARIOS'])
          .eq('pais', userPais)
          .gt('sp_convencion', 0);
        const spConvByName = new Map<string, number>();
        (vnSpConvRows || []).forEach((g: any) => {
          if (!g.nombre) return;
          const k = normalizePersonName(g.nombre);
          const val = Number(g.sp_convencion) || 0;
          if (val > (spConvByName.get(k) || 0)) spConvByName.set(k, val);
        });

        const gerentesByCelula = new Map<string, { id?: string; nombre: string; sp_canje: number; sp_convencion: number }>();
        const gerentesByCell = new Map<string, Array<{ id?: string; nombre: string; email?: string | null; celula?: string | null; sp_canje: number; sp_convencion: number; user_id?: string | null }>>();
        (gerentesRes.data || []).forEach((g: any) => {
          const celulaKey = normalizeComparableText(g.celula);
          if (!celulaKey) return;
          // Excluir a quienes nunca han recibido SP de convención (no son líderes reales).
          if (!conventionLeaderIds.has(String(g.id))) return;
          const list = gerentesByCell.get(celulaKey) || [];
          list.push({ id: g.id, nombre: g.nombre, email: g.email, celula: g.celula, sp_canje: Number(g.sp_canje) || 0, sp_convencion: Number(g.sp_convencion) || 0, user_id: g.user_id });
          gerentesByCell.set(celulaKey, list);
        });


        // Unión de células: las que tienen miembros en `gerentes` Y las que tienen nombre desde Databricks.
        const allCelulas = new Set<string>([...gerentesByCell.keys(), ...gerenteNombreByCelula.keys()]);
        allCelulas.forEach((celulaKey) => {
          const members = gerentesByCell.get(celulaKey) || [];
          const advisorNameSet = new Set([...asesorNames]);

          // 1. Prioridad: nombre del gerente desde Databricks (metas_asesores.gerente)
          const nombreDatabricks = gerenteNombreByCelula.get(celulaKey);
          if (nombreDatabricks) {
            const matchDB = pickVnLeaderCandidate(members, { celula: members[0]?.celula || celulaKey, gerenteNombre: nombreDatabricks, advisorNames: advisorNameSet });
            if (matchDB) {
              gerentesByCelula.set(celulaKey, matchDB);
              return;
            }
            // No tiene cuenta en Arena: entrada mínima con el nombre real
            gerentesByCelula.set(celulaKey, { nombre: nombreDatabricks, sp_canje: 0, sp_convencion: 0 });
            return;
          }

          // 1b. Match líder por token de célula + señales anti-asesor.
          const byCelulaFirstName = pickVnLeaderCandidate(members, { celula: members[0]?.celula || celulaKey, advisorNames: advisorNameSet });
          if (byCelulaFirstName) {
            gerentesByCelula.set(celulaKey, byCelulaFirstName);
            return;
          }

          // 2. Fallback: miembro con role='gerente' o 'admin' en user_roles
          const roleMatch = members.find((m) => {
            if (!m.user_id) return false;
            const role = roleByUserId.get(m.user_id);
            return role === 'gerente' || role === 'admin';
          });
          if (roleMatch) {
            gerentesByCelula.set(celulaKey, roleMatch);
            return;
          }

          // 3. Último fallback: primer miembro que NO sea asesor conocido
          const nonAsesor = members.find((m) => !asesorNames.has(normalizePersonName(m.nombre)));
          if (nonAsesor) {
            gerentesByCelula.set(celulaKey, nonAsesor);
          }
        });


        const vnGerenteMetricByCelula = aggregateVnGerenteMetricRows(((vnMetricasMexGerRes as any)?.data as any[]) || [], currentMonth);

        // Aggregate by celula + month
        const celulaAgg = new Map<string, { celulaNombre: string; months: Map<string, { ventas: number; meta: number; acv: number }>; recomendados: number; unidades: number; acv: number; currentVentas: number; currentMeta: number; currentRecomendados: number; currentAcv: number }>();
        (productividadRes.data || []).forEach((row: any) => {
          const celula = normalizeComparableText(row.celula);
          if (!celula) return;
          const agg = celulaAgg.get(celula) || { celulaNombre: row.celula || '', months: new Map(), recomendados: 0, unidades: 0, acv: 0, currentVentas: 0, currentMeta: 0, currentRecomendados: 0, currentAcv: 0 };
          if (!agg.celulaNombre && row.celula) agg.celulaNombre = row.celula;
          const period = String(row.anio_mes || '');
          const cm = agg.months.get(period) || { ventas: 0, meta: 0, acv: 0 };
          cm.ventas += Number(row.ventas) || 0;
          cm.meta += normalizeVnMetaAcv(row.meta, row.pais);
          cm.acv += normalizeStoredAcv(row.acv_f);
          agg.months.set(period, cm);
          agg.unidades += Number(row.ventas) || 0;
          agg.acv += normalizeStoredAcv(row.acv_f);
          if (period === currentMonth) {
            agg.currentVentas += Number(row.ventas) || 0;
            agg.currentMeta += normalizeVnMetaAcv(row.meta, row.pais);
            agg.currentRecomendados += Number(row.cant_recomendados) || 0;
            agg.currentAcv += normalizeStoredAcv(row.acv_f);
          }
          celulaAgg.set(celula, agg);
        });
        // Set de células válidas para el canal del usuario:
        // FUENTE ÚNICA = metas_acv_gerentes (ya filtrada por pais+canal).
        // productividad_asesores mezcla células de otros segmentos (B&M, Base
        // Instalada Mexico, Venta Cruzada, etc.) bajo el mismo `area`, así
        // que NO sirve como filtro de canal. metas_asesores tampoco trae el
        // canal real por célula. Solo metas_acv_gerentes garantiza que la
        // célula pertenezca al canal/pais del usuario.
        const allowedCelulas = new Set<string>();
        (metasAcvGerRes.data || []).forEach((row: any) => {
          const k = normalizeComparableText(row.celula);
          if (k) allowedCelulas.add(k);
        });
        // Purgar de celulaAgg las células que NO pertenecen al canal real
        // (entraron por productividad_asesores con `area` compartida).
        Array.from(celulaAgg.keys()).forEach((celula) => {
          if (!allowedCelulas.has(celula)) celulaAgg.delete(celula);
        });
        vnGerenteMetricByCelula.forEach((metricAgg, celula) => {
          if (celulaAgg.has(celula)) return;
          if (!allowedCelulas.has(celula)) return;
          celulaAgg.set(celula, {
            celulaNombre: metricAgg.celulaNombre,
            months: new Map(),
            recomendados: 0,
            unidades: metricAgg.fe + metricAgg.nube,
            acv: metricAgg.acv,
            currentVentas: metricAgg.feMes + metricAgg.nubeMes,
            currentMeta: 0,
            currentRecomendados: 0,
            currentAcv: metricAgg.acvMes,
          });
        });
        // MEX: enriquecer meta_nube de metas_acv_gerentes con coi+noi de metas_gerentes
        // (replica el fallback de useSpConvencionAnualSelf para que el SP del header
        // y el de Clasificación coincidan).
        const metasAcvGerEnriched = [...(metasAcvGerRes.data || [])] as any[];
        if (userPais === 'MEX') {
          const mexRows = (((metasGerentesMexRes as any)?.data as any[]) || [])
            .slice()
            .sort((a, b) => String(b.anio_mes || '').localeCompare(String(a.anio_mes || '')));
          if (mexRows.length > 0) {
            const mes3to2: Record<string, string> = { ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12' };
            // Index by celula+anio_mes
            const byCelulaPeriod = new Map<string, any>();
            const latestByCelula = new Map<string, any>();
            mexRows.forEach((r) => {
              const ck = normalizeSpText(r.celula);
              byCelulaPeriod.set(`${ck}|${r.anio_mes}`, r);
              if (!latestByCelula.has(ck)) latestByCelula.set(ck, r);
            });
            metasAcvGerEnriched.forEach((row) => {
              const ck = normalizeSpText(row.celula);
              const mm = mes3to2[String(row.mes || '').trim().toLowerCase().slice(0, 3)] || '';
              const mg = byCelulaPeriod.get(`${ck}|${currentConventionYear}${mm}`) || latestByCelula.get(ck);
              const nube = (Number(mg?.coi) || 0) + (Number(mg?.noi) || 0);
              if ((Number(row.meta_nube) || 0) === 0 && nube > 0) row.meta_nube = nube;
            });
          }
        }
        const spInputsGer = {
          vgmRows: vgmGerRes.data || [],
          metaAsesorRows: metasAsesoresRes.data || [],
          metaAcvRows: metasAcvGerEnriched,
          year: String(currentConventionYear),
          vnMetricasGerenteRows: ((vnMetricasMexGerRes as any)?.data as any[]) || [],
          ventasDiariasRows: ((ventasDiariasGerRes as any)?.data as any[]) || [],
        };
        const entries: any[] = [];
        celulaAgg.forEach((agg, celula) => {
          const monthlyRows = buildVnConventionMonthlyRows({
            productivityRows: (productividadRes.data || []).filter((row: any) => normalizeComparableText(row.celula) === celula),
            metaRows: (metasAsesoresRes.data || []).filter((row: any) => normalizeComparableText(row.celula) === celula),
            ejecRows: ejecAsesoresGerenteRes.data || [],
          });
          const currentMonthly = monthlyRows.find((row) => row.period === currentMonth);
          const celulaMetaMap = metaAcvByCelulaTeam.get(celula);
          const currentMetaAcv = celulaMetaMap?.get(currentMonth) || 0;
          const metricCurrent = vnGerenteMetricByCelula.get(celula);
          const currentAcvValue = metricCurrent ? metricCurrent.acvMes : agg.currentAcv;
          const currentVentasValue = metricCurrent ? metricCurrent.feMes + metricCurrent.nubeMes : agg.currentVentas;
          const totalAcvValue = metricCurrent ? metricCurrent.acv : agg.acv;
          const totalVentasValue = metricCurrent ? metricCurrent.fe + metricCurrent.nube : agg.unidades;
          const pct = currentMetaAcv > 0 && currentAcvValue > 0 ? Math.round((currentAcvValue / currentMetaAcv) * 100) : (currentMonthly?.pctAcv ?? 0);
          const gerenteInfo = gerentesByCelula.get(celula);
          const gerenteDisplayName = gerenteInfo?.nombre || metricCurrent?.gerente || agg.celulaNombre || celula;

          // Ventas FE/Nube del mes actual desde vn_metricas_optimizadas; fallback ventas_gerente_mensual.
          const vgmMesActual = (vgmGerRes.data || []).filter((r: any) =>
            normalizeComparableText(r.celula) === celula &&
            String(r.periodo) === currentMonth
          );
          let currentFe = metricCurrent?.feMes || 0;
          let currentNube = metricCurrent?.nubeMes || 0;
          vgmMesActual.forEach((r: any) => {
            if (metricCurrent) return;
            const fam = String(r.familia ?? '').toUpperCase();
            if (fam === 'FE') currentFe += Math.round(Number(r.unidades) || 0);
            if (fam === 'NUBE') currentNube += Math.round(Number(r.unidades) || 0);
          });
          // Metas FE/Nube del mes actual desde metas_acv_gerentes (Cierre prioritario sobre Inicio)
          const MES_MAP: Record<string, string> = {
            ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',
            jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12'
          };
          const metasAcvMesActual =
            (metasAcvGerEnriched || []).find((r: any) => {
              if (normalizeComparableText(r.celula) !== celula) return false;
              const mes3 = String(r.mes ?? '').trim().toLowerCase().slice(0, 3);
              const mm = MES_MAP[mes3];
              return mm && currentMonth.endsWith(mm) &&
                !String(r.archivo ?? '').toLowerCase().includes('inicio');
            }) ||
            (metasAcvGerEnriched || []).find((r: any) => {
              if (normalizeComparableText(r.celula) !== celula) return false;
              const mes3 = String(r.mes ?? '').trim().toLowerCase().slice(0, 3);
              const mm = MES_MAP[mes3];
              return mm && currentMonth.endsWith(mm);
            });
          // Verdad por célula: suma de metas_asesores activos (excluye novedades).
          // Si esa suma es 0, caemos al catálogo metas_acv_gerentes.
          const currentMetaFe = (currentMonthly?.metaFe || 0) || Number(metasAcvMesActual?.meta_fe) || 0;
          const currentMetaNube = (currentMonthly?.metaNube || 0) || Number(metasAcvMesActual?.meta_nube) || 0;
          const currentMetaUnd = (currentMonthly?.metaTotal || 0) || Number(metasAcvMesActual?.meta_total_und) || 0;
          const capPct = (v: number) => Math.min(300, Math.max(0, Math.round(v)));
          const pctFeMes = currentMetaFe > 0 ? capPct((currentFe / currentMetaFe) * 100) : 0;
          const pctNubeMes = currentMetaNube > 0 ? capPct((currentNube / currentMetaNube) * 100) : 0;
          // Clasificación: SIEMPRE usar el cálculo determinístico por célula para que el
          // ranking sea idéntico para todos los usuarios (no depende de quién inicia sesión).
          const spLive = computeSpConvencionAnualForCelula(spInputsGer, agg.celulaNombre || celula, gerenteDisplayName);
          const spStored = spConvByName.get(normalizePersonName(gerenteDisplayName)) || Number((gerenteInfo as any)?.sp_convencion) || 0;
          const spFinal = spStored > 0 ? spStored : spLive;
          entries.push({
            id: celula,
            nombre: gerenteDisplayName,
            celula_nombre: agg.celulaNombre || celula,
            canal: profile.canal,
            pais: userPais,
            kpi_value: Math.round(currentAcvValue),
            acv_total_year: Math.round(totalAcvValue),
            meta_total: currentMetaAcv,
            meta_acv: currentMetaAcv,
            meta_unidades: currentMetaUnd,
            unidades_logradas: currentVentasValue,
            unidades_total: totalVentasValue,
            cant_recomendados: agg.currentRecomendados,
            pct_cumplimiento: pct,
            pct_fe: pctFeMes,
            pct_nube: pctNubeMes,
            unidades_fe_mes: currentFe,
            unidades_nube_mes: currentNube,
            meta_fe_mes: currentMetaFe,
            meta_nube_mes: currentMetaNube,
            sp_totales: spFinal,
            sp_canje: gerenteInfo?.sp_canje || 0,
            nivel: null,
            posicion: 0,
          });
        });

        // México: agregar células presentes en vn_metricas_optimizadas pero ausentes en productividad_asesores
        if (userPais === 'MEX') {
          const vnMex = ((vnMetricasMexGerRes?.data as any[]) || []);
          const mesActualNro = new Date().getMonth() + 1;
          const mexCelulaMap = new Map<string, { celulaNombre: string; gerente: string; fe: number; nube: number; acv: number; feMes: number; nubeMes: number; acvMes: number }>();
          vnMex.forEach((r: any) => {
            const celulaRaw = String(r.celula ?? '').trim();
            if (!celulaRaw) return;
            const key = normalizeComparableText(celulaRaw);
            const cur = mexCelulaMap.get(key) ?? {
              celulaNombre: celulaRaw, gerente: r.gerente ?? '',
              fe: 0, nube: 0, acv: 0, feMes: 0, nubeMes: 0, acvMes: 0,
            };
            if (!cur.gerente && r.gerente) cur.gerente = r.gerente;
            const tipo = String(r.tipo_producto1 ?? '').toUpperCase().trim();
            const v = Number(r.ventas) || 0;
            const acv = Number(r.acv_total) || 0;
            if (tipo === 'FE') cur.fe += v;
            if (tipo === 'CAMPANA' || tipo === 'CAMPAÑA' || tipo === 'NUBE') cur.nube += v;
            cur.acv += acv;
            if (Number(r.mes_nro) === mesActualNro) {
              if (tipo === 'FE') cur.feMes += v;
              if (tipo === 'CAMPANA' || tipo === 'CAMPAÑA' || tipo === 'NUBE') cur.nubeMes += v;
              cur.acvMes += acv;
            }
            mexCelulaMap.set(key, cur);
          });

          const existingCelulaKeys = new Set(entries.map((e: any) => String(e.id)));
          mexCelulaMap.forEach((agg, celulaKey) => {
            if (existingCelulaKeys.has(celulaKey)) return;
            const gerenteInfo = gerentesByCelula.get(celulaKey);
            const gerenteDisplayName = gerenteInfo?.nombre || agg.gerente || agg.celulaNombre;
            // Clasificación única para todos los usuarios: cálculo determinístico por célula.
            const spLive = computeSpConvencionAnualForCelula(spInputsGer, agg.celulaNombre, gerenteDisplayName);
            const spStored = spConvByName.get(normalizePersonName(gerenteDisplayName)) || Number((gerenteInfo as any)?.sp_convencion) || 0;
            const spFinal = spStored > 0 ? spStored : spLive;
            // Metas desde metas_asesores (verdad por asesor) con fallback a catálogo metas_acv_gerentes
            const monthlyRowsMex = buildVnConventionMonthlyRows({
              productivityRows: [],
              metaRows: (metasAsesoresRes.data || []).filter((row: any) => normalizeComparableText(row.celula) === celulaKey),
              ejecRows: [],
            });
            const cmMex = monthlyRowsMex.find((row) => row.period === currentMonth);
            const acvCatMex = (metasAcvGerEnriched || []).find((r: any) => {
              if (normalizeComparableText(r.celula) !== celulaKey) return false;
              const mes3 = String(r.mes ?? '').trim().toLowerCase().slice(0, 3);
              const MMAP: Record<string, string> = { ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12' };
              const mm = MMAP[mes3];
              return mm && currentMonth.endsWith(mm) && !String(r.archivo ?? '').toLowerCase().includes('inicio');
            }) || (metasAcvGerEnriched || []).find((r: any) => {
              if (normalizeComparableText(r.celula) !== celulaKey) return false;
              const mes3 = String(r.mes ?? '').trim().toLowerCase().slice(0, 3);
              const MMAP: Record<string, string> = { ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12' };
              const mm = MMAP[mes3];
              return mm && currentMonth.endsWith(mm);
            });
            const mxMetaUnd = (cmMex?.metaTotal || 0) || Number(acvCatMex?.meta_total_und) || 0;
            const mxMetaFe = (cmMex?.metaFe || 0) || Number(acvCatMex?.meta_fe) || 0;
            const mxMetaNube = (cmMex?.metaNube || 0) || Number(acvCatMex?.meta_nube) || 0;
            const mxMetaAcv = Number(acvCatMex?.meta_total_acv) || 0;
            const capPct = (v: number) => Math.min(300, Math.max(0, Math.round(v)));
            const pctAcvMx = mxMetaAcv > 0 && agg.acvMes > 0 ? capPct((agg.acvMes / mxMetaAcv) * 100) : 0;
            const pctFeMx = mxMetaFe > 0 && agg.feMes > 0 ? capPct((agg.feMes / mxMetaFe) * 100) : 0;
            const pctNubeMx = mxMetaNube > 0 && agg.nubeMes > 0 ? capPct((agg.nubeMes / mxMetaNube) * 100) : 0;
            entries.push({
              id: celulaKey,
              nombre: gerenteDisplayName,
              celula_nombre: agg.celulaNombre,
              canal: profile.canal,
              pais: 'MEX',
              kpi_value: Math.round(agg.acvMes),
              acv_total_year: Math.round(agg.acv),
              meta_total: mxMetaAcv,
              meta_acv: mxMetaAcv,
              meta_unidades: mxMetaUnd,
              unidades_logradas: agg.feMes + agg.nubeMes,
              unidades_total: agg.fe + agg.nube,
              cant_recomendados: 0,
              pct_cumplimiento: pctAcvMx,
              pct_fe: pctFeMx,
              pct_nube: pctNubeMx,
              unidades_fe_mes: agg.feMes,
              unidades_nube_mes: agg.nubeMes,
              meta_fe_mes: mxMetaFe,
              meta_nube_mes: mxMetaNube,
              sp_totales: spFinal,
              sp_canje: gerenteInfo?.sp_canje || 0,
              nivel: null,
              posicion: 0,
            });
          });
        }

        // Ocultar gerentes sin actividad alguna (antiguos/inactivos):
        // sin SP convención, sin ventas, sin meta y sin ACV.
        // NOTA: sp_canje no se exige; un gerente nuevo con ventas pero aún
        // sin canjeables debe aparecer en el ranking (caso Cristhian/Vicky).
        const activeEntries = entries.filter((e: any) =>
          (Number(e.sp_totales) || 0) > 0 ||
          (Number(e.unidades_total) || 0) > 0 ||
          (Number(e.acv_total_year) || 0) > 0 ||
          (Number(e.meta_acv) || 0) > 0
        );
        setRanking(activeEntries);
      }
    } else {
      const [rankRes, kpiRes, gerentesRes] = await Promise.all([
        supabase.from('ranking_general').select('*').eq('canal', profile.canal).eq('pais', userPais),
        supabase.from('kpis_mes_actual').select('gerente_id, acv_f, sc_creados').eq('canal', profile.canal),
        supabase.from('gerentes').select('id, sp_canje').eq('canal', profile.canal).eq('pais', userPais),
      ]);
      const kpiMap = new Map<string, { acv: number; units: number }>();
      (kpiRes.data || []).forEach((k: any) => {
        if (k.gerente_id) kpiMap.set(k.gerente_id, { acv: Number(k.acv_f) || 0, units: Number(k.sc_creados) || 0 });
      });
      const canjeablesMap = new Map<string, number>();
      (gerentesRes.data || []).forEach((g: any) => {
        if (g.id) canjeablesMap.set(g.id, Number(g.sp_canje) || 0);
      });
      setRanking((rankRes.data || []).map((r: any) => ({
        ...r,
        kpi_value: kpiMap.get(r.id)?.acv || 0,
        units: kpiMap.get(r.id)?.units || 0,
        sp_canje: canjeablesMap.get(r.id) || 0,
      })));
    }
    } catch (error) {
      console.error('[Rankings] Error cargando clasificación', error);
      setRanking([]);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !profile?.canal) return;
    const currentTab = tab;
    fetchRanking(currentTab);
    // Debounce para evitar ráfagas de refetch cuando Databricks inserta lotes grandes.
    let refetchTimer: any = null;
    const triggerRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      // Pasamos tabRef.current para que el resultado se valide contra el tab vigente.
      refetchTimer = setTimeout(() => fetchRanking(tabRef.current), 1500);
    };
    const channel = supabase
      .channel(`ranking-live-${profile?.canal}-${userPais}-${currentTab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sp_acumulados' }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gerentes' }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asesores' }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas_gerente_mensual' }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vn_metricas_optimizadas' }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas_diarias' }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metas_acv_gerentes' }, triggerRefetch)
      .subscribe();
    // Refresco automático cada 60s como red de seguridad si Realtime no cubre alguna
    // tabla (p.ej. publicación deshabilitada). Mantiene Clasificación consistente.
    const refreshInterval = setInterval(() => fetchRanking(tabRef.current), 60 * 1000);
    return () => {
      supabase.removeChannel(channel);
      if (refetchTimer) clearTimeout(refetchTimer);
      clearInterval(refreshInterval);
    };
  }, [isAuthenticated, profile?.canal, profile?.celula, tab, profile?.nombre, profile?.role, userPais, currentUserAnnualSp]);


  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isComercialTab = (isVC || isVN) && tab === 'comerciales';
  const isGerentesVCTab = isVC && tab === 'gerentes';
  const isGerentesVNTab = isVN && tab === 'gerentes';
  // Asesores VN (todos los países): no tienen meta ACV, solo se muestran FE/Nube/Unidades.
  const isAsesoresVNTab = isVN && isComercialTab;

  // Sort by SP totales as primary, then by % cumplimiento
  const sorted = [...ranking].sort((a, b) => {
    const spDiff = (b.sp_totales || 0) - (a.sp_totales || 0);
    if (spDiff !== 0) return spDiff;
    const pctDiff = (b.pct_cumplimiento ?? 0) - (a.pct_cumplimiento ?? 0);
    if (pctDiff !== 0) return pctDiff;
    return (b.kpi_value || 0) - (a.kpi_value || 0);
  });

  const entityLabel = isComercialTab ? 'Comercial' : 'Gerente';
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <Layout title={`🏆 Clasificación · ${CANALES_LABEL[profile?.canal || ''] || profile?.canal}`}>
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        {/* Tabs + Country indicator */}
        <motion.div className="flex items-center justify-between flex-wrap gap-3" variants={fadeUpItem}>
          <div className="flex gap-2">
            {(isVC || isVN) && (
              <>
                {!isDirector && (
                  <button onClick={() => setTab('comerciales')} className={cn("px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2", tab === 'comerciales' ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40")}>
                    👤 {isVN ? 'Asesores' : 'Comerciales'}
                  </button>
                )}
                <button onClick={() => setTab('gerentes')} className={cn("px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2", tab === 'gerentes' ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40")}>
                  👥 Gerentes
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDirector && directorPaises.length > 1 ? (
              <div className="flex items-center gap-1 p-1 rounded-full bg-muted border border-border">
                {directorPaises.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPais(p)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                      selectedPais === p ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FlagIcon pais={p} /> {PAIS_LABEL[p] || p}
                  </button>
                ))}
              </div>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted border border-border text-foreground">
                <FlagIcon pais={userPais} /> {PAIS_LABEL[userPais] || userPais}
              </span>
            )}
            <span className="text-[10px] text-white bg-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> EN VIVO
            </span>
          </div>
        </motion.div>

        {dataLoading ? <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}</div> : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {top3.map((g, i) => (
                  <motion.div
                    key={g.id}
                    className={cn(
                      "bg-white rounded-3xl border-2 p-6 text-center relative overflow-hidden shadow-smooth-sm",
                      PODIUM_COLORS[i],
                      (g.isCurrent || g.user_id === profile?.user_id) && "ring-2 ring-primary"
                    )}
                    variants={podiumBounce}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  >
                    {i === 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow to-transparent" />}
                    <motion.p className="text-4xl mb-2" animate={{ rotate: [0, -8, 8, -4, 4, 0] }} transition={{ duration: 0.6, delay: i * 0.15 + 0.4 }}>{PODIUM_EMOJIS[i]}</motion.p>
                    <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 mx-auto flex items-center justify-center text-3xl mb-2">🏅</div>
                    <p className="font-bold font-heading text-secondary text-lg">{g.nombre}</p>
                    {g.celula_nombre && g.celula_nombre !== g.nombre && (
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">📋 {g.celula_nombre}</p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                      <FlagIcon pais={g.pais} /> {g.canal?.replace(/_/g, ' ')}
                    </p>

                    {/* SP — HERO metric */}
                    <motion.div
                      className="mt-4 mb-3"
                      initial={{ opacity: 0, scale: 0.3 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 12, delay: i * 0.15 + 0.5 }}
                    >
                      <div className="inline-flex items-center gap-2 bg-primary/10 rounded-2xl px-5 py-3">
                        <motion.span
                          className="text-2xl"
                          animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                        >⚡</motion.span>
                        <AnimatedCounter value={g.sp_totales || 0} className="text-3xl font-black font-scoreboard text-primary" duration={1.2} />
                        <span className="text-xs font-bold text-primary/70 font-scoreboard">Siigo Points</span>
                      </div>
                    </motion.div>

                    {!isComercialTab && (
                      <div className="mt-2 flex justify-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold font-scoreboard text-accent">
                          🎁 {(g.sp_canje || 0).toLocaleString()} <span className="text-[10px] text-accent/70">SP Canje</span>
                        </span>
                      </div>
                    )}

                    {/* Secondary metrics — ocultas en VN (Top 3 sólo muestra SP + SP Canje) */}
                    {!isVN && (
                      <div className="flex items-center justify-center gap-3 text-xs flex-wrap">
                        {(isComercialTab || isGerentesVCTab) && (
                          <>
                            <div>
                              <p className="text-sm font-bold font-scoreboard text-foreground">{g.pct_cumplimiento != null ? `${Math.round(g.pct_cumplimiento)}%` : '—'}</p>
                              <p className="text-[10px] text-muted-foreground font-heading uppercase">Cumpl. ACV</p>
                            </div>
                            <div className="w-px h-6 bg-border" />
                            <div>
                              <p className="text-sm font-bold font-scoreboard text-foreground">{formatMoney(g.kpi_value)}</p>
                              <p className="text-[10px] text-muted-foreground font-heading uppercase">{isVC ? 'ACV+' : 'ACV'}</p>
                            </div>
                            <div className="w-px h-6 bg-border" />
                            <div>
                              <p className="text-sm font-bold font-scoreboard text-muted-foreground">{formatMoney(g.meta_total)}</p>
                              <p className="text-[10px] text-muted-foreground font-heading uppercase">Meta</p>
                            </div>
                          </>
                        )}
                        {!isComercialTab && !isGerentesVCTab && !isGerentesVNTab && g.kpi_value > 0 && (
                          <div>
                            <p className="text-sm font-bold font-scoreboard text-accent">{formatMoney(g.kpi_value)}</p>
                            <p className="text-[10px] text-muted-foreground font-heading uppercase">{isVC ? 'ACV+' : 'ACV'}</p>
                          </div>
                        )}
                      </div>
                    )}


                    {!isComercialTab && g.nivel && <span className="inline-block mt-2 text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span>}
                    {isComercialTab && g.gerente_nombre && <p className="text-[10px] text-muted-foreground mt-2">Líder: {g.gerente_nombre}</p>}
                    {isGerentesVNTab && g.celula_nombre && g.celula_nombre !== g.nombre && <p className="text-[10px] text-muted-foreground mt-2">📋 {g.celula_nombre}</p>}
                    {(g.isCurrent || g.user_id === profile?.user_id) && <span className="inline-block mt-2 text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">Tú</span>}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Full table */}
            {rest.length > 0 && (
              <motion.div className="bg-white border border-border rounded-2xl overflow-hidden shadow-smooth-sm" variants={fadeUpItem}>
                <div className="bg-primary px-4 py-3"><p className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 font-heading">📋 Tabla Completa</p></div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-primary text-white text-[11px] uppercase tracking-wider font-heading">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">{entityLabel}</th>
                      {isComercialTab && <th className="text-left px-4 py-3">Líder</th>}
                      <th className="text-right px-4 py-3">⚡ Siigo Points</th>
                      {!isComercialTab && <th className="text-right px-4 py-3">🎁 Canjeables</th>}
                      {(isComercialTab || isGerentesVCTab) && !isVN && (
                        <>
                          <th className="text-right px-4 py-3">% Cumpl.</th>
                          <th className="text-right px-4 py-3">{isVC ? 'ACV+' : 'ACV'}</th>
                          <th className="text-right px-4 py-3">Meta</th>
                        </>
                      )}
                      {!isComercialTab && !isGerentesVCTab && !isGerentesVNTab && (
                        <>
                          <th className="text-right px-4 py-3">{isVC ? 'ACV+' : 'ACV'}</th>
                          <th className="text-left px-4 py-3">Nivel</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((g, i) => (
                      <motion.tr
                        key={g.id}
                        className={cn(
                          "border-b border-border hover:bg-primary/5 transition-colors",
                          (g.isCurrent || g.user_id === profile?.user_id) && "bg-primary/10 font-semibold"
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 + 0.3 }}
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground font-scoreboard">{i + 4}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FlagIcon pais={g.pais} />
                            <div>
                              <span className="text-sm text-foreground">{g.nombre}</span>
                              {g.celula_nombre && g.celula_nombre !== g.nombre && (
                                <p className="text-[10px] text-muted-foreground">📋 {g.celula_nombre}</p>
                              )}
                            </div>
                            {(g.isCurrent || g.user_id === profile?.user_id) && <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">Tú</span>}
                          </div>
                        </td>
                        {isComercialTab && <td className="px-4 py-3 text-xs text-muted-foreground">{g.gerente_nombre || '—'}</td>}
                        {/* SP Panel General — prominent */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-base font-black font-scoreboard text-primary">{(g.sp_totales || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-primary/60 ml-1 font-scoreboard">PTS</span>
                        </td>
                        {!isComercialTab && (
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-black font-scoreboard text-accent">{(g.sp_canje || 0).toLocaleString()}</span>
                          </td>
                        )}
                        {(isComercialTab || isGerentesVCTab) && !isVN && (
                          <>
                            <td className="px-4 py-3 text-sm font-bold font-scoreboard text-foreground text-right">{g.pct_cumplimiento != null ? `${Math.round(g.pct_cumplimiento)}%` : '—'}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.kpi_value)}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.meta_total)}</td>
                          </>
                        )}
                        {!isComercialTab && !isGerentesVCTab && !isGerentesVNTab && (
                          <>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.kpi_value)}</td>
                            <td className="px-4 py-3"><span className="text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span></td>
                          </>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
            {sorted.length === 0 && (
              <motion.div className="text-center py-16" variants={fadeUpItem}>
                <div className="text-7xl mb-4 opacity-30">📊</div>
                <p className="text-lg font-bold text-muted-foreground">Sin datos de ranking</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Los datos aparecerán cuando se sincronicen las ventas</p>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </Layout>
  );
};

export default Rankings;
