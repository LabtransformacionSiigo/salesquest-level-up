import { useEffect, useRef, useState, useCallback } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, slideInRight, popIn, shimmerLine } from '@/lib/animations';
import { useGamificationMetrics, type EjecucionAsesor, type MetaAsesor } from '@/hooks/useGamificationMetrics';
import CelebrationOverlay from '@/components/ui/CelebrationOverlay';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import bannerPerformance from '@/assets/banner-performance.png';

const FLAG_MAP: Record<string, string> = { COL: '🇨🇴', MEX: '🇲🇽', ECU: '🇪🇨' };
const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn('material-icons-round', className)}>{icon}</span>
);

const InfoTip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground cursor-help hover:bg-primary/10 hover:text-primary transition-colors">
        <MI icon="help_outline" className="!text-[14px]" />
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">{text}</TooltipContent>
  </Tooltip>
);

const MiPerformance = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const metrics = useGamificationMetrics(profile);

  const canal = profile?.canal;
  const isAliados = canal === 'VN_ALIADOS';
  const isEmpresarios = canal === 'VN_EMPRESARIOS';
  const canalLabel = metrics.isVC ? 'Venta Cruzada' : isAliados ? 'Venta Nueva — Aliados' : 'Venta Nueva — Empresarios';

  // Celebration for meta cumplida
  const [celebration, setCelebration] = useState<{ show: boolean; type: 'level_up' | 'meta_cumplida' }>({ show: false, type: 'meta_cumplida' });
  const prevPctRef = useRef<number | null>(null);
  const celebrationShown = useRef(false);

  const pctValue = metrics.vcCumplimiento?.pct || metrics.kpis?.pct_cumplimiento || 0;
  
  useEffect(() => {
    if (metrics.loading || celebrationShown.current) return;
    if (prevPctRef.current !== null && prevPctRef.current < 100 && pctValue >= 100) {
      setCelebration({ show: true, type: 'meta_cumplida' });
      celebrationShown.current = true;
    }
    prevPctRef.current = pctValue;
  }, [pctValue, metrics.loading]);

  const handleCelebrationComplete = useCallback(() => setCelebration(p => ({ ...p, show: false })), []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const { kpis, vcSnapshot, vcCumplimiento, vcMonthlyCumplimiento, acvData, productBreakdown, upgradesCount, loading: dataLoading, isVcAdvisor, isVC } = metrics;

  const vcMetrics = vcSnapshot?.metrics;
  const vcBlocks = vcSnapshot?.blockTotals;
  const vcHistory = isVcAdvisor ? (vcMetrics?.monthlyHistory || []) : acvData;
  const vcHeadlineValue = isVcAdvisor ? vcMetrics?.totalAcv || 0 : metrics.acvMes;
  const vcUnitsTotal = isVcAdvisor ? Number(vcMetrics?.currentMonthUnits) || 0 : Number(acvData[0]?.unidades) || metrics.unidades;
  const vcUnitsLabel = `Sumatoria de unidades del mes: ${vcUnitsTotal} ${vcUnitsTotal === 1 ? 'unidad' : 'unidades'}`;

  return (
    <Layout title="📊 Mi Performance">
      <CelebrationOverlay show={celebration.show} type={celebration.type} onComplete={handleCelebrationComplete} />
      <TooltipProvider delayDuration={200}>
        <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
          {/* ═══ BANNER ═══ */}
          <motion.div 
            className="relative rounded-2xl overflow-hidden shadow-smooth-md"
            variants={fadeUpItem}
            whileHover={{ scale: 1.005, transition: { duration: 0.3 } }}
          >
            {/* Background image + gradient overlay */}
            <div className="absolute inset-0" style={{ backgroundImage: `url(${bannerPerformance})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-secondary/80 via-primary/70 to-primary/50" />
            
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
              variants={shimmerLine}
              initial="hidden"
              animate="show"
            />

            <div className="relative z-10 flex items-center gap-5 p-6">
              {/* Avatar */}
              <motion.div 
                className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/50 flex items-center justify-center shadow-lg"
                variants={popIn}
                initial="hidden"
                animate="show"
              >
                <MI icon="person" className="text-white !text-2xl" />
              </motion.div>

              {/* Name + channel */}
              <motion.div 
                className="flex-1 min-w-0"
                variants={slideInRight}
                initial="hidden"
                animate="show"
              >
                <p className="text-xl font-black font-heading text-white drop-shadow-md truncate">{profile?.nombre}</p>
                <p className="text-xs text-white/80 flex items-center gap-2 mt-0.5">
                  <span className="text-base">{FLAG_MAP[profile?.pais || ''] || '🌎'}</span>
                  <span className="bg-white/20 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-white/20">{canalLabel}</span>
                </p>
              </motion.div>

              {/* SP counter */}
              <motion.div 
                className="text-right flex items-center gap-6"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
              >
                <div className="text-right" title="Siigo Points · Solo cumplimiento de meta">
                  <div className="flex items-baseline gap-1.5">
                    <motion.span
                      className="text-lg"
                      animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 4 }}
                    >⚡</motion.span>
                    <AnimatedCounter value={profile?.sp_totales || 0} className="text-3xl font-black font-scoreboard text-white drop-shadow-lg" duration={1.5} />
                  </div>
                  <p className="text-[10px] text-white/70 font-scoreboard tracking-widest mt-0.5">SIIGO POINTS</p>
                </div>
                 <div className="text-right border-l border-white/20 pl-6" title="SP Canje · Medallas, retos y reconocimientos">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg">🎁</span>
                    <AnimatedCounter value={profile?.sp_canje || 0} className="text-2xl font-black font-scoreboard text-white drop-shadow-lg" duration={1.5} />
                  </div>
                  <p className="text-[10px] text-white/70 font-scoreboard tracking-widest mt-0.5">SP CANJE</p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {dataLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
          ) : (
            <>
              {isEmpresarios && (
                <>
                  <SectionTitle icon="bar_chart" title="Unidades · ACV+ · Referidos" tip="Métricas principales que alimentan tu puntaje." />
                  <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    <KPICard icon="inventory_2" label="Unidades" value={`${metrics.ejecucion?.ventas_total ?? kpis?.ventas ?? 0} / ${metrics.metaAsesor?.meta_total ?? kpis?.meta ?? 0}`} sub="Vendidas vs Meta" tip="Unidades vendidas este mes vs meta asignada." />
                    <KPICard icon="trending_up" label="ACV+" value={formatMoney(metrics.ejecucion?.acv_total ?? kpis?.acv_f)} sub="Valor contractual anual" color="text-primary" tip="Valor anualizado de contratos cerrados." />
                    <KPICard icon="group_add" label="# de Referidos" value={String(metrics.ejecucion?.cant_recomendados ?? kpis?.cant_recomendados ?? 0)} sub="Referidos generados" color="text-accent" tip="Clientes por recomendación." />
                  </motion.div>
                  <SectionTitle icon="emoji_events" title="Retos Semanales" tip="Desafíos semanales para SP extra." />
                  <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    <RetoCard icon="target" label="Efectividad SQL" value={`${kpis?.efectividad_sql_pct || 0}%`} progress={Number(kpis?.efectividad_sql_pct || 0)} description="% SQL convertidos" tip="(Ventas SQL ÷ Total SQL) × 100." />
                    <RetoCard icon="speed" label="Productividad" value={formatMoney(kpis?.productividad_por_asesor)} progress={Math.min(100, ((kpis?.productividad_por_asesor || 0) / 5_000_000) * 100)} description="Ventas / HC activo" tip="Ventas totales ÷ Headcount activo." />
                  </motion.div>
                  <VnCumplimientoSection kpis={kpis} ejecucion={metrics.ejecucion} metaAsesor={metrics.metaAsesor} />
                  {vcMonthlyCumplimiento.length > 0 && <VnHistorialSection data={vcMonthlyCumplimiento} canal={canal} />}
                </>
              )}

              {isAliados && (
                <>
                  <SectionTitle icon="bar_chart" title="Unidades · ACV+ · Referidos" />
                  <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    <KPICard icon="inventory_2" label="Unidades" value={`${metrics.ejecucion?.ventas_total ?? kpis?.ventas ?? 0} / ${metrics.metaAsesor?.meta_total ?? kpis?.meta ?? 0}`} sub="Vendidas vs Meta" />
                    <KPICard icon="trending_up" label="ACV+" value={formatMoney(metrics.ejecucion?.acv_total ?? kpis?.acv_f)} sub="Valor contractual anual" color="text-primary" />
                    <KPICard icon="person_add" label="Referidos del Contador" value={String(metrics.ejecucion?.cant_recomendados ?? kpis?.cant_recomendados ?? 0)} sub="Referidos de aliados" color="text-accent" />
                  </motion.div>
                  <SectionTitle icon="emoji_events" title="Retos Semanales" />
                  <motion.div className="grid grid-cols-1 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    <RetoCard icon="handshake" label="Efectividad Referidos" value={`${kpis?.efectividad_referidos_pct || 0}%`} progress={Number(kpis?.efectividad_referidos_pct || 0)} description="% referidos convertidos" />
                  </motion.div>
                  <VnCumplimientoSection kpis={kpis} ejecucion={metrics.ejecucion} metaAsesor={metrics.metaAsesor} />
                  {vcMonthlyCumplimiento.length > 0 && <VnHistorialSection data={vcMonthlyCumplimiento} canal={canal} />}
                </>
              )}

              {isVC && (
                <>
                  <SectionTitle icon="bar_chart" title="ACV+" />
                  <motion.div className="bg-white border border-border rounded-2xl p-8 text-center shadow-smooth-sm" variants={fadeUpItem}>
                    <MI icon="add_chart" className="text-4xl text-primary mb-2" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-heading">
                      {isVcAdvisor ? 'ACV+ Acumulado' : 'ACV+ del Mes'}
                    </p>
                    <p className="text-4xl font-bold font-scoreboard text-primary">{formatMoney(vcHeadlineValue)}</p>
                    <p className="text-sm text-muted-foreground mt-2">{vcUnitsLabel}</p>
                  </motion.div>

                  {(isVcAdvisor || productBreakdown.length > 0 || acvData.length > 0) && (
                    <>
                      <SectionTitle icon="pie_chart" title="Desglose por Producto" />
                      <motion.div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                        {(isVcAdvisor
                          ? [
                              { label: 'Nómina-e', value: vcBlocks?.acv_nomina || 0 },
                              { label: 'FE', value: vcBlocks?.acv_fe || 0 },
                              { label: 'Conversiones', value: vcBlocks?.acv_conversiones || 0 },
                            ].filter(b => b.value > 0)
                          : productBreakdown
                        ).map((b) => (
                          <BloqueCard key={b.label} label={b.label} value={b.value} units={(b as any).units} />
                        ))}
                      </motion.div>
                    </>
                  )}

                  {/* Historial Mensual: ACV vs Meta */}
                  {vcMonthlyCumplimiento.length > 0 && (
                    <>
                      <SectionTitle icon="calendar_month" title="Historial Mensual" tip="ACV+ logrado vs Meta por mes, con % de cumplimiento." />
                      <motion.div className="bg-white border border-border rounded-2xl overflow-hidden shadow-smooth-sm" variants={fadeUpItem}>
                        <table className="w-full">
                          <thead>
                            <tr className="bg-primary text-white text-[11px] uppercase tracking-wider font-heading">
                              <th className="text-left px-4 py-3">Mes</th>
                              <th className="text-right px-4 py-3">ACV+</th>
                              <th className="text-right px-4 py-3">Meta</th>
                              <th className="text-right px-4 py-3">% Cumpl.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vcMonthlyCumplimiento.map((m, i) => (
                              <motion.tr
                                key={m.mes}
                                className="border-b border-border hover:bg-primary/5 transition-colors"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.25, delay: i * 0.06 + 0.2 }}
                              >
                                <td className="px-4 py-3 text-sm font-medium text-foreground">{m.mes}</td>
                                <td className="px-4 py-3 text-sm font-bold font-scoreboard text-primary text-right">{formatMoney(m.acv)}</td>
                                <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(m.meta)}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={cn(
                                    "text-sm font-bold font-scoreboard px-2 py-0.5 rounded-full",
                                    m.pct >= 100 ? "bg-green-100 text-green-700" : m.pct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                                  )}>
                                    {m.pct}%
                                  </span>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </motion.div>
                    </>
                  )}

                </>
              )}

              {!kpis && !isVC && (
                <motion.div className="text-center py-16" variants={fadeUpItem}>
                  <div className="text-7xl mb-4 opacity-30">📊</div>
                  <p className="text-lg font-bold text-muted-foreground">Sin datos de KPI para este mes</p>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </TooltipProvider>
    </Layout>
  );
};

const formatMoney = (val: number | null | undefined) => {
  const n = val || 0;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

const SectionTitle = ({ icon, title, tip }: { icon: string; title: string; tip?: string }) => (
  <motion.h3 className="flex items-center gap-2 text-sm font-bold font-heading text-secondary uppercase tracking-wider pt-2" variants={fadeUpItem}>
    <MI icon={icon} className="text-primary text-lg" />{title}{tip && <InfoTip text={tip} />}
  </motion.h3>
);

const KPICard = ({ icon, label, value, sub, color, tip }: { icon: string; label: string; value: string; sub: string; color?: string; tip?: string }) => (
  <motion.div className="bg-white border border-border rounded-2xl p-6 text-center hover:shadow-smooth-md transition-shadow relative shadow-smooth-sm" variants={fadeUpItem}>
    {tip && <div className="absolute top-3 right-3"><InfoTip text={tip} /></div>}
    <MI icon={icon} className={cn('text-3xl mb-2', color || 'text-primary')} />
    <p className={cn('text-3xl font-bold font-scoreboard', color || 'text-primary')}>{value}</p>
    <p className="text-xs font-semibold text-secondary uppercase tracking-wider mt-1 font-heading">{label}</p>
    <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
  </motion.div>
);

const RetoCard = ({ icon, label, value, progress, description, tip }: { icon: string; label: string; value: string; progress: number; description: string; tip?: string }) => (
  <motion.div className="bg-white border border-border rounded-2xl p-6 relative shadow-smooth-sm" variants={fadeUpItem}>
    {tip && <div className="absolute top-3 right-3"><InfoTip text={tip} /></div>}
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><MI icon={icon} className="text-primary text-xl" /></div>
      <div><p className="text-sm font-bold text-foreground">{label}</p><p className="text-[11px] text-muted-foreground">{description}</p></div>
      <span className="ml-auto text-2xl font-bold font-scoreboard text-primary">{value}</span>
    </div>
    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, progress)}%` }} /></div>
  </motion.div>
);

const VnCumplimientoSection = ({ kpis, ejecucion, metaAsesor }: { kpis: any; ejecucion?: EjecucionAsesor | null; metaAsesor?: MetaAsesor | null }) => {
  const acv = ejecucion?.acv_total ?? Number(kpis?.acv_f) ?? 0;
  const metaAcv = metaAsesor?.meta_acv ?? 0;
  const pct = metaAcv > 0 ? Math.round((acv / metaAcv) * 100) : 0;
  const ventas = ejecucion?.ventas_total ?? Number(kpis?.ventas) ?? 0;
  const meta = metaAsesor?.meta_total ?? Number(kpis?.meta) ?? 0;
  const referidos = ejecucion?.cant_recomendados ?? Number(kpis?.cant_recomendados) ?? 0;
  return (
    <>
      <SectionTitle icon="donut_large" title="Cumplimiento de Meta" tip="(ACV+ logrado ÷ Meta ACV) × 100." />
      <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
        <div className="flex items-center gap-8">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeDasharray={`${Math.min(100, pct) * 3.14} 314`} strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold font-scoreboard text-primary">{pct}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <MetaRow label="ACV+" value={formatMoney(acv)} />
            <MetaRow label="Meta ACV" value={formatMoney(metaAcv)} />
            <MetaRow label="Unidades" value={`${ventas} / ${meta}`} />
            <MetaRow label="Referidos" value={String(referidos)} />
          </div>
        </div>
      </motion.div>
    </>
  );
};

const VnHistorialSection = ({ data, canal }: { data: any[]; canal?: string | null }) => (
  <>
    <SectionTitle icon="calendar_month" title="Historial Mensual" tip="ACV+ logrado vs Meta ACV por mes, con % de cumplimiento." />
    <motion.div className="bg-card border border-border rounded-2xl overflow-hidden shadow-smooth-sm" variants={fadeUpItem}>
      <table className="w-full">
        <thead>
          <tr className="bg-primary text-primary-foreground text-[11px] uppercase tracking-wider font-heading">
            <th className="text-left px-4 py-3">Mes</th>
            <th className="text-right px-4 py-3">ACV+</th>
            <th className="text-right px-4 py-3">Meta ACV</th>
            <th className="text-right px-4 py-3">% Cumpl.</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m, i) => (
            <motion.tr
              key={m.mes}
              className="border-b border-border hover:bg-primary/5 transition-colors"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06 + 0.2 }}
            >
              <td className="px-4 py-3 text-sm font-medium text-foreground">{m.mes}</td>
              <td className="px-4 py-3 text-sm font-bold font-scoreboard text-primary text-right">{formatMoney(m.acv)}</td>
              <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(m.meta)}</td>
              <td className="px-4 py-3 text-right">
                <span className={cn(
                  "text-sm font-bold font-scoreboard px-2 py-0.5 rounded-full",
                  m.pct >= 100 ? "bg-accent/10 text-accent" : m.pct >= 70 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                )}>
                  {m.pct}%
                </span>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  </>
);

