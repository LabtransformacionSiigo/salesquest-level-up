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
  { id: 'meta_conquistada', nombre: 'Meta Cumplida', sp: 500, desc: '≥100% cumplimiento', umbral: 100, tipo: 'mensual', emoji: '✅' },
  { id: 'mes_impacto', nombre: 'Sobre Meta', sp: 800, desc: '≥120% cumplimiento', umbral: 120, tipo: 'mensual', emoji: '⚡' },
  { id: 'mes_elite', nombre: 'Élite', sp: 1200, desc: '≥150% cumplimiento', umbral: 150, tipo: 'mensual', emoji: '💎' },
  { id: 'mes_legendario', nombre: 'Leyenda', sp: 2000, desc: '≥200% cumplimiento', umbral: 200, tipo: 'mensual', emoji: '🌟' },
  { id: 'el_que_no_para', nombre: 'Imbatible', sp: 600, desc: 'Sin semanas rojas', tipo: 'mensual', emoji: '🛡️' },
];

const Retos = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [completados, setCompletados] = useState<Set<string>>(new Set());
  const [autoCompletados, setAutoCompletados] = useState<Set<string>>(new Set());
  const [ventasHoy, setVentasHoy] = useState(0);
  const [ventasSemana, setVentasSemana] = useState(0);
  const [pctCumplimiento, setPctCumplimiento] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const isVcAdvisor = isVcAdvisorProfile(profile);

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
      if (isVcAdvisor) {
        const [{ data: retosData, error: retosError }, snapshot] = await Promise.all([
          supabase.from('retos_completados').select('reto, periodo').eq('gerente_id', profile.id),
          getVcAdvisorSnapshot(profile),
        ]);
        if (retosError) throw retosError;
        if (cancelled) return;
        const metrics = snapshot?.metrics;
        const auto = new Set<string>();
        auto.add(`siempre_en_la_jugada::${periodoHoy}`);
        if ((metrics?.todaySalesCount || 0) >= 1) auto.add(`sin_irme_en_0::${periodoHoy}`);
        if ((metrics?.todaySalesCount || 0) >= 5) auto.add(`jornada_redonda::${periodoHoy}`);
        if ((metrics?.currentWeekRevenue || 0) >= 50_000_000) auto.add(`semana_ejecutada::${periodoSemana}`);
        if ((metrics?.currentWeekRevenue || 0) >= 80_000_000) auto.add(`semana_en_fuego::${periodoSemana}`);
        if ((metrics?.currentWeekRevenue || 0) >= 100_000_000) auto.add(`semana_elite::${periodoSemana}`);
        if (snapshot?.sales && hasVcAdvisorSalesEveryDaySoFar(snapshot.sales)) auto.add(`sin_semana_roja::${periodoSemana}`);
        setCompletados(new Set((retosData || []).map((r) => `${r.reto}::${r.periodo}`)));
        setAutoCompletados(auto);
        setVentasHoy(metrics?.todaySalesCount || 0);
        setVentasSemana(metrics?.currentWeekRevenue || 0);
        setPctCumplimiento(0);
        setDataLoading(false);
        return;
      }

      const { data: retosData } = await supabase.from('retos_completados').select('reto, periodo').eq('gerente_id', profile.id);
      if (cancelled) return;
      setCompletados(new Set((retosData || []).map((r) => `${r.reto}::${r.periodo}`)));
      setAutoCompletados(new Set());

      const { data: ventasHoyData } = await supabase.from('ventas').select('id', { count: 'exact' }).eq('gerente_id', profile.id).eq('fecha_facturacion', todayStr);
      if (cancelled) return;
      setVentasHoy(ventasHoyData?.length || 0);

      const weekStart = getISOWeekStartDate(semanaISO, anio);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const { data: ventasSemanaData } = await supabase.from('ventas').select('valor_producto').eq('gerente_id', profile.id).gte('fecha_facturacion', weekStart.toISOString().split('T')[0]).lt('fecha_facturacion', weekEnd.toISOString().split('T')[0]);
      if (cancelled) return;
      setVentasSemana((ventasSemanaData || []).reduce((sum, v) => sum + (Number(v.valor_producto) || 0), 0));

      const { data: kpiData } = await supabase.from('kpis_mes_actual').select('pct_cumplimiento').eq('gerente_id', profile.id).maybeSingle();
      if (cancelled) return;
      setPctCumplimiento(Number(kpiData?.pct_cumplimiento) || 0);
      setDataLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.nombre, profile?.gerente_id, profile?.role, isVcAdvisor, periodoHoy, periodoSemana, anio, semanaISO, todayStr]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isCompleted = (retoId: string, periodo: string) => completados.has(`${retoId}::${periodo}`) || autoCompletados.has(`${retoId}::${periodo}`);

  const getProgress = (reto: RetoConfig): { current: number; target: number; pct: number } => {
    if (reto.tipo === 'diario') {
      if (reto.id === 'primer_disparo') return { current: ventasHoy, target: 1, pct: Math.min(100, ventasHoy * 100) };
      if (reto.id === 'jornada_redonda') return { current: ventasHoy, target: 2, pct: Math.min(100, (ventasHoy / 2) * 100) };
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
            >{completed ? `+${reto.sp}` : reto.sp} SP</motion.span>
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
