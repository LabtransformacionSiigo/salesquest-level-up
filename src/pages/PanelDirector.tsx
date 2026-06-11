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
        let gq = supabase.from('gerentes')
          .select('id, nombre, email, canal, pais, celula, user_id')
          .eq('activo', true);
        if (!isAdmin) {
          if (scopeCanales.length) gq = gq.in('canal', scopeCanales);
          if (scopePaises.length) gq = gq.in('pais', scopePaises);
        }
        const { data: gerentes = [] } = await gq;
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
          const { data: ases } = await supabase
            .from('asesores')
            .select('gerente_id')
            .in('gerente_id', gerenteIds)
            .eq('activo', true);
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
          let allCelQuery = supabase
            .from('gerentes')
            .select('celula, canal, pais')
            .in('celula', celulasInScope)
            .eq('activo', true);
          if (!isAdmin && scopeCanales.length) allCelQuery = allCelQuery.in('canal', scopeCanales);
          if (!isAdmin && scopePaises.length) allCelQuery = allCelQuery.in('pais', scopePaises);
          const { data: allCel } = await allCelQuery;
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

        // 3) Métricas VN — respetar scope de canales del director
        const vnCanales = (scopeCanales.length ? scopeCanales : ['VN_ALIADOS', 'VN_EMPRESARIOS', 'VC'])
          .filter((c) => c.startsWith('VN'));
        // Mapear canal interno → canal_direccion en vn_metricas_optimizadas
        const canalDirMap: Record<string, string> = {
          VN_ALIADOS: 'Aliados',
          VN_EMPRESARIOS: 'Empresarios',
        };
        const canalDirs = vnCanales.map((c) => canalDirMap[c]).filter(Boolean);
        let metricas: any[] = [];
        if (vnCanales.length || isAdmin) {
          let mq = supabase
            .from('vn_metricas_optimizadas' as any)
            .select('pais, mes_nro, canal_direccion, gerente, gerente_normalizado, tipo_producto1, ventas, acv_total')
            .eq('scope', 'gerente')
            .eq('anio', anio)
            .eq('mes_nro', periodoSel);
          if (!isAdmin && scopePaises.length) mq = mq.in('pais', scopePaises);
          if (!isAdmin && canalDirs.length) mq = mq.in('canal_direccion', canalDirs);
          const { data } = await mq;
          metricas = data || [];
        }

        // 4) SP acumulado mes actual
        const periodoYYYYMM = `${anio}${String(periodoSel).padStart(2, '0')}`;
        const spMap = new Map<string, number>();
        if (gerenteIds.length) {
          const { data: spData } = await supabase
            .from('sp_acumulados')
            .select('gerente_id, sp')
            .eq('periodo', periodoYYYYMM)
            .in('gerente_id', gerenteIds);
          (spData || []).forEach((r: any) => {
            spMap.set(r.gerente_id, (spMap.get(r.gerente_id) || 0) + (r.sp || 0));
          });
        }

        // 5) Rachas
        const rachaMap = new Map<string, number>();
        if (gerenteIds.length) {
          const [rvc, rvn] = await Promise.all([
            supabase.from('rachas').select('gerente_id, semanas_consecutivas')
              .in('gerente_id', gerenteIds)
              .order('semanas_consecutivas', { ascending: false }),
            supabase.from('rachas_vn_estado').select('gerente_id, dias_o_semanas_consecutivas, racha_activa')
              .in('gerente_id', gerenteIds)
              .eq('racha_activa', true),
          ]);
          (rvc.data || []).forEach((r: any) => {
            const cur = rachaMap.get(r.gerente_id) || 0;
            rachaMap.set(r.gerente_id, Math.max(cur, r.semanas_consecutivas || 0));
          });
          (rvn.data || []).forEach((r: any) => {
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

          const { data: metas } = await metasQuery;
          (metas || []).forEach((m: any) => {
            const cel = normalize(m.celula);
            if (!cel) return;
            const key = celulaScopeKey(m.celula, m.canal, m.pais);
            if (!isAdmin && isDirector && !isSeniorDirector && allowedCelulaKeys.size > 0 && !allowedCelulaKeys.has(key)) return;
            metasRows.push(m);
            validCelulasMes.add(key);
            metasMap.set(key, {
              fe: m.meta_fe || 0,
              nube: m.meta_nube || 0,
              totalUds: m.meta_total_und || 0,
              acv: Number(m.meta_total_acv) || 0,
            });
          });

        }

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
          const tp = String(m.tipo_producto1 || '').toUpperCase();
          if (tp === 'FE') cur.fe += v;
          else if (tp === 'NUBE') cur.nube += v;
          cur.total += v;
          cur.acv += Number(m.acv_total) || 0;
          cur.pais = cur.pais || m.pais;
          aggByLeader.set(key, cur);
        }

        const gByName = new Map<string, GerenteRow[]>();
        for (const g of gerentesList) {
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
          const matches = gerentesList.filter((g) => celulaScopeKey(g.celula, g.canal, g.pais) === key);
          return pickVnLeaderCandidate(matches, {
            celula: matches[0]?.celula,
            excludeIds: usedIds,
          });
        };
        for (const metaRow of metasRows) {
          const celKey = celulaScopeKey(metaRow.celula, metaRow.canal, metaRow.pais);
          if (seenCelulas.has(celKey)) continue;
          const g = pickGerenteByCelula(celKey);
          const asesoresCount = g ? (asesoresMap.get(g.id) || 0) : 0;
          seenCelulas.add(celKey);
          if (g) usedIds.add(g.id);
          const meta = metasMap.get(celKey);
          const metaFe = meta ? meta.fe : asesoresCount * 2;
          const metaNube = meta ? meta.nube : asesoresCount * 1;
          const metaTotal = meta ? meta.totalUds : metaFe + metaNube;
          const gerente: GerenteRow = g || {
            id: `meta-${celKey}`,
            nombre: metaRow.celula || 'Gerente sin asignar',
            email: '',
            canal: metaRow.canal || null,
            pais: normalizePaisCode(metaRow.pais),
            celula: metaRow.celula || null,
          };
          out.push({
            gerente,
            asesores: asesoresCount,
            fe: 0, nube: 0, total: 0, acv: 0,
            metaFe, metaNube, metaUds: metaTotal,
            metaAcv: meta ? meta.acv : 0,
            pctFe: 0, pctNube: 0, pctAcv: 0, pctTotal: 0,
            pacing: 0, scoreCompuesto: 0,
            productividad: 0, ventasPorAsesor: 0,
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

  // Conteo por tier
  const tierCounts = useMemo(() => {
    const c: Record<TierKey, number> = { cumple: 0, en_meta: 0, en_riesgo: 0, por_debajo: 0 };
    for (const s of filteredStats) c[tierOf(s.pctTotal)]++;
    return c;
  }, [filteredStats]);

  // Heatmap canal × país (% promedio de cumplimiento)
  const heatmap = useMemo(() => {
    const canales = Array.from(new Set(filteredStats.map((s) => s.gerente.canal).filter(Boolean))) as string[];
    const paises = Array.from(new Set(filteredStats.map((s) => s.gerente.pais).filter(Boolean))) as string[];
    const pctOf = (s: Stats) => {
      switch (heatmapMetric) {
        case 'FE': return s.pctFe;
        case 'NUBE': return s.pctNube;
        case 'ACV': return s.pctAcv;
        default: return s.pctTotal;
      }
    };
    const cell = (canal: string, pais: string) => {
      const arr = filteredStats.filter((s) => s.gerente.canal === canal && s.gerente.pais === pais);
      if (!arr.length) return null;
      return Math.round(arr.reduce((a, b) => a + pctOf(b), 0) / arr.length);
    };
    return { canales: canales.sort(), paises: paises.sort(), cell };
  }, [filteredStats, heatmapMetric]);


  // Tabla: aplica tier + search + ordena por % desc + pagina
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = filteredStats
      .filter((s) => filtroTier === 'TODOS' || tierOf(s.pctTotal) === filtroTier)
      .filter((s) => !q || s.gerente.nombre.toLowerCase().includes(q) || (s.gerente.email || '').toLowerCase().includes(q))
      .sort((a, b) => b.scoreCompuesto - a.scoreCompuesto);
    return rows;
  }, [filteredStats, filtroTier, search]);

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
              Clasificación por desempeño · {totalGer} gerentes activos
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

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Participación de cada segmento</p>
              <p className="text-xs text-muted-foreground">Total: {totalGer} gerentes</p>
            </div>
            <div className="flex h-10 w-full overflow-hidden rounded-lg">
              {TIERS.map((t) => {
                const pct = totalGer ? (tierCounts[t.key] / totalGer) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <motion.div
                    key={t.key}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7 }}
                    className={`${t.solid} flex items-center justify-center text-xs font-bold text-white`}
                    title={`${t.label}: ${tierCounts[t.key]} (${pct.toFixed(0)}%)`}
                  >
                    {pct >= 6 ? `${pct.toFixed(0)}%` : ''}
                  </motion.div>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2 text-center text-xs text-muted-foreground">
              {TIERS.map((t) => <span key={t.key}>{t.label}</span>)}
            </div>
          </div>
        </Card>

        {/* Heatmap canal × país */}
        {heatmap.canales.length > 0 && heatmap.paises.length > 0 && (
          <Card className="p-6 rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3 flex-wrap">
                <div>
                  <h2 className="font-heading text-lg font-bold">Cumplimiento por canal y país</h2>
                  <p className="text-xs text-muted-foreground">Cada celda: % promedio · click para filtrar</p>
                </div>
                <Select value={heatmapMetric} onValueChange={(v) => setHeatmapMetric(v as typeof heatmapMetric)}>
                  <SelectTrigger className="h-9 w-[180px]">
                    <SelectValue placeholder="Métrica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOTAL">Total unidades</SelectItem>
                    <SelectItem value="FE">FE</SelectItem>
                    <SelectItem value="NUBE">Nube</SelectItem>
                    <SelectItem value="ACV">ACV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(filtroCanal !== 'TODOS' || filtroPais !== 'TODOS') && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Filtro activo:</span>
                  {filtroCanal !== 'TODOS' && (
                    <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                      {filtroCanal}
                      <button onClick={() => setFiltroCanal('TODOS')} className="hover:bg-muted rounded-full w-4 h-4 inline-flex items-center justify-center text-xs">×</button>
                    </Badge>
                  )}
                  {filtroPais !== 'TODOS' && (
                    <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                      {filtroPais}
                      <button onClick={() => setFiltroPais('TODOS')} className="hover:bg-muted rounded-full w-4 h-4 inline-flex items-center justify-center text-xs">×</button>
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setFiltroCanal('TODOS'); setFiltroPais('TODOS'); }} className="h-7 text-xs">
                    Ver todos
                  </Button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-2">
                <thead>
                  <tr>
                    <th></th>
                    {heatmap.paises.map((p) => (
                      <th key={p} className="text-sm font-semibold text-muted-foreground px-2">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.canales.map((c) => (
                    <tr key={c}>
                      <th className="text-left text-sm font-semibold pr-4 py-1 text-foreground/90 whitespace-nowrap">{c}</th>
                      {heatmap.paises.map((p) => {
                        const val = heatmap.cell(c, p);
                        if (val === null) {
                          return (
                            <td key={p} className="px-1">
                              <div className="h-11 rounded-full bg-muted/40 border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">—</div>
                            </td>
                          );
                        }
                        const t = tierDef(tierOf(val));
                        return (
                          <td key={p} className="px-1">
                            <button
                              type="button"
                              onClick={() => { setFiltroCanal(c); setFiltroPais(p); }}
                              className={`${t.solid} w-full h-11 rounded-full text-white font-bold text-base hover:opacity-90 hover:scale-[1.02] transition shadow-sm`}
                              title={`${c} · ${p}: ${val}% — ${t.label}`}
                            >
                              {val}%
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-4 justify-center mt-5 text-xs">
                {TIERS.map((t) => (
                  <span key={t.key} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`inline-block w-3 h-3 rounded-full ${t.solid}`} />
                    <span className="font-medium text-foreground/80">{t.label}</span> · {t.range}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        )}

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
              <div className="flex flex-wrap gap-2">
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
                  <TableHead className="text-right">Asesores</TableHead>
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
                      <TableCell className="text-right font-scoreboard">{s.asesores}</TableCell>
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
