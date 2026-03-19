import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, popIn } from '@/lib/animations';
import { getVcAdvisorSnapshot, isVcAdvisorProfile } from '@/lib/vc-advisor-data';
import DonutChart from '@/components/dashboard/DonutChart';
import KpiProgressBars from '@/components/dashboard/KpiProgressBars';
import TopSiigoPointers from '@/components/dashboard/TopSiigoPointers';

const NIVELES = [
  { nombre: 'Bronce', min: 0, max: 499 },
  { nombre: 'Plata', min: 500, max: 1499 },
  { nombre: 'Oro', min: 1500, max: 3499 },
  { nombre: 'Platino', min: 3500, max: 6999 },
  { nombre: 'Diamante', min: 7000, max: 12999 },
  { nombre: 'Élite', min: 13000, max: 21999 },
  { nombre: 'Master', min: 22000, max: 34999 },
  { nombre: 'Leyenda', min: 35000, max: 54999 },
  { nombre: 'GOAT', min: 55000, max: 999999 },
];

const RETOS_SEMANALES = [
  { id: 'semana_ejecutada', nombre: '🎯 Reto Básico', sp: 100, umbral: 50_000_000 },
  { id: 'semana_en_fuego', nombre: '🔥 Reto Intermedio', sp: 160, umbral: 80_000_000 },
  { id: 'semana_elite', nombre: '💎 Reto Élite', sp: 250, umbral: 100_000_000 },
];

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

