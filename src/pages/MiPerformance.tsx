import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, popIn } from '@/lib/animations';

const FLAG_MAP: Record<string, string> = { COL: '🇨🇴', MEX: '🇲🇽', ECU: '🇪🇨' };

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-round", className)}>{icon}</span>
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
  const [kpis, setKpis] = useState<any>(null);
  const [acvData, setAcvData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    const fetchData = async () => {
      const [kpisRes, acvRes] = await Promise.all([
        supabase.from('kpis_mes_actual').select('*').eq('gerente_id', profile.id).maybeSingle(),
        supabase.from('acv_vc_mensual').select('*').eq('gerente_id', profile.id).order('anio', { ascending: false }).limit(6),
      ]);
      setKpis(kpisRes.data);
      setAcvData(acvRes.data || []);
      setDataLoading(false);
    };
    fetchData();
  }, [profile?.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const canal = profile?.canal;
  const isVC = canal === 'VC';
  const isAliados = canal === 'VN_ALIADOS';
  const isEmpresarios = canal === 'VN_EMPRESARIOS';
  const canalLabel = isVC ? 'Venta Cruzada' : isAliados ? 'Venta Nueva — Aliados' : 'Venta Nueva — Empresarios';

  return (
    <Layout title="📊 Mis KPIs">
      <TooltipProvider delayDuration={200}>
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        {/* Player card header */}
        <motion.div className="jumbotron rounded-2xl p-6 flex items-center gap-4" variants={fadeUpItem}>
          <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-2xl shadow-glow-green">
            {profile?.avatar_url || '⚽'}
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{profile?.nombre}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span>{FLAG_MAP[profile?.pais || ''] || '🌎'}</span>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold">{canalLabel}</span>
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-black font-scoreboard text-neon-green">{(profile?.sp_totales || 0).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground font-scoreboard">SIIGO POINTS</p>
          </div>
        </motion.div>

        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
        ) : (
          <>
            {isEmpresarios && (
              <>
                <SectionTitle icon="bar_chart" title="KPIs de Gamificación" tip="Métricas principales que alimentan tu puntaje." />
                <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                  <KPICard icon="inventory_2" label="Unidades" value={String(kpis?.sc_creados || 0)} sub="Vendidas este mes" tip="Cantidad total de productos vendidas." />
                  <KPICard icon="trending_up" label="ACV" value={formatMoney(kpis?.acv_f)} sub="Valor contractual anual" color="text-secondary" tip="Valor anualizado de contratos cerrados." />
                  <KPICard icon="group_add" label="# de Referidos" value={String(kpis?.cant_recomendados || 0)} sub="Referidos generados" color="text-accent" tip="Clientes por recomendación." />
                </motion.div>
                <SectionTitle icon="emoji_events" title="Retos Semanales" tip="Desafíos semanales para SP extra." />
                <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                  <RetoCard icon="target" label="Efectividad SQL" value={`${kpis?.efectividad_sql_pct || 0}%`} progress={Number(kpis?.efectividad_sql_pct || 0)} description="% SQL convertidos" tip="(Ventas SQL ÷ Total SQL) × 100." />
                  <RetoCard icon="speed" label="Productividad" value={formatMoney(kpis?.productividad_por_asesor)} progress={Math.min(100, ((kpis?.productividad_por_asesor || 0) / 5_000_000) * 100)} description="Ventas / HC activo" tip="Ventas totales ÷ Headcount activo." />
                </motion.div>
                <CumplimientoSection kpis={kpis} />
              </>
            )}
            {isAliados && (
              <>
                <SectionTitle icon="bar_chart" title="KPIs de Gamificación" />
                <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                  <KPICard icon="inventory_2" label="Unidades" value={String(kpis?.sc_creados || 0)} sub="Vendidas este mes" />
                  <KPICard icon="trending_up" label="ACV" value={formatMoney(kpis?.acv_f)} sub="Valor contractual anual" color="text-secondary" />
                  <KPICard icon="person_add" label="Referidos Contador" value={String(kpis?.cant_recomendados || 0)} sub="Referidos aliados" color="text-accent" />
                </motion.div>
                <SectionTitle icon="emoji_events" title="Retos Semanales" />
                <motion.div className="grid grid-cols-1 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                  <RetoCard icon="handshake" label="Efectividad Referidos" value={`${kpis?.efectividad_referidos_pct || 0}%`} progress={Number(kpis?.efectividad_referidos_pct || 0)} description="% referidos convertidos" />
                </motion.div>
                <CumplimientoSection kpis={kpis} />
              </>
            )}
            {isVC && (
              <>
                <SectionTitle icon="bar_chart" title="KPI de Gamificación" />
                <motion.div className="glass-card rounded-2xl p-8 text-center" variants={fadeUpItem}>
                  <MI icon="add_chart" className="text-4xl text-primary mb-2" />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ACV+ del Mes</p>
                  <p className="text-4xl font-bold font-scoreboard text-neon-green">
                    {acvData.length > 0 ? `$${((acvData[0]?.acv_plus_total || 0) / 1_000_000).toFixed(1)}M` : '$0M'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">{acvData.length > 0 ? acvData[0]?.unidades || 0 : 0} unidades</p>
                </motion.div>
                {acvData.length > 0 && (
                  <>
                    <SectionTitle icon="pie_chart" title="Desglose por Bloque" />
                    <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                      <BloqueCard label="Nómina-e" value={acvData[0]?.acv_nomina || 0} color="bg-primary" />
                      <BloqueCard label="FE" value={acvData[0]?.acv_fe || 0} color="bg-secondary" />
                      <BloqueCard label="Conversiones" value={acvData[0]?.acv_conversiones || 0} color="bg-accent" />
                    </motion.div>
                  </>
                )}
                {acvData.length > 1 && (
                  <>
                    <SectionTitle icon="history" title="Histórico ACV+" />
                    <motion.div className="glass-card rounded-2xl p-6" variants={fadeUpItem}>
                      {acvData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
                          <span className="text-sm text-muted-foreground">{d.mes} {d.anio}</span>
                          <span className="text-sm font-bold font-scoreboard text-foreground">${((d.acv_plus_total || 0) / 1_000_000).toFixed(1)}M</span>
                        </div>
                      ))}
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
  <motion.h3 className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-wider pt-2" variants={fadeUpItem}>
    <MI icon={icon} className="text-primary text-lg" />{title}{tip && <InfoTip text={tip} />}
  </motion.h3>
);

const KPICard = ({ icon, label, value, sub, color, tip }: { icon: string; label: string; value: string; sub: string; color?: string; tip?: string }) => (
  <motion.div className="glass-card rounded-2xl p-6 text-center hover:shadow-glow-green transition-shadow relative" variants={fadeUpItem}>
    {tip && <div className="absolute top-3 right-3"><InfoTip text={tip} /></div>}
    <MI icon={icon} className={cn("text-3xl mb-2", color || "text-primary")} />
    <p className={cn("text-3xl font-bold font-scoreboard", color || "text-foreground")}>{value}</p>
    <p className="text-xs font-semibold text-foreground uppercase tracking-wider mt-1">{label}</p>
    <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
  </motion.div>
);

const RetoCard = ({ icon, label, value, progress, description, tip }: { icon: string; label: string; value: string; progress: number; description: string; tip?: string }) => (
  <motion.div className="glass-card rounded-2xl p-6 relative" variants={fadeUpItem}>
    {tip && <div className="absolute top-3 right-3"><InfoTip text={tip} /></div>}
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><MI icon={icon} className="text-primary text-xl" /></div>
      <div><p className="text-sm font-bold text-foreground">{label}</p><p className="text-[11px] text-muted-foreground">{description}</p></div>
      <span className="ml-auto text-2xl font-bold font-scoreboard text-neon-green">{value}</span>
    </div>
    <Progress value={Math.min(100, progress)} className="h-2" />
  </motion.div>
);

const CumplimientoSection = ({ kpis }: { kpis: any }) => (
  <>
    <SectionTitle icon="donut_large" title="Cumplimiento de Meta" tip="(Ventas actuales ÷ Meta) × 100." />
    <motion.div className="glass-card rounded-2xl p-6" variants={fadeUpItem}>
      <div className="flex items-center gap-8">
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeDasharray={`${Math.min(100, Number(kpis?.pct_cumplimiento || 0)) * 3.14} 314`} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold font-scoreboard text-neon-green">{kpis?.pct_cumplimiento || 0}%</span>
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

const BloqueCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <motion.div className="glass-card rounded-2xl p-5 text-center hover:shadow-glow-green transition-shadow" variants={fadeUpItem}>
    <div className={cn("w-3 h-3 rounded-full mx-auto mb-3", color)} />
    <p className="text-xl font-bold font-scoreboard text-foreground">${(value / 1_000_000).toFixed(1)}M</p>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
  </motion.div>
);

export default MiPerformance;
