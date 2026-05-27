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

        // 3) Métricas VN
        const vnCanales = (scopeCanales.length ? scopeCanales : ['VN_ALIADOS', 'VN_EMPRESARIOS', 'VC'])
          .filter((c) => c.startsWith('VN'));
        let metricas: any[] = [];
        if (vnCanales.length || isAdmin) {
          let mq = supabase
            .from('vn_metricas_optimizadas' as any)
            .select('pais, mes_nro, canal_direccion, gerente, gerente_normalizado, tipo_producto1, ventas, acv_total')
            .eq('scope', 'gerente')
            .eq('anio', anio)
            .eq('mes_nro', periodoSel);
          if (!isAdmin && scopePaises.length) mq = mq.in('pais', scopePaises);
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

        // 6) Metas reales desde metas_acv_gerentes (mes en español)
        const mesNombre = MESES[periodoSel - 1];
        const metasMap = new Map<string, { fe: number; nube: number; acv: number }>();
        if (gerentesList.length) {
          const { data: metas } = await supabase
            .from('metas_acv_gerentes')
            .select('celula, meta_fe, meta_nube, meta_total_acv')
            .eq('mes', mesNombre);
          (metas || []).forEach((m: any) => {
            const cel = normalize(m.celula);
            metasMap.set(cel, {
              fe: m.meta_fe || 0,
              nube: m.meta_nube || 0,
              acv: Number(m.meta_total_acv) || 0,
            });
          });
        }

        // 7) Construir stats por gerente
        const out: Stats[] = gerentesList.map((g) => {
          const gNorm = normalize(g.nombre);
          const firstName = gNorm.split(' ')[0];
          const rows = metricas.filter((m) => {
            const mNorm = normalize(m.gerente_normalizado || m.gerente || '');
            return mNorm.includes(firstName) || gNorm.includes(mNorm.split(' ')[0]);
          });
          const fe = rows.filter((r) => String(r.tipo_producto1 || '').toUpperCase() === 'FE')
            .reduce((s, r) => s + (Number(r.ventas) || 0), 0);
          const nube = rows.filter((r) => String(r.tipo_producto1 || '').toUpperCase() === 'NUBE')
            .reduce((s, r) => s + (Number(r.ventas) || 0), 0);
          const total = rows.reduce((s, r) => s + (Number(r.ventas) || 0), 0);
          const acv = rows.reduce((s, r) => s + (Number(r.acv_total) || 0), 0);

          const meta = metasMap.get(normalize(g.celula || ''));
          const asesoresCount = asesoresMap.get(g.id) || 0;
          const metaFe = meta?.fe || asesoresCount * 2;
          const metaNube = meta?.nube || asesoresCount * 1;
          const metaTotal = metaFe + metaNube;
          const pctTotal = metaTotal > 0 ? (total / metaTotal) * 100 : 0;

          return {
            gerente: g,
            asesores: asesoresCount,
            fe: Math.round(fe),
            nube: Math.round(nube),
            total: Math.round(total),
            acv: Math.round(acv),
            metaFe,
            metaNube,
            metaAcv: meta?.acv || 0,
            pctTotal: Math.round(pctTotal),
            sp: spMap.get(g.id) || 0,
            racha: rachaMap.get(g.id) || 0,
          };
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

  const distribucion = useMemo(() => {
    const enMeta = filteredStats.filter((s) => s.pctTotal >= 90).length;
    const enRiesgo = filteredStats.filter((s) => s.pctTotal >= 60 && s.pctTotal < 90).length;
    const bajoMeta = filteredStats.filter((s) => s.pctTotal < 60).length;
    return { enMeta, enRiesgo, bajoMeta };
  }, [filteredStats]);

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

  const sema = semaforo(kpis.pctUds);

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
              <Badge className={`${sema.bg} ${sema.color} border-0`}>{sema.emoji}</Badge>
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
              <DollarSign className="text-green-500" />
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

        {/* Tabla semáforo gerentes */}
        <Card className="rounded-2xl">
          <div className="p-5 border-b border-border">
            <h2 className="font-heading text-lg font-bold">Semáforo de Gerentes</h2>
            <p className="text-xs text-muted-foreground">Cumplimiento del periodo seleccionado</p>
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
                  <TableHead className="text-right">% Cumpl.</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : filteredStats.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No hay gerentes en tu scope.</TableCell></TableRow>
                ) : filteredStats.sort((a, b) => b.pctTotal - a.pctTotal).map((s) => {
                  const sm = semaforo(s.pctTotal);
                  return (
                    <TableRow key={s.gerente.id}>
                      <TableCell className="font-medium">{s.gerente.nombre}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s.gerente.canal}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{s.gerente.pais}</Badge></TableCell>
                      <TableCell className="text-right">{s.asesores}</TableCell>
                      <TableCell className="text-right">{s.fe} <span className="text-xs text-muted-foreground">/ {s.metaFe}</span></TableCell>
                      <TableCell className="text-right">{s.nube} <span className="text-xs text-muted-foreground">/ {s.metaNube}</span></TableCell>
                      <TableCell className="text-right">{fmtMoney(s.acv)}</TableCell>
                      <TableCell className="text-right font-scoreboard">{s.sp.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{s.racha > 0 ? `${s.racha}🔥` : '—'}</TableCell>
                      <TableCell className={`text-right font-bold ${sm.color}`}>{s.pctTotal}%</TableCell>
                      <TableCell><Badge className={`${sm.bg} ${sm.color} ${sm.border}`}>{sm.emoji} {sm.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Grid Distribución + Top/Plan */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5 rounded-2xl">
            <h3 className="font-heading text-lg font-bold mb-4">Distribución del Equipo</h3>
            <div className="space-y-3">
              {[
                { label: '🟢 En meta (≥90%)', count: distribucion.enMeta, color: 'bg-green-500', total: filteredStats.length },
                { label: '🟡 En riesgo (60-89%)', count: distribucion.enRiesgo, color: 'bg-yellow-500', total: filteredStats.length },
                { label: '🔴 Bajo meta (<60%)', count: distribucion.bajoMeta, color: 'bg-red-500', total: filteredStats.length },
              ].map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{b.label}</span>
                    <span className="font-bold">{b.count}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${b.total ? (b.count / b.total) * 100 : 0}%` }}
                      className={`h-full ${b.color}`}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 rounded-2xl">
            <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
              <Trophy className="text-yellow-500" /> Top 3 & Plan de choque
            </h3>
            <div className="space-y-2 mb-4">
              {top3.map((s, i) => (
                <div key={s.gerente.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{['🥇','🥈','🥉'][i]}</span>
                    <span className="font-medium text-sm">{s.gerente.nombre}</span>
                  </span>
                  <span className="font-bold text-green-500">{s.pctTotal}%</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-500" /> Requieren plan de choque
              </p>
              <div className="flex flex-wrap gap-1.5">
                {planChoque.map((s) => (
                  <Badge key={s.gerente.id} className="bg-red-500/10 text-red-500 border-red-500/30">
                    {s.gerente.nombre.split(' ')[0]} · {s.pctTotal}%
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Tendencia */}
        <Card className="p-5 rounded-2xl">
          <h3 className="font-heading text-lg font-bold mb-4">Tendencia (últimos 6 meses)</h3>
          <div className="space-y-2">
            {tendencia.map((t) => {
              const sm = semaforo(t.pct);
              return (
                <div key={t.mes} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-muted-foreground">{MESES[t.mes - 1]}</span>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(t.pct, 100)}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full ${t.pct >= 90 ? 'bg-green-500' : t.pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    />
                  </div>
                  <span className={`w-12 text-right text-sm font-bold ${sm.color}`}>{t.pct}%</span>
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
