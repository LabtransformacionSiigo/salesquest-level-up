import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

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
}

const RETOS_DIARIOS: RetoConfig[] = [
  { id: 'primer_disparo', nombre: 'Primer Disparo', sp: 10, desc: 'Registra tu primera venta del día', tipo: 'diario' },
  { id: 'jornada_redonda', nombre: 'Jornada Redonda', sp: 25, desc: 'Más de 1 venta en el día', umbral: 2, tipo: 'diario' },
];

const RETOS_SEMANALES: RetoConfig[] = [
  { id: 'semana_ejecutada', nombre: 'Semana Ejecutada', sp: 100, desc: '≥$50M COP en ventas esta semana', umbral: 50_000_000, tipo: 'semanal' },
  { id: 'semana_en_fuego', nombre: 'Semana en Fuego', sp: 160, desc: '≥$80M COP en ventas esta semana', umbral: 80_000_000, tipo: 'semanal' },
  { id: 'semana_elite', nombre: 'Semana Élite', sp: 250, desc: '≥$100M COP en ventas esta semana', umbral: 100_000_000, tipo: 'semanal' },
  { id: 'sin_semana_roja', nombre: 'Sin Semana Roja', sp: 80, desc: 'Ningún día sin ventas esta semana', tipo: 'semanal' },
];

const RETOS_MENSUALES: RetoConfig[] = [
  { id: 'meta_conquistada', nombre: 'Meta Conquistada', sp: 500, desc: '≥100% de cumplimiento mensual', umbral: 100, tipo: 'mensual' },
  { id: 'mes_impacto', nombre: 'Mes Impacto', sp: 800, desc: '≥120% de cumplimiento mensual', umbral: 120, tipo: 'mensual' },
  { id: 'mes_elite', nombre: 'Mes Élite', sp: 1200, desc: '≥150% de cumplimiento mensual', umbral: 150, tipo: 'mensual' },
  { id: 'mes_legendario', nombre: 'Mes Legendario', sp: 2000, desc: '≥200% de cumplimiento mensual', umbral: 200, tipo: 'mensual' },
  { id: 'el_que_no_para', nombre: 'El Que No Para', sp: 600, desc: 'Sin semanas rojas en el mes', tipo: 'mensual' },
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
      // Get completed challenges
      const { data: retosData } = await supabase
        .from('retos_completados')
        .select('reto, periodo')
        .eq('gerente_id', profile.id);

      const completadosSet = new Set((retosData || []).map(r => `${r.reto}::${r.periodo}`));
      setCompletados(completadosSet);

      // Ventas hoy
      const { data: ventasHoyData } = await supabase
        .from('ventas')
        .select('id', { count: 'exact' })
        .eq('gerente_id', profile.id)
        .eq('fecha_facturacion', todayStr);
      setVentasHoy(ventasHoyData?.length || 0);

      // Ventas semana (sum valor_producto)
      const weekStart = getISOWeekStartDate(semanaISO, anio);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const { data: ventasSemanaData } = await supabase
        .from('ventas')
        .select('valor_producto')
        .eq('gerente_id', profile.id)
        .gte('fecha_facturacion', weekStart.toISOString().split('T')[0])
        .lt('fecha_facturacion', weekEnd.toISOString().split('T')[0]);

      const totalSemana = (ventasSemanaData || []).reduce((sum, v) => sum + (Number(v.valor_producto) || 0), 0);
      setVentasSemana(totalSemana);

      // KPI mes actual
      const { data: kpiData } = await supabase
        .from('kpis_mes_actual')
        .select('pct_cumplimiento')
        .eq('gerente_id', profile.id)
        .maybeSingle();
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
    if (reto.tipo === 'semanal' && reto.umbral) {
      return { current: ventasSemana, target: reto.umbral, pct: Math.min(100, (ventasSemana / reto.umbral) * 100) };
    }
    if (reto.tipo === 'mensual' && reto.umbral) {
      return { current: pctCumplimiento, target: reto.umbral, pct: Math.min(100, (pctCumplimiento / reto.umbral) * 100) };
    }
    return { current: 0, target: 1, pct: 0 };
  };

  const formatValue = (reto: RetoConfig, value: number): string => {
    if (reto.tipo === 'semanal' && reto.umbral && reto.umbral >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(0)}M`;
    }
    if (reto.tipo === 'mensual' && reto.umbral) return `${value}%`;
    return String(value);
  };

  const renderReto = (reto: RetoConfig, periodo: string) => {
    const completed = isCompleted(reto.id, periodo);
    const progress = getProgress(reto);

    return (
      <div
        key={reto.id}
        className={cn(
          "bg-card border rounded-2xl p-5 transition-all",
          completed ? "border-secondary/50 bg-secondary/5" : "border-border"
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{completed ? '✅' : progress.pct >= 50 ? '🔥' : '🔒'}</span>
            <div>
              <p className={cn("text-sm font-bold", completed ? "text-secondary" : "text-foreground")}>{reto.nombre}</p>
              <p className="text-xs text-muted-foreground">{reto.desc}</p>
            </div>
          </div>
          <span className={cn(
            "text-xs font-bold px-2.5 py-1 rounded-full",
            completed ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
          )}>
            {completed ? `+${reto.sp}` : reto.sp} SP
          </span>
        </div>

        {!completed && reto.umbral && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatValue(reto, progress.current)} / {formatValue(reto, progress.target)}</span>
              <span>{Math.round(progress.pct)}%</span>
            </div>
            <Progress value={progress.pct} className="h-2" />
          </div>
        )}

        {!completed && !reto.umbral && (
          <div className="opacity-50 text-xs text-muted-foreground italic">En progreso...</div>
        )}
      </div>
    );
  };

  return (
    <Layout title="Retos">
      <Tabs defaultValue="diarios" className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="diarios" className="flex-1">🎯 Diarios</TabsTrigger>
          <TabsTrigger value="semanales" className="flex-1">📅 Semanales</TabsTrigger>
          <TabsTrigger value="mensuales" className="flex-1">🏆 Mensuales</TabsTrigger>
        </TabsList>

        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <>
            <TabsContent value="diarios">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {RETOS_DIARIOS.map(r => renderReto(r, periodoHoy))}
              </div>
            </TabsContent>
            <TabsContent value="semanales">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {RETOS_SEMANALES.map(r => renderReto(r, periodoSemana))}
              </div>
            </TabsContent>
            <TabsContent value="mensuales">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {RETOS_MENSUALES.map(r => renderReto(r, periodoMes))}
              </div>
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
