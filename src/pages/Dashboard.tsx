import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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

const RETOS_SEMANALES = [
  { id: 'semana_ejecutada', nombre: 'Semana Ejecutada', sp: 100, umbral: 50_000_000 },
  { id: 'semana_en_fuego', nombre: 'Semana en Fuego', sp: 160, umbral: 80_000_000 },
  { id: 'semana_elite', nombre: 'Semana Élite', sp: 250, umbral: 100_000_000 },
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

  useEffect(() => {
    if (!profile?.id) return;

    const now = new Date();
    const mesActual = now.toLocaleString('es', { month: 'long' }).toLowerCase();
    const anioActual = now.getFullYear();
    const semanaISO = getISOWeek(now);
    const weekStart = getISOWeekStartDate(semanaISO, anioActual);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const fetchData = async () => {
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

      setRacha(rachaRes.data);
      setKpis(kpisRes.data);
      setMedallas(medallasRes.data || []);
      setFeed(feedRes.data || []);
      setUnidades(unidadesRes.count || 0);
      setVentasSemana((ventasSemanaRes.data || []).reduce((s, v) => s + (Number(v.valor_producto) || 0), 0));

      // ACV: for VC use acv_vc_mensual, for VN use acv_f from kpis
      if (profile.canal === 'VC') {
        const { data: acvData } = await supabase
          .from('acv_vc_mensual')
          .select('acv_plus_total')
          .eq('gerente_id', profile.id)
          .maybeSingle();
        setAcvMes(Number(acvData?.acv_plus_total) || 0);
      } else {
        setAcvMes(Number(kpisRes.data?.acv_f) || 0);
      }

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
        {/* Top row: SP + Racha */}
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
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{nivelActual.nombre}</span>
                {nivelSiguiente && <span>{nivelSiguiente.nombre} ({nivelSiguiente.min.toLocaleString()} SP)</span>}
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full progress-gradient transition-all duration-1000 ease-out" style={{ width: `${progressPct}%` }} />
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
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : kpis ? (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              <StatCard label="Ventas" value={`$${(kpis.ventas / 1_000_000).toFixed(0)}M`} icon="payments" />
              <StatCard label="Cumplimiento" value={`${kpis.pct_cumplimiento}%`} icon="speed"
                color={Number(kpis.pct_cumplimiento) >= 100 ? 'text-secondary' : Number(kpis.pct_cumplimiento) >= 80 ? 'text-accent' : 'text-destructive'} />
              <StatCard label="Referidos" value={String(kpis.cant_recomendados || 0)} icon="group_add" />
              <StatCard label="Productividad" value={`$${((kpis.productividad_por_asesor || 0) / 1_000_000).toFixed(0)}M`} icon="person" />
              <StatCard label="Unidades" value={String(unidades)} icon="shopping_cart" />
              <StatCard label="ACV del Mes" value={`$${(acvMes / 1_000_000).toFixed(1)}M`} icon="trending_up" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Sin datos de KPI para este mes</p>
          )}
        </div>

        {/* Progreso de Retos */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MI icon="flag" className="text-accent text-lg" />
              Progreso de Retos Semanales
            </h3>
            <Link to="/retos" className="text-xs text-primary font-medium hover:underline">Ver todos →</Link>
          </div>
          {dataLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {RETOS_SEMANALES.map(reto => {
                const pct = Math.min(100, (ventasSemana / reto.umbral) * 100);
                return (
                  <div key={reto.id} className={cn(
                    "bg-muted/50 rounded-xl p-4 border",
                    pct >= 100 ? "border-secondary/50" : "border-transparent"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-foreground">{reto.nombre}</p>
                      <span className="text-[10px] font-bold text-accent">{reto.sp} SP</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>${(ventasSemana / 1_000_000).toFixed(0)}M / ${(reto.umbral / 1_000_000).toFixed(0)}M</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom row: Medallas + Feed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <span className="font-semibold">{r.de_nombre}</span>{' → '}<span className="font-semibold">{r.para_nombre}</span>
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
