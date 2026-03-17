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
import { staggerContainer, fadeUpItem, scoreboardSlide } from '@/lib/animations';

const getISOWeek = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

interface RetoConfig {
  id: string; nombre: string; sp: number; desc: string; umbral?: number; tipo: 'diario' | 'semanal' | 'mensual'; emoji: string;
  sede?: string;
}

const RETOS_DIARIOS: RetoConfig[] = [
  { id: 'primer_disparo', nombre: 'Primer Tiro', sp: 10, desc: 'Registra tu primera venta del día', tipo: 'diario', emoji: '⚽', sede: 'Entrenamiento' },
  { id: 'jornada_redonda', nombre: 'Doblete', sp: 25, desc: 'Más de 1 venta en el día', umbral: 2, tipo: 'diario', emoji: '⚽⚽', sede: 'Entrenamiento' },
];

const RETOS_SEMANALES: RetoConfig[] = [
  { id: 'semana_ejecutada', nombre: 'Fase de Grupos', sp: 100, desc: '≥$50M COP en ventas', umbral: 50_000_000, tipo: 'semanal', emoji: '🏟️', sede: 'MetLife Stadium' },
  { id: 'semana_en_fuego', nombre: 'Cuartos de Final', sp: 160, desc: '≥$80M COP en ventas', umbral: 80_000_000, tipo: 'semanal', emoji: '🔥', sede: 'Estadio Azteca' },
  { id: 'semana_elite', nombre: 'Semifinal', sp: 250, desc: '≥$100M COP en ventas', umbral: 100_000_000, tipo: 'semanal', emoji: '⭐', sede: 'AT&T Stadium' },
  { id: 'sin_semana_roja', nombre: 'Invicto', sp: 80, desc: 'Sin días sin ventas', tipo: 'semanal', emoji: '🛡️', sede: 'SoFi Stadium' },
];

const RETOS_MENSUALES: RetoConfig[] = [
  { id: 'meta_conquistada', nombre: 'La Final', sp: 500, desc: '≥100% cumplimiento', umbral: 100, tipo: 'mensual', emoji: '🏆', sede: 'MetLife Stadium' },
  { id: 'mes_impacto', nombre: 'Tiempo Extra', sp: 800, desc: '≥120% cumplimiento', umbral: 120, tipo: 'mensual', emoji: '⚡', sede: 'Rose Bowl' },
  { id: 'mes_elite', nombre: 'Penales', sp: 1200, desc: '≥150% cumplimiento', umbral: 150, tipo: 'mensual', emoji: '🥅', sede: 'Hard Rock Stadium' },
  { id: 'mes_legendario', nombre: 'Campeón del Mundo', sp: 2000, desc: '≥200% cumplimiento', umbral: 200, tipo: 'mensual', emoji: '🌟', sede: 'MetLife Stadium' },
  { id: 'el_que_no_para', nombre: 'Imbatible', sp: 600, desc: 'Sin semanas rojas', tipo: 'mensual', emoji: '🛡️', sede: 'Lumen Field' },
];

