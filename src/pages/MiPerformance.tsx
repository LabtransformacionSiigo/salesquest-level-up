import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem } from '@/lib/animations';
import { getVcAdvisorSnapshot, isVcAdvisorProfile } from '@/lib/vc-advisor-data';
import bannerPerformance from '@/assets/banner-performance.png';

const FLAG_MAP: Record<string, string> = { COL: '🇨🇴', MEX: '🇲🇽', ECU: '🇪🇨' };
const PRODUCT_COLORS = ['bg-primary', 'bg-accent', 'bg-orange', 'bg-secondary', 'bg-primary/70', 'bg-accent/70', 'bg-orange/70', 'bg-secondary/70', 'bg-primary/50', 'bg-accent/50', 'bg-orange/50'];

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

interface MonthlyCumplimiento {
  mes: string;
  acv: number;
  meta: number;
  pct: number;
}

const MiPerformance = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [kpis, setKpis] = useState<any>(null);
  const [acvData, setAcvData] = useState<any[]>([]);
  const [vcSnapshot, setVcSnapshot] = useState<any>(null);
  const [vcCumplimiento, setVcCumplimiento] = useState<{ acv: number; meta: number; pct: number } | null>(null);
  const [vcMonthlyCumplimiento, setVcMonthlyCumplimiento] = useState<MonthlyCumplimiento[]>([]);
  const [upgradesCount, setUpgradesCount] = useState(0);
  const [productBreakdown, setProductBreakdown] = useState<{ label: string; value: number }[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const canal = profile?.canal;
  const isVC = canal === 'VC';
  const isAliados = canal === 'VN_ALIADOS';
  const isEmpresarios = canal === 'VN_EMPRESARIOS';
  const isVcAdvisor = isVcAdvisorProfile(profile);
  const canalLabel = isVC ? 'Venta Cruzada' : isAliados ? 'Venta Nueva — Aliados' : 'Venta Nueva — Empresarios';

  useEffect(() => {
    if (!profile?.id) return;

    let cancelled = false;

    const fetchData = async () => {
      setDataLoading(true);

      if (isVcAdvisor) {
        const [snapshot, ventasMetaRes, upgradesRes] = await Promise.all([
          getVcAdvisorSnapshot(profile),
          supabase.from('ventas').select('acv_plus, meta, mes').eq('gerente_id', profile.gerente_id).eq('canal', 'VC').eq('anio', new Date().getFullYear()).like('documento_factura', 'SUM-%').eq('comercial', profile.nombre),
          supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('gerente_id', profile.gerente_id).eq('canal', 'VC').eq('comercial', profile.nombre).eq('categoria_producto_venta', 'Upgrade').eq('anio', new Date().getFullYear()),
        ]);
        if (cancelled) return;

        setVcSnapshot(snapshot);
        setKpis({
          ventas: snapshot?.metrics.currentMonthRevenue || 0,
          acv_f: snapshot?.metrics.currentMonthAcv || 0,
          sc_creados: snapshot?.metrics.currentMonthUnits || 0,
        });
        setAcvData([]);
        setUpgradesCount(upgradesRes.count || 0);

        // Build monthly cumplimiento from SUM- records
        const monthlyMap = new Map<string, { acv: number; meta: number }>();
        (ventasMetaRes.data || []).forEach((v: any) => {
          const mes = v.mes || 'Unknown';
          const entry = monthlyMap.get(mes) || { acv: 0, meta: 0 };
          entry.acv += Number(v.acv_plus) || 0;
          entry.meta += Number(v.meta) || 0;
          monthlyMap.set(mes, entry);
        });
        const monthlyCumpl = [...monthlyMap.entries()].map(([mes, { acv, meta }]) => ({
          mes,
          acv,
          meta,
          pct: meta > 0 ? Math.round((acv / meta) * 100) : 0,
        }));
        setVcMonthlyCumplimiento(monthlyCumpl);

        const totalAcv = monthlyCumpl.reduce((s, m) => s + m.acv, 0);
        const totalMeta = monthlyCumpl.reduce((s, m) => s + m.meta, 0);
        setVcCumplimiento({ acv: totalAcv, meta: totalMeta, pct: totalMeta > 0 ? Math.round((totalAcv / totalMeta) * 100) : 0 });

        setDataLoading(false);
        return;
      }

      // Get current month name in Spanish for filtering
      const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const currentMonthName = MONTH_NAMES_ES[new Date().getMonth()];

      const [kpisRes, acvRes, ventasMetaRes, productRes] = await Promise.all([
        supabase.from('kpis_mes_actual').select('*').eq('gerente_id', profile.id).maybeSingle(),
        supabase.from('acv_vc_mensual').select('*').eq('gerente_id', profile.id).order('anio', { ascending: false }).limit(6),
        isVC ? supabase.from('ventas').select('acv_plus, meta, mes').eq('gerente_id', profile.id).eq('canal', 'VC').eq('anio', new Date().getFullYear()).like('documento_factura', 'SUM-%') : Promise.resolve({ data: null }),
        isVC ? supabase.from('desglose_producto_vc').select('producto, acv_total, unidades, mes').eq('gerente_id', profile.id).eq('anio', new Date().getFullYear()) : Promise.resolve({ data: null }),
      ]);

      if (cancelled) return;

      setVcSnapshot(null);
      setKpis(kpisRes.data);
      setAcvData(acvRes.data || []);

      // Build product breakdown from view - filter by current month to match ACV headline
      if (isVC && productRes.data) {
        // Get the month shown in ACV headline (latest month from acv_vc_mensual)
        const headlineMonth = (acvRes.data && acvRes.data.length > 0) ? acvRes.data[0].mes : currentMonthName;
        const filteredProducts = (productRes.data as any[]).filter((r: any) => r.mes === headlineMonth);
        const breakdown = filteredProducts
          .map((r: any) => ({ label: r.producto, value: Number(r.acv_total) || 0, units: Number(r.unidades) || 0 }))
          .filter(b => b.value > 0)
          .sort((a, b) => b.value - a.value);
        setProductBreakdown(breakdown);
        const upgradeRow = filteredProducts.find((r: any) => r.producto === 'Upgrade');
        setUpgradesCount(upgradeRow ? Number(upgradeRow.unidades) || 0 : 0);
      }

      if (isVC) {
        // Build cumplimiento from acv_vc_mensual (real individual records) instead of SUM- consolidated records
        const acvRows = acvRes.data || [];
        const monthlyCumpl: MonthlyCumplimiento[] = [];

        // Get meta from SUM- records per month
        const metaByMonth = new Map<string, number>();
        if (ventasMetaRes.data) {
          (ventasMetaRes.data as any[]).forEach((v: any) => {
            const mes = v.mes || 'Unknown';
            metaByMonth.set(mes, (metaByMonth.get(mes) || 0) + (Number(v.meta) || 0));
          });
        }

        for (const row of acvRows) {
          const mes = row.mes || 'Unknown';
          const acv = Number(row.acv_plus_total) || 0;
          const meta = metaByMonth.get(mes) || 0;
          monthlyCumpl.push({
            mes,
            acv,
            meta,
            pct: meta > 0 ? Math.round((acv / meta) * 100) : 0,
          });
        }
        setVcMonthlyCumplimiento(monthlyCumpl);

        const totalAcv = monthlyCumpl.reduce((s, m) => s + m.acv, 0);
        const totalMeta = monthlyCumpl.reduce((s, m) => s + m.meta, 0);
        setVcCumplimiento({ acv: totalAcv, meta: totalMeta, pct: totalMeta > 0 ? Math.round((totalAcv / totalMeta) * 100) : 0 });
      }
      setDataLoading(false);
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.nombre, profile?.gerente_id, profile?.role, isVcAdvisor]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const vcMetrics = vcSnapshot?.metrics;
  const vcBlocks = vcSnapshot?.blockTotals;
  const vcHistory = isVcAdvisor ? (vcMetrics?.monthlyHistory || []) : acvData;
  const vcHeadlineValue = isVcAdvisor ? vcMetrics?.totalAcv || 0 : acvData[0]?.acv_plus_total || 0;
  const vcUnitsLabel = isVcAdvisor
    ? `${vcMetrics?.currentMonthUnits || 0} unidades este mes · ${formatMoney(vcMetrics?.currentMonthAcv || 0)} ACV+ del mes`
    : `${acvData[0]?.unidades || 0} unidades`;

  return (
    <Layout title="📊 Mi Performance">
      <TooltipProvider delayDuration={200}>
        <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
          <motion.div className="relative rounded-2xl p-6 flex items-center gap-4 overflow-hidden" variants={fadeUpItem}
            style={{ backgroundImage: `url(${bannerPerformance})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="absolute inset-0 bg-primary/30" />
            <div className="relative z-10 w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl">
              <MI icon="person" className="text-white" />
            </div>
            <div>
              <p className="text-lg font-bold font-heading text-white">{profile?.nombre}</p>
              <p className="text-xs text-white/70 flex items-center gap-2">
                <span>{FLAG_MAP[profile?.pais || ''] || '🌎'}</span>
                <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{canalLabel}</span>
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-black font-scoreboard text-white">{(profile?.sp_totales || 0).toLocaleString()}</p>
              <p className="text-[10px] text-white/60 font-scoreboard">SIIGO POINTS</p>
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
                    <KPICard icon="inventory_2" label="Unidades" value={String(kpis?.sc_creados || 0)} sub="Vendidas este mes" tip="Cantidad total de productos vendidas." />
                    <KPICard icon="trending_up" label="ACV+" value={formatMoney(kpis?.acv_f)} sub="Valor contractual anual" color="text-primary" tip="Valor anualizado de contratos cerrados." />
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
                  <SectionTitle icon="bar_chart" title="Unidades · ACV+ · Referidos" />
                  <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                    <KPICard icon="inventory_2" label="Unidades" value={String(kpis?.sc_creados || 0)} sub="Vendidas este mes" />
                    <KPICard icon="trending_up" label="ACV+" value={formatMoney(kpis?.acv_f)} sub="Valor contractual anual" color="text-primary" />
                    <KPICard icon="person_add" label="Referidos" value={String(kpis?.cant_recomendados || 0)} sub="Referidos aliados" color="text-accent" />
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
                        ).map((b, i) => (
                          <BloqueCard key={b.label} label={b.label} value={b.value} color={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} />
                        ))}
                      </motion.div>
                    </>
                  )}


                  {/* Cumplimiento de Meta VC - Global */}
                  {(vcCumplimiento || kpis?.pct_cumplimiento != null) && (
                    <>
                      <SectionTitle icon="donut_large" title="Cumplimiento de Meta" tip="(ACV+ logrado ÷ Meta asignada) × 100." />
                      <motion.div className="bg-white border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
                        <div className="flex items-center gap-8">
                          <div className="relative w-28 h-28 shrink-0">
                            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                              <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeDasharray={`${Math.min(100, vcCumplimiento?.pct || 0) * 3.14} 314`} strokeLinecap="round" className="transition-all duration-1000" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xl font-bold font-scoreboard text-primary">{vcCumplimiento?.pct || 0}%</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                            <MetaRow label="ACV+ Logrado" value={formatMoney(vcCumplimiento?.acv)} />
                            <MetaRow label="Meta" value={formatMoney(vcCumplimiento?.meta)} />
                          </div>
                        </div>
                      </motion.div>

                      {/* Monthly breakdown */}
                      {vcMonthlyCumplimiento.length > 0 && (
                        <motion.div className="bg-white border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
                          <h4 className="text-sm font-bold font-heading text-secondary mb-4 flex items-center gap-2">
                            <MI icon="calendar_month" className="text-primary text-lg" /> Cumplimiento por Mes
                          </h4>
                          <div className="space-y-4">
                            {vcMonthlyCumplimiento.map((m) => (
                              <div key={m.mes}>
                                <div className="flex justify-between text-sm mb-1.5">
                                  <span className="font-semibold text-foreground">{m.mes}</span>
                                  <div className="flex items-center gap-4">
                                    <span className="text-xs text-muted-foreground">{formatMoney(m.acv)} / {formatMoney(m.meta)}</span>
                                    <span className={cn("font-bold font-scoreboard", m.pct >= 100 ? "text-accent" : "text-primary")}>{m.pct}%</span>
                                  </div>
                                </div>
                                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                  <div className={cn("h-full rounded-full transition-all duration-700", m.pct >= 100 ? "bg-accent" : "bg-primary")} style={{ width: `${Math.min(100, m.pct)}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
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

const CumplimientoSection = ({ kpis }: { kpis: any }) => (
  <>
    <SectionTitle icon="donut_large" title="Cumplimiento de Meta" tip="(Ventas actuales ÷ Meta) × 100." />
    <motion.div className="bg-white border border-border rounded-2xl p-6 shadow-smooth-sm" variants={fadeUpItem}>
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

const BloqueCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <motion.div className="bg-white border border-border rounded-2xl p-5 text-center hover:shadow-smooth-md transition-shadow shadow-smooth-sm" variants={fadeUpItem}>
    <div className={cn('w-3 h-3 rounded-full mx-auto mb-3', color)} />
    <p className="text-xl font-bold font-scoreboard text-foreground">{formatMoney(value)}</p>
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
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
