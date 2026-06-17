import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, TrendingUp, DollarSign, Cloud, Trophy, AlertTriangle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { pickVnLeaderCandidate } from '@/lib/vn-leaders';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];


const normalize = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const normalizePaisCode = (pais?: string | null) => {
  const code = String(pais || '').toUpperCase().trim();
  return code === 'URY' ? 'URU' : code;
};

const paisNameToCode = (pais?: string | null) => {
  const value = normalize(pais || '');
  if (value === 'colombia') return 'COL';
  if (value === 'mexico') return 'MEX';
  if (value === 'ecuador') return 'ECU';
  if (value === 'uruguay') return 'URU';
  return normalizePaisCode(pais);
};

const celulaScopeKey = (celula?: string | null, canal?: string | null, pais?: string | null) =>
  `${normalize(celula || '')}|${canal || ''}|${normalizePaisCode(pais)}`;

const fmtMoney = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

type GerenteRow = {
  id: string;
  nombre: string;
  email: string;
  canal: string | null;
  pais: string | null;
  celula: string | null;
  user_id?: string | null;
};

type Stats = {
  gerente: GerenteRow;
  asesores: number;
  fe: number;
  nube: number;
  total: number;
  acv: number;
  metaFe: number;
  metaNube: number;
  metaUds: number;
  metaAcv: number;
  pctFe: number;            // % cumplimiento FE
  pctNube: number;          // % cumplimiento Nube
  pctAcv: number;           // % cumplimiento ACV ($)
  pctTotal: number;         // % unidades totales (FE+Nube vs meta)
  pacing: number;           // ritmo vs días transcurridos (1.0 = en ritmo)
  scoreCompuesto: number;   // 35% FE + 25% Nube + 40% ACV
  productividad: number;    // % asesores con ventas (fase 2)
  ventasPorAsesor: number;  // promedio unidades por asesor
  sp: number;
  racha: number;
};

// 4-tier classification
type TierKey = 'cumple' | 'en_meta' | 'en_riesgo' | 'por_debajo';
const TIERS: { key: TierKey; label: string; range: string; min: number; max: number;
  text: string; bg: string; border: string; solid: string; dot: string; }[] = [
  { key: 'cumple',     label: 'Cumple',         range: 'Cumpl. ≥100%',   min: 100, max: Infinity,
    text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-900', solid: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'en_meta',    label: 'En meta',        range: 'Cumpl. 80-99%',  min: 80,  max: 100,
    text: 'text-sky-700 dark:text-sky-300',         bg: 'bg-sky-50 dark:bg-sky-950/40',         border: 'border-sky-200 dark:border-sky-900',         solid: 'bg-sky-500',     dot: 'bg-sky-500' },
  { key: 'en_riesgo',  label: 'En riesgo',      range: 'Cumpl. 50-79%',  min: 50,  max: 80,
    text: 'text-amber-700 dark:text-amber-300',     bg: 'bg-amber-50 dark:bg-amber-950/40',     border: 'border-amber-200 dark:border-amber-900',     solid: 'bg-amber-500',   dot: 'bg-amber-500' },
  { key: 'por_debajo', label: 'Por debajo de meta', range: 'Cumpl. <50%', min: 0,   max: 50,
    text: 'text-rose-700 dark:text-rose-300',       bg: 'bg-rose-50 dark:bg-rose-950/40',       border: 'border-rose-200 dark:border-rose-900',       solid: 'bg-rose-500',     dot: 'bg-rose-500' },
];
const tierOf = (pct: number): TierKey =>
  pct >= 100 ? 'cumple' : pct >= 80 ? 'en_meta' : pct >= 50 ? 'en_riesgo' : 'por_debajo';
const tierDef = (k: TierKey) => TIERS.find((t) => t.key === k)!;


