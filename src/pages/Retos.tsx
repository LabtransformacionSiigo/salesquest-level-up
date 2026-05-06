import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, scoreboardSlide } from '@/lib/animations';
import { filterCatalogByScope, normalizeCatalogWindow } from '@/lib/catalog-scope';
import { getVcAdvisorSnapshot, isVcAdvisorProfile } from '@/lib/vc-advisor-data';

const getISOWeek = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

interface VcCatalogReto {
  id: string;
  nombre: string;
  emoji: string | null;
  ventana_tiempo: string;
  canal?: string | null;
  pais?: string | null;
  gerente_id?: string | null;
  kpi: string | null;
  familia_vc: string | null;
  umbral: number;
  sp_otorgados: number;
  objetivo_descripcion: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
}

interface VcRacha {
  id: string;
  nombre: string;
  emoji: string | null;
  kpi: string | null;
  familia_vc: string | null;
  umbral_verde: number;
  umbral_legacy: number | null;
  multiplicador_sp: number;
  dias_lun_mie: boolean;
  objetivo_descripcion: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  canal?: string | null;
  pais?: string | null;
  gerente_id?: string | null;
}

const classifyFamilia = (v: any): 'NUBE' | 'LEGACY' | 'OTROS' => {
  const txt = `${v.producto || ''} ${v.categoria_producto_venta || ''} ${v.bloque_venta || ''}`.toLowerCase();
  if (txt.includes('nube') || txt.includes('cloud')) return 'NUBE';
  if (txt.includes('pyme') || txt.includes('ilimitada') || txt.includes('legacy') || txt.includes('contador')) return 'LEGACY';
  return 'OTROS';
};

