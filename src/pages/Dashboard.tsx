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

const NIVELES = [
  { nombre: 'Prospecto', min: 0, max: 499 },
  { nombre: 'Ejecutor', min: 500, max: 1499 },
  { nombre: 'Impulsor', min: 1500, max: 3499 },
  { nombre: 'Estratega Comercial', min: 3500, max: 6999 },
  { nombre: 'Dominador', min: 7000, max: 12999 },
  { nombre: 'Vanguardia', min: 13000, max: 21999 },
  { nombre: 'Élite Siigo', min: 22000, max: 34999 },
  { nombre: 'Cima Ejecutiva', min: 35000, max: 54999 },
  { nombre: 'Leyenda Siigo', min: 55000, max: 999999 },
];

const Dashboard = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [racha, setRacha] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);
  const [medallas, setMedallas] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchData = async () => {
      const [rachaRes, kpisRes, medallasRes, feedRes] = await Promise.all([
        supabase.from('racha_activa').select('*').eq('gerente_id', profile.id).maybeSingle(),
        supabase.from('kpis_mes_actual').select('*').eq('gerente_id', profile.id).maybeSingle(),
        supabase.from('medallas').select('*').eq('gerente_id', profile.id).order('fecha_desbloqueo', { ascending: false }).limit(3),
        supabase.from('feed_reconocimientos').select('*').limit(5),
      ]);

      setRacha(rachaRes.data);
      setKpis(kpisRes.data);
      setMedallas(medallasRes.data || []);
      setFeed(feedRes.data || []);
      setDataLoading(false);
    };

    fetchData();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const sp = profile?.sp_totales || 0;
  const nivelActual = NIVELES.find(n => sp >= n.min && sp <= n.max) || NIVELES[0];
  const nivelSiguiente = NIVELES[NIVELES.indexOf(nivelActual) + 1];
  const progressPct = nivelSiguiente
    ? Math.min(100, ((sp - nivelActual.min) / (nivelSiguiente.min - nivelActual.min)) * 100)
    : 100;

  return (
    <Layout title="Mi Arena">
      <div className="space-y-6">
        {/* Top row: SP + Racha + KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* SP Card */}
          <div className="bg-card border border-border rounded-2xl p-6 col-span-1 md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Siigo Points Totales</p>
                <p className="text-4xl font-bold text-foreground">{sp.toLocaleString()} <span className="text-lg text-primary">SP</span></p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-semibold">
                  <MI icon="military_tech" className="text-base" />
                  {profile?.nivel}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{nivelActual.nombre}</span>
                {nivelSiguiente && <span>{nivelSiguiente.nombre} ({nivelSiguiente.min.toLocaleString()} SP)</span>}
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full progress-gradient transition-all duration-1000 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Racha Card */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="text-sm text-muted-foreground mb-2">Racha Activa</p>
            {dataLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : racha && racha.semanas_consecutivas > 0 ? (
              <div className="text-center">
                <p className="text-3xl font-bold text-accent">🔥 ×{racha.multiplicador}</p>
                <p className="text-sm font-semibold text-foreground mt-1">{racha.nombre_racha}</p>
                <p className="text-xs text-muted-foreground">{racha.semanas_consecutivas} semanas en verde</p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <p className="text-2xl mb-1">❄️</p>
                <p className="text-sm">Sin racha activa</p>
              </div>
            )}
          </div>
        </div>

        {/* KPIs del mes */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <MI icon="trending_up" className="text-primary text-lg" />
            Rendimiento del Mes
          </h3>
          {dataLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : kpis ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Ventas" value={`$${(kpis.ventas / 1_000_000).toFixed(0)}M`} icon="payments" />
              <StatCard label="Cumplimiento" value={`${kpis.pct_cumplimiento}%`} icon="speed"
                color={Number(kpis.pct_cumplimiento) >= 100 ? 'text-secondary' : Number(kpis.pct_cumplimiento) >= 80 ? 'text-accent' : 'text-destructive'} />
              <StatCard label="Referidos" value={String(kpis.cant_recomendados || 0)} icon="group_add" />
              <StatCard label="Productividad" value={`$${((kpis.productividad_por_asesor || 0) / 1_000_000).toFixed(0)}M`} icon="person" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Sin datos de KPI para este mes</p>
          )}
        </div>

        {/* Bottom row: Medallas + Feed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Medallas recientes */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <MI icon="emoji_events" className="text-accent text-lg" />
              Medallas Recientes
            </h3>
            {dataLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : medallas.length > 0 ? (
              <div className="space-y-3">
                {medallas.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                    <span className="text-xl">🏅</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.medalla}</p>
                      <p className="text-[10px] text-muted-foreground">+{m.sp_otorgados} SP</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aún no tienes medallas</p>
            )}
          </div>

          {/* Feed reconocimientos */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <MI icon="diversity_3" className="text-primary text-lg" />
              Reconocimientos Recientes
            </h3>
            {dataLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
            ) : feed.length > 0 ? (
              <div className="space-y-3">
                {feed.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 p-2 bg-muted/50 rounded-lg">
                    <span className="text-lg mt-0.5">💬</span>
                    <div>
                      <p className="text-xs text-foreground">
                        <span className="font-semibold">{r.de_nombre}</span>
                        {' → '}
                        <span className="font-semibold">{r.para_nombre}</span>
                      </p>
                      <p className="text-[10px] text-primary font-medium">{r.tipo?.replace(/_/g, ' ')}</p>
                      {r.mensaje && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{r.mensaje}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sin reconocimientos aún</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

const StatCard = ({ label, value, icon, color }: { label: string; value: string; icon: string; color?: string }) => (
  <div className="bg-muted/50 rounded-xl p-4 text-center">
    <MI icon={icon} className={cn("text-2xl mb-1", color || "text-primary")} />
    <p className={cn("text-xl font-bold", color || "text-foreground")}>{value}</p>
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
  </div>
);

export default Dashboard;