const PanelDirector = () => {
  const { profile, loading: authLoading } = useSupabaseAuthContext();
  const isAdmin = profile?.role === 'admin';
  const isDirector = profile?.role === 'director';

  const now = new Date();
  const [periodoSel, setPeriodoSel] = useState<number>(now.getMonth() + 1);
  const anio = now.getFullYear();
  const [filtroPais, setFiltroPais] = useState<string>('TODOS');
  const [filtroCanal, setFiltroCanal] = useState<string>('TODOS');
  const [filtroTier, setFiltroTier] = useState<TierKey | 'TODOS'>('TODOS');
  const [heatmapMetric, setHeatmapMetric] = useState<'TOTAL' | 'FE' | 'NUBE' | 'ACV'>('TOTAL');
  const [chartMetric, setChartMetric] = useState<'TOTAL' | 'FE' | 'NUBE' | 'ACV'>('FE');
  const [chartPage, setChartPage] = useState(1);
  const CHART_PAGE_SIZE = 10;
  useEffect(() => { setChartPage(1); }, [chartMetric, filtroPais, filtroCanal, filtroTier]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats[]>([]);

  const [tendencia, setTendencia] = useState<{ mes: number; pct: number }[]>([]);

  const scopeCanales = useMemo(
    () => (isAdmin ? [] : (profile?.director_canales || [])),
    [isAdmin, profile?.director_canales],
  );
  const scopePaises = useMemo(
    () => (isAdmin ? [] : (profile?.director_paises || []).map(normalizePaisCode)),
    [isAdmin, profile?.director_paises],
  );

  // Todos los directores supervisan TODO su canal+país. El filtro fino por
  // `metas_acv_gerentes.director` es poco confiable (columna sparse / nombres
  // inconsistentes mes a mes), por lo que se desactiva para todos.
  // El scope efectivo se aplica vía `director_canales` + `director_paises`.
  const isSeniorDirector = useMemo(() => true, []);


  useEffect(() => {
    if (authLoading || !profile) return;
    if (!isAdmin && !isDirector) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const fetchAll = async <T = any,>(buildQuery: () => any, pageSize = 1000): Promise<T[]> => {
          const rows: T[] = [];
          for (let from = 0; ; from += pageSize) {
            const { data, error } = await buildQuery().range(from, from + pageSize - 1);
            if (error) throw error;
            rows.push(...((data || []) as T[]));
            if (!data || data.length < pageSize) break;
          }
          return rows;
        };

        const fetchAllInChunks = async <T = any,>(ids: string[], buildQuery: (chunk: string[]) => any): Promise<T[]> => {
          const rows: T[] = [];
          const CHUNK_SIZE = 350;
          for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            rows.push(...await fetchAll<T>(() => buildQuery(ids.slice(i, i + CHUNK_SIZE))));
          }
          return rows;
        };

        // 0) Director scope por NOMBRE: leer celulas asignadas en metas_acv_gerentes.director
        // Esto evita que aparezcan gerentes de otros directores con el mismo canal/país.
        // ⚠️ Los directores Sr supervisan TODO el canal+país: no construimos gate.
        const allowedCelulaKeys = new Set<string>();
        if (!isAdmin && isDirector && !isSeniorDirector && profile?.nombre) {
          const tokens = profile.nombre.trim().split(/\s+/).filter(Boolean);
          const pattern = tokens.length >= 2
            ? `%${tokens[0]}%${tokens[tokens.length - 1]}%`
            : `%${tokens[0]}%`;
          let dq = supabase
            .from('metas_acv_gerentes')
            .select('celula, canal, pais')
            .ilike('director', pattern);
          if (scopeCanales.length) dq = dq.in('canal', scopeCanales);
          if (scopePaises.length) dq = dq.in('pais', scopePaises);
          const { data: dirCelulas } = await dq;
          (dirCelulas || []).forEach((r: any) => {
            if (r.celula) allowedCelulaKeys.add(celulaScopeKey(r.celula, r.canal, r.pais));
          });
        }


        // 1) Gerentes en scope
        const buildGerentesQuery = () => {
          let q = supabase.from('gerentes')
            .select('id, nombre, email, canal, pais, celula, user_id')
            .eq('activo', true);
          if (!isAdmin) {
            if (scopeCanales.length) q = q.in('canal', scopeCanales);
            if (scopePaises.length) q = q.in('pais', scopePaises);
          }
          return q;
        };
        const gerentes = await fetchAll<GerenteRow>(buildGerentesQuery);
        let gerentesList = (gerentes || []) as GerenteRow[];
        if (!isAdmin && isDirector && !isSeniorDirector && allowedCelulaKeys.size > 0) {
          // VC no usa celula → no aplicar gate de celula a gerentes VC
          gerentesList = gerentesList.filter((g) =>
            g.canal === 'VC' || (g.celula && allowedCelulaKeys.has(celulaScopeKey(g.celula, g.canal, g.pais)))
          );
        }


        // 2) Asesores count por gerente
        // Modelo VN: los asesores están en la propia tabla `gerentes` compartiendo `celula`
        // con su líder. Contamos miembros por célula y restamos 1 (el líder).
        const gerenteIds = gerentesList.map((g) => g.id);
        const asesoresMap = new Map<string, number>();
        // a) Desde la tabla `asesores` (modelo legacy / VC)
        if (gerenteIds.length) {
          const ases = await fetchAllInChunks<any>(gerenteIds, (chunk) => supabase
            .from('asesores')
            .select('gerente_id')
            .in('gerente_id', chunk)
            .eq('activo', true));
          (ases || []).forEach((a: any) => {
            asesoresMap.set(a.gerente_id, (asesoresMap.get(a.gerente_id) || 0) + 1);
          });
        }
        // b) Desde `gerentes` agrupado por celula (modelo VN actual). Trae TODOS los
        //    miembros de la celula aunque no estén en el scope del director.
        const celulasInScope = Array.from(
          new Set(gerentesList.map((g) => g.celula).filter(Boolean) as string[]),
        );
        const celulaCountMap = new Map<string, number>();
        if (celulasInScope.length) {
          const allCel = await fetchAllInChunks<any>(celulasInScope, (chunk) => {
            let q = supabase
              .from('gerentes')
              .select('celula, canal, pais')
              .in('celula', chunk)
              .eq('activo', true);
            if (!isAdmin && scopeCanales.length) q = q.in('canal', scopeCanales);
            if (!isAdmin && scopePaises.length) q = q.in('pais', scopePaises);
            return q;
          });
          (allCel || []).forEach((r: any) => {
            const key = celulaScopeKey(r.celula, r.canal, r.pais);
            celulaCountMap.set(key, (celulaCountMap.get(key) || 0) + 1);
          });
        }
        for (const g of gerentesList) {
          if (asesoresMap.get(g.id)) continue; // ya contado vía asesores
          if (!g.celula) continue;
          const total = celulaCountMap.get(celulaScopeKey(g.celula, g.canal, g.pais)) || 0;
          // restamos 1 = el propio líder (este gerente)
          asesoresMap.set(g.id, Math.max(0, total - 1));
        }

        // c) Fallback: para gerentes VN que aún tienen 0 asesores (MEX/ECU/URU
        //    donde los advisors no viven en `gerentes`), contar desde `metas_asesores`
        //    del período actual. Usa celula normalizada para tolerar tildes.
        const periodoMetasYYYYMM = `${anio}${String(periodoSel).padStart(2, '0')}`;
        const paisToMetas: Record<string, string> = {
          COL: 'COLOMBIA', MEX: 'MEXICO', ECU: 'ECUADOR', URU: 'URUGUAY',
        };
        const gerentesSinAsesores = gerentesList.filter(
          (g) => (g.canal === 'VN_ALIADOS' || g.canal === 'VN_EMPRESARIOS') &&
                 g.celula && !asesoresMap.get(g.id),
        );
        if (gerentesSinAsesores.length) {
          const celulasNeed = Array.from(new Set(gerentesSinAsesores.map((g) => g.celula!)));
          const paisesNeed = Array.from(new Set(
            gerentesSinAsesores.map((g) => paisToMetas[normalizePaisCode(g.pais)]).filter(Boolean),
          ));
          const mAse = await fetchAll<any>(() => supabase
            .from('metas_asesores')
            .select('celula, pais, documento_asesor, aplica_cuota_lider')
            .eq('anio_mes', periodoMetasYYYYMM)
            .in('pais', paisesNeed)
            .not('documento_asesor', 'is', null));
          // Contar advisors únicos por (celula normalizada, pais)
          const advisorsByKey = new Map<string, Set<string>>();
          (mAse || []).forEach((r: any) => {
            const doc = String(r.documento_asesor || '').trim();
            if (!doc || doc.startsWith('CEL_')) return;
            const key = `${normalize(r.celula || '')}|${r.pais || ''}`;
            if (!celulasNeed.some((cel) => normalize(cel) === normalize(r.celula || ''))) return;
            if (!advisorsByKey.has(key)) advisorsByKey.set(key, new Set());
            advisorsByKey.get(key)!.add(doc);
          });
          for (const g of gerentesSinAsesores) {
            const paisMetas = paisToMetas[normalizePaisCode(g.pais)];
            const key = `${normalize(g.celula || '')}|${paisMetas}`;
            const set = advisorsByKey.get(key);
            // Restamos 1 si el propio líder figura como advisor en metas
            const count = set ? Math.max(0, set.size - 1) : 0;
            if (count > 0) asesoresMap.set(g.id, count);
          }
        }

        // 3) Métricas VN — respetar scope de canales del director
        const vnCanales = (scopeCanales.length ? scopeCanales : ['VN_ALIADOS', 'VN_EMPRESARIOS', 'VC'])
          .filter((c) => c.startsWith('VN'));
        // Mapear canal interno → canal_direccion en vn_metricas_optimizadas
        const canalDirMap: Record<string, string> = {
          VN_ALIADOS: 'Aliados',
          VN_EMPRESARIOS: 'Empresarios',
        };
        const normCanalDireccion = (value?: string | null) => {
          const v = normalize(value || '');
          if (v.includes('aliado')) return 'Aliados';
          if (v.includes('smbs') || v.includes('empresario')) return 'Empresarios';
          return value || '';
        };
        const canalDirs = vnCanales.map((c) => canalDirMap[c]).filter(Boolean);
        let metricas: any[] = [];
        if (vnCanales.length || isAdmin) {
          metricas = await fetchAll<any>(() => {
            let q = supabase
              .from('vn_metricas_optimizadas' as any)
              .select('pais, mes_nro, canal_direccion, gerente, gerente_normalizado, tipo_producto1, familia, ventas, acv_total')
              .eq('scope', 'gerente')
              .eq('anio', anio)
              .eq('mes_nro', periodoSel);
            if (!isAdmin && scopePaises.length) q = q.in('pais', scopePaises);
            if (!isAdmin && canalDirs.length) q = q.in('canal_direccion', canalDirs);
            return q;
          });
        }

        // 3b) Métricas a nivel ASESOR agregadas por celula. Sirven como fallback
        // cuando la fila de scope='gerente' está ausente o en 0 para algún líder
        // (caso frecuente en COL/ECU/MEX donde la sync de Databricks no genera
        // la fila del gerente pero sí las de sus asesores).
        const aggByCelula = new Map<string, { fe: number; nube: number; total: number; acv: number; pais: string | null; canal: string | null }>();
        if (vnCanales.length || isAdmin) {
          const asesorRows = await fetchAll<any>(() => {
            let q = supabase
              .from('vn_metricas_optimizadas' as any)
              .select('pais, canal_direccion, celula, tipo_producto1, familia, ventas, acv_total')
              .eq('scope', 'asesor')
              .eq('anio', anio)
              .eq('mes_nro', periodoSel)
              .not('celula', 'is', null);
            if (!isAdmin && scopePaises.length) q = q.in('pais', scopePaises);
            if (!isAdmin && canalDirs.length) q = q.in('canal_direccion', canalDirs);
            return q;
          });
          (asesorRows || []).forEach((r: any) => {
            const cd = String(r.canal_direccion || '').toLowerCase();
            const canalReal = cd.includes('aliado') ? 'VN_ALIADOS'
              : cd.includes('empresario') || cd.includes('smbs') ? 'VN_EMPRESARIOS'
              : null;
            const key = celulaScopeKey(r.celula, canalReal, r.pais);
            const cur = aggByCelula.get(key) || { fe: 0, nube: 0, total: 0, acv: 0, pais: r.pais, canal: canalReal };
            const v = Number(r.ventas) || 0;
            const tp = String(r.familia || r.tipo_producto1 || '').toUpperCase();
            if (tp === 'FE') cur.fe += v;
            else if (tp === 'NUBE') cur.nube += v;
            cur.total += v;
            cur.acv += Number(r.acv_total) || 0;
            aggByCelula.set(key, cur);
          });
        }

        // 4) SP acumulado mes actual
        const periodoYYYYMM = `${anio}${String(periodoSel).padStart(2, '0')}`;
        const spMap = new Map<string, number>();
        if (gerenteIds.length) {
          const spData = await fetchAllInChunks<any>(gerenteIds, (chunk) => supabase
            .from('sp_acumulados')
            .select('gerente_id, sp')
            .eq('periodo', periodoYYYYMM)
            .in('gerente_id', chunk));
          (spData || []).forEach((r: any) => {
            spMap.set(r.gerente_id, (spMap.get(r.gerente_id) || 0) + (r.sp || 0));
          });
        }

        // 5) Rachas
        const rachaMap = new Map<string, number>();
        if (gerenteIds.length) {
          const [rvc, rvn] = await Promise.all([
            fetchAllInChunks<any>(gerenteIds, (chunk) => supabase.from('rachas').select('gerente_id, semanas_consecutivas')
              .in('gerente_id', chunk)
              .order('semanas_consecutivas', { ascending: false })),
            fetchAllInChunks<any>(gerenteIds, (chunk) => supabase.from('rachas_vn_estado').select('gerente_id, dias_o_semanas_consecutivas, racha_activa')
              .in('gerente_id', chunk)
              .eq('racha_activa', true)),
          ]);
          (rvc || []).forEach((r: any) => {
            const cur = rachaMap.get(r.gerente_id) || 0;
            rachaMap.set(r.gerente_id, Math.max(cur, r.semanas_consecutivas || 0));
          });
          (rvn || []).forEach((r: any) => {
            const cur = rachaMap.get(r.gerente_id) || 0;
            const semanas = Math.ceil((r.dias_o_semanas_consecutivas || 0) / 5);
            rachaMap.set(r.gerente_id, Math.max(cur, semanas));
          });
        }

        // 6) Metas reales desde metas_acv_gerentes (usa abreviatura del mes: Ene, Feb...)
        const MESES_ABR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const mesAbr = MESES_ABR[periodoSel - 1];
        const metasMap = new Map<string, { fe: number; nube: number; totalUds: number; acv: number }>();
        const validCelulasMes = new Set<string>();
        const metasRows: any[] = [];
        {
          let metasQuery = supabase
            .from('metas_acv_gerentes')
            .select('pais, canal, celula, meta_fe, meta_nube, meta_total_und, meta_total_acv')
            .eq('mes', mesAbr)
            .eq('anio', anio);
          if (!isAdmin && scopeCanales.length) metasQuery = metasQuery.in('canal', scopeCanales);
          if (!isAdmin && scopePaises.length) metasQuery = metasQuery.in('pais', scopePaises);
          // Nota: no filtramos por `director` aquí porque esa columna puede estar
          // vacía en algunos meses (ej. Jun 2026). El scope por director ya se
          // aplica vía `allowedCelulaKeys` (construido a partir de TODOS los meses).

          const metas = await fetchAll<any>(() => metasQuery);
          let metasAsesoresRows: any[] = [];
          if (periodoYYYYMM) {
            metasAsesoresRows = await fetchAll<any>(() => {
              let q = supabase
                .from('metas_asesores')
                .select('pais, canal_direccion, celula, meta_fe, meta_nube, meta_total, documento_asesor')
                .eq('anio_mes', periodoYYYYMM)
                .like('documento_asesor', 'CEL_%');
              if (!isAdmin && scopePaises.length) {
                const fullPais = scopePaises.map((p) => p === 'MEX' ? 'MEXICO' : p === 'COL' ? 'COLOMBIA' : p === 'ECU' ? 'ECUADOR' : p === 'URU' ? 'URUGUAY' : p);
                q = q.in('pais', fullPais);
              }
              return q;
            });
          }
          const metasAsesorByKey = new Map<string, any>();
          metasAsesoresRows.forEach((r: any) => {
            const paisCode = normalizePaisCode(r.pais === 'MEXICO' ? 'MEX' : r.pais === 'COLOMBIA' ? 'COL' : r.pais === 'ECUADOR' ? 'ECU' : r.pais === 'URUGUAY' ? 'URU' : r.pais);
            const canal = normCanalDireccion(r.canal_direccion) === 'Aliados' ? 'VN_ALIADOS' : 'VN_EMPRESARIOS';
            metasAsesorByKey.set(celulaScopeKey(r.celula, canal, paisCode), r);
          });
          (metas || []).forEach((m: any) => {
            const cel = normalize(m.celula);
            if (!cel) return;
            const key = celulaScopeKey(m.celula, m.canal, m.pais);
            if (!isAdmin && isDirector && !isSeniorDirector && allowedCelulaKeys.size > 0 && !allowedCelulaKeys.has(key)) return;
            const asesorMeta = metasAsesorByKey.get(key);
            const asesorFe = Number(asesorMeta?.meta_fe) || 0;
            const asesorNube = Number(asesorMeta?.meta_nube) || 0;
            const asesorTotal = Number(asesorMeta?.meta_total) || 0;
            const metaFe = Math.round(Number(m.meta_fe) || asesorFe || 0);
            const metaNube = Math.round(Number(m.meta_nube) || asesorNube || Math.max(0, asesorTotal - metaFe));
            const metaTotal = Math.round(Math.max(Number(m.meta_total_und) || 0, asesorTotal || 0, metaFe + metaNube));
            metasRows.push(m);
            validCelulasMes.add(key);
            metasMap.set(key, {
              fe: metaFe,
              nube: metaNube,
              totalUds: metaTotal,
              acv: Number(m.meta_total_acv) || 0,
            });
          });

        }

        // Construir set de NOMBRES DE ASESORES antes de resolver líderes.
        // Cualquier persona con documento_asesor real (no CEL_*) en metas_asesores del
        // periodo es asesor — aunque tenga registro espejo en `gerentes`.
        const advisorNamesSet = new Set<string>();
        const metaGerenteByCelula = new Map<string, string>();
        const advisorDocsByCelula = new Map<string, Set<string>>();
        {
          const asRows = await fetchAll<any>(() => {
            let q = supabase
              .from('metas_asesores')
              .select('nombre_asesor, documento_asesor, gerente, celula, canal_direccion, pais')
              .eq('anio_mes', periodoYYYYMM)
              .not('documento_asesor', 'is', null);
            if (!isAdmin && scopePaises.length) {
              const fullPais = scopePaises.map((p) => p === 'MEX' ? 'MEXICO' : p === 'COL' ? 'COLOMBIA' : p === 'ECU' ? 'ECUADOR' : p === 'URU' ? 'URUGUAY' : p);
              q = q.in('pais', fullPais);
            }
            return q;
          });
          (asRows || []).forEach((r: any) => {
            const doc = String(r.documento_asesor || '').trim();
            if (!doc || doc.startsWith('CEL_')) return;
            const canal = normCanalDireccion(r.canal_direccion) === 'Aliados' ? 'VN_ALIADOS' : 'VN_EMPRESARIOS';
            if (!isAdmin && scopeCanales.length && !scopeCanales.includes(canal)) return;
            const celKey = celulaScopeKey(r.celula, canal, paisNameToCode(r.pais));
            const n = normalize(r.nombre_asesor || '');
            if (n) advisorNamesSet.add(n);
            const gerenteNombre = String(r.gerente || '').trim();
            if (gerenteNombre && !metaGerenteByCelula.has(celKey)) metaGerenteByCelula.set(celKey, gerenteNombre);
            if (!advisorDocsByCelula.has(celKey)) advisorDocsByCelula.set(celKey, new Set());
            advisorDocsByCelula.get(celKey)!.add(doc);
          });
        }

        const isAdvisorLikeGerente = (g?: GerenteRow | null) => {
          if (!g) return false;
          const name = normalize(g.nombre || '');
          const email = String(g.email || '').trim().toLowerCase();
          return advisorNamesSet.has(name) || email.startsWith('emp-');
        };

        // 7) Construir stats por LÍDER REAL agrupando vn_metricas por gerente_normalizado.
        // Esto arregla COL/ECU (antes el matching por primer nombre fallaba contra los 1500+
        // registros de la tabla `gerentes`).
        type Agg = { fe: number; nube: number; total: number; acv: number; pais: string | null };
        const aggByLeader = new Map<string, Agg>();
        for (const m of metricas) {
          const key = normalize(m.gerente_normalizado || m.gerente || '');
          if (!key) continue;
          const cur = aggByLeader.get(key) || { fe: 0, nube: 0, total: 0, acv: 0, pais: m.pais || null };
          const v = Number(m.ventas) || 0;
          const tp = String(m.familia || m.tipo_producto1 || '').toUpperCase();
          if (tp === 'FE') cur.fe += v;
          else if (tp === 'NUBE') cur.nube += v;
          cur.total += v;
          cur.acv += Number(m.acv_total) || 0;
          cur.pais = cur.pais || m.pais;
          aggByLeader.set(key, cur);
        }

        const gByName = new Map<string, GerenteRow[]>();
        for (const g of gerentesList) {
          if (isAdvisorLikeGerente(g)) continue;
          const k = normalize(g.nombre);
          if (!k) continue;
          // Excluir nombres de UN solo token (ej. "Angel", "Walter") como candidatos
          // de matching: son demasiado ambiguos y arrastraban a varios líderes
          // distintos al mismo registro (bug "Angel duplicado" en ECU/MEX).
          if (k.split(/\s+/).length < 2) continue;
          gByName.set(k, [...(gByName.get(k) || []), g]);
        }
        // Prefer gerentes WITH celula (líderes reales) y mismo país
        const pickBest = (arr: GerenteRow[], paisHint: string | null): GerenteRow | null => {
          if (!arr.length) return null;
          const byPais = paisHint ? arr.filter((g) => g.pais === paisHint) : arr;
          const pool = byPais.length ? byPais : arr;
          return pool.find((g) => !!g.celula) || pool[0];
        };
        const findGerente = (leaderKey: string, paisHint: string | null): GerenteRow | null => {
          const exact = gByName.get(leaderKey);
          if (exact && exact.length) return pickBest(exact, paisHint);

          const tokens = leaderKey.split(/\s+/).filter(Boolean);
          if (tokens.length >= 2) {
            // Coincidencia por primer + último token (ej. "diana naranjo" ↔ "Diana Maria Naranjo Mattheus")
            const first = tokens[0];
            const last = tokens[tokens.length - 1];
            const matches: GerenteRow[] = [];
            for (const [k, arr] of gByName) {
              const kt = k.split(/\s+/);
              if (kt.includes(first) && kt.includes(last)) matches.push(...arr);
            }
            if (matches.length) return pickBest(matches, paisHint);
          }

          // Fallback prefix — SOLO con límite de palabra (evita que "angel" matchee
          // "angela ..." o que cualquier "angel ..." colapse a un gerente llamado solo "Angel").
          for (const [k, arr] of gByName) {
            if (k === leaderKey || k.startsWith(leaderKey + ' ') || leaderKey.startsWith(k + ' ')) {
              const pick = pickBest(arr, paisHint);
              if (pick) return pick;
            }
          }
          return null;
        };

        // Mapeo canal_direccion → canal real para rellenar filas sin match en `gerentes`.
        const canalFromMetric = (m: any): string | null => {
          const cd = String(m.canal_direccion || '').toLowerCase();
          if (cd.includes('aliado')) return 'VN_ALIADOS';
          if (cd.includes('empresario')) return 'VN_EMPRESARIOS';
          return null;
        };
        const canalByLeader = new Map<string, string | null>();
        for (const m of metricas) {
          const key = normalize(m.gerente_normalizado || m.gerente || '');
          if (!key || canalByLeader.has(key)) continue;
          canalByLeader.set(key, canalFromMetric(m));
        }

        const out: Stats[] = [];
        const usedIds = new Set<string>();
        const usedCelulaKeys = new Set<string>();
        const seenSynth = new Set<string>();
        for (const [leaderKey, agg] of aggByLeader) {
          const g = findGerente(leaderKey, agg.pais);

          // 🔒 Directores (no-admin): nunca crear gerentes sintéticos. Si la métrica no
          // tiene match con un gerente real dentro del scope, se descarta. Esto evita que
          // aparezcan líderes de otros canales/países en el panel.
          if (!isAdmin && !g) continue;
          if (!isAdmin && g && scopeCanales.length && !scopeCanales.includes(g.canal || '')) continue;
          if (!isAdmin && g && scopePaises.length && !scopePaises.includes(normalizePaisCode(g.pais))) continue;
          const celKey = celulaScopeKey(g?.celula, g?.canal, g?.pais);
          if (!isAdmin && (!celKey || !validCelulasMes.has(celKey))) continue;
          if (g?.celula && usedCelulaKeys.has(celKey)) continue;
          if (g?.celula) usedCelulaKeys.add(celKey);

          // Dedupe: si dos leaderKey distintos resuelven al mismo gerente real, sólo una fila
          if (g && usedIds.has(g.id)) continue;
          const synthKey = `${leaderKey}|${agg.pais || ''}`;
          if (!g && seenSynth.has(synthKey)) continue;
          const gerente: GerenteRow = g || {
            id: `metric-${synthKey}`,
            nombre: leaderKey.replace(/\b\w/g, (c) => c.toUpperCase()),
            email: '',
            canal: canalByLeader.get(leaderKey) || null,
            pais: agg.pais,
            celula: null,
          };
          if (g) usedIds.add(g.id);
          else seenSynth.add(synthKey);
          const meta = metasMap.get(celulaScopeKey(gerente.celula, gerente.canal, gerente.pais));
          const asesoresCount = g ? (asesoresMap.get(g.id) || 0) : 0;
          // Fallback: si la fila de gerente está vacía pero sí hay ventas a nivel
          // asesor agrupadas por la misma celula, usar esas ventas.
          const celAggKey = celulaScopeKey(gerente.celula, gerente.canal, gerente.pais);
          const celAgg = aggByCelula.get(celAggKey);
          if (celAgg && (agg.fe + agg.nube + agg.total) === 0) {
            agg.fe = celAgg.fe;
            agg.nube = celAgg.nube;
            agg.total = celAgg.total;
            agg.acv = celAgg.acv;
          }
          const metaFe = meta ? meta.fe : asesoresCount * 2;
          const metaNube = meta ? meta.nube : asesoresCount * 1;
          const metaTotal = meta ? meta.totalUds : metaFe + metaNube;
          const metaAcv = meta ? meta.acv : 0;

          const pctFe = metaFe > 0 ? (agg.fe / metaFe) * 100 : 0;
          const pctNube = metaNube > 0 ? (agg.nube / metaNube) * 100 : 0;
          const pctTotal = metaTotal > 0 ? (agg.total / metaTotal) * 100 : 0;
          const pctAcv = metaAcv > 0 ? (agg.acv / metaAcv) * 100 : 0;

          // Pacing: qué tan en ritmo está el gerente vs el día del mes
          const today = new Date();
          const lastDay = new Date(today.getFullYear(), periodoSel, 0).getDate();
          const currentDay = today.getMonth() + 1 === periodoSel ? today.getDate() : lastDay;
          const pacing = currentDay > 0 ? pctTotal / ((currentDay / lastDay) * 100) : 0;

          // Score compuesto ponderado (0-100+)
          const scoreCompuesto = Math.round(pctFe * 0.35 + pctNube * 0.25 + pctAcv * 0.40);

          const productividad = 0; // fase 2: contar asesores con ventas > 0
          const ventasPorAsesor = asesoresCount > 0 ? agg.total / asesoresCount : 0;

          out.push({
            gerente,
            asesores: asesoresCount,
            fe: Math.round(agg.fe),
            nube: Math.round(agg.nube),
            total: Math.round(agg.total),
            acv: Math.round(agg.acv),
            metaFe,
            metaNube,
            metaUds: metaTotal,
            metaAcv,
            pctFe: Math.round(pctFe),
            pctNube: Math.round(pctNube),
            pctAcv: Math.round(pctAcv),
            pctTotal: Math.round(pctTotal),
            pacing: Math.round(pacing * 100) / 100,
            scoreCompuesto,
            productividad,
            ventasPorAsesor: Math.round(ventasPorAsesor * 10) / 10,
            sp: g ? (spMap.get(g.id) || 0) : 0,
            racha: g ? (rachaMap.get(g.id) || 0) : 0,
          });
        }

        const filasDesdeMetricas = out.length;
        // Sumar líderes con asesores asignados pero sin métrica este mes.
        // ⚠️ Debemos añadir UNA SOLA fila por celula y solo el líder real
        // (gerente con user_id). De lo contrario se mezclaban los asesores
        // de la celula como si fueran gerentes (bug 275 vs 28 esperados).
        const seenCelulas = new Set<string>();
        // Marcar como ya vistas las celulas de gerentes que ya entraron por métricas
        for (const s of out) {
          if (s.gerente.celula) seenCelulas.add(celulaScopeKey(s.gerente.celula, s.gerente.canal, s.gerente.pais));
        }
        const pickGerenteByCelula = (key: string) => {
          const all = gerentesList.filter((g) => celulaScopeKey(g.celula, g.canal, g.pais) === key);
          // Excluir candidatos que son asesores o registros espejo emp-*.
          const pool = all.filter((g) => !isAdvisorLikeGerente(g));
          if (!pool.length) return null;
          return pickVnLeaderCandidate(pool, {
            celula: pool[0]?.celula,
            advisorNames: advisorNamesSet,
            excludeIds: usedIds,
          });
        };
        for (const metaRow of metasRows) {
          const celKey = celulaScopeKey(metaRow.celula, metaRow.canal, metaRow.pais);
          if (seenCelulas.has(celKey)) continue;
          const g = pickGerenteByCelula(celKey);
          // Si no hay gerente real para la célula, no crear filas sintéticas ni
          // elegir asesores como reemplazo: el panel sólo debe listar gerentes reales.
          if (!g || isAdvisorLikeGerente(g)) continue;
          const asesoresCount = g ? (asesoresMap.get(g.id) || 0) : 0;
          seenCelulas.add(celKey);
          if (g) usedIds.add(g.id);
          const meta = metasMap.get(celKey);
          const metaFe = meta ? meta.fe : asesoresCount * 2;
          const metaNube = meta ? meta.nube : asesoresCount * 1;
          const metaTotal = meta ? meta.totalUds : metaFe + metaNube;
          const gerente: GerenteRow = g;
          // Usar ventas a nivel asesor agregadas por celula como fallback real
          const celAgg = aggByCelula.get(celKey);
          const fe = celAgg ? Math.round(celAgg.fe) : 0;
          const nube = celAgg ? Math.round(celAgg.nube) : 0;
          const total = celAgg ? Math.round(celAgg.total) : 0;
          const acv = celAgg ? Math.round(celAgg.acv) : 0;
          const pctFe = metaFe > 0 ? (fe / metaFe) * 100 : 0;
          const pctNube = metaNube > 0 ? (nube / metaNube) * 100 : 0;
          const pctTotal = metaTotal > 0 ? (total / metaTotal) * 100 : 0;
          const pctAcv = (meta?.acv || 0) > 0 ? (acv / (meta!.acv)) * 100 : 0;
          out.push({
            gerente,
            asesores: asesoresCount,
            fe, nube, total, acv,
            metaFe, metaNube, metaUds: metaTotal,
            metaAcv: meta ? meta.acv : 0,
            pctFe: Math.round(pctFe), pctNube: Math.round(pctNube),
            pctAcv: Math.round(pctAcv), pctTotal: Math.round(pctTotal),
            pacing: 0,
            scoreCompuesto: Math.round(pctFe * 0.35 + pctNube * 0.25 + pctAcv * 0.40),
            productividad: 0,
            ventasPorAsesor: asesoresCount > 0 ? Math.round((total / asesoresCount) * 10) / 10 : 0,
            sp: g ? (spMap.get(g.id) || 0) : 0,
            racha: g ? (rachaMap.get(g.id) || 0) : 0,
          });
        }

        // === VC: `ventas` es la fuente oficial ===
        // SUM-* = ACV+ y meta mensual por comercial (evita inflar métricas)
        // PROD-* = desglose visual por familia FE / Nube
        const vcGerentes = gerentesList.filter((g) => g.canal === 'VC');
        if (vcGerentes.length) {
          const vcIds = vcGerentes.map((g) => g.id);
          const mesNombre = MESES[periodoSel - 1];

          const vcVentasRows: any[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase
              .from('ventas')
              .select('gerente_id, comercial, lider, producto, categoria_producto_venta, acv_plus, valor_producto, meta, documento_factura')
              .eq('canal', 'VC')
              .in('gerente_id', vcIds)
              .eq('anio', anio)
              .eq('mes', mesNombre)
              .range(from, from + 999);
            if (error) throw error;
            vcVentasRows.push(...(data || []));
            if (!data || data.length < 1000) break;
          }

          const norm = (s?: string | null) =>
            String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

          type VcAgg = {
            fe: number;
            nube: number;
            total: number;
            acv: number;
            metaAcv: number;
            acvFe: number;
            acvNube: number;
            comerciales: Set<string>;
          };
          const vcAgg = new Map<string, VcAgg>();
          const empty = (): VcAgg => ({ fe: 0, nube: 0, total: 0, acv: 0, metaAcv: 0, acvFe: 0, acvNube: 0, comerciales: new Set() });
          const bucketVc = (p?: string | null): 'fe' | 'nube' | 'skip' => {
            const s = String(p || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            if (!s) return 'nube';
            if (s.includes('resumen')) return 'skip';
            if (s === 'fe' || s.includes(' pyme fe') || s.includes('pyme fe') || s.includes('documentos') || s.includes('factura electronica')) return 'fe';
            return 'nube';
          };
          for (const v of vcVentasRows) {
            if (!v.gerente_id) continue;
            const cur = vcAgg.get(v.gerente_id) || empty();
            if (v.comercial) cur.comerciales.add(norm(v.comercial));
            const doc = String(v.documento_factura || '');
            const acv = Number(v.acv_plus) || 0;
            if (doc.startsWith('SUM-')) {
              cur.acv += acv;
              cur.metaAcv += Number(v.meta) || 0;
              vcAgg.set(v.gerente_id, cur);
              continue;
            }
            if (!doc.startsWith('PROD-')) {
              vcAgg.set(v.gerente_id, cur);
              continue;
            }
            const b = bucketVc(`${v.producto || ''} ${v.categoria_producto_venta || ''} ${doc}`);
            if (b === 'skip') {
              vcAgg.set(v.gerente_id, cur);
              continue;
            }
            cur.total += 1;
            cur[b] += 1;
            if (b === 'fe') cur.acvFe += acv;
            if (b === 'nube') cur.acvNube += acv;
            vcAgg.set(v.gerente_id, cur);
          }

          for (const g of vcGerentes) {
            const agg = vcAgg.get(g.id) || empty();
            const asesoresCount = agg.comerciales.size || asesoresMap.get(g.id) || 0;
            // Mostrar si tiene comerciales asignados, venta o meta este mes.
            if (asesoresCount === 0 && agg.acv === 0 && agg.metaAcv === 0) continue;

            const metaAcv = Math.round(agg.metaAcv);
            const acvReal = Math.round(agg.acv);
            // En VC, FE y Nube son CANTIDAD DE PRODUCTOS VENDIDOS (no monto).
            // No existe meta por familia en unidades para VC: se muestra "—" en la meta y %.
            const metaFe = 0;
            const metaNube = 0;

            const pctFe = 0;
            const pctNube = 0;
            const pctAcv = metaAcv > 0 ? (acvReal / metaAcv) * 100 : 0;
            const pctTotal = pctAcv;

            const today = new Date();
            const lastDay = new Date(today.getFullYear(), periodoSel, 0).getDate();
            const currentDay = today.getMonth() + 1 === periodoSel ? today.getDate() : lastDay;
            const pacing = currentDay > 0 ? pctTotal / ((currentDay / lastDay) * 100) : 0;
            const scoreCompuesto = Math.round(pctAcv);

            out.push({
              gerente: g,
              asesores: asesoresCount,
              fe: agg.fe,
              nube: agg.nube,
              total: acvReal,
              acv: acvReal,
              metaFe,
              metaNube,
              metaUds: metaAcv,
              metaAcv,
              pctFe: Math.round(pctFe),
              pctNube: Math.round(pctNube),
              pctAcv: Math.round(pctAcv),
              pctTotal: Math.round(pctTotal),
              pacing: Math.round(pacing * 100) / 100,
              scoreCompuesto,
              productividad: 0,
              ventasPorAsesor: asesoresCount > 0 ? Math.round((agg.total / asesoresCount) * 10) / 10 : 0,
              sp: spMap.get(g.id) || 0,
              racha: rachaMap.get(g.id) || 0,
            });

          }
        }



        console.log('[PanelDirector] Diagnóstico:', {
          gerentesEnScope: gerentesList.length,
          metricasRecibidas: metricas.length,
          filasDesdeMetricas,
          filasFallbackPorCelula: out.length - filasDesdeMetricas,
          filasTotales: out.length,
          celulasConMetaDelMes: validCelulasMes.size,
          scopeCanales,
          scopePaises,
          isAdmin,
        });

        // 8) Tendencia 6 meses (cumplimiento agregado)
        const mesesAtras = Array.from({ length: 6 }, (_, i) => periodoSel - 5 + i).filter((m) => m >= 1 && m <= 12);
        const tendData: { mes: number; pct: number }[] = [];
        for (const mes of mesesAtras) {
          let tq = supabase
            .from('vn_metricas_optimizadas' as any)
            .select('ventas, gerente_normalizado, gerente, pais')
            .eq('scope', 'gerente')
            .eq('anio', anio)
            .eq('mes_nro', mes);
          if (!isAdmin && scopePaises.length) tq = tq.in('pais', scopePaises);
          if (!isAdmin && canalDirs.length) tq = tq.in('canal_direccion', canalDirs);
          const { data } = await tq;
          const totalMes = (data || []).reduce((s: number, r: any) => s + (Number(r.ventas) || 0), 0);
          const metaMes = out.reduce((s, st) => s + st.metaUds, 0);
          tendData.push({ mes, pct: metaMes > 0 ? Math.round((totalMes / metaMes) * 100) : 0 });
        }

        if (!cancelled) {
          setStats(out);
          setTendencia(tendData);
          setLoading(false);
        }
      } catch (err) {
        console.error('[PanelDirector] error', err);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile, isAdmin, isDirector, authLoading, periodoSel, anio, scopeCanales, scopePaises]);

  // Filtros aplicados sobre stats
  const filteredStats = useMemo(() => {
    return stats.filter((s) =>
      (filtroPais === 'TODOS' || s.gerente.pais === filtroPais) &&
      (filtroCanal === 'TODOS' || s.gerente.canal === filtroCanal),
    );
  }, [stats, filtroPais, filtroCanal]);

  const paisesDisponibles = useMemo(
    () => (Array.from(new Set(stats.map((s) => s.gerente.pais).filter(Boolean))) as string[])
      .filter((p) => ['COL', 'MEX', 'ECU', 'URU'].includes(p)),
    [stats],
  );
  const canalesDisponibles = useMemo(
    () => Array.from(new Set(stats.map((s) => s.gerente.canal).filter(Boolean))) as string[],
    [stats],
  );

  // KPIs agregados
  const kpis = useMemo(() => {
    const totalGerentes = filteredStats.length;
    const totalUds = filteredStats.reduce((s, x) => s + x.total, 0);
    const metaUds = filteredStats.reduce((s, x) => s + x.metaUds, 0);
    const totalAcv = filteredStats.reduce((s, x) => s + x.acv, 0);
    const totalFe = filteredStats.reduce((s, x) => s + x.fe, 0);
    const totalNube = filteredStats.reduce((s, x) => s + x.nube, 0);
    const metaFeTot = filteredStats.reduce((s, x) => s + x.metaFe, 0);
    const metaNubeTot = filteredStats.reduce((s, x) => s + x.metaNube, 0);
    const metaAcvTot = filteredStats.reduce((s, x) => s + x.metaAcv, 0);
    const mixNube = (totalFe + totalNube) > 0 ? (totalNube / (totalFe + totalNube)) * 100 : 0;
    const pctUds = metaUds > 0 ? (totalUds / metaUds) * 100 : 0;
    const pctFe = metaFeTot > 0 ? (totalFe / metaFeTot) * 100 : 0;
    const pctNube = metaNubeTot > 0 ? (totalNube / metaNubeTot) * 100 : 0;
    const pctAcv = metaAcvTot > 0 ? (totalAcv / metaAcvTot) * 100 : 0;
    return { totalGerentes, totalUds, metaUds, totalAcv, metaAcvTot, mixNube, pctUds, totalFe, totalNube, metaFeTot, metaNubeTot, pctFe, pctNube, pctAcv };
  }, [filteredStats]);

  // Selector de métrica usado por la tabla de Gerentes (tier counts, filtros y badges)
  const pctByMetric = (s: Stats) => {
    switch (heatmapMetric) {
      case 'FE': return s.pctFe;
      case 'NUBE': return s.pctNube;
      case 'ACV': return s.pctAcv;
      default: return s.pctTotal;
    }
  };

  // Tier counts en sincronía con la gráfica "Gerentes bajo meta":
  // usan la misma métrica (chartMetric), excluyen filas sintéticas y
  // requieren meta > 0 para ser contadas (mismo criterio que la gráfica).
  const tierCounts = useMemo(() => {
    const c: Record<TierKey, number> = { cumple: 0, en_meta: 0, en_riesgo: 0, por_debajo: 0 };
    const pctOf = (s: Stats) =>
      chartMetric === 'FE' ? s.pctFe
        : chartMetric === 'NUBE' ? s.pctNube
        : chartMetric === 'ACV' ? s.pctAcv
        : s.pctTotal;
    const metaOf = (s: Stats) =>
      chartMetric === 'FE' ? s.metaFe
        : chartMetric === 'NUBE' ? s.metaNube
        : chartMetric === 'ACV' ? s.metaAcv
        : s.metaUds;
    const isSynthetic = (s: Stats) =>
      typeof s.gerente.id === 'string' &&
      (s.gerente.id.startsWith('meta-') || s.gerente.id.startsWith('metric-'));
    for (const s of filteredStats) {
      if (isSynthetic(s)) continue;
      if (metaOf(s) <= 0) continue;
      c[tierOf(pctOf(s))]++;
    }
    return c;
  }, [filteredStats, chartMetric]);

  // Heatmap canal × país (% promedio de cumplimiento global - unidades)
  const heatmap = useMemo(() => {
    const canales = Array.from(new Set(filteredStats.map((s) => s.gerente.canal).filter(Boolean))) as string[];
    const paises = Array.from(new Set(filteredStats.map((s) => s.gerente.pais).filter(Boolean))) as string[];
    const cell = (canal: string, pais: string) => {
      const arr = filteredStats.filter((s) => s.gerente.canal === canal && s.gerente.pais === pais);
      if (!arr.length) return null;
      return Math.round(arr.reduce((a, b) => a + b.pctTotal, 0) / arr.length);
    };
    return { canales: canales.sort(), paises: paises.sort(), cell };
  }, [filteredStats]);


  // Tabla: aplica tier (sobre métrica seleccionada) + search + ordena por % desc + pagina
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = filteredStats
      .filter((s) => filtroTier === 'TODOS' || tierOf(pctByMetric(s)) === filtroTier)
      .filter((s) => !q || s.gerente.nombre.toLowerCase().includes(q) || (s.gerente.email || '').toLowerCase().includes(q))
      .sort((a, b) => b.scoreCompuesto - a.scoreCompuesto);
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStats, filtroTier, search, heatmapMetric]);


  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = tableRows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filtroTier, search, filtroCanal, filtroPais, periodoSel]);

  const top3 = useMemo(
    () => [...filteredStats]
      .filter((s) => s.metaUds > 0)
      .sort((a, b) => b.pctTotal - a.pctTotal)
      .slice(0, 3),
    [filteredStats],
  );
  // Plan de choque: gerentes con meta asignada y cumplimiento <50%, ordenados por
  // el % más bajo (los más críticos primero).
  const planChoque = useMemo(
    () => [...filteredStats]
      .filter((s) => !(s.gerente.id.startsWith('meta-') || s.gerente.id.startsWith('metric-')))
      .filter((s) => s.metaUds > 0 && s.pctTotal < 50)
      .sort((a, b) => a.pctTotal - b.pctTotal)
      .slice(0, 5),
    [filteredStats],
  );

  // Razón principal del bajo cumplimiento de un gerente
  const motivoPlanChoque = (s: Stats): string => {
    const gapFe = s.metaFe - s.fe;
    const gapNube = s.metaNube - s.nube;
    const pctFe = s.metaFe > 0 ? (s.fe / s.metaFe) * 100 : 100;
    const pctNube = s.metaNube > 0 ? (s.nube / s.metaNube) * 100 : 100;
    const motivos: string[] = [];
    if (pctFe < 50 && gapFe > 0) motivos.push(`FE ${Math.round(pctFe)}% (faltan ${gapFe})`);
    if (pctNube < 50 && gapNube > 0) motivos.push(`Nube ${Math.round(pctNube)}% (faltan ${gapNube})`);
    if (!motivos.length) motivos.push(`Cumpl. ${s.pctTotal}%`);
    return motivos.join(' · ');
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Skeleton className="h-32 w-64" /></div>;
  }
  if (!isAdmin && !isDirector) return <Navigate to="/dashboard" replace />;

  const overallTier = tierDef(tierOf(kpis.pctUds));
  const totalGer = filteredStats.length;
  const filteredOnlyVc = filteredStats.length > 0 && filteredStats.every((s) => s.gerente.canal === 'VC');
  const fmtKpiValue = (n: number) => filteredOnlyVc ? fmtMoney(n) : n.toLocaleString();
  const fmtMetaLabel = (n: number, suffix: string) => filteredOnlyVc ? fmtMoney(n) : `${n.toLocaleString()} ${suffix}`;



  return (
    <Layout title="📊 Panel Director">
      <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
                {profile?.director_cargo || (isAdmin ? 'Administrador' : 'Director')}
              </p>
              <h1 className="text-3xl font-heading font-bold">Hola, {profile?.nombre}</h1>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(profile?.director_canales || []).map((c) => (
                  <Badge key={c} variant="secondary">{c}</Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Mes</label>
                <Select value={String(periodoSel)} onValueChange={(v) => setPeriodoSel(Number(v))}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {canalesDisponibles.length > 1 && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Canal</label>
                  <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos</SelectItem>
                      {canalesDisponibles.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {paisesDisponibles.length > 1 && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">País</label>
                  <Select value={filtroPais} onValueChange={setFiltroPais}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos</SelectItem>
                      {paisesDisponibles.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* KPI Cards */}
        <div className={`grid grid-cols-2 md:grid-cols-3 ${filteredOnlyVc ? 'lg:grid-cols-3' : 'lg:grid-cols-5'} gap-4`}>
          <Card className="p-5 rounded-2xl">
            <div className="flex items-start justify-between">
              <Users className="text-primary" />
              <Badge className={`${overallTier.bg} ${overallTier.text} ${overallTier.border}`}>{overallTier.label}</Badge>
            </div>
            <p className="text-3xl font-scoreboard font-bold mt-3">{kpis.totalGerentes}</p>
            <p className="text-xs text-muted-foreground mt-1">Gerentes activos</p>
          </Card>
          {!filteredOnlyVc && (
            <Card className="p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                <TrendingUp className="text-accent" />
                <Badge variant="outline">{Math.round(kpis.pctUds)}%</Badge>
              </div>
              <p className="text-3xl font-scoreboard font-bold mt-3">{fmtKpiValue(kpis.totalUds)}</p>
              <p className="text-xs text-muted-foreground mt-1">de {fmtMetaLabel(kpis.metaUds, 'uds')}</p>
            </Card>
          )}
          {!filteredOnlyVc && (
            <Card className="p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                <span className="text-indigo-500 font-bold text-base">FE</span>
                <Badge variant="outline">{Math.round(kpis.pctFe)}%</Badge>
              </div>
              <p className="text-3xl font-scoreboard font-bold mt-3">{kpis.totalFe.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">de {kpis.metaFeTot > 0 ? `${kpis.metaFeTot.toLocaleString()} FE` : '—'}</p>
            </Card>
          )}
          {!filteredOnlyVc && (
            <Card className="p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                <Cloud className="text-sky-500" />
                <Badge variant="outline">{Math.round(kpis.pctNube)}%</Badge>
              </div>
              <p className="text-3xl font-scoreboard font-bold mt-3">{kpis.totalNube.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">de {kpis.metaNubeTot > 0 ? `${kpis.metaNubeTot.toLocaleString()} Nube` : '—'} · Mix {Math.round(kpis.mixNube)}%</p>
            </Card>
          )}
          <Card className="p-5 rounded-2xl">
            <div className="flex items-start justify-between">
              <DollarSign className="text-emerald-500" />
              <Badge variant="outline">{Math.round(kpis.pctAcv)}%</Badge>
            </div>
            <p className="text-3xl font-scoreboard font-bold mt-3">{fmtMoney(kpis.totalAcv)}</p>
            <p className="text-xs text-muted-foreground mt-1">de {fmtMoney(kpis.metaAcvTot)} ACV</p>
          </Card>
          {filteredOnlyVc && (
            <Card className="p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                <Users className="text-accent" />
                <Badge variant="outline">VC</Badge>
              </div>
              <p className="text-3xl font-scoreboard font-bold mt-3">{filteredStats.reduce((s, x) => s + x.asesores, 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Asesores VC</p>
            </Card>
          )}
        </div>



        {/* Resumen ejecutivo: 4 niveles + barra de participación */}
        <Card className="p-6 rounded-2xl">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-bold">Resumen ejecutivo del equipo</h2>
            <p className="text-xs text-muted-foreground">
              Clasificación por desempeño · {tierCounts.cumple + tierCounts.en_meta + tierCounts.en_riesgo + tierCounts.por_debajo} gerentes con meta {chartMetric === 'TOTAL' ? 'Total uds' : chartMetric}{totalGer !== (tierCounts.cumple + tierCounts.en_meta + tierCounts.en_riesgo + tierCounts.por_debajo) ? ` · ${totalGer} gerentes activos en total` : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {TIERS.map((t) => {
              const active = filtroTier === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFiltroTier(active ? 'TODOS' : t.key)}
                  className={`text-left rounded-xl border ${t.border} ${t.bg} p-4 transition hover:scale-[1.01] ${active ? 'ring-2 ring-offset-2 ring-offset-background ring-current ' + t.text : ''}`}
                >
                  <div className={`text-xs font-semibold ${t.text}`}>
                    {t.label} <span className="text-muted-foreground font-normal">· {t.range}</span>
                  </div>
                  <div className={`text-4xl font-scoreboard font-bold mt-2 ${t.text}`}>
                    {tierCounts[t.key]}
                  </div>
                </button>
              );
            })}
          </div>

          {(() => {
            const METRIC_OPTS: { key: typeof chartMetric; label: string }[] = [
              { key: 'FE', label: 'FE' },
              { key: 'NUBE', label: 'Nube' },
              { key: 'TOTAL', label: 'Total uds' },
              { key: 'ACV', label: 'ACV' },
            ];
            const pctOf = (s: Stats) => chartMetric === 'FE' ? s.pctFe
              : chartMetric === 'NUBE' ? s.pctNube
              : chartMetric === 'ACV' ? s.pctAcv
              : s.pctTotal;
            const valOf = (s: Stats) => chartMetric === 'FE' ? s.fe
              : chartMetric === 'NUBE' ? s.nube
              : chartMetric === 'ACV' ? s.acv
              : s.total;
            const metaOf = (s: Stats) => chartMetric === 'FE' ? s.metaFe
              : chartMetric === 'NUBE' ? s.metaNube
              : chartMetric === 'ACV' ? s.metaAcv
              : s.metaUds;
            const fmtVal = (n: number) =>
              chartMetric === 'ACV' ? fmtMoney(n) : Math.round(n).toLocaleString();
            // Excluir filas sintéticas (células con meta pero sin gerente real asignado):
            // sus IDs comienzan con 'meta-' o 'metric-' y muestran el nombre de la célula
            // en lugar del nombre del gerente, además de no tener ventas atribuibles.
            const isSyntheticRow = (s: Stats) =>
              typeof s.gerente.id === 'string' && (s.gerente.id.startsWith('meta-') || s.gerente.id.startsWith('metric-'));
            const rankedAll = filteredStats
              .filter((s) => metaOf(s) > 0)
              .filter((s) => !isSyntheticRow(s))
              .map((s) => ({ s, pct: pctOf(s) }))
              .sort((a, b) => a.pct - b.pct);
            const totalRanked = rankedAll.length;
            const totalPages = Math.max(1, Math.ceil(totalRanked / CHART_PAGE_SIZE));
            const safePage = Math.min(Math.max(1, chartPage), totalPages);
            const pageStart = (safePage - 1) * CHART_PAGE_SIZE;
            const ranked = rankedAll.slice(pageStart, pageStart + CHART_PAGE_SIZE);
            const maxPctSeen = Math.max(100, ...rankedAll.map((r) => r.pct));
            const scale = Math.max(100, Math.ceil(maxPctSeen / 10) * 10);
            const metaLinePct = (100 / scale) * 100;
            // Soft tint + text color per tier for the executive-style gauge badge
            const tierTint = (k: TierKey) => {
              switch (k) {
                case 'cumple': return { ring: 'bg-emerald-50', text: 'text-emerald-600', soft: 'text-emerald-600' };
                case 'en_meta': return { ring: 'bg-sky-50',     text: 'text-sky-600',     soft: 'text-sky-600' };
                case 'en_riesgo': return { ring: 'bg-amber-50', text: 'text-amber-600',   soft: 'text-amber-600' };
                default: return { ring: 'bg-rose-50',           text: 'text-rose-600',    soft: 'text-rose-600' };
              }
            };
            // Axis tick positions (0/25/50/75/100% of meta)
            const axisTicks = [0, 25, 50, 75, 100];
            return (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-foreground tracking-tight">Gerentes bajo meta</h3>
                    <p className="text-sm text-muted-foreground">
                      {totalRanked === 0
                        ? 'Sin gerentes bajo meta'
                        : `${totalRanked} gerentes ordenados por menor cumplimiento`}
                    </p>
                  </div>
                  <div className="flex p-1 bg-muted rounded-full">
                    {METRIC_OPTS.map((m) => {
                      const active = chartMetric === m.key;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setChartMetric(m.key)}
                          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                            active
                              ? 'bg-[#00AAFF] text-white shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chart body */}
                <div className="px-6 pt-5 pb-6">
                  {ranked.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <p className="text-sm font-semibold text-foreground">Sin gerentes bajo meta</p>
                      <p className="text-xs">Ningún gerente con meta asignada para esta métrica.</p>
                    </div>
                  ) : (
                    <>
                      {/* Column header / axis */}
                      <div className="grid grid-cols-12 gap-4 mb-4 items-end">
                        <div className="col-span-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Gerente · Región
                        </div>
                        <div className="col-span-6 relative h-4">
                          <div className="absolute inset-0 flex justify-between text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                            {axisTicks.map((t) => {
                              const isMeta = t === 100;
                              const pos = (t / scale) * 100;
                              return (
                                <span
                                  key={t}
                                  className={`absolute -translate-x-1/2 whitespace-nowrap ${isMeta ? 'text-[#00AAFF]' : ''}`}
                                  style={{ left: `${pos}%` }}
                                >
                                  {isMeta ? '100% META' : `${t}%`}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="col-span-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Avance / Meta
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        {ranked.map(({ s, pct }, idx) => {
                          const t = tierDef(tierOf(pct));
                          const tint = tierTint(t.key);
                          const barPct = Math.min(100, (pct / scale) * 100);
                          const valor = valOf(s);
                          const meta = metaOf(s);
                          const gap = valor - meta;
                          const gapLabel = chartMetric === 'ACV' ? fmtMoney(Math.abs(gap)) : Math.round(Math.abs(gap)).toLocaleString();
                          return (
                            <div key={s.gerente.id} className="grid grid-cols-12 gap-4 items-center group">
                              {/* Name + region */}
                              <div className="col-span-3 flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold text-muted-foreground/60 tabular-nums w-5 shrink-0">
                                  #{pageStart + idx + 1}
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-semibold text-foreground truncate" title={s.gerente.nombre}>
                                    {s.gerente.nombre}
                                  </span>
                                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight truncate">
                                    {s.gerente.canal || '—'} · {s.gerente.pais || '—'}
                                  </span>
                                </div>
                              </div>

                              {/* Bar with axis grid + meta marker */}
                              <div className="col-span-6 relative flex items-center h-8">
                                {/* Grid ticks */}
                                <div className="absolute inset-0 pointer-events-none">
                                  {axisTicks.map((tk) => {
                                    const isMeta = tk === 100;
                                    const pos = (tk / scale) * 100;
                                    return (
                                      <div
                                        key={tk}
                                        className={`absolute top-0 bottom-0 ${isMeta ? 'border-l border-dashed border-[#00AAFF]/60' : 'border-l border-border/60'}`}
                                        style={{ left: `${pos}%` }}
                                      />
                                    );
                                  })}
                                </div>
                                {/* Track */}
                                <div className="relative h-2.5 w-full bg-muted rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${barPct}%` }}
                                    transition={{ duration: 0.7, ease: 'easeOut' }}
                                    className={`h-full ${t.solid} rounded-full`}
                                  />
                                </div>
                              </div>

                              {/* Value / Meta + circular gauge */}
                              <div className="col-span-3 flex items-center justify-end gap-3">
                                <div className="text-right leading-tight">
                                  <div className="text-sm font-bold text-foreground tabular-nums">
                                    {fmtVal(valor)} <span className="text-muted-foreground/50 font-normal mx-0.5">/</span> <span className="text-muted-foreground font-semibold">{fmtVal(meta)}</span>
                                  </div>
                                  <div className={`text-[10px] font-semibold ${tint.soft} tabular-nums`}>
                                    {gap >= 0 ? `+${gapLabel}` : `Brecha: -${gapLabel}`}
                                  </div>
                                </div>
                                <div className={`w-12 h-12 rounded-full ${tint.ring} flex items-center justify-center shrink-0 ring-4 ring-card`}>
                                  <span className={`text-xs font-bold ${tint.text} tabular-nums`}>{pct}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Legend + pagination */}
                <div className="bg-muted/40 px-6 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    {TIERS.map((tt) => (
                      <div key={tt.key} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${tt.solid}`} />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                          {tt.label} · {tt.range}
                        </span>
                      </div>
                    ))}
                  </div>
                  {totalRanked > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                        {pageStart + 1}–{Math.min(pageStart + CHART_PAGE_SIZE, totalRanked)} de {totalRanked}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setChartPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-[#00AAFF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          aria-label="Página anterior"
                        >
                          ‹
                        </button>
                        <span className="text-[11px] font-bold text-foreground tabular-nums px-2">
                          {safePage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setChartPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-[#00AAFF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          aria-label="Página siguiente"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </Card>



        {/* Tabla con filtros rápidos */}
        <Card className="rounded-2xl">
          <div className="p-5 border-b border-border space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-heading text-lg font-bold">Gerentes</h2>
                <p className="text-xs text-muted-foreground">
                  {tableRows.length} resultados · ordenados por % cumplimiento
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={heatmapMetric} onValueChange={(v) => setHeatmapMetric(v as typeof heatmapMetric)}>
                  <SelectTrigger className="h-9 w-[170px]">
                    <SelectValue placeholder="Métrica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOTAL">Total unidades</SelectItem>
                    <SelectItem value="FE">FE</SelectItem>
                    <SelectItem value="NUBE">Nube</SelectItem>
                    <SelectItem value="ACV">ACV</SelectItem>
                  </SelectContent>
                </Select>
                {TIERS.map((t) => {
                  const active = filtroTier === t.key;
                  return (
                    <Button
                      key={t.key}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFiltroTier(active ? 'TODOS' : t.key)}
                      className="gap-1.5"
                    >
                      <span className={`inline-block w-2.5 h-2.5 rounded ${t.solid}`} />
                      {t.label}
                      <span className="text-xs opacity-70">({tierCounts[t.key]})</span>
                    </Button>
                  );
                })}
                {filtroTier !== 'TODOS' && (
                  <Button variant="ghost" size="sm" onClick={() => setFiltroTier('TODOS')}>
                    Limpiar
                  </Button>
                )}
              </div>
            </div>

            {(filtroCanal !== 'TODOS' || filtroPais !== 'TODOS') && (
              <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                <span className="text-xs text-muted-foreground">Filtros aplicados desde el heatmap:</span>
                {filtroCanal !== 'TODOS' && (
                  <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                    Canal: {filtroCanal}
                    <button onClick={() => setFiltroCanal('TODOS')} className="hover:bg-muted rounded-full w-4 h-4 inline-flex items-center justify-center text-xs">×</button>
                  </Badge>
                )}
                {filtroPais !== 'TODOS' && (
                  <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                    País: {filtroPais}
                    <button onClick={() => setFiltroPais('TODOS')} className="hover:bg-muted rounded-full w-4 h-4 inline-flex items-center justify-center text-xs">×</button>
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setFiltroCanal('TODOS'); setFiltroPais('TODOS'); }} className="h-7 text-xs ml-auto">
                  Ver todos los países y canales
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_160px] gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar gerente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {paisesDisponibles.length > 1 && (
                <Select value={filtroPais} onValueChange={setFiltroPais}>
                  <SelectTrigger><SelectValue placeholder="País" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos los países</SelectItem>
                    {paisesDisponibles.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={String(periodoSel)} onValueChange={(v) => setPeriodoSel(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gerente</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>País</TableHead>
                  
                  {!filteredOnlyVc && <TableHead className="text-right">FE</TableHead>}
                  {!filteredOnlyVc && <TableHead className="text-right">Nube</TableHead>}
                  <TableHead className="text-right">ACV</TableHead>
                  {!filteredOnlyVc && <TableHead className="text-right">% FE</TableHead>}
                  {!filteredOnlyVc && <TableHead className="text-right">% Nube</TableHead>}
                  <TableHead className="text-right">% ACV</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-8 text-muted-foreground">Sin resultados con los filtros aplicados.</TableCell></TableRow>
                ) : pageRows.map((s) => {
                  const t = tierDef(tierOf(s.pctTotal));
                  const isVcRow = s.gerente.canal === 'VC';
                  // VC: FE/Nube son CANTIDAD de productos (unidades). ACV sigue siendo monto.
                  const metricValue = (value: number) => isVcRow ? value.toLocaleString() : value.toLocaleString();

                  const pctColor = (p: number) =>
                    p >= 100 ? 'text-emerald-600' : p >= 80 ? 'text-amber-600' : p >= 50 ? 'text-orange-600' : 'text-rose-600';
                  const scoreVariant: 'default' | 'secondary' | 'destructive' =
                    s.scoreCompuesto >= 100 ? 'default' : s.scoreCompuesto >= 80 ? 'secondary' : 'destructive';
                  return (
                    <TableRow key={s.gerente.id}>
                      <TableCell className="font-medium">{s.gerente.nombre}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s.gerente.canal}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{s.gerente.pais}</Badge></TableCell>
                      
                      {!filteredOnlyVc && <TableCell className="text-right">{metricValue(s.fe)} <span className="text-xs text-muted-foreground">/ {s.metaFe > 0 ? metricValue(s.metaFe) : '—'}</span></TableCell>}
                      {!filteredOnlyVc && <TableCell className="text-right">{metricValue(s.nube)} <span className="text-xs text-muted-foreground">/ {s.metaNube > 0 ? metricValue(s.metaNube) : '—'}</span></TableCell>}
                      <TableCell className="text-right">{fmtMoney(s.acv)} <span className="text-xs text-muted-foreground">/ {s.metaAcv > 0 ? fmtMoney(s.metaAcv) : '—'}</span></TableCell>
                      {!filteredOnlyVc && <TableCell className={`text-right font-semibold ${s.metaFe > 0 ? pctColor(s.pctFe) : 'text-muted-foreground'}`}>{s.metaFe > 0 ? `${s.pctFe}%` : '—'}</TableCell>}
                      {!filteredOnlyVc && <TableCell className={`text-right font-semibold ${s.metaNube > 0 ? pctColor(s.pctNube) : 'text-muted-foreground'}`}>{s.metaNube > 0 ? `${s.pctNube}%` : '—'}</TableCell>}
                      <TableCell className={`text-right font-semibold ${s.metaUds > 0 ? pctColor(s.pctAcv) : 'text-muted-foreground'}`}>{s.metaUds > 0 ? `${s.pctAcv}%` : '—'}</TableCell>
                      <TableCell>
                        <Badge className={`${t.bg} ${t.text} ${t.border}`}>
                          <span className={`inline-block w-2 h-2 rounded-full ${t.solid} mr-1.5`} />
                          {t.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}

              </TableBody>
            </Table>
          </div>

          {tableRows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Página {pageSafe} de {totalPages} · {tableRows.length} gerentes
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Top 3 + Plan de choque */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5 rounded-2xl">
            <h3 className="font-heading text-lg font-bold mb-1 flex items-center gap-2">
              <Trophy className="text-amber-500" /> Top 3 del mes
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Mayor % de cumplimiento ACV — FE + Nube</p>
            <div className="space-y-2">
              {top3.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Sin gerentes con meta asignada este mes.</p>
              )}
              {top3.map((s, i) => {
                const t = tierDef(tierOf(s.pctTotal));
                return (
                  <div key={s.gerente.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-gradient-to-r from-amber-50/60 to-transparent dark:from-amber-950/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl">{['🥇','🥈','🥉'][i]}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{s.gerente.nombre}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {s.gerente.canal} · {s.gerente.pais} · FE {s.fe}/{s.metaFe} · Nube {s.nube}/{s.metaNube}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xl font-scoreboard font-bold ${t.text}`}>{s.pctTotal}%</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 rounded-2xl">
            <h3 className="font-heading text-lg font-bold mb-1 flex items-center gap-2">
              <AlertTriangle className="text-rose-500" /> Plan de choque
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Gerentes con cumplimiento &lt;50%. Datos: <span className="font-semibold">metas_acv_gerentes</span> + <span className="font-semibold">vn_metricas_optimizadas</span> (ventas diarias).
            </p>
            <div className="space-y-2">
              {planChoque.length === 0 && (
                <p className="text-sm text-emerald-600 flex items-center gap-1">✅ Ningún gerente bajo el 50% este mes.</p>
              )}
              {planChoque.map((s) => {
                const t = tierDef(tierOf(s.pctTotal));
                return (
                  <div key={s.gerente.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{s.gerente.nombre}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {s.gerente.canal} · {s.gerente.pais} · {s.asesores} asesores
                      </p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 font-medium">
                        ⚠ {motivoPlanChoque(s)}
                      </p>
                    </div>
                    <span className={`text-xl font-scoreboard font-bold ${t.text}`}>{s.pctTotal}%</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Tendencia */}
        <Card className="p-5 rounded-2xl">
          <h3 className="font-heading text-lg font-bold mb-4">Tendencia (últimos 6 meses)</h3>
          <div className="space-y-2">
            {tendencia.map((tn) => {
              const t = tierDef(tierOf(tn.pct));
              return (
                <div key={tn.mes} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-muted-foreground">{MESES[tn.mes - 1]}</span>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(tn.pct, 100)}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full ${t.solid}`}
                    />
                  </div>
                  <span className={`w-12 text-right text-sm font-bold ${t.text}`}>{tn.pct}%</span>
                </div>
              );
            })}
          </div>
        </Card>

      </div>
    </Layout>
  );
};

export default PanelDirector;
