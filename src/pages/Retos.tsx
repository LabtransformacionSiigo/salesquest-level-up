import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, scoreboardSlide, popIn, celebratePulse } from '@/lib/animations';
import { getVcAdvisorSnapshot, isVcAdvisorProfile } from '@/lib/vc-advisor-data';
import { hasVcAdvisorSalesEveryDaySoFar } from '@/lib/vc-advisor-metrics';
import { filterCatalogByScope, normalizeCatalogWindow } from '@/lib/catalog-scope';

const getISOWeek = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

interface RetoConfig {
  id: string;
  nombre: string;
  sp: number;
  desc: string;
  umbral?: number;
  tipo: 'diario' | 'semanal' | 'mensual';
  emoji: string;
}

const RETOS_DIARIOS: RetoConfig[] = [
  { id: 'siempre_en_la_jugada', nombre: 'Siempre en la jugada', sp: 1, desc: 'Ingresa a la plataforma al menos 1 vez por día', tipo: 'diario', emoji: '🔓' },
  { id: 'sin_irme_en_0', nombre: 'Sin irme en 0', sp: 1, desc: 'Logra al menos 1 venta en el día', umbral: 1, tipo: 'diario', emoji: '🎯' },
  { id: 'jornada_redonda', nombre: 'Jornada Redonda', sp: 3, desc: 'Logra 5 ventas en el día', umbral: 5, tipo: 'diario', emoji: '🔥' },
];

const RETOS_SEMANALES: RetoConfig[] = [
  { id: 'semana_ejecutada', nombre: 'Reto Básico', sp: 100, desc: '≥$50M COP en ventas', umbral: 50_000_000, tipo: 'semanal', emoji: '🎯' },
  { id: 'semana_en_fuego', nombre: 'Reto Intermedio', sp: 160, desc: '≥$80M COP en ventas', umbral: 80_000_000, tipo: 'semanal', emoji: '🔥' },
  { id: 'semana_elite', nombre: 'Reto Avanzado', sp: 250, desc: '≥$100M COP en ventas', umbral: 100_000_000, tipo: 'semanal', emoji: '💎' },
  { id: 'sin_semana_roja', nombre: 'Consistencia', sp: 80, desc: 'Sin días sin ventas', tipo: 'semanal', emoji: '🛡️' },
];

const RETOS_MENSUALES: RetoConfig[] = [
  { id: 'meta_conquistada', nombre: 'Meta Conquistada', sp: 5, desc: 'Cumple al 100% de la meta de ACV+', umbral: 100, tipo: 'mensual', emoji: '✅' },
  { id: 'performance_elite', nombre: 'Performance Élite', sp: 7, desc: 'Cumple al 125% de la meta de ACV+', umbral: 125, tipo: 'mensual', emoji: '⚡' },
  { id: 'mes_legendario', nombre: 'Mes Legendario', sp: 10, desc: 'Cumple al 150% de la meta de ACV+', umbral: 150, tipo: 'mensual', emoji: '🌟' },
];

interface VcCatalogReto {
  id: string;
  nombre: string;
  emoji: string | null;
  ventana_tiempo: string;
  canal?: string | null;
  pais?: string | null;
  gerente_id?: string | null;
  kpi: string | null;
  familia_vc: string | null;
  umbral: number;
  sp_otorgados: number;
  objetivo_descripcion: string | null;
}

