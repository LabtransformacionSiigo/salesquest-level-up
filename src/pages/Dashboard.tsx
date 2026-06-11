import { useEffect, useRef, useState, useCallback } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, popIn } from '@/lib/animations';
import { useGamificationMetrics } from '@/hooks/useGamificationMetrics';
import { useSpConvencionAnual } from '@/lib/sp-convencion-store';
import { useSpConvencionAnualSelf } from '@/hooks/useSpConvencionAnualSelf';
import DonutChart from '@/components/dashboard/DonutChart';
import KpiProgressBars from '@/components/dashboard/KpiProgressBars';

import AnimatedCounter from '@/components/ui/AnimatedCounter';
import CelebrationOverlay from '@/components/ui/CelebrationOverlay';
import bannerPrincipal from '@/assets/banner-principal.png';
import { getNivelThresholds } from '@/lib/niveles';
import { supabase } from '@/integrations/supabase/client';
import { filterCatalogByScope, normalizeCatalogWindow } from '@/lib/catalog-scope';


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

  const spAnualStore = useSpConvencionAnual();
  const spAnualSelf = useSpConvencionAnualSelf(profile);
  const isVC = profile?.canal === 'VC';
  const sp = isVC
    ? ((profile as any)?.sp_totales ?? 0)
    : (spAnualStore ?? spAnualSelf ?? (profile as any)?.sp_totales ?? 0);
  const { kpis, racha, medallas, feed, acvMes, ventasSemana, pctCumplimiento, topRanking, loading: dataLoading, isVcAdvisor, teamAsesorPerformance } = metrics;

  // Catálogo dinámico de retos semanales filtrado por canal/país del usuario
  const [catalogRetosSemana, setCatalogRetosSemana] = useState<any[]>([]);
  useEffect(() => {
    if (!profile?.canal) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('catalogo_retos')
        .select('*')
        .eq('activo', true)
        .or(`canal.eq.${profile.canal},canal.is.null`);
      if (cancelled) return;
      const semanales = (data || []).filter((r: any) => normalizeCatalogWindow(r.ventana_tiempo) === 'SEMANAL');
      setCatalogRetosSemana(filterCatalogByScope(semanales as any[], profile));
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.canal, profile?.pais, profile?.gerente_id, profile?.role]);

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
        <KpiProgressBars kpis={kpis} acvMes={acvMes} ventasSemana={ventasSemana} isVcAdvisor={isVcAdvisor} loading={dataLoading} pctCumplimiento={pctCumplimiento} sp={sp} canal={profile?.canal} pais={profile?.pais} ejecucion={metrics.ejecucion} metaAsesor={metrics.metaAsesor} isVCGerente={isVCGerente} teamAsesorPerformance={teamAsesorPerformance} vcCumplimiento={metrics.vcCumplimiento} periodoSeleccionado={periodoActivo || currentPeriodo} lastUpdated={metrics.lastUpdated} />

      </motion.div>
    </Layout>
  );
};

export default Dashboard;