const Retos = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [completados, setCompletados] = useState<Set<string>>(new Set());
  const [vcCatalog, setVcCatalog] = useState<VcCatalogReto[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [vcMetrics, setVcMetrics] = useState<{
    dailyAcvPlus: number;
    weeklyUpgrades: number;
    monthlyCumplimientoPct: number;
    monthlyAcvPlus: number;
    monthlyMeta: number;
  }>({ dailyAcvPlus: 0, weeklyUpgrades: 0, monthlyCumplimientoPct: 0, monthlyAcvPlus: 0, monthlyMeta: 0 });

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const semanaISO = getISOWeek(today);
  const anio = today.getFullYear();
  const mes = today.getMonth();
  const periodoHoy = todayStr;
  const periodoSemana = `${anio}-W${String(semanaISO).padStart(2, '0')}`;
  const periodoMes = `${anio}${String(mes + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    const fetchData = async () => {
      setDataLoading(true);
      const [{ data: catalog }, { data: retosData }, snapshot] = await Promise.all([
        supabase.from('catalogo_retos').select('*').eq('activo', true).or(`canal.eq.${profile.canal ?? 'VC'},canal.is.null`),
        supabase.from('retos_completados').select('reto, periodo').eq('gerente_id', profile.id),
        isVcAdvisorProfile(profile) ? getVcAdvisorSnapshot(profile) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setVcCatalog(filterCatalogByScope((catalog || []) as VcCatalogReto[], profile));
      setCompletados(new Set((retosData || []).map((r) => `${r.reto}::${r.periodo}`)));
      if (snapshot?.vcMetrics) {
        setVcMetrics(snapshot.vcMetrics);
      } else if (profile.canal === 'VC' && profile.id) {
        // Gerente VC: calcular métricas mensuales/diarias/semanales desde la tabla ventas
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
        const todayStr2 = now.toISOString().split('T')[0];
        const weekStart = (() => { const d = new Date(now); const dow = d.getDay() || 7; d.setDate(d.getDate() - dow + 1); return d.toISOString().split('T')[0]; })();

        const { data: vMes } = await supabase
          .from('ventas')
          .select('fecha_facturacion, acv_plus, meta, categoria_producto_venta, recurrencia, bloque_venta')
          .eq('canal', 'VC')
          .eq('gerente_id', profile.id)
          .gte('fecha_facturacion', monthStart)
          .lt('fecha_facturacion', monthEnd);

        if (cancelled) return;
        const ventas = vMes || [];
        const monthlyAcvPlus = ventas.reduce((s, v: any) => s + (Number(v.acv_plus) || 0), 0);
        const monthlyMeta = Math.max(0, ...ventas.map((v: any) => Number(v.meta) || 0));
        const monthlyCumplimientoPct = monthlyMeta > 0 ? (monthlyAcvPlus / monthlyMeta) * 100 : 0;
        const dailyAcvPlus = ventas.filter((v: any) => v.fecha_facturacion === todayStr2)
          .reduce((s, v: any) => s + (Number(v.acv_plus) || 0), 0);
        const isUpg = (v: any) => `${v.recurrencia || ''} ${v.bloque_venta || ''} ${v.categoria_producto_venta || ''}`.toLowerCase().includes('upgrade');
        const weeklyUpgrades = ventas.filter((v: any) => v.fecha_facturacion >= weekStart && isUpg(v)).length;
        setVcMetrics({ dailyAcvPlus, weeklyUpgrades, monthlyCumplimientoPct, monthlyAcvPlus, monthlyMeta });
      }
      setDataLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.canal, profile?.pais, profile?.gerente_id, profile?.role, profile?.nombre]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const kpiLabel = (kpi?: string | null) => {
    switch (kpi) {
      case 'acv_plus': return 'ACV';
      case 'upgrades': return 'Upgrades';
      case 'conversiones': return 'Conversiones';
      case 'cumplimiento_pct': return '% Cumplimiento';
      default: return 'Meta';
    }
  };

  const familiaLabel = (fam?: string | null) => {
    if (!fam || fam === 'AMBAS') return 'Nube + Legacy';
    if (fam === 'NUBE') return 'Nube';
    if (fam === 'LEGACY') return 'Legacy';
    return fam;
  };

  const formatUmbral = (reto: VcCatalogReto) => {
    if (reto.kpi === 'acv_plus') return `$${(reto.umbral / 1_000_000).toFixed(0)}M`;
    if (reto.kpi === 'cumplimiento_pct' || reto.kpi === 'conversiones') return `${reto.umbral}%`;
    return String(reto.umbral);
  };

  const getVcProgress = (reto: VcCatalogReto): { current: number; target: number; pct: number; label: string } => {
    const umbral = Number(reto.umbral) || 0;
    if (umbral === 0) return { current: 0, target: 1, pct: 0, label: '' };
    switch (reto.kpi) {
      case 'acv_plus': {
        const window = normalizeCatalogWindow(reto.ventana_tiempo);
        if (window === 'DIARIO') {
          const current = vcMetrics?.dailyAcvPlus ?? 0;
          return {
            current,
            target: umbral,
            pct: Math.min(100, (current / umbral) * 100),
            label: `$${(current / 1_000_000).toFixed(1)}M / $${(umbral / 1_000_000).toFixed(0)}M`,
          };
        }
        if (window === 'MENSUAL') {
          const current = vcMetrics?.monthlyAcvPlus ?? 0;
          return {
            current,
            target: umbral,
            pct: Math.min(100, (current / umbral) * 100),
            label: `$${(current / 1_000_000).toFixed(1)}M / $${(umbral / 1_000_000).toFixed(0)}M`,
          };
        }
        return { current: 0, target: umbral, pct: 0, label: '' };
      }
      case 'upgrades': {
        const current = vcMetrics?.weeklyUpgrades ?? 0;
        return {
          current,
          target: umbral,
          pct: Math.min(100, (current / umbral) * 100),
          label: `${current} / ${umbral} upgrades`,
        };
      }
      case 'cumplimiento_pct': {
        const current = vcMetrics?.monthlyCumplimientoPct ?? 0;
        return {
          current,
          target: umbral,
          pct: Math.min(100, (current / umbral) * 100),
          label: `${current.toFixed(1)}% / ${umbral}%`,
        };
      }
      case 'conversiones': {
        const monthlyCumpl = vcMetrics?.monthlyCumplimientoPct ?? 0;
        return {
          current: monthlyCumpl,
          target: umbral,
          pct: Math.min(100, (monthlyCumpl / umbral) * 100),
          label: `${monthlyCumpl.toFixed(1)}% / ${umbral}%`,
        };
      }
      default:
        return { current: 0, target: 1, pct: 0, label: '' };
    }
  };

  const renderVcCard = (reto: VcCatalogReto, periodo: string) => {
    const completed = completados.has(`${reto.nombre}::${periodo}`);
    return (
      <motion.div
        key={reto.id}
        className={cn('bg-white border rounded-2xl p-5 transition-all relative overflow-hidden border-l-4 shadow-smooth-sm', completed ? 'border-l-accent' : 'border-l-primary')}
        variants={scoreboardSlide}
        whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em] font-heading">
            {reto.ventana_tiempo === 'diario' ? 'DIARIO' : reto.ventana_tiempo === 'semanal' ? 'SEMANAL' : 'MENSUAL'}
          </span>
          {completed && (
            <span className="text-[9px] font-bold text-white bg-accent px-2 py-0.5 rounded-full">✅ COMPLETADO</span>
          )}
        </div>
        <div className="flex items-center gap-3 mb-3 mt-2">
          <span className="text-3xl">{completed ? '✅' : (reto.emoji || '🎯')}</span>
          <div className="flex-1">
            <p className={cn('text-sm font-bold', completed ? 'text-accent' : 'text-foreground')}>{reto.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {reto.objetivo_descripcion || `Logra ${formatUmbral(reto)} de ${kpiLabel(reto.kpi)}`}
            </p>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              <span className="text-[9px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{kpiLabel(reto.kpi)}</span>
              <span className="text-[9px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{familiaLabel(reto.familia_vc)}</span>
              {(reto.fecha_inicio || reto.fecha_fin) && (
                <span className="text-[9px] font-semibold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">
                  Vigente hasta: {reto.fecha_fin || 'Sin límite'}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <span
              className={cn('text-xs font-bold font-scoreboard px-3 py-1.5 rounded-lg block', completed ? 'bg-siigo-red text-white' : 'bg-muted text-muted-foreground')}
              title="Se suman a puntos canjeables"
            >🎁 {completed ? `+${reto.sp_otorgados}` : reto.sp_otorgados}</span>
          </div>
        </div>
        {!completed && (() => {
          const prog = getVcProgress(reto);
          return prog.target > 0 && prog.label ? (
            <div className="space-y-1.5 mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{prog.label}</span>
                <span className="font-scoreboard">{Math.round(prog.pct)}%</span>
              </div>
              <Progress value={prog.pct} className="h-2" />
            </div>
          ) : null;
        })()}
      </motion.div>
    );
  };

  const renderTab = (windowKey: 'DIARIO' | 'SEMANAL' | 'MENSUAL', periodo: string) => {
    const items = vcCatalog.filter((r) => normalizeCatalogWindow(r.ventana_tiempo) === windowKey);
    return (
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
        {items.map((r) => renderVcCard(r, periodo))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No hay retos activos en este momento.</p>
        )}
      </motion.div>
    );
  };

  return (
    <Layout title="🎯 Retos">
      <Tabs defaultValue="diarios" className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <TabsList className="w-full bg-white border border-border">
            <TabsTrigger value="diarios" className="flex-1">📋 Diarios</TabsTrigger>
            <TabsTrigger value="semanales" className="flex-1">📅 Semanales</TabsTrigger>
            <TabsTrigger value="mensuales" className="flex-1">🏆 Mensuales</TabsTrigger>
          </TabsList>
        </motion.div>

        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}</div>
        ) : (
          <>
            <TabsContent value="diarios">{renderTab('DIARIO', periodoHoy)}</TabsContent>
            <TabsContent value="semanales">{renderTab('SEMANAL', periodoSemana)}</TabsContent>
            <TabsContent value="mensuales">{renderTab('MENSUAL', periodoMes)}</TabsContent>
          </>
        )}
      </Tabs>
    </Layout>
  );
};

export default Retos;