const Retos = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [completados, setCompletados] = useState<Set<string>>(new Set());
  const [autoCompletados, setAutoCompletados] = useState<Set<string>>(new Set());
  const [ventasHoy, setVentasHoy] = useState(0);
  const [ventasSemana, setVentasSemana] = useState(0);
  const [pctCumplimiento, setPctCumplimiento] = useState(0);
  const [vcCatalog, setVcCatalog] = useState<VcCatalogReto[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const isVcAdvisor = isVcAdvisorProfile(profile);
  const isVcGerente = (profile?.canal === 'VC') && profile?.role !== 'admin';
  const useVcCatalog = isVcAdvisor || isVcGerente;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const semanaISO = getISOWeek(today);
  const anio = today.getFullYear();
  const mes = today.getMonth();
  const periodoHoy = todayStr;
  const periodoSemana = `${anio}-W${String(semanaISO).padStart(2, '0')}`;
  const periodoMes = `${anio}${String(mes + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    const fetchData = async () => {
      setDataLoading(true);

      if (useVcCatalog) {
        const [{ data: catalog }, { data: retosData }, snapshot] = await Promise.all([
          supabase.from('catalogo_retos').select('*').eq('activo', true),
          supabase.from('retos_completados').select('reto, periodo').eq('gerente_id', profile.id),
          isVcAdvisor ? getVcAdvisorSnapshot(profile) : Promise.resolve(null as any),
        ]);
        if (cancelled) return;
        setVcCatalog(filterCatalogByScope((catalog || []) as VcCatalogReto[], profile));
        setCompletados(new Set((retosData || []).map((r) => `${r.reto}::${r.periodo}`)));
        if (snapshot?.metrics) {
          setVentasHoy(snapshot.metrics.todaySalesCount || 0);
          setVentasSemana(snapshot.metrics.currentWeekRevenue || 0);
        }
        setAutoCompletados(new Set());
        setDataLoading(false);
        return;
      }

      const { data: retosData } = await supabase.from('retos_completados').select('reto, periodo').eq('gerente_id', profile.id);
      if (cancelled) return;
      setCompletados(new Set((retosData || []).map((r) => `${r.reto}::${r.periodo}`)));
      const gerenteAuto = new Set<string>();
      gerenteAuto.add(`siempre_en_la_jugada::${periodoHoy}`);

      const { data: ventasHoyData } = await supabase.from('ventas').select('id', { count: 'exact' }).eq('gerente_id', profile.id).eq('fecha_facturacion', todayStr);
      if (cancelled) return;
      const ventasCount = ventasHoyData?.length || 0;
      setVentasHoy(ventasCount);
      if (ventasCount >= 1) gerenteAuto.add(`sin_irme_en_0::${periodoHoy}`);
      if (ventasCount >= 5) gerenteAuto.add(`jornada_redonda::${periodoHoy}`);

      const weekStart = getISOWeekStartDate(semanaISO, anio);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const { data: ventasSemanaData } = await supabase.from('ventas').select('valor_producto').eq('gerente_id', profile.id).gte('fecha_facturacion', weekStart.toISOString().split('T')[0]).lt('fecha_facturacion', weekEnd.toISOString().split('T')[0]);
      if (cancelled) return;
      setVentasSemana((ventasSemanaData || []).reduce((sum, v) => sum + (Number(v.valor_producto) || 0), 0));

      const { data: kpiData } = await supabase.from('kpis_mes_actual').select('pct_cumplimiento').eq('gerente_id', profile.id).maybeSingle();
      if (cancelled) return;
      setPctCumplimiento(Number(kpiData?.pct_cumplimiento) || 0);
      setAutoCompletados(gerenteAuto);
      setDataLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.nombre, profile?.gerente_id, profile?.role, profile?.canal, isVcAdvisor, useVcCatalog, periodoHoy, periodoSemana, anio, semanaISO, todayStr]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isCompleted = (retoId: string, periodo: string) => completados.has(`${retoId}::${periodo}`) || autoCompletados.has(`${retoId}::${periodo}`);

  const getProgress = (reto: RetoConfig): { current: number; target: number; pct: number } => {
    if (reto.tipo === 'diario') {
      if (reto.id === 'siempre_en_la_jugada') return { current: 1, target: 1, pct: 100 };
      if (reto.id === 'sin_irme_en_0') return { current: ventasHoy, target: 1, pct: Math.min(100, ventasHoy * 100) };
      if (reto.id === 'jornada_redonda') return { current: ventasHoy, target: 5, pct: Math.min(100, (ventasHoy / 5) * 100) };
    }
    if (reto.tipo === 'semanal' && reto.umbral) return { current: ventasSemana, target: reto.umbral, pct: Math.min(100, (ventasSemana / reto.umbral) * 100) };
    if (reto.tipo === 'mensual' && reto.umbral) return { current: pctCumplimiento, target: reto.umbral, pct: Math.min(100, (pctCumplimiento / reto.umbral) * 100) };
    return { current: 0, target: 1, pct: 0 };
  };

  const formatValue = (reto: RetoConfig, value: number): string => {
    if (reto.tipo === 'semanal' && reto.umbral && reto.umbral >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
    if (reto.tipo === 'mensual' && reto.umbral) return `${value}%`;
    return String(value);
  };

  const renderCard = (reto: RetoConfig, periodo: string, idx: number) => {
    const completed = isCompleted(reto.id, periodo);
    const progress = getProgress(reto);

    return (
      <motion.div
        key={reto.id}
        className={cn('bg-white border rounded-2xl p-5 transition-all relative overflow-hidden border-l-4 shadow-smooth-sm', completed ? 'border-l-accent' : 'border-l-primary')}
        variants={scoreboardSlide}
        whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Shimmer on completed */}
        {completed && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/10 to-transparent pointer-events-none"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          />
        )}

        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em] font-heading">
            {reto.tipo === 'diario' ? 'DIARIO' : reto.tipo === 'semanal' ? 'SEMANAL' : 'MENSUAL'}
          </span>
          {completed && (
            <motion.span
              className="text-[9px] font-bold text-white bg-accent px-2 py-0.5 rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 0.4 }}
            >✅ COMPLETADO</motion.span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-3 mt-2">
          <motion.span
            className="text-3xl"
            animate={completed ? { scale: [1, 1.3, 1], rotate: [0, 15, -15, 0] } : {}}
            transition={{ duration: 0.6 }}
          >{completed ? '✅' : reto.emoji}</motion.span>
          <div className="flex-1">
            <p className={cn('text-sm font-bold', completed ? 'text-accent' : 'text-foreground')}>{reto.nombre}</p>
            <p className="text-xs text-muted-foreground">{reto.desc}</p>
          </div>
          <div className="text-right">
            <motion.span
              className={cn('text-xs font-bold font-scoreboard px-3 py-1.5 rounded-lg block', completed ? 'bg-siigo-red text-white' : 'bg-muted text-muted-foreground')}
              animate={completed ? { scale: [1, 1.15, 1] } : {}}
              title="Se suman a puntos canjeables"
            >🎁 {completed ? `+${reto.sp}` : reto.sp}</motion.span>
          </div>
        </div>

        {!completed && reto.umbral && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatValue(reto, progress.current)} / {formatValue(reto, progress.target)}</span>
              <span className="font-scoreboard">{Math.round(progress.pct)}%</span>
            </div>
            <Progress value={progress.pct} className="h-2" />
          </div>
        )}
      </motion.div>
    );
  };

  const kpiLabel = (kpi?: string | null) => {
    switch (kpi) {
      case 'acv_plus': return 'ACV+';
      case 'upgrades': return 'Upgrades';
      case 'conversiones': return 'Conversiones';
      case 'cumplimiento_pct': return '% Cumplimiento';
      default: return 'Meta';
    }
  };

  const familiaLabel = (fam?: string | null) => {
    if (!fam || fam === 'AMBAS') return 'Nube + Legacy';
    if (fam === 'NUBE') return 'Nube';
    if (fam === 'LEGACY') return 'Legacy';
    return fam;
  };

  const formatUmbral = (reto: VcCatalogReto) => {
    if (reto.kpi === 'acv_plus') return `$${(reto.umbral / 1_000_000).toFixed(0)}M`;
    if (reto.kpi === 'cumplimiento_pct' || reto.kpi === 'conversiones') return `${reto.umbral}%`;
    return String(reto.umbral);
  };

  const renderVcCard = (reto: VcCatalogReto, periodo: string) => {
    const completed = completados.has(`${reto.nombre}::${periodo}`);
    return (
      <motion.div
        key={reto.id}
        className={cn('bg-white border rounded-2xl p-5 transition-all relative overflow-hidden border-l-4 shadow-smooth-sm', completed ? 'border-l-accent' : 'border-l-primary')}
        variants={scoreboardSlide}
        whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em] font-heading">
            {reto.ventana_tiempo === 'diario' ? 'DIARIO' : reto.ventana_tiempo === 'semanal' ? 'SEMANAL' : 'MENSUAL'}
          </span>
          {completed && (
            <span className="text-[9px] font-bold text-white bg-accent px-2 py-0.5 rounded-full">✅ COMPLETADO</span>
          )}
        </div>
        <div className="flex items-center gap-3 mb-3 mt-2">
          <span className="text-3xl">{completed ? '✅' : (reto.emoji || '🎯')}</span>
          <div className="flex-1">
            <p className={cn('text-sm font-bold', completed ? 'text-accent' : 'text-foreground')}>{reto.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {reto.objetivo_descripcion || `Logra ${formatUmbral(reto)} de ${kpiLabel(reto.kpi)}`}
            </p>
            <div className="flex gap-1 mt-1.5">
              <span className="text-[9px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{kpiLabel(reto.kpi)}</span>
              <span className="text-[9px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{familiaLabel(reto.familia_vc)}</span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={cn('text-xs font-bold font-scoreboard px-3 py-1.5 rounded-lg block', completed ? 'bg-siigo-red text-white' : 'bg-muted text-muted-foreground')}
              title="Se suman a puntos canjeables"
            >🎁 {completed ? `+${reto.sp_otorgados}` : reto.sp_otorgados}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Layout title="🎯 Retos">
      <Tabs defaultValue="diarios" className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <TabsList className="w-full bg-white border border-border">
            <TabsTrigger value="diarios" className="flex-1">📋 Diarios</TabsTrigger>
            <TabsTrigger value="semanales" className="flex-1">📅 Semanales</TabsTrigger>
            <TabsTrigger value="mensuales" className="flex-1">🏆 Mensuales</TabsTrigger>
          </TabsList>
        </motion.div>

        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}</div>
        ) : (
          <>
            {useVcCatalog && (
              <>
                <TabsContent value="diarios">
                  <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    {vcCatalog.filter(r => normalizeCatalogWindow(r.ventana_tiempo) === 'DIARIO').map((r) => renderVcCard(r, periodoHoy))}
                    {vcCatalog.filter(r => normalizeCatalogWindow(r.ventana_tiempo) === 'DIARIO').length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Sin retos diarios activos.</p>
                    )}
                  </motion.div>
                </TabsContent>
                <TabsContent value="semanales">
                  <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    {vcCatalog.filter(r => normalizeCatalogWindow(r.ventana_tiempo) === 'SEMANAL').map((r) => renderVcCard(r, periodoSemana))}
                    {vcCatalog.filter(r => normalizeCatalogWindow(r.ventana_tiempo) === 'SEMANAL').length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Sin retos semanales activos.</p>
                    )}
                  </motion.div>
                </TabsContent>
                <TabsContent value="mensuales">
                  <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    {vcCatalog.filter(r => normalizeCatalogWindow(r.ventana_tiempo) === 'MENSUAL').map((r) => renderVcCard(r, periodoMes))}
                    {vcCatalog.filter(r => normalizeCatalogWindow(r.ventana_tiempo) === 'MENSUAL').length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Sin retos mensuales activos.</p>
                    )}
                  </motion.div>
                </TabsContent>
              </>
            )}
            {!useVcCatalog && (
              <>
                <TabsContent value="diarios">
                  <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    {RETOS_DIARIOS.map((r, i) => renderCard(r, periodoHoy, i))}
                  </motion.div>
                </TabsContent>
                <TabsContent value="semanales">
                  <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    {RETOS_SEMANALES.map((r, i) => renderCard(r, periodoSemana, i))}
                  </motion.div>
                </TabsContent>
                <TabsContent value="mensuales">
                  <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    {RETOS_MENSUALES.map((r, i) => renderCard(r, periodoMes, i))}
                  </motion.div>
                </TabsContent>
              </>
            )}
          </>
        )}
      </Tabs>
    </Layout>
  );
};

function getISOWeekStartDate(week: number, year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

export default Retos;
