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

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];


const normalize = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

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
  metaAcv: number;
  pctTotal: number;
  sp: number;
  racha: number;
  daily: number[]; // últimos 7 días: unidades vendidas
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
    () => (isAdmin ? [] : (profile?.director_paises || [])),
    [isAdmin, profile?.director_paises],
  );

  useEffect(() => {
    if (authLoading || !profile) return;
    if (!isAdmin && !isDirector) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // 1) Gerentes en scope
        let gq = supabase.from('gerentes')
          .select('id, nombre, email, canal, pais, celula')
          .eq('activo', true);
        if (!isAdmin) {
          if (scopeCanales.length) gq = gq.in('canal', scopeCanales);
          if (scopePaises.length) gq = gq.in('pais', scopePaises);
        }
        const { data: gerentes = [] } = await gq;
        const gerentesList = (gerentes || []) as GerenteRow[];

        // 2) Asesores count por gerente
        const gerenteIds = gerentesList.map((g) => g.id);
        const asesoresMap = new Map<string, number>();
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

        // 3) Métricas VN — restringidas por país Y canal del director (evita leak VN_ALIADOS↔VN_EMPRESARIOS)
        let metricas: any[] = [];
        {
          let mq = supabase
            .from('vn_metricas_optimizadas' as any)
            .select('pais, mes_nro, canal_direccion, gerente, gerente_normalizado, tipo_producto1, ventas, acv_total')
            .eq('scope', 'gerente')
            .eq('anio', anio)
            .eq('mes_nro', periodoSel);
          if (!isAdmin) {
            if (scopePaises.length) mq = mq.in('pais', scopePaises);
            if (scopeCanales.length) mq = mq.in('canal_direccion', scopeCanales);
          }
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
        const metasMap = new Map<string, { fe: number; nube: number; acv: number }>();
        {
          const { data: metas } = await supabase
            .from('metas_acv_gerentes')
            .select('celula, meta_fe, meta_nube, meta_total_acv')
            .eq('mes', mesAbr);
          (metas || []).forEach((m: any) => {
            const cel = normalize(m.celula);
            if (!cel) return;
            metasMap.set(cel, {
              fe: m.meta_fe || 0,
              nube: m.meta_nube || 0,
              acv: Number(m.meta_total_acv) || 0,
            });
          });
        }

        // 6b) Ventas diarias de los últimos 7 días por gerente
        const dailyMap = new Map<string, number[]>();
        const today = new Date();
        const days: string[] = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() - (6 - i));
          return d.toISOString().slice(0, 10);
        });
        if (gerenteIds.length) {
          const fromDate = days[0];
          const { data: vts } = await supabase
            .from('ventas')
            .select('gerente_id, fecha_facturacion')
            .in('gerente_id', gerenteIds)
            .gte('fecha_facturacion', fromDate)
            .lte('fecha_facturacion', days[6]);
          const idx = new Map(days.map((d, i) => [d, i] as const));
          (vts || []).forEach((v: any) => {
            if (!v.gerente_id || !v.fecha_facturacion) return;
            const dayKey = String(v.fecha_facturacion).slice(0, 10);
            const i = idx.get(dayKey);
            if (i === undefined) return;
            const arr = dailyMap.get(v.gerente_id) || Array(7).fill(0);
            arr[i] += 1;
            dailyMap.set(v.gerente_id, arr);
          });
        }

        // 7) Construir stats por LÍDER REAL agrupando vn_metricas por gerente_normalizado.
        // Esto arregla COL/ECU (antes el matching por primer nombre fallaba contra los 1500+
        // registros de la tabla `gerentes`).
        type Agg = { fe: number; nube: number; total: number; acv: number; pais: string | null; canal: string | null };
        const aggByLeader = new Map<string, Agg>();
        for (const m of metricas) {
          const key = normalize(m.gerente_normalizado || m.gerente || '');
          if (!key) continue;
          const cur = aggByLeader.get(key) || { fe: 0, nube: 0, total: 0, acv: 0, pais: m.pais || null, canal: m.canal_direccion || null };
          const v = Number(m.ventas) || 0;
          const tp = String(m.tipo_producto1 || '').toUpperCase();
          if (tp === 'FE') cur.fe += v;
          else if (tp === 'NUBE') cur.nube += v;
          cur.total += v;
          cur.acv += Number(m.acv_total) || 0;
          cur.pais = cur.pais || m.pais;
          cur.canal = cur.canal || m.canal_direccion;
          aggByLeader.set(key, cur);
        }

        // Index de gerentes por nombre normalizado. Excluimos stubs (1 sola palabra y sin celula)
        // para que un registro residual "Angel" no pise a "Angel Alfonso Arciniegas Guerrero".
        const gByName = new Map<string, GerenteRow[]>();
        for (const g of gerentesList) {
          const k = normalize(g.nombre);
          if (!k) continue;
          const isStub = k.split(/\s+/).length < 2 && !g.celula;
          if (isStub) continue;
          gByName.set(k, [...(gByName.get(k) || []), g]);
        }
        const findGerente = (leaderKey: string, paisHint: string | null, canalHint: string | null): GerenteRow | null => {
          const pick = (arr: GerenteRow[]) =>
            arr.find((g) => (!paisHint || g.pais === paisHint) && (!canalHint || g.canal === canalHint)) ||
            arr.find((g) => !paisHint || g.pais === paisHint) ||
            arr[0];
          const exact = gByName.get(leaderKey);
          if (exact && exact.length) return pick(exact);
          // startsWith con mínimo de 2 palabras a cada lado
          const leaderWords = leaderKey.split(/\s+/).length;
          if (leaderWords < 2) return null;
          for (const [k, arr] of gByName) {
            if (k.split(/\s+/).length < 2) continue;
            if (k.startsWith(leaderKey) || leaderKey.startsWith(k)) {
              return pick(arr);
            }
          }
          return null;
        };

        const out: Stats[] = [];
        const usedIds = new Set<string>();
        for (const [leaderKey, agg] of aggByLeader) {
          const g = findGerente(leaderKey, agg.pais, agg.canal);
          const gerente: GerenteRow = g || {
            id: `metric-${leaderKey}`,
            nombre: leaderKey.replace(/\b\w/g, (c) => c.toUpperCase()),
            email: '',
            canal: agg.canal,
            pais: agg.pais,
            celula: null,
          };
          if (g) usedIds.add(g.id);
          const meta = metasMap.get(normalize(gerente.celula || ''));
          const asesoresCount = g ? (asesoresMap.get(g.id) || 0) : 0;
          const metaFe = meta?.fe || asesoresCount * 2;
          const metaNube = meta?.nube || asesoresCount * 1;
          const metaTotal = metaFe + metaNube;
          const pctTotal = metaTotal > 0 ? (agg.total / metaTotal) * 100 : 0;
          out.push({
            gerente,
            asesores: asesoresCount,
            fe: Math.round(agg.fe),
            nube: Math.round(agg.nube),
            total: Math.round(agg.total),
            acv: Math.round(agg.acv),
            metaFe,
            metaNube,
            metaAcv: meta?.acv || 0,
            pctTotal: Math.round(pctTotal),
            sp: g ? (spMap.get(g.id) || 0) : 0,
            racha: g ? (rachaMap.get(g.id) || 0) : 0,
            daily: (g && dailyMap.get(g.id)) || Array(7).fill(0),
          });
        }
        // Sumar líderes con asesores asignados pero sin métrica este mes
        for (const g of gerentesList) {
          if (usedIds.has(g.id)) continue;
          const asesoresCount = asesoresMap.get(g.id) || 0;
          if (asesoresCount === 0) continue;
          const meta = metasMap.get(normalize(g.celula || ''));
          const metaFe = meta?.fe || asesoresCount * 2;
          const metaNube = meta?.nube || asesoresCount * 1;
          out.push({
            gerente: g,
            asesores: asesoresCount,
            fe: 0, nube: 0, total: 0, acv: 0,
            metaFe, metaNube,
            metaAcv: meta?.acv || 0,
            pctTotal: 0,
            sp: spMap.get(g.id) || 0,
            racha: rachaMap.get(g.id) || 0,
            daily: dailyMap.get(g.id) || Array(7).fill(0),
          });
        }

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
          const { data } = await tq;
          const totalMes = (data || []).reduce((s: number, r: any) => s + (Number(r.ventas) || 0), 0);
          const metaMes = out.reduce((s, st) => s + st.metaFe + st.metaNube, 0);
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
    () => Array.from(new Set(stats.map((s) => s.gerente.pais).filter(Boolean))) as string[],
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
    const metaUds = filteredStats.reduce((s, x) => s + x.metaFe + x.metaNube, 0);
    const totalAcv = filteredStats.reduce((s, x) => s + x.acv, 0);
    const totalFe = filteredStats.reduce((s, x) => s + x.fe, 0);
    const totalNube = filteredStats.reduce((s, x) => s + x.nube, 0);
    const mixNube = (totalFe + totalNube) > 0 ? (totalNube / (totalFe + totalNube)) * 100 : 0;
    const pctUds = metaUds > 0 ? (totalUds / metaUds) * 100 : 0;
    return { totalGerentes, totalUds, metaUds, totalAcv, mixNube, pctUds };
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
    const cell = (canal: string, pais: string) => {
      const arr = filteredStats.filter((s) => s.gerente.canal === canal && s.gerente.pais === pais);
      if (!arr.length) return null;
      return Math.round(arr.reduce((a, b) => a + b.pctTotal, 0) / arr.length);
    };
    return { canales: canales.sort(), paises: paises.sort(), cell };
  }, [filteredStats]);

  // Tabla: aplica tier + search + ordena por % desc + pagina
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = filteredStats
      .filter((s) => filtroTier === 'TODOS' || tierOf(s.pctTotal) === filtroTier)
      .filter((s) => !q || s.gerente.nombre.toLowerCase().includes(q) || (s.gerente.email || '').toLowerCase().includes(q))
      .sort((a, b) => b.pctTotal - a.pctTotal);
    return rows;
  }, [filteredStats, filtroTier, search]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = tableRows.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filtroTier, search, filtroCanal, filtroPais, periodoSel]);

  const top3 = useMemo(
    () => [...filteredStats].sort((a, b) => b.pctTotal - a.pctTotal).slice(0, 3),
    [filteredStats],
  );
  const planChoque = useMemo(
    () => [...filteredStats].sort((a, b) => a.pctTotal - b.pctTotal).slice(0, 3),
    [filteredStats],
  );

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Skeleton className="h-32 w-64" /></div>;
  }
  if (!isAdmin && !isDirector) return <Navigate to="/dashboard" replace />;

  const overallTier = tierDef(tierOf(kpis.pctUds));
  const totalGer = filteredStats.length;



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
                {(profile?.director_paises || []).map((p) => (
                  <Badge key={p} variant="outline">{p}</Badge>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 rounded-2xl">
            <div className="flex items-start justify-between">
              <Users className="text-primary" />
              <Badge className={`${overallTier.bg} ${overallTier.text} ${overallTier.border}`}>{overallTier.label}</Badge>
            </div>
            <p className="text-3xl font-scoreboard font-bold mt-3">{kpis.totalGerentes}</p>
            <p className="text-xs text-muted-foreground mt-1">Gerentes activos</p>
          </Card>
          <Card className="p-5 rounded-2xl">
            <div className="flex items-start justify-between">
              <TrendingUp className="text-accent" />
              <Badge variant="outline">{Math.round(kpis.pctUds)}%</Badge>
            </div>
            <p className="text-3xl font-scoreboard font-bold mt-3">{kpis.totalUds.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">de {kpis.metaUds.toLocaleString()} uds</p>
          </Card>
          <Card className="p-5 rounded-2xl">
            <div className="flex items-start justify-between">
              <DollarSign className="text-emerald-500" />
            </div>
            <p className="text-3xl font-scoreboard font-bold mt-3">{fmtMoney(kpis.totalAcv)}</p>
            <p className="text-xs text-muted-foreground mt-1">ACV total</p>
          </Card>
          <Card className="p-5 rounded-2xl">
            <div className="flex items-start justify-between">
              <Cloud className="text-sky-500" />
            </div>
            <p className="text-3xl font-scoreboard font-bold mt-3">{Math.round(kpis.mixNube)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Mix Nube</p>
          </Card>
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
            <div className="mb-4">
              <h2 className="font-heading text-lg font-bold">Cumplimiento por canal y país</h2>
              <p className="text-xs text-muted-foreground">Cada celda: % promedio · click para filtrar</p>
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

            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar gerente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filtroPais} onValueChange={setFiltroPais}>
                <SelectTrigger><SelectValue placeholder="Todos los países" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los países</SelectItem>
                  {paisesDisponibles.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                <SelectTrigger><SelectValue placeholder="Todos los canales" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los canales</SelectItem>
                  {canalesDisponibles.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                  <TableHead className="text-right">FE</TableHead>
                  <TableHead className="text-right">Nube</TableHead>
                  <TableHead className="text-right">ACV</TableHead>
                  <TableHead className="text-right">⚡ SP</TableHead>
                  <TableHead className="text-right">🔥 Racha</TableHead>
                  <TableHead className="text-center">Últ. 7 días</TableHead>
                  <TableHead className="text-right">% Cumpl.</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Sin resultados con los filtros aplicados.</TableCell></TableRow>
                ) : pageRows.map((s) => {
                  const t = tierDef(tierOf(s.pctTotal));
                  const dailyMax = Math.max(1, ...s.daily);
                  const dailySum = s.daily.reduce((a, b) => a + b, 0);
                  return (
                    <TableRow key={s.gerente.id}>
                      <TableCell className="font-medium">{s.gerente.nombre}</TableCell>
                      <TableCell>{s.gerente.canal ? <Badge variant="outline" className="text-xs">{s.gerente.canal}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{s.gerente.pais}</Badge></TableCell>
                      <TableCell className="text-right">{s.asesores}</TableCell>
                      <TableCell className="text-right">{s.fe} <span className="text-xs text-muted-foreground">/ {s.metaFe}</span></TableCell>
                      <TableCell className="text-right">{s.nube} <span className="text-xs text-muted-foreground">/ {s.metaNube}</span></TableCell>
                      <TableCell className="text-right">{fmtMoney(s.acv)}</TableCell>
                      <TableCell className="text-right font-scoreboard">{s.sp.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{s.racha > 0 ? `${s.racha}🔥` : '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-end justify-center gap-0.5 h-8" title={`Total 7d: ${dailySum} uds`}>
                          {s.daily.map((v, i) => (
                            <div
                              key={i}
                              className={`w-1.5 rounded-sm ${v > 0 ? t.solid : 'bg-muted'}`}
                              style={{ height: `${Math.max(10, (v / dailyMax) * 100)}%` }}
                              title={`Día -${6 - i}: ${v} uds`}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] text-center text-muted-foreground mt-0.5">{dailySum} uds</p>
                      </TableCell>
                      <TableCell className={`text-right font-bold ${t.text}`}>{s.pctTotal}%</TableCell>
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
        <Card className="p-5 rounded-2xl">
          <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="text-amber-500" /> Top 3 & Plan de choque
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              {top3.map((s, i) => (
                <div key={s.gerente.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{['🥇','🥈','🥉'][i]}</span>
                    <span className="font-medium text-sm">{s.gerente.nombre}</span>
                  </span>
                  <span className="font-bold text-emerald-600">{s.pctTotal}%</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-500" /> Requieren plan de choque
              </p>
              <div className="flex flex-wrap gap-1.5">
                {planChoque.map((s) => (
                  <Badge key={s.gerente.id} className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                    {s.gerente.nombre.split(' ')[0]} · {s.pctTotal}%
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

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
