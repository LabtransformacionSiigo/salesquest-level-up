import { useEffect, useRef, useState, useCallback } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, slideInRight, popIn, shimmerLine } from '@/lib/animations';
import { useGamificationMetrics, type EjecucionAsesor, type MetaAsesor, type AsesorPerformance } from '@/hooks/useGamificationMetrics';
import CelebrationOverlay from '@/components/ui/CelebrationOverlay';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import bannerPerformance from '@/assets/banner-performance.png';

import { setSpConvencionAnual, useSpConvencionAnual } from '@/lib/sp-convencion-store';
import { useSpConvencionAnualSelf } from '@/hooks/useSpConvencionAnualSelf';

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
  const spAnualStore = useSpConvencionAnual();
  const spAnualSelf = useSpConvencionAnualSelf(profile);

  const canal = profile?.canal;
  const isVCChannel = canal === 'VC';
  const spConvencionDisplay = isVCChannel
    ? ((profile as any)?.sp_totales ?? 0)
    : (spAnualStore ?? spAnualSelf ?? 0);
  const isAliados = canal === 'VN_ALIADOS';
  const isEmpresarios = canal === 'VN_EMPRESARIOS';
  const isVCGerente = canal === 'VC' && profile?.role !== 'asesor' && profile?.role !== 'admin' && profile?.role !== 'especialista';
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
                    <AnimatedCounter value={spConvencionDisplay} className="text-3xl font-black font-scoreboard text-white drop-shadow-lg" duration={1.5} />
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
                  <SectionTitle icon="bar_chart" title="Unidades · ACV · Referidos" tip="Métricas principales que alimentan tu puntaje." />
                  <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    <KPICard icon="inventory_2" label="Unidades" value={`${metrics.ejecucion?.ventas_total ?? kpis?.ventas ?? 0} / ${metrics.metaAsesor?.meta_total ?? kpis?.meta ?? 0}`} sub="Vendidas vs Meta" tip="Unidades vendidas este mes vs meta asignada." />
                    <KPICard icon="trending_up" label="ACV" value={formatMoney(metrics.ejecucion?.acv_total ?? kpis?.acv_f)} sub="Valor contractual anual" color="text-primary" tip="Valor anualizado de contratos cerrados." />
                    <KPICard icon="group_add" label="# de Referidos" value={String(metrics.ejecucion?.cant_recomendados ?? kpis?.cant_recomendados ?? 0)} sub="Referidos generados" color="text-accent" tip="Clientes por recomendación." />
                  </motion.div>
                  <SectionTitle icon="emoji_events" title="Retos Semanales" tip="Desafíos semanales para SP extra." />
                  <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    <RetoCard icon="target" label="Efectividad SQL" value={`${kpis?.efectividad_sql_pct || 0}%`} progress={Number(kpis?.efectividad_sql_pct || 0)} description="% SQL convertidos" tip="(Ventas SQL ÷ Total SQL) × 100." />
                    <RetoCard icon="speed" label="Productividad" value={formatMoney(kpis?.productividad_por_asesor)} progress={Math.min(100, ((kpis?.productividad_por_asesor || 0) / 5_000_000) * 100)} description="Ventas / HC activo" tip="Ventas totales ÷ Headcount activo." />
                  </motion.div>
                  <VnCumplimientoSection kpis={kpis} ejecucion={metrics.ejecucion} metaAsesor={metrics.metaAsesor} />
                  {profile?.role !== 'asesor' && metrics.teamAsesorPerformance?.length > 0 && (
                    <EquipoRendimientoSection asesores={metrics.teamAsesorPerformance} canal={canal} />
                  )}
                  {vcMonthlyCumplimiento.length > 0 && <VnHistorialSection data={vcMonthlyCumplimiento} canal={canal} />}
                </>
              )}

              {isAliados && (
                <>
                  <SectionTitle icon="bar_chart" title="Unidades · ACV" />
                  <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    <KPICard icon="inventory_2" label="Unidades" value={`${metrics.ejecucion?.ventas_total ?? kpis?.ventas ?? 0} / ${metrics.metaAsesor?.meta_total ?? kpis?.meta ?? 0}`} sub="Vendidas vs Meta" />
                    <KPICard icon="trending_up" label="ACV" value={formatMoney(metrics.ejecucion?.acv_total ?? kpis?.acv_f)} sub="Valor contractual anual" color="text-primary" />
                  </motion.div>
                  <VnCumplimientoSection kpis={kpis} ejecucion={metrics.ejecucion} metaAsesor={metrics.metaAsesor} />
                  {profile?.role !== 'asesor' && metrics.teamAsesorPerformance?.length > 0 && (
                    <EquipoRendimientoSection asesores={metrics.teamAsesorPerformance} canal={canal} />
                  )}
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

                  {isVCGerente && metrics.teamAsesorPerformance?.length > 0 && (
                    <EquipoRendimientoVCSection asesores={metrics.teamAsesorPerformance} />
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
  const pctAcv = metaAcv > 0 ? Math.round((acv / metaAcv) * 100) : 0;
  const ventas = ejecucion?.ventas_total ?? Number(kpis?.ventas) ?? 0;
  const meta = metaAsesor?.meta_total ?? Number(kpis?.meta) ?? 0;
  const referidos = ejecucion?.cant_recomendados ?? Number(kpis?.cant_recomendados) ?? 0;
  const ventasFe = ejecucion?.ventas_fe ?? 0;
  const metaFe = metaAsesor?.meta_fe ?? 0;
  const pctFe = metaFe > 0 ? Math.round((ventasFe / metaFe) * 100) : 0;
  const ventasNube = ejecucion?.ventas_nube ?? 0;
  const metaNube = metaAsesor?.meta_nube ?? 0;
  const pctNube = metaNube > 0 ? Math.round((ventasNube / metaNube) * 100) : 0;
  const pctTotal = meta > 0 ? Math.round((ventas / meta) * 100) : 0;

  return (
    <>
      <SectionTitle icon="donut_large" title="Rendimiento del Mes" tip="Ves el logrado del mes, la meta y el porcentaje de cumplimiento para Total Unidades, Nube, FE y ACV." />
      <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
        <div className="space-y-5">
          <ProgressMetricRow
            icon="inventory_2"
            label="Total Unidades"
            currentValue={ventas}
            goalValue={meta}
            percentage={pctTotal}
            formatValue={(value) => `${value.toLocaleString()} uds`}
          />
          <ProgressMetricRow
            icon="receipt_long"
            label="FE"
            currentValue={ventasFe}
            goalValue={metaFe}
            percentage={pctFe}
            formatValue={(value) => `${value.toLocaleString()} uds`}
          />
          <ProgressMetricRow
            icon="cloud"
            label="Nube"
            currentValue={ventasNube}
            goalValue={metaNube}
            percentage={pctNube}
            formatValue={(value) => `${value.toLocaleString()} uds`}
          />
          <ProgressMetricRow
            icon="trending_up"
            label="ACV"
            currentValue={acv}
            goalValue={metaAcv}
            percentage={pctAcv}
            formatValue={formatMoney}
          />

          <div className="pt-4 border-t border-border flex items-center justify-between gap-4 text-sm">
            <MetaRow label="Referidos" value={String(referidos)} />
            <span className="text-xs text-muted-foreground">Cada barra muestra logrado, meta y % de cumplimiento actual.</span>
          </div>
        </div>
      </motion.div>
    </>
  );
};

const ProgressMetricRow = ({
  icon,
  label,
  currentValue,
  goalValue,
  percentage,
  formatValue,
}: {
  icon: string;
  label: string;
  currentValue: number;
  goalValue: number;
  percentage: number;
  formatValue: (value: number) => string;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
      <span className="flex items-center gap-2 text-foreground">
        <MI icon={icon} className="text-primary !text-base" />
        <span>{label}</span>
      </span>
      <span className="text-primary font-scoreboard text-sm">{Math.round(percentage)}%</span>
    </div>
    <Progress value={Math.min(100, Math.max(0, percentage))} className="h-3" />
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-foreground font-scoreboard">{formatValue(currentValue || 0)}</span>
      <span className="text-muted-foreground">Meta: <span className="font-scoreboard text-foreground">{formatValue(goalValue || 0)}</span></span>
    </div>
  </div>
);

const VnHistorialSection = ({ data, canal }: { data: any[]; canal?: string | null }) => {
  const pctClass = (p: number) =>
    p >= 100 ? 'bg-accent/10 text-accent' : p >= 70 ? 'bg-primary/10 text-primary' : p > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground';
  const fmtPct = (p?: number, hasMeta?: boolean) => (hasMeta && p != null ? `${p}%` : '—');
  const cap = (v: number) => Math.min(300, Math.max(0, Math.round(v || 0)));
  const spByMonth = data.map((m: any) => {
    const hasMetaFe = (m.meta_fe ?? 0) > 0;
    const hasMetaNube = (m.meta_nube ?? 0) > 0;
    const hasMetaAcv = (m.meta ?? 0) > 0;
    const spFe = hasMetaFe ? cap(m.pct_fe) : 0;
    const spNube = hasMetaNube ? cap(m.pct_nube) * 2 : 0;
    const spAcv = hasMetaAcv ? cap(m.pct) : 0;
    return typeof m.sp === 'number' && m.sp > 0 ? m.sp : (spFe + spNube + spAcv);
  });
  const totalSp = spByMonth.reduce((s, v) => s + v, 0);
  const mesesConDatos = spByMonth.filter((v) => v > 0).length;
  useEffect(() => {
    setSpConvencionAnual(totalSp);
  }, [totalSp]);
  return (
    <>
      <SectionTitle icon="calendar_month" title="Historial Mensual" tip="Ejecución mensual de Unidades, FE, Nube y ACV con su % de cumplimiento. La columna ⚡ SP muestra los Siigo Points Convención generados ese mes." />
      <motion.div className="bg-card border border-border rounded-2xl overflow-x-auto shadow-smooth-sm" variants={fadeUpItem}>
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="bg-primary text-primary-foreground text-[11px] uppercase tracking-wider font-heading">
              <th className="text-left px-4 py-3">Mes</th>
              <th className="text-right px-4 py-3">Unidades</th>
              <th className="text-right px-4 py-3">% Uds</th>
              <th className="text-right px-4 py-3">FE</th>
              <th className="text-right px-4 py-3">% FE</th>
              <th className="text-right px-4 py-3">Nube</th>
              <th className="text-right px-4 py-3">% Nube</th>
              <th className="text-right px-4 py-3">ACV</th>
              <th className="text-right px-4 py-3">% ACV</th>
              <th className="text-right px-4 py-3">⚡ SP</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => {
              const hasMetaTotal = (m.meta_total ?? 0) > 0;
              const hasMetaFe = (m.meta_fe ?? 0) > 0;
              const hasMetaNube = (m.meta_nube ?? 0) > 0;
              const hasMetaAcv = (m.meta ?? 0) > 0;
              const spTotal = spByMonth[i];
              return (
                <motion.tr
                  key={m.mes}
                  className="border-b border-border hover:bg-primary/5 transition-colors"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.06 + 0.2 }}
                >
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{m.mes}</td>
                  <td className="px-4 py-3 text-sm font-scoreboard text-foreground text-right">{m.ventas_total ?? 0}{hasMetaTotal ? ` / ${m.meta_total}` : ''}</td>
                  <td className="px-4 py-3 text-right"><span className={cn('text-xs font-bold font-scoreboard px-2 py-0.5 rounded-full', pctClass(m.pct_total ?? 0))}>{fmtPct(m.pct_total, hasMetaTotal)}</span></td>
                  <td className="px-4 py-3 text-sm font-scoreboard text-foreground text-right">{m.ventas_fe ?? 0}{hasMetaFe ? ` / ${m.meta_fe}` : ''}</td>
                  <td className="px-4 py-3 text-right"><span className={cn('text-xs font-bold font-scoreboard px-2 py-0.5 rounded-full', pctClass(m.pct_fe ?? 0))}>{fmtPct(m.pct_fe, hasMetaFe)}</span></td>
                  <td className="px-4 py-3 text-sm font-scoreboard text-foreground text-right">{m.ventas_nube ?? 0}{hasMetaNube ? ` / ${m.meta_nube}` : ''}</td>
                  <td className="px-4 py-3 text-right"><span className={cn('text-xs font-bold font-scoreboard px-2 py-0.5 rounded-full', pctClass(m.pct_nube ?? 0))}>{fmtPct(m.pct_nube, hasMetaNube)}</span></td>
                  <td className="px-4 py-3 text-sm font-bold font-scoreboard text-primary text-right">{formatMoney(m.acv)}</td>
                  <td className="px-4 py-3 text-right"><span className={cn('text-xs font-bold font-scoreboard px-2 py-0.5 rounded-full', pctClass(m.pct ?? 0))}>{fmtPct(m.pct, hasMetaAcv)}</span></td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold font-scoreboard text-primary">
                      {spTotal > 0 ? `+${spTotal}` : '—'}
                    </span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-orange/10 border-t-2 border-orange/40">
              <td colSpan={9} className="px-4 py-4">
                <div className="flex flex-col">
                  <span className="text-sm md:text-base font-black font-heading text-orange flex items-center gap-2">
                    <span>⚡</span> Total SP Convención 2026
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Acumulado {mesesConDatos} {mesesConDatos === 1 ? 'mes' : 'meses'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4 text-right">
                <span className="inline-block text-2xl md:text-3xl font-scoreboard font-black text-orange leading-none">
                  +{totalSp.toLocaleString()}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </motion.div>
    </>
  );
};

const EquipoRendimientoSection = ({
  asesores,
  canal,
}: {
  asesores: AsesorPerformance[];
  canal?: string | null;
}) => {
  const [sortBy, setSortBy] = useState<'acv' | 'fe' | 'nube' | 'total'>('acv');
  const referidosLabel = canal === 'VN_ALIADOS' ? 'Ref. Contador' : 'Referidos';

  const getEstado = (a: AsesorPerformance): 'verde' | 'amarillo' | 'rojo' | 'novedad' => {
    if (a.tiene_novedad) return 'novedad';
    const pct = a.pct_acv || a.pct_total;
    if (pct >= 90) return 'verde';
    if (pct >= 60) return 'amarillo';
    return 'rojo';
  };

  const ESTADO_CONFIG = {
    verde:    { color: 'text-accent', bg: 'bg-accent/10', border: 'border-l-accent', emoji: '🟢', label: 'En meta' },
    amarillo: { color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-l-orange-500', emoji: '🟡', label: 'En riesgo' },
    rojo:     { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-l-destructive', emoji: '🔴', label: 'Bajo meta' },
    novedad:  { color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-l-muted-foreground', emoji: '⚪', label: 'Con novedad' },
  } as const;

  const verdes = asesores.filter(a => getEstado(a) === 'verde').length;
  const amarillos = asesores.filter(a => getEstado(a) === 'amarillo').length;
  const rojos = asesores.filter(a => getEstado(a) === 'rojo').length;
  const novedades = asesores.filter(a => getEstado(a) === 'novedad').length;

  const sorted = [...asesores].sort((a, b) => {
    if (a.tiene_novedad && !b.tiene_novedad) return 1;
    if (!a.tiene_novedad && b.tiene_novedad) return -1;
    if (sortBy === 'acv') return b.pct_acv - a.pct_acv;
    if (sortBy === 'fe') return b.pct_fe - a.pct_fe;
    if (sortBy === 'nube') return b.pct_nube - a.pct_nube;
    return b.pct_total - a.pct_total;
  });

  const semaforoItems = [
    { key: 'verde',    label: 'En meta',    count: verdes,    cfg: ESTADO_CONFIG.verde },
    { key: 'amarillo', label: 'En riesgo',  count: amarillos, cfg: ESTADO_CONFIG.amarillo },
    { key: 'rojo',     label: 'Bajo meta',  count: rojos,     cfg: ESTADO_CONFIG.rojo },
    { key: 'novedad',  label: 'Novedad',    count: novedades, cfg: ESTADO_CONFIG.novedad },
  ];

  const sortOptions = [
    { key: 'acv', label: 'ACV%' },
    { key: 'fe', label: 'FE%' },
    { key: 'nube', label: 'Nube%' },
    { key: 'total', label: 'Unidades%' },
  ] as const;

  return (
    <motion.div variants={fadeUpItem} className="space-y-4">
      <SectionTitle
        icon="groups"
        title={`Rendimiento del Equipo (${asesores.length} asesores)`}
        tip="Vista de semáforo de tu equipo: en meta (≥90%), en riesgo (60-89%) o bajo meta (<60%) según ACV."
      />

      {/* Resumen tipo semáforo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {semaforoItems.map(item => (
          <motion.div
            key={item.key}
            className={cn(item.cfg.bg, 'rounded-2xl p-4 text-center border border-border shadow-smooth-sm')}
            variants={popIn}
            whileHover={{ scale: 1.03 }}
          >
            <span className="text-2xl block mb-1">{item.cfg.emoji}</span>
            <span className={cn('text-3xl font-black font-scoreboard', item.cfg.color)}>{item.count}</span>
            <p className="text-[10px] text-muted-foreground uppercase font-heading mt-1">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Selector ordenamiento */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-semibold">Ordenar por:</span>
        {sortOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
              sortBy === opt.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:border-primary/40'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Lista de asesores */}
      <div className="space-y-2">
        {sorted.map((asesor, i) => {
          const estado = getEstado(asesor);
          const cfg = ESTADO_CONFIG[estado];

          const pctColorClass = (p: number, hasMeta: boolean) => {
            if (!hasMeta) return 'text-muted-foreground';
            if (p >= 90) return 'text-accent font-bold';
            if (p >= 60) return 'text-orange-600 font-bold';
            return 'text-destructive font-bold';
          };

          return (
            <motion.div
              key={asesor.documento || asesor.nombre}
              className={cn('bg-card border border-border rounded-2xl p-4 border-l-4 shadow-smooth-sm', cfg.border)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              {/* Fila principal */}
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0', cfg.bg)}>
                  <span>{cfg.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{asesor.nombre}</p>
                  {asesor.tiene_novedad && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Con novedad</span>
                  )}
                </div>
              </div>

              {/* Métricas en 4 columnas */}
              {!asesor.tiene_novedad && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* FE */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>FE</span>
                      <span className={pctColorClass(asesor.pct_fe, asesor.meta_fe > 0)}>
                        {asesor.meta_fe > 0 ? `${asesor.pct_fe}%` : '—'}
                      </span>
                    </div>
                    <Progress value={Math.min(100, asesor.pct_fe)} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-1 font-scoreboard">
                      {asesor.ventas_fe}{asesor.meta_fe > 0 ? ` / ${asesor.meta_fe}` : ''}
                    </p>
                  </div>

                  {/* Nube */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Nube</span>
                      <span className={pctColorClass(asesor.pct_nube, asesor.meta_nube > 0)}>
                        {asesor.meta_nube > 0 ? `${asesor.pct_nube}%` : '—'}
                      </span>
                    </div>
                    <Progress value={Math.min(100, asesor.pct_nube)} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-1 font-scoreboard">
                      {asesor.ventas_nube}{asesor.meta_nube > 0 ? ` / ${asesor.meta_nube}` : ''}
                    </p>
                  </div>

                  {/* Unidades total */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Uds</span>
                      <span className={pctColorClass(asesor.pct_total, asesor.meta_total > 0)}>
                        {asesor.meta_total > 0 ? `${asesor.pct_total}%` : '—'}
                      </span>
                    </div>
                    <Progress value={Math.min(100, asesor.pct_total)} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-1 font-scoreboard">
                      {asesor.ventas_total}{asesor.meta_total > 0 ? ` / ${asesor.meta_total}` : ''}
                    </p>
                  </div>

                  {/* Referidos */}
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-1">{referidosLabel}</div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (asesor.recomendados / 5) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-bold font-scoreboard text-primary">
                      {asesor.recomendados}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-2xl">
          No hay datos de asesores para este mes todavía
        </div>
      )}
    </motion.div>
  );
};


const EquipoRendimientoVCSection = ({ asesores }: { asesores: AsesorPerformance[] }) => {
  const [sortBy, setSortBy] = useState<'acv' | 'pct'>('acv');

  const getEstado = (a: AsesorPerformance): 'verde' | 'amarillo' | 'rojo' => {
    const pct = a.pct_acv;
    if (pct >= 90) return 'verde';
    if (pct >= 60) return 'amarillo';
    return 'rojo';
  };

  const ESTADO_CONFIG = {
    verde:    { color: 'text-accent', bg: 'bg-accent/10', border: 'border-l-accent', emoji: '🟢', label: 'En meta' },
    amarillo: { color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-l-orange-500', emoji: '🟡', label: 'En riesgo' },
    rojo:     { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-l-destructive', emoji: '🔴', label: 'Bajo meta' },
  } as const;

  const verdes = asesores.filter(a => getEstado(a) === 'verde').length;
  const amarillos = asesores.filter(a => getEstado(a) === 'amarillo').length;
  const rojos = asesores.filter(a => getEstado(a) === 'rojo').length;

  const totalAcv = asesores.reduce((s, a) => s + (a.acv || 0), 0);
  const totalMeta = asesores.reduce((s, a) => s + (a.meta_acv || 0), 0);
  const pctEquipo = totalMeta > 0 ? Math.round((totalAcv / totalMeta) * 100) : 0;

  const sorted = [...asesores].sort((a, b) => {
    if (sortBy === 'acv') return b.acv - a.acv;
    return b.pct_acv - a.pct_acv;
  });

  const semaforoItems = [
    { key: 'verde',    label: 'En meta',   count: verdes,    cfg: ESTADO_CONFIG.verde },
    { key: 'amarillo', label: 'En riesgo', count: amarillos, cfg: ESTADO_CONFIG.amarillo },
    { key: 'rojo',     label: 'Bajo meta', count: rojos,     cfg: ESTADO_CONFIG.rojo },
  ];

  const sortOptions = [
    { key: 'acv', label: 'ACV+' },
    { key: 'pct', label: '% Cumpl.' },
  ] as const;

  return (
    <motion.div variants={fadeUpItem} className="space-y-4">
      <SectionTitle
        icon="groups"
        title={`Rendimiento del Equipo (${asesores.length} comerciales)`}
        tip="Vista de semáforo de tu equipo VC: en meta (≥90%), en riesgo (60-89%) o bajo meta (<60%) según ACV+ vs Meta."
      />

      {/* Resumen total */}
      <motion.div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between shadow-smooth-sm" variants={popIn}>
        <div>
          <p className="text-[10px] uppercase font-heading text-muted-foreground">Total equipo · ACV</p>
          <p className="text-2xl font-black font-scoreboard text-foreground">{formatMoney(totalAcv)}</p>
          <p className="text-xs text-muted-foreground">Meta: <span className="font-scoreboard text-foreground">{formatMoney(totalMeta)}</span></p>
        </div>
        <div className="text-right">
          <p className={cn('text-4xl font-black font-scoreboard', pctEquipo >= 100 ? 'text-accent' : pctEquipo >= 70 ? 'text-primary' : 'text-orange-600')}>
            {pctEquipo}%
          </p>
          <p className="text-[10px] uppercase font-heading text-muted-foreground">Cumplimiento</p>
        </div>
      </motion.div>

      {/* Semáforo */}
      <div className="grid grid-cols-3 gap-3">
        {semaforoItems.map(item => (
          <motion.div
            key={item.key}
            className={cn(item.cfg.bg, 'rounded-2xl p-4 text-center border border-border shadow-smooth-sm')}
            variants={popIn}
            whileHover={{ scale: 1.03 }}
          >
            <span className="text-2xl block mb-1">{item.cfg.emoji}</span>
            <span className={cn('text-3xl font-black font-scoreboard', item.cfg.color)}>{item.count}</span>
            <p className="text-[10px] text-muted-foreground uppercase font-heading mt-1">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-semibold">Ordenar por:</span>
        {sortOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
              sortBy === opt.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:border-primary/40'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Lista comerciales */}
      <div className="space-y-2">
        {sorted.map((asesor, i) => {
          const estado = getEstado(asesor);
          const cfg = ESTADO_CONFIG[estado];
          const hasMeta = asesor.meta_acv > 0;

          return (
            <motion.div
              key={asesor.nombre}
              className={cn('bg-card border border-border rounded-2xl p-4 border-l-4 shadow-smooth-sm', cfg.border)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0', cfg.bg)}>
                  <span>{cfg.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{asesor.nombre}</p>
                  <p className="text-[10px] text-muted-foreground font-scoreboard">
                    {formatMoney(asesor.acv)}{hasMeta ? ` / ${formatMoney(asesor.meta_acv)}` : ''}
                  </p>
                </div>
                <span className={cn('text-base font-black font-scoreboard px-3 py-1 rounded-full', cfg.bg, cfg.color)}>
                  {hasMeta ? `${asesor.pct_acv}%` : '—'}
                </span>
              </div>
              {hasMeta && (
                <div className="mt-3">
                  <Progress value={Math.min(100, asesor.pct_acv)} className="h-2" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-2xl">
          No hay datos del equipo para este mes todavía
        </div>
      )}
    </motion.div>
  );
};


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
