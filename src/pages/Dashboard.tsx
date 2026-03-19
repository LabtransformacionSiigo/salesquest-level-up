import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, popIn, scoreboardSlide } from '@/lib/animations';
import siigoLogoWhite from '@/assets/siigo-logo-white.png';
import { getVcAdvisorSnapshot, isVcAdvisorProfile } from '@/lib/vc-advisor-data';

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
  const [topSeller, setTopSeller] = useState<any>(null);
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
        const [feedRes, topRes, snapshot] = await Promise.all([
          supabase.from('feed_reconocimientos').select('*').limit(5),
          supabase.from('ranking_general').select('*').eq('canal', profile?.canal).order('sp_totales', { ascending: false }).limit(1),
          getVcAdvisorSnapshot(profile),
        ]);

        if (cancelled) return;

        const metrics = snapshot?.metrics;
        setRacha(null);
        setKpis({
          ventas: metrics?.currentMonthRevenue || 0,
          acv_f: metrics?.currentMonthAcv || 0,
        });
        setMedallas(snapshot?.medals || []);
        setFeed(feedRes.data || []);
        setUnidades(metrics?.currentMonthUnits || 0);
        setVentasSemana(metrics?.currentWeekRevenue || 0);
        setTopSeller(topRes.data?.[0] || null);
        setAcvMes(metrics?.totalAcv || 0);
        setDataLoading(false);
        return;
      }

      const [rachaRes, kpisRes, medallasRes, feedRes, unidadesRes, ventasSemanaRes, topRes] = await Promise.all([
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
        supabase.from('ranking_general').select('*').eq('canal', profile.canal).order('sp_totales', { ascending: false }).limit(1),
      ]);

      if (cancelled) return;

      setRacha(rachaRes.data);
      setKpis(kpisRes.data);
      setMedallas(medallasRes.data || []);
      setFeed(feedRes.data || []);
      setUnidades(unidadesRes.count || 0);
      setVentasSemana((ventasSemanaRes.data || []).reduce((s, v) => s + (Number(v.valor_producto) || 0), 0));
      setTopSeller(topRes.data?.[0] || null);

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
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.canal, profile?.nombre, profile?.gerente_id, profile?.role, isVcAdvisor]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin/gerentes" replace />;

  const sp = profile?.sp_totales || 0;
  const nivelActual = NIVELES.find((n) => sp >= n.min && sp <= n.max) || NIVELES[0];
  const nivelSiguiente = NIVELES[NIVELES.indexOf(nivelActual) + 1];
  const progressPct = nivelSiguiente ? Math.min(100, ((sp - nivelActual.min) / (nivelSiguiente.min - nivelActual.min)) * 100) : 100;

  return (
    <Layout title="Panel Principal">
      <motion.div className="space-y-5 max-w-[1200px]" variants={staggerContainer} initial="hidden" animate="show">
        {topSeller && (
          <motion.div className="jumbotron rounded-3xl p-8 flex items-center gap-8" variants={fadeUpItem}>
            <div className="flex-shrink-0 relative">
              <div className="w-20 h-20 rounded-full bg-white/20 border-3 border-white/40 flex items-center justify-center text-4xl">
                🏆
              </div>
              <motion.div
                className="absolute -top-2 -right-2 text-2xl"
                animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
              >⭐</motion.div>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-[0.2em] mb-1 flex items-center gap-2 font-heading">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Top Performer · Líder del Canal
              </p>
              <p className="text-2xl font-black font-heading text-white">{topSeller.nombre}</p>
              <p className="text-xs text-white/70 flex items-center gap-2 mt-0.5">
                {topSeller.pais === 'COL' ? '🇨🇴' : topSeller.pais === 'MEX' ? '🇲🇽' : '🇪🇨'} {topSeller.canal?.replace(/_/g, ' ')}
                <span className="text-white/50">·</span>
                <span className="font-scoreboard text-white">{(topSeller.sp_totales || 0).toLocaleString()} SP</span>
              </p>
            </div>
            <motion.div
              className="text-6xl font-black font-scoreboard text-white/90"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >#1</motion.div>
            <img src={siigoLogoWhite} alt="Siigo" className="absolute bottom-4 right-6 h-5 opacity-30" />
          </motion.div>
        )}

        <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={fadeUpItem}>
          <motion.div className="bg-card border border-border rounded-2xl p-6 col-span-1 md:col-span-2 shadow-smooth-sm" whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1.5 font-heading">
                  <span>⚡</span> Siigo Points
                </p>
                <motion.p
                  className="text-4xl font-black font-scoreboard text-primary tracking-tight"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
                >
                  {sp.toLocaleString()}
                  <span className="text-lg font-bold text-primary ml-2">SP</span>
                </motion.p>
              </div>
              <motion.span className="inline-flex items-center gap-1.5 bg-primary text-white rounded-full px-4 py-2 text-sm font-bold" variants={popIn}>
                <span>🏅</span>{profile?.nivel}
              </motion.span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                <span>{nivelActual.nombre}</span>
                {nivelSiguiente && <span>{nivelSiguiente.nombre} · {nivelSiguiente.min.toLocaleString()} SP</span>}
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full progress-gradient" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }} />
              </div>
            </div>
          </motion.div>

          <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={popIn}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5 font-heading"><span>🔥</span> Racha Activa</p>
            {dataLoading ? <Skeleton className="h-16 w-full" /> : racha && racha.semanas_consecutivas > 0 ? (
              <motion.div className="text-center py-2" initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.6 }}>
                <p className="text-3xl font-black font-scoreboard text-siigo-orange">🔥 ×{racha.multiplicador}</p>
                <p className="text-sm font-bold text-foreground mt-2">{racha.nombre_racha}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{racha.semanas_consecutivas} semanas</p>
              </motion.div>
            ) : (
              <div className="text-center text-muted-foreground py-4"><span className="text-3xl mb-1 block">❄️</span><p className="text-sm font-medium">Sin racha activa</p></div>
            )}
          </motion.div>
        </motion.div>

        <motion.div className="bg-card border border-border border-t-[3px] border-t-primary rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
          <h3 className="text-sm font-bold font-heading text-secondary mb-4 flex items-center gap-2"><span>📊</span> Resumen del Mes</h3>
          {dataLoading ? (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : isVcAdvisor ? (
            <motion.div className="grid grid-cols-3 md:grid-cols-6 gap-3" variants={staggerContainer} initial="hidden" animate="show">
              <StatCard label="Ventas Mes" value={`$${((kpis?.ventas || 0) / 1_000_000).toFixed(1)}M`} emoji="💰" delay={0} />
              <StatCard label="Semana" value={`$${(ventasSemana / 1_000_000).toFixed(1)}M`} emoji="🔥" delay={0.05} />
              <StatCard label="Unidades" value={String(unidades)} emoji="📦" delay={0.1} />
              <StatCard label="ACV+ Mes" value={`$${((kpis?.acv_f || 0) / 1_000_000).toFixed(1)}M`} emoji="🗓️" delay={0.15} />
              <StatCard label="ACV+ Total" value={`$${(acvMes / 1_000_000).toFixed(1)}M`} emoji="📈" delay={0.2} />
              <StatCard label="Medallas" value={String(medallas.length)} emoji="🏅" delay={0.25} />
            </motion.div>
          ) : kpis ? (
            <motion.div className="grid grid-cols-3 md:grid-cols-6 gap-3" variants={staggerContainer} initial="hidden" animate="show">
              <StatCard label="Ventas" value={`$${(kpis.ventas / 1_000_000).toFixed(0)}M`} emoji="💰" delay={0} />
              <StatCard label="Cumpl." value={`${kpis.pct_cumplimiento}%`} emoji="🎯" delay={0.05}
                color={Number(kpis.pct_cumplimiento) >= 100 ? 'text-accent' : Number(kpis.pct_cumplimiento) >= 80 ? 'text-siigo-orange' : 'text-destructive'} />
              <StatCard label="Referidos" value={String(kpis.cant_recomendados || 0)} emoji="🤝" delay={0.1} />
              <StatCard label="Productividad" value={`$${((kpis.productividad_por_asesor || 0) / 1_000_000).toFixed(0)}M`} emoji="⚡" delay={0.15} />
              <StatCard label="Unidades" value={String(unidades)} emoji="📦" delay={0.2} />
              <StatCard label="ACV Mes" value={`$${(acvMes / 1_000_000).toFixed(1)}M`} emoji="📈" delay={0.25} />
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos de KPI para este mes</p>
          )}
        </motion.div>

        <motion.div className="bg-card border border-border border-t-[3px] border-t-primary rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold font-heading text-secondary flex items-center gap-2"><span>🎯</span> Retos de la Semana</h3>
            <Link to="/retos" className="text-xs text-primary font-bold hover:underline">Ver todos →</Link>
          </div>
          {dataLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : (
            <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-3" variants={staggerContainer} initial="hidden" animate="show">
              {RETOS_SEMANALES.map((reto) => {
                const pct = Math.min(100, (ventasSemana / reto.umbral) * 100);
                const completed = pct >= 100;
                return (
                  <motion.div key={reto.id} className={cn('bg-card border rounded-xl p-4 border-l-4 transition-all shadow-smooth-sm', completed ? 'border-l-accent' : 'border-l-muted')} variants={scoreboardSlide} whileHover={{ scale: 1.02 }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-foreground">{reto.nombre}</p>
                      <span className={cn('text-[10px] font-black font-scoreboard px-2 py-0.5 rounded-full', completed ? 'bg-accent text-white' : 'bg-muted text-muted-foreground')}>{reto.sp} SP</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5 font-medium">
                      <span>${(ventasSemana / 1_000_000).toFixed(0)}M / ${(reto.umbral / 1_000_000).toFixed(0)}M</span>
                      <span className="font-scoreboard">{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    {completed && <motion.p className="text-center text-xs font-bold text-accent mt-2" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>✅ ¡Completado!</motion.p>}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </motion.div>

        <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={fadeUpItem}>
          <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
            <h3 className="text-sm font-bold font-heading text-secondary mb-4 flex items-center gap-2"><span>🏅</span> Medallas Recientes</h3>
            {dataLoading ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div> : medallas.length > 0 ? (
              <motion.div className="space-y-2" variants={staggerContainer} initial="hidden" animate="show">
                {medallas.slice(0, 3).map((m, i) => (
                  <motion.div key={`${m.medalla}-${i}`} className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-xl hover:shadow-smooth-sm transition-shadow" variants={fadeUpItem}>
                    <motion.span className="text-xl" animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5, delay: i * 0.2 + 0.5 }}>🏅</motion.span>
                    <div className="flex-1"><p className="text-sm font-semibold text-foreground">{m.medalla}</p><p className="text-[11px] font-bold font-scoreboard text-accent">+{m.sp_otorgados} SP</p></div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-5xl mb-3 opacity-30">🏅</div>
                <p className="text-sm">Aún no tienes medallas</p>
              </div>
            )}
          </motion.div>

          <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
            <h3 className="text-sm font-bold font-heading text-secondary mb-4 flex items-center gap-2">
              <span>🎖️</span> Reconocimientos
              <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full ml-auto flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> EN VIVO</span>
            </h3>
            {dataLoading ? <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div> : feed.length > 0 ? (
              <motion.div className="space-y-2" variants={staggerContainer} initial="hidden" animate="show">
                {feed.map((r) => (
                  <motion.div key={r.id} className="flex items-start gap-3 p-3 bg-muted/50 border border-border rounded-xl" variants={fadeUpItem} whileHover={{ x: 4 }}>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">🤝</div>
                    <div className="min-w-0">
                      <p className="text-xs text-foreground font-medium"><span className="font-bold">{r.de_nombre}</span>{' → '}<span className="font-bold">{r.para_nombre}</span></p>
                      <p className="text-[11px] text-primary font-bold">{r.tipo?.replace(/_/g, ' ')}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-5xl mb-3 opacity-30">🤝</div>
                <p className="text-sm">Sin reconocimientos aún</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </Layout>
  );
};

const StatCard = ({ label, value, emoji, color, delay = 0 }: { label: string; value: string; emoji: string; color?: string; delay?: number }) => (
  <motion.div
    className="bg-white border border-border rounded-xl p-4 text-center hover:shadow-smooth-md transition-shadow"
    initial={{ opacity: 0, y: 15, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.35, delay: 0.4 + delay, ease: 'easeOut' }}
    whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
  >
    <span className="text-2xl mb-1 block">{emoji}</span>
    <p className={cn('text-lg font-black font-scoreboard', color || 'text-primary')}>{value}</p>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
  </motion.div>
);

export default Dashboard;
