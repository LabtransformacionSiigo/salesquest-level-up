import { useEffect, useRef, useState, useCallback } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, popIn } from '@/lib/animations';
import { useGamificationMetrics } from '@/hooks/useGamificationMetrics';
import DonutChart from '@/components/dashboard/DonutChart';
import KpiProgressBars from '@/components/dashboard/KpiProgressBars';
import TopSiigoPointers from '@/components/dashboard/TopSiigoPointers';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import CelebrationOverlay from '@/components/ui/CelebrationOverlay';
import bannerPrincipal from '@/assets/banner-principal.png';
import { getNivelThresholds } from '@/lib/niveles';

const RETOS_SEMANALES = [
  { id: 'semana_ejecutada', nombre: '🎯 Reto Básico', sp: 100, umbral: 50_000_000 },
  { id: 'semana_en_fuego', nombre: '🔥 Reto Intermedio', sp: 160, umbral: 80_000_000 },
  { id: 'semana_elite', nombre: '💎 Reto Élite', sp: 250, umbral: 100_000_000 },
];

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const Dashboard = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const isVN = profile?.canal === 'VN_ALIADOS' || profile?.canal === 'VN_EMPRESARIOS';
  const isVCGerente = profile?.canal === 'VC' && profile?.role !== 'asesor' && profile?.role !== 'admin' && profile?.role !== 'especialista';
  const showPeriodoSelector = isVN || isVCGerente;

  const now = new Date();
  const currentPeriodo = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [periodo, setPeriodo] = useState<string>(currentPeriodo);
  const periodoActivo = showPeriodoSelector ? periodo : undefined;
  const metrics = useGamificationMetrics(profile, periodoActivo);

  const sp = isVN ? (profile?.sp_periodo_actual ?? profile?.sp_totales ?? 0) : (profile?.sp_totales ?? 0);
  const { kpis, racha, medallas, feed, acvMes, ventasSemana, pctCumplimiento, topRanking, loading: dataLoading, isVcAdvisor, teamAsesorPerformance } = metrics;

  // Period options: current year months + last 3 months of previous year
  const periodoOptions = (() => {
    const opts: { value: string; label: string }[] = [];
    const yearNow = now.getFullYear();
    for (let m = 11; m >= 0; m--) {
      const value = `${yearNow}${String(m + 1).padStart(2, '0')}`;
      opts.push({ value, label: `${MESES[m]} ${yearNow}` });
    }
    for (let m = 11; m >= 9; m--) {
      const value = `${yearNow - 1}${String(m + 1).padStart(2, '0')}`;
      opts.push({ value, label: `${MESES[m]} ${yearNow - 1}` });
    }
    return opts;
  })();

  // Celebration state
  const [celebration, setCelebration] = useState<{ show: boolean; type: 'level_up' | 'meta_cumplida'; title?: string; subtitle?: string }>({ show: false, type: 'level_up' });
  const prevSpRef = useRef<number | null>(null);
  const prevPctRef = useRef<number | null>(null);
  const celebrationShown = useRef(false);

  useEffect(() => {
    if (dataLoading || celebrationShown.current) return;

    const thresholds = getNivelThresholds(profile?.canal);
    const getNivelIndex = (s: number) => {
      for (let i = thresholds.length - 1; i >= 0; i--) {
        if (s >= thresholds[i]) return i;
      }
      return 0;
    };

    // Check level up
    if (prevSpRef.current !== null && prevSpRef.current !== sp) {
      const oldLevel = getNivelIndex(prevSpRef.current);
      const newLevel = getNivelIndex(sp);
      if (newLevel > oldLevel) {
        const names = ['Cuarzo', 'Rubí', 'Zafiro', 'Esmeralda', 'Diamante'];
        setCelebration({ show: true, type: 'level_up', title: `🚀 ¡Nivel ${names[newLevel]}!`, subtitle: '¡Has subido de nivel! Sigue escalando.' });
        celebrationShown.current = true;
      }
    }

    // Check meta cumplida (first time crossing 100%)
    const pct = pctCumplimiento;
    if (prevPctRef.current !== null && prevPctRef.current < 100 && pct >= 100 && !celebrationShown.current) {
      setCelebration({ show: true, type: 'meta_cumplida' });
      celebrationShown.current = true;
    }

    prevSpRef.current = sp;
    prevPctRef.current = pct;
  }, [sp, pctCumplimiento, dataLoading]);

  const handleCelebrationComplete = useCallback(() => {
    setCelebration(prev => ({ ...prev, show: false }));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin/gerentes" replace />;
  if (profile?.role === 'especialista') return <Navigate to="/admin/especialista" replace />;

  return (
    <Layout title="Panel General">
      <CelebrationOverlay show={celebration.show} type={celebration.type} title={celebration.title} subtitle={celebration.subtitle} onComplete={handleCelebrationComplete} />
      <motion.div className="space-y-6 max-w-[1400px]" variants={staggerContainer} initial="hidden" animate="show">

        {/* Hero Banner */}
        <motion.div
          className="relative rounded-2xl overflow-hidden h-28"
          variants={fadeUpItem}
          style={{ backgroundImage: `url(${bannerPrincipal})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className="absolute inset-0 bg-secondary/50" />
          {/* Shimmer overlay */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          />
          <div className="relative z-10 h-full flex items-center px-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <p className="text-white/70 text-sm font-medium">Bienvenido de nuevo,</p>
              <h2 className="text-2xl font-black font-heading text-white">{profile?.nombre || 'Usuario'}</h2>
            </motion.div>
            <motion.div
              className="ml-auto text-right flex items-center gap-6"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div className="text-right" title="Siigo Points · Solo cumplimiento de meta">
                <AnimatedCounter value={sp} className="text-3xl font-black font-scoreboard text-white" duration={1.5} />
                <p className="text-xs text-white/60 font-scoreboard uppercase">⚡ Siigo Points</p>
              </div>
              <div className="text-right border-l border-white/20 pl-6" title="SP Canje · Medallas, retos y reconocimientos">
                <AnimatedCounter value={profile?.sp_canje || 0} className="text-2xl font-black font-scoreboard text-white" duration={1.5} />
                <p className="text-xs text-white/60 font-scoreboard uppercase">🎁 SP Canje</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Period selector (VN Aliados/Empresarios + VC Gerente) */}
        {showPeriodoSelector && (
          <motion.div className="flex items-center justify-end gap-3" variants={fadeUpItem}>
            <label htmlFor="periodo-sel" className="text-xs font-bold uppercase text-muted-foreground">
              📅 Periodo
            </label>
            <select
              id="periodo-sel"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {periodoOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {periodo !== currentPeriodo && (
              <button
                type="button"
                onClick={() => setPeriodo(currentPeriodo)}
                className="text-xs font-bold text-primary hover:underline"
              >
                Volver al actual
              </button>
            )}
          </motion.div>
        )}

        {/* KPIs del Mes */}
        <KpiProgressBars kpis={kpis} acvMes={acvMes} ventasSemana={ventasSemana} isVcAdvisor={isVcAdvisor} loading={dataLoading} pctCumplimiento={pctCumplimiento} sp={sp} canal={profile?.canal} ejecucion={metrics.ejecucion} metaAsesor={metrics.metaAsesor} isVCGerente={isVCGerente} teamAsesorPerformance={teamAsesorPerformance} vcCumplimiento={metrics.vcCumplimiento} />

        {/* Racha + Top Pointers */}
        <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-5" variants={fadeUpItem}>
          {/* Racha */}
          <motion.div
            className="bg-card border border-border rounded-2xl p-8 shadow-smooth-sm"
            variants={popIn}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
          >
            <h3 className="text-base font-bold font-heading text-secondary mb-5 flex items-center gap-2">
              <span className="text-primary">🔥</span> Racha activa
            </h3>
            {dataLoading ? <Skeleton className="h-28 w-full" /> : racha && racha.semanas_consecutivas > 0 ? (
              <div className="text-center py-6">
                <motion.p
                  className="text-4xl font-black font-scoreboard text-orange"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                >
                  <motion.span
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >🔥</motion.span> ×{racha.multiplicador}
                </motion.p>
                <p className="text-base font-bold text-foreground mt-3">{racha.nombre_racha}</p>
                <p className="text-sm text-muted-foreground mt-1">{racha.semanas_consecutivas} semanas</p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <motion.span
                  className="text-6xl mb-3 block"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >❄️</motion.span>
                <p className="text-base font-medium">Sin racha activa</p>
              </div>
            )}
          </motion.div>

          {/* Top Siigo Pointers */}
          <TopSiigoPointers canal={profile?.canal ?? null} loading={dataLoading} isVC={profile?.canal === 'VC'} topRanking={topRanking} />
        </motion.div>

        {/* Retos + Medallas/Reconocimientos */}
        <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-5" variants={fadeUpItem}>
          {/* Retos de la Semana */}
          <motion.div className="lg:col-span-2 bg-card border border-border rounded-2xl p-8 shadow-smooth-sm" variants={fadeUpItem}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold font-heading text-secondary flex items-center gap-2">
                <span className="text-primary">🎯</span> Retos de la Semana
              </h3>
              <Link to="/retos" className="text-sm text-primary font-bold hover:underline">Ver todos →</Link>
            </div>
            {dataLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
            ) : (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-5"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {RETOS_SEMANALES.map((reto, idx) => {
                  const pct = Math.min(100, (ventasSemana / reto.umbral) * 100);
                  const completed = pct >= 100;
                  return (
                    <motion.div
                      key={reto.id}
                      className="flex flex-col items-center text-center p-5 border border-border rounded-xl"
                      variants={popIn}
                      whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
                    >
                      <p className="text-sm font-bold text-foreground mb-1">{reto.nombre}</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        <span className="text-accent font-scoreboard font-bold">🎁 {reto.sp} Canjeables</span>
                      </p>
                      <DonutChart
                        value={ventasSemana}
                        max={reto.umbral}
                        size={120}
                        strokeWidth={10}
                        color={completed ? 'hsl(var(--accent))' : 'hsl(var(--orange))'}
                        bgColor="hsl(var(--muted))"
                      >
                        <span className="text-xs text-muted-foreground">ventas</span>
                        <span className={cn('text-sm font-black font-scoreboard', completed ? 'text-accent' : 'text-primary')}>
                          {(ventasSemana / 1_000_000).toFixed(0)}/{(reto.umbral / 1_000_000).toFixed(0)}
                        </span>
                      </DonutChart>
                      {completed && (
                        <motion.p
                          className="text-sm font-bold text-accent mt-3"
                          initial={{ scale: 0 }}
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.5 }}
                        >✅ ¡Completado!</motion.p>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>

          {/* Medallas + Reconocimientos stacked */}
          <div className="space-y-5">
            {/* Medallas Recientes */}
            <motion.div
              className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm"
              variants={fadeUpItem}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <h3 className="text-base font-bold font-heading text-secondary mb-4 flex items-center gap-2">
                <span className="text-primary">🏅</span> Medallas Recientes
              </h3>
              {dataLoading ? <Skeleton className="h-20" /> : medallas.length > 0 ? (
                <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="show">
                  {medallas.slice(0, 3).map((m, i) => (
                    <motion.div
                      key={`${m.medalla}-${i}`}
                      className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-xl"
                      variants={fadeUpItem}
                      whileHover={{ x: 4, transition: { duration: 0.15 } }}
                    >
                      <motion.span
                        className="text-2xl"
                        animate={{ rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.8, delay: i * 0.2 + 0.5 }}
                      >🏅</motion.span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{m.medalla}</p>
                        <p className="text-xs font-bold font-scoreboard text-accent">🎁 +{m.sp_otorgados} Canjeables</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <span className="text-4xl mb-2 block opacity-30">🏅</span>
                  <p className="text-sm">Aún no tienes medallas</p>
                </div>
              )}
            </motion.div>

            {/* Reconocimientos */}
            <motion.div
              className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm"
              variants={fadeUpItem}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <h3 className="text-base font-bold font-heading text-secondary mb-4 flex items-center gap-2">
                <span className="text-primary">🎖️</span> Reconocimientos
              </h3>
              {dataLoading ? <Skeleton className="h-20" /> : feed.length > 0 ? (
                <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="show">
                  {feed.slice(0, 3).map((r) => (
                    <motion.div
                      key={r.id}
                      className="flex items-start gap-3 p-3"
                      variants={fadeUpItem}
                      whileHover={{ x: 4, transition: { duration: 0.15 } }}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-lg">🏆</div>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-bold">{r.de_nombre}</span> — <span className="font-bold">{r.para_nombre}</span>
                        </p>
                        <p className="text-xs text-primary font-bold uppercase mt-0.5">{r.tipo?.replace(/_/g, ' ')}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <span className="text-4xl mb-2 block opacity-30">🤝</span>
                  <p className="text-sm">Sin reconocimientos aún</p>
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