const Dashboard = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [racha, setRacha] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [medallas, setMedallas] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [unidades, setUnidades] = useState(0);
  const [acvMes, setAcvMes] = useState(0);
  const [ventasSemana, setVentasSemana] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const isVcAdvisor = isVcAdvisorProfile(profile);

  useEffect(() => {
    if (!profile?.id) return;
    const now = new Date();
    const anioActual = now.getFullYear();
    const semanaISO = getISOWeek(now);
    const weekStart = getISOWeekStartDate(semanaISO, anioActual);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    let cancelled = false;

    const fetchData = async () => {
      setDataLoading(true);

      if (isVcAdvisor) {
        const [feedRes, snapshot] = await Promise.all([
          supabase.from('feed_reconocimientos').select('*').limit(5),
          getVcAdvisorSnapshot(profile),
        ]);
        if (cancelled) return;
        const metrics = snapshot?.metrics;
        setRacha(null);
        setKpis({ ventas: metrics?.currentMonthRevenue || 0, acv_f: metrics?.currentMonthAcv || 0 });
        setMedallas(snapshot?.medals || []);
        setFeed(feedRes.data || []);
        setUnidades(metrics?.currentMonthUnits || 0);
        setVentasSemana(metrics?.currentWeekRevenue || 0);
        setAcvMes(metrics?.totalAcv || 0);
        setDataLoading(false);
        return;
      }

      const [rachaRes, kpisRes, medallasRes, feedRes, unidadesRes, ventasSemanaRes] = await Promise.all([
        supabase.from('racha_activa').select('*').eq('gerente_id', profile.id).maybeSingle(),
        supabase.from('kpis_mes_actual').select('*').eq('gerente_id', profile.id).maybeSingle(),
        supabase.from('medallas').select('*').eq('gerente_id', profile.id).order('fecha_desbloqueo', { ascending: false }).limit(3),
        supabase.from('feed_reconocimientos').select('*').limit(5),
        supabase.from('ventas').select('id', { count: 'exact', head: true })
          .eq('gerente_id', profile.id)
          .gte('fecha_facturacion', `${anioActual}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
          .lt('fecha_facturacion', `${anioActual}-${String(now.getMonth() + 2).padStart(2, '0')}-01`),
        supabase.from('ventas').select('valor_producto')
          .eq('gerente_id', profile.id)
          .gte('fecha_facturacion', weekStart.toISOString().split('T')[0])
          .lt('fecha_facturacion', weekEnd.toISOString().split('T')[0]),
      ]);

      if (cancelled) return;
      setRacha(rachaRes.data);
      setKpis(kpisRes.data);
      setMedallas(medallasRes.data || []);
      setFeed(feedRes.data || []);
      setUnidades(unidadesRes.count || 0);
      setVentasSemana((ventasSemanaRes.data || []).reduce((s, v) => s + (Number(v.valor_producto) || 0), 0));

      if (profile.canal === 'VC') {
        const { data: acvData } = await supabase.from('acv_vc_mensual').select('acv_plus_total').eq('gerente_id', profile.id).maybeSingle();
        if (cancelled) return;
        setAcvMes(Number(acvData?.acv_plus_total) || 0);
      } else {
        setAcvMes(Number(kpisRes.data?.acv_f) || 0);
      }
      setDataLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.canal, profile?.nombre, profile?.gerente_id, profile?.role, isVcAdvisor]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin/gerentes" replace />;

  const sp = profile?.sp_totales || 0;
  const nivelActual = NIVELES.find((n) => sp >= n.min && sp <= n.max) || NIVELES[0];
  const nivelSiguiente = NIVELES[NIVELES.indexOf(nivelActual) + 1];

  return (
    <Layout title="Panel General">
      <motion.div className="space-y-5 max-w-[1200px]" variants={staggerContainer} initial="hidden" animate="show">

        {/* KPIs del Mes — barras de progreso */}
        <KpiProgressBars kpis={kpis} acvMes={acvMes} ventasSemana={ventasSemana} isVcAdvisor={isVcAdvisor} loading={dataLoading} />

        {/* Fila: SP Donut | Racha | Top Pointers */}
        <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={fadeUpItem}>
          {/* SP Donut */}
          <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm flex flex-col items-center" variants={popIn}>
            <h3 className="text-sm font-bold font-heading text-secondary mb-4 flex items-center gap-2 self-start">
              <span className="text-primary">⚡</span> Siigo Points gerente
            </h3>
            {dataLoading ? <Skeleton className="h-28 w-28 rounded-full" /> : (
              <DonutChart
                value={sp}
                max={nivelSiguiente?.min || sp}
                size={140}
                strokeWidth={12}
                color="hsl(var(--orange))"
                bgColor="hsl(var(--muted))"
              >
                <span className="text-xs text-muted-foreground font-semibold">{nivelActual.nombre}</span>
                <span className="text-lg font-black font-scoreboard text-primary">
                  {sp.toLocaleString()}/{(nivelSiguiente?.min || sp).toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">sp</span>
              </DonutChart>
            )}
          </motion.div>

          {/* Racha */}
          <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={popIn}>
            <h3 className="text-sm font-bold font-heading text-secondary mb-4 flex items-center gap-2">
              <span className="text-primary">🔥</span> Racha activa
            </h3>
            {dataLoading ? <Skeleton className="h-24 w-full" /> : racha && racha.semanas_consecutivas > 0 ? (
              <div className="text-center py-4">
                <p className="text-3xl font-black font-scoreboard text-orange">🔥 ×{racha.multiplicador}</p>
                <p className="text-sm font-bold text-foreground mt-2">{racha.nombre_racha}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{racha.semanas_consecutivas} semanas</p>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <span className="text-5xl mb-2 block">❄️</span>
                <p className="text-sm font-medium">Sin racha activa</p>
              </div>
            )}
          </motion.div>

          {/* Top Siigo Pointers */}
          <TopSiigoPointers canal={profile?.canal} loading={dataLoading} />
        </motion.div>

        {/* Retos + Medallas/Reconocimientos */}
        <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-4" variants={fadeUpItem}>
          {/* Retos de la Semana — 2 columnas */}
          <motion.div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold font-heading text-secondary flex items-center gap-2">
                <span className="text-primary">🎯</span> Retos de la Semana
              </h3>
              <Link to="/retos" className="text-xs text-primary font-bold hover:underline">Ver todos →</Link>
            </div>
            {dataLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {RETOS_SEMANALES.map((reto) => {
                  const pct = Math.min(100, (ventasSemana / reto.umbral) * 100);
                  const completed = pct >= 100;
                  return (
                    <div key={reto.id} className="flex flex-col items-center text-center p-4 border border-border rounded-xl">
                      <p className="text-xs font-bold text-foreground mb-1">{reto.nombre}</p>
                      <p className="text-[10px] text-muted-foreground mb-3">
                        <span className="text-primary font-scoreboard font-bold">⚡ {reto.sp} SP</span>
                      </p>
                      <DonutChart
                        value={ventasSemana}
                        max={reto.umbral}
                        size={100}
                        strokeWidth={8}
                        color={completed ? 'hsl(var(--accent))' : 'hsl(var(--orange))'}
                        bgColor="hsl(var(--muted))"
                      >
                        <span className="text-[10px] text-muted-foreground">ventas</span>
                        <span className={cn('text-xs font-black font-scoreboard', completed ? 'text-accent' : 'text-primary')}>
                          {(ventasSemana / 1_000_000).toFixed(0)}/{(reto.umbral / 1_000_000).toFixed(0)}
                        </span>
                      </DonutChart>
                      {completed && <p className="text-xs font-bold text-accent mt-2">✅ ¡Completado!</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Medallas + Reconocimientos stacked */}
          <div className="space-y-4">
            {/* Medallas Recientes */}
            <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
              <h3 className="text-sm font-bold font-heading text-secondary mb-3 flex items-center gap-2">
                <span className="text-primary">🏅</span> Medallas Recientes
              </h3>
              {dataLoading ? <Skeleton className="h-16" /> : medallas.length > 0 ? (
                <div className="space-y-2">
                  {medallas.slice(0, 3).map((m, i) => (
                    <div key={`${m.medalla}-${i}`} className="flex items-center gap-3 p-2 bg-muted/50 border border-border rounded-xl">
                      <span className="text-lg">🏅</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{m.medalla}</p>
                        <p className="text-[10px] font-bold font-scoreboard text-accent">+{m.sp_otorgados} SP</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <span className="text-3xl mb-1 block opacity-30">🏅</span>
                  <p className="text-xs">Aún no tienes medallas</p>
                </div>
              )}
            </motion.div>

            {/* Reconocimientos */}
            <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
              <h3 className="text-sm font-bold font-heading text-secondary mb-3 flex items-center gap-2">
                <span className="text-primary">🎖️</span> Reconocimientos
              </h3>
              {dataLoading ? <Skeleton className="h-16" /> : feed.length > 0 ? (
                <div className="space-y-2">
                  {feed.slice(0, 3).map((r) => (
                    <div key={r.id} className="flex items-start gap-3 p-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">🏆</div>
                      <div className="min-w-0">
                        <p className="text-xs text-foreground">
                          <span className="font-bold">{r.de_nombre}</span> — <span className="font-bold">{r.para_nombre}</span>
                        </p>
                        <p className="text-[10px] text-primary font-bold uppercase">{r.tipo?.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <span className="text-3xl mb-1 block opacity-30">🤝</span>
                  <p className="text-xs">Sin reconocimientos aún</p>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default Dashboard;
