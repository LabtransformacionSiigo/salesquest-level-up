import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isVC = profile?.canal === 'VC';
  const isAliados = profile?.canal === 'VN_ALIADOS';

  return (
    <Layout title="Mis KPIs">
      <div className="space-y-6">
        {dataLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <>
            {/* Vista VN (Empresarios/Aliados) */}
            {!isVC && (
              <>
                {/* Main KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPICard icon="payments" label="Ventas del Mes" value={kpis ? `$${(kpis.ventas / 1_000_000).toFixed(0)}M` : '$0M'} />
                  <KPICard icon="speed" label="% Cumplimiento"
                    value={kpis ? `${kpis.pct_cumplimiento}%` : '0%'}
                    color={kpis && Number(kpis.pct_cumplimiento) >= 100 ? 'text-secondary' : kpis && Number(kpis.pct_cumplimiento) >= 80 ? 'text-accent' : 'text-destructive'} />
                  <KPICard icon="group_add" label="Referidos" value={String(kpis?.cant_recomendados || 0)} />
                  <KPICard icon="person" label="Productividad/Asesor"
                    value={kpis ? `$${((kpis.productividad_por_asesor || 0) / 1_000_000).toFixed(0)}M` : '$0M'} />
                </div>

                {/* Cumplimiento gauge */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Cumplimiento de Meta</h3>
                  <div className="flex items-center gap-6">
                    <div className="relative w-32 h-32">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--primary))" strokeWidth="10"
                          strokeDasharray={`${Math.min(100, Number(kpis?.pct_cumplimiento || 0)) * 3.14} 314`}
                          strokeLinecap="round" className="transition-all duration-1000" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-foreground">{kpis?.pct_cumplimiento || 0}%</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Ventas:</span> <span className="font-semibold">${((kpis?.ventas || 0) / 1_000_000).toFixed(0)}M</span></p>
                      <p><span className="text-muted-foreground">Meta:</span> <span className="font-semibold">${((kpis?.meta || 0) / 1_000_000).toFixed(0)}M</span></p>
                      <p><span className="text-muted-foreground">HC Final:</span> <span className="font-semibold">{kpis?.hc_final || 0}</span></p>
                      <p><span className="text-muted-foreground">Terminaciones:</span> <span className="font-semibold">{kpis?.terminaciones || 0}</span></p>
                    </div>
                  </div>
                </div>

                {/* Aliados extra: Efectividad Referidos */}
                {isAliados && kpis && (
                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <MI icon="handshake" className="text-primary text-lg" />
                      Efectividad de Referidos
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <KPICard icon="group_add" label="Referidos" value={String(kpis.cant_recomendados || 0)} small />
                      <KPICard icon="payments" label="Ventas Referidos" value={`$${((kpis.ventas_recomendados || 0) / 1_000_000).toFixed(0)}M`} small />
                      <KPICard icon="percent" label="Efectividad" value={`${kpis.efectividad_referidos_pct || 0}%`} small
                        color={Number(kpis.efectividad_referidos_pct) >= 50 ? 'text-secondary' : 'text-accent'} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Vista VC (Venta Cruzada) */}
            {isVC && (
              <>
                {/* ACV+ principal */}
                <div className="bg-card border border-border rounded-2xl p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">ACV+ del Mes Actual</p>
                  <p className="text-5xl font-bold text-primary">
                    ${acvData.length > 0 ? ((acvData[0]?.acv_plus_total || 0) / 1_000_000).toFixed(1) : '0'}M
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {acvData.length > 0 ? acvData[0]?.unidades || 0 : 0} unidades vendidas
                  </p>
                </div>

                {/* Desglose por bloque */}
                {acvData.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Desglose por Bloque</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <BloqueCard label="Nómina-e" value={acvData[0]?.acv_nomina || 0} color="bg-primary" />
                      <BloqueCard label="FE" value={acvData[0]?.acv_fe || 0} color="bg-secondary" />
                      <BloqueCard label="Conversiones" value={acvData[0]?.acv_conversiones || 0} color="bg-accent" />
                    </div>
                  </div>
                )}

                {/* Histórico */}
                {acvData.length > 1 && (
                  <div className="bg-card border border-border rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Histórico ACV+</h3>
                    <div className="space-y-2">
                      {acvData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <span className="text-sm text-muted-foreground">{d.mes} {d.anio}</span>
                          <span className="text-sm font-bold text-foreground">${((d.acv_plus_total || 0) / 1_000_000).toFixed(1)}M</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!kpis && !isVC && (
              <div className="text-center py-16 text-muted-foreground">
                <MI icon="analytics" className="text-5xl mb-3" />
                <p>Sin datos de KPI para este mes</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

const KPICard = ({ icon, label, value, color, small }: { icon: string; label: string; value: string; color?: string; small?: boolean }) => (
  <div className={cn("bg-muted/50 rounded-xl text-center", small ? "p-3" : "p-5")}>
    <MI icon={icon} className={cn("mb-1", color || "text-primary", small ? "text-xl" : "text-2xl")} />
    <p className={cn("font-bold", color || "text-foreground", small ? "text-lg" : "text-2xl")}>{value}</p>
    <p className={cn("text-muted-foreground uppercase tracking-wider", small ? "text-[9px]" : "text-[10px]")}>{label}</p>
  </div>
);

const BloqueCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="bg-muted/50 rounded-xl p-4 text-center">
    <div className={cn("w-3 h-3 rounded-full mx-auto mb-2", color)} />
    <p className="text-lg font-bold text-foreground">${(value / 1_000_000).toFixed(1)}M</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

export default MiPerformance;