const CumplimientoSection = ({ kpis }: { kpis: any }) => (
  <>
    <SectionTitle icon="donut_large" title="Cumplimiento de Meta" tip="(Ventas actuales ÷ Meta) × 100." />
    <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
      <div className="flex items-center gap-8">
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeDasharray={`${Math.min(100, Number(kpis?.pct_cumplimiento || 0)) * 3.14} 314`} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold font-scoreboard text-primary">{kpis?.pct_cumplimiento || 0}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <MetaRow label="Ventas" value={formatMoney(kpis?.ventas)} />
          <MetaRow label="Meta" value={formatMoney(kpis?.meta)} />
          <MetaRow label="HC Final" value={String(kpis?.hc_final || 0)} />
          <MetaRow label="Terminaciones" value={String(kpis?.terminaciones || 0)} />
        </div>
      </div>
    </motion.div>
  </>
);

const MetaRow = ({ label, value }: { label: string; value: string }) => (
  <p><span className="text-muted-foreground">{label}:</span> <span className="font-semibold text-foreground">{value}</span></p>
);

const BloqueCard = ({ label, value, units }: { label: string; value: number; units?: number }) => (
  <motion.div className="bg-white border border-border rounded-2xl p-5 text-center hover:shadow-smooth-md transition-shadow shadow-smooth-sm" variants={fadeUpItem}>
    <p className="text-xl font-bold font-scoreboard text-foreground">{formatMoney(value)}</p>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    {units != null && units > 0 && (
      <p className="text-[11px] text-muted-foreground mt-1">{units} {units === 1 ? 'unidad' : 'unidades'}</p>
    )}
  </motion.div>
);

const BloqueCardCount = ({ label, count, color }: { label: string; count: number; color: string }) => (
  <motion.div className="bg-white border border-border rounded-2xl p-5 text-center hover:shadow-smooth-md transition-shadow shadow-smooth-sm" variants={fadeUpItem}>
    <div className={cn('w-3 h-3 rounded-full mx-auto mb-3', color)} />
    <p className="text-xl font-bold font-scoreboard text-foreground">{count.toLocaleString()}</p>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
  </motion.div>
);

export default MiPerformance;