const Retos = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [completados, setCompletados] = useState<Set<string>>(new Set());
  const [ventasHoy, setVentasHoy] = useState(0);
  const [ventasSemana, setVentasSemana] = useState(0);
  const [pctCumplimiento, setPctCumplimiento] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

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
    const fetchData = async () => {
      const { data: retosData } = await supabase.from('retos_completados').select('reto, periodo').eq('gerente_id', profile.id);
      setCompletados(new Set((retosData || []).map(r => `${r.reto}::${r.periodo}`)));

      const { data: ventasHoyData } = await supabase.from('ventas').select('id', { count: 'exact' }).eq('gerente_id', profile.id).eq('fecha_facturacion', todayStr);
      setVentasHoy(ventasHoyData?.length || 0);

      const weekStart = getISOWeekStartDate(semanaISO, anio);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
      const { data: ventasSemanaData } = await supabase.from('ventas').select('valor_producto').eq('gerente_id', profile.id).gte('fecha_facturacion', weekStart.toISOString().split('T')[0]).lt('fecha_facturacion', weekEnd.toISOString().split('T')[0]);
      setVentasSemana((ventasSemanaData || []).reduce((sum, v) => sum + (Number(v.valor_producto) || 0), 0));

      const { data: kpiData } = await supabase.from('kpis_mes_actual').select('pct_cumplimiento').eq('gerente_id', profile.id).maybeSingle();
      setPctCumplimiento(Number(kpiData?.pct_cumplimiento) || 0);
      setDataLoading(false);
    };
    fetchData();
  }, [profile?.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isCompleted = (retoId: string, periodo: string) => completados.has(`${retoId}::${periodo}`);

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

  const renderTicket = (reto: RetoConfig, periodo: string, idx: number) => {
    const completed = isCompleted(reto.id, periodo);
    const progress = getProgress(reto);

    return (
      <motion.div
        key={reto.id}
        className={cn("ticket-card rounded-2xl p-5 transition-all relative overflow-hidden", completed && "border-primary/30")}
        variants={scoreboardSlide}
        whileHover={{ scale: 1.02, y: -3, transition: { duration: 0.15 } }}
      >
        {/* Ticket header — like a real match ticket */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em] font-scoreboard">
            FIFA 2026 · {reto.tipo === 'diario' ? 'TRAINING' : reto.tipo === 'semanal' ? 'MATCH DAY' : 'TOURNAMENT'}
          </span>
          {completed && (
            <motion.span 
              className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
            >⚽ COMPLETADO</motion.span>
          )}
        </div>

        {/* Sede */}
        {reto.sede && <p className="text-[9px] text-muted-foreground/60 mb-3">📍 {reto.sede}</p>}

        {/* Match info */}
        <div className="flex items-center gap-3 mb-3">
          <motion.span 
            className="text-3xl"
            animate={completed ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : {}}
            transition={{ duration: 0.6 }}
          >{completed ? '✅' : reto.emoji}</motion.span>
          <div className="flex-1">
            <p className={cn("text-sm font-bold", completed ? "text-neon-green" : "text-foreground")}>{reto.nombre}</p>
            <p className="text-xs text-muted-foreground">{reto.desc}</p>
          </div>
          <div className="text-right">
            <motion.span 
              className={cn("text-xs font-bold font-scoreboard px-3 py-1.5 rounded-lg block", completed ? "bg-accent/20 text-neon-gold" : "bg-muted text-muted-foreground")}
              animate={completed ? { scale: [1, 1.15, 1] } : {}}
            >{completed ? `+${reto.sp}` : reto.sp} SP</motion.span>
          </div>
        </div>

        {/* Dashed separator line */}
        <div className="border-t border-dashed border-border/30 my-3" />

        {/* Progress */}
        {!completed && reto.umbral && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatValue(reto, progress.current)} / {formatValue(reto, progress.target)}</span>
              <span className="font-scoreboard">{Math.round(progress.pct)}%</span>
            </div>
            <Progress value={progress.pct} className="h-2" />
          </div>
        )}
        {completed && (
          <p className="text-center text-xs text-muted-foreground font-scoreboard">RESULTADO FINAL: ⚽ ¡GOL!</p>
        )}
      </motion.div>
    );
  };

  return (
    <Layout title="⚽ Partidos y Retos">
      <Tabs defaultValue="diarios" className="space-y-6">
        <TabsList className="w-full glass-card border-border/30">
          <TabsTrigger value="diarios" className="flex-1">⚽ Entrenamiento</TabsTrigger>
          <TabsTrigger value="semanales" className="flex-1">🏟️ Partidos</TabsTrigger>
          <TabsTrigger value="mensuales" className="flex-1">🏆 Torneo</TabsTrigger>
        </TabsList>

        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-40" />)}</div>
        ) : (
          <>
            <TabsContent value="diarios">
              <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {RETOS_DIARIOS.map((r, i) => renderTicket(r, periodoHoy, i))}
              </motion.div>
            </TabsContent>
            <TabsContent value="semanales">
              <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {RETOS_SEMANALES.map((r, i) => renderTicket(r, periodoSemana, i))}
              </motion.div>
            </TabsContent>
            <TabsContent value="mensuales">
              <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {RETOS_MENSUALES.map((r, i) => renderTicket(r, periodoMes, i))}
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
