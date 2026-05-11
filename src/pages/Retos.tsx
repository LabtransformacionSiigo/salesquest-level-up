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

// Clasificación VC: NUBE vs LEGACY. Debe coincidir 1:1 con la del edge
// supabase/functions/evaluar-retos-vc/index.ts (classifyFamiliaVc).
// Reglas (en orden):
//   1) NUBE si contiene cualquier keyword nube (incluye 'pyme', 'lite',
//      'emprendedor', 'premium', 'profesional independiente', 'sci',
//      'contai', 'mto', 'nomina ili', 'nube', 'cloud').
//   2) LEGACY si contiene 'ilimitada', 'legacy', 'contador', o es FE/POS/Nómina
//      desktop (sin haber matcheado NUBE primero).
//   3) OTROS en cualquier otro caso.
const NUBE_KEYWORDS = [
  'nube', 'cloud', 'siigo nube', 'pyme', 'lite', 'emprendedor', 'premium',
  'profesional independiente', 'sci', 'contai', 'mto', 'nomina ili',
];
const LEGACY_KEYWORDS = [
  'ilimitada', 'legacy', 'contador',
  'fe ', 'fe(', 'fe pro', ' pos', 'pos ', 'pos inicio', 'pos avanzado',
  'pos esencial', 'gastrobar', 'nomina base', 'nomina lite', 'nomina plus',
  'nomina pro',
];
const classifyFamilia = (v: any): 'NUBE' | 'LEGACY' | 'OTROS' => {
  const raw = `${v.producto || ''} ${v.categoria_producto_venta || ''} ${v.bloque_venta || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!raw) return 'OTROS';
  if (NUBE_KEYWORDS.some((k) => raw.includes(k))) return 'NUBE';
  if (LEGACY_KEYWORDS.some((k) => raw.includes(k))) return 'LEGACY';
  return 'OTROS';
};

interface VcMetrics {
  // ACV+ del día por familia (PROD-)
  dailyAcvNube: number;
  dailyAcvLegacy: number;
  dailyAcvTotal: number;
  // Upgrades semana por familia (PROD-)
  weeklyUpgradesNube: number;
  weeklyUpgradesLegacy: number;
  weeklyUpgradesTotal: number;
  // ACV+ mes por familia (PROD-)
  monthlyAcvNube: number;
  monthlyAcvLegacy: number;
  monthlyAcvTotal: number;
  // Cumplimiento mensual (SUM-)
  monthlyCumplimientoPct: number;
  monthlyAcvSum: number;
  monthlyMetaSum: number;
  // Racha "El artillero" — días lun/mar/mié evaluados
  artilleroDias: { fecha: string; nube: number; legacy: number; cumple: boolean }[];
}

// ── Tipos VN ─────────────────────────────────────────────────────────────────
interface VnRetoConfig {
  id: string;
  nombre: string;
  tipo: 'DIARIO' | 'SEMANAL' | 'MENSUAL';
  kpi: 'NUBES' | 'ACV';
  sp_base: number;
  sp_semanal_sem1: number; sp_semanal_sem2: number;
  sp_semanal_sem3: number; sp_semanal_sem4: number;
  acumular_finde_al_viernes: boolean;
}
interface VnProgresoDiario { fecha_evaluacion: string; nubes_vendidas: number; meta_diaria_nubes: number; cumple: boolean; sp_otorgados: number; sp_con_racha: number; }
interface VnProgresoSemanal { semana_numero: number; fecha_inicio_semana: string; fecha_fin_semana: string; acv_real: number; meta_semanal_acv: number; pct_cumplimiento: number; cumple: boolean; sp_otorgados: number; sp_con_racha: number; }
interface VnProgresoMensual { acv_real: number; meta_mensual_acv: number; pct_cumplimiento: number; cumple: boolean; sp_otorgados: number; }
interface VnRachaEstado { racha_id: string; dias_o_semanas_consecutivas: number; racha_activa: boolean; ultima_fecha_cumplida?: string; rachas_vn_config?: { nombre: string; tipo: string; multiplicador: number; dias_consecutivos_requeridos: number }; }
interface VnMedalla { id: string; nombre: string; descripcion: string; emoji: string; condicion_tipo: string; condicion_valor: number; sp_reward: number; ganada?: boolean; }
interface VnSemana { numero: number; fecha_inicio: string; fecha_fin: string; sp: number; }

const Retos = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [completados, setCompletados] = useState<Set<string>>(new Set());
  const [vcCatalog, setVcCatalog] = useState<VcCatalogReto[]>([]);
  const [vcRachas, setVcRachas] = useState<VcRacha[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [vcMetrics, setVcMetrics] = useState<VcMetrics>({
    dailyAcvNube: 0, dailyAcvLegacy: 0, dailyAcvTotal: 0,
    weeklyUpgradesNube: 0, weeklyUpgradesLegacy: 0, weeklyUpgradesTotal: 0,
    monthlyAcvNube: 0, monthlyAcvLegacy: 0, monthlyAcvTotal: 0,
    monthlyCumplimientoPct: 0, monthlyAcvSum: 0, monthlyMetaSum: 0,
    artilleroDias: [],
  });

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const semanaISO = getISOWeek(today);
  const anio = today.getFullYear();
  const mes = today.getMonth();
  const periodoHoy = todayStr;
  const periodoSemana = `${anio}-W${String(semanaISO).padStart(2, '0')}`;
  const periodoMes = `${anio}${String(mes + 1).padStart(2, '0')}`;
  const anioMesStr = `${anio}-${String(mes + 1).padStart(2, '0')}`;

  // ── Estado VN ───────────────────────────────────────────────────────────
  const [vnRetos,          setVnRetos]          = useState<VnRetoConfig[]>([]);
  const [vnProgresoDiario, setVnProgresoDiario] = useState<VnProgresoDiario[]>([]);
  const [vnProgresoSemanal,setVnProgresoSemanal]= useState<VnProgresoSemanal[]>([]);
  const [vnProgresoMensual,setVnProgresoMensual]= useState<VnProgresoMensual | null>(null);
  const [vnRachaEstados,   setVnRachaEstados]   = useState<VnRachaEstado[]>([]);
  const [vnMedallas,       setVnMedallas]       = useState<VnMedalla[]>([]);
  const [vnMetaNubes,      setVnMetaNubes]      = useState(0);
  const [vnDiasHabiles,    setVnDiasHabiles]    = useState(20);
  const [vnFestivos,       setVnFestivos]       = useState<string[]>([]);
  const [vnSemanas,        setVnSemanas]        = useState<VnSemana[]>([]);

  const isVN = profile?.canal === 'VN_EMPRESARIOS' || profile?.canal === 'VN_ALIADOS';

  useEffect(() => {
    if (!profile?.id || !isVN) return;
    let cancelled = false;

    const fetchVnData = async () => {
      const pais = profile.pais ?? 'COL';
      const canal = profile.canal ?? 'VN_EMPRESARIOS';

      const [
        { data: retosData },
        { data: calData },
        { data: metaNubesData },
        { data: progDiario },
        { data: progSemanal },
        { data: progMensual },
        { data: rachaEstados },
        { data: medallasConf },
        { data: medallasGanadas },
      ] = await Promise.all([
        supabase.from('retos_vn_config').select('*').eq('activo', true)
          .contains('canal', [canal]).contains('paises', [pais]),
        supabase.from('config_calendario_vn').select('*')
          .eq('anio_mes', anioMesStr).eq('pais', pais).maybeSingle(),
        supabase.from('metas_nubes_mensuales').select('meta_nubes')
          .eq('gerente_id', profile.id).eq('anio_mes', anioMesStr).maybeSingle(),
        supabase.from('retos_vn_progreso_diario').select('*')
          .eq('gerente_id', profile.id)
          .gte('fecha_evaluacion', `${anioMesStr}-01`)
          .order('fecha_evaluacion', { ascending: false }),
        supabase.from('retos_vn_progreso_semanal').select('*')
          .eq('gerente_id', profile.id).eq('anio_mes', anioMesStr)
          .order('semana_numero'),
        supabase.from('retos_vn_progreso_mensual').select('*')
          .eq('gerente_id', profile.id).eq('anio_mes', anioMesStr).maybeSingle(),
        supabase.from('rachas_vn_estado').select('*, rachas_vn_config(nombre, tipo, multiplicador, dias_consecutivos_requeridos)')
          .eq('gerente_id', profile.id),
        supabase.from('medallas_vn_config').select('*').eq('activo', true)
          .contains('canal', [canal]).contains('paises', [pais]),
        supabase.from('medallas_vn_ganadas').select('medalla_id').eq('gerente_id', profile.id),
      ]);

      if (cancelled) return;

      setVnRetos((retosData ?? []) as VnRetoConfig[]);
      const cal = calData as any;
      if (cal) {
        setVnDiasHabiles(cal.dias_habiles ?? 20);
        setVnFestivos(cal.festivos ?? []);
        setVnSemanas(cal.semanas ?? []);
      }
      setVnMetaNubes(Number(metaNubesData?.meta_nubes ?? 0));
      setVnProgresoDiario((progDiario ?? []) as VnProgresoDiario[]);
      setVnProgresoSemanal((progSemanal ?? []) as VnProgresoSemanal[]);
      setVnProgresoMensual((progMensual as VnProgresoMensual) ?? null);
      setVnRachaEstados((rachaEstados ?? []) as VnRachaEstado[]);

      const ganadosSet = new Set((medallasGanadas ?? []).map((m: any) => m.medalla_id));
      setVnMedallas(
        (medallasConf ?? []).map((m: any) => ({ ...m, ganada: ganadosSet.has(m.id) })) as VnMedalla[],
      );
    };

    fetchVnData();
    return () => { cancelled = true; };
  }, [profile?.id, isVN, anioMesStr]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    const fetchData = async () => {
      setDataLoading(true);
      const [{ data: catalog }, { data: rachasCfg }, { data: retosData }, snapshot] = await Promise.all([
        supabase.from('catalogo_retos').select('*').eq('activo', true).or(`canal.eq.${profile.canal ?? 'VC'},canal.is.null`),
        supabase.from('config_rachas').select('*').eq('activo', true).or(`canal.eq.${profile.canal ?? 'VC'},canal.is.null`),
        supabase.from('retos_completados').select('reto, periodo').eq('gerente_id', profile.id),
        isVcAdvisorProfile(profile) ? getVcAdvisorSnapshot(profile) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setVcCatalog(filterCatalogByScope((catalog || []) as VcCatalogReto[], profile));
      setVcRachas(filterCatalogByScope((rachasCfg || []) as VcRacha[], profile));
      setCompletados(new Set((retosData || []).map((r) => `${r.reto}::${r.periodo}`)));

      if (profile.canal === 'VC' && profile.id && !snapshot?.vcMetrics) {
        // Gerente VC: réplica de la lógica del edge function (SUM- vs PROD-)
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
        const todayStr2 = now.toISOString().split('T')[0];
        const monday = (() => { const d = new Date(now); const dow = d.getDay() || 7; d.setDate(d.getDate() - dow + 1); return d; })();
        const weekStart = monday.toISOString().split('T')[0];

        const { data: vMes } = await supabase
          .from('ventas')
          .select('fecha_facturacion, acv_plus, meta, producto, categoria_producto_venta, recurrencia, bloque_venta, documento_factura')
          .eq('canal', 'VC')
          .eq('gerente_id', profile.id)
          .gte('fecha_facturacion', monthStart)
          .lt('fecha_facturacion', monthEnd);

        if (cancelled) return;
        const all = vMes || [];
        const isSum = (v: any) => typeof v.documento_factura === 'string' && v.documento_factura.startsWith('SUM-');
        const isProd = (v: any) => typeof v.documento_factura === 'string' && v.documento_factura.startsWith('PROD-');
        const sumRows = all.filter(isSum);
        const prodRows = all.filter(isProd);
        const isUpg = (v: any) => `${v.recurrencia || ''} ${v.bloque_venta || ''}`.toLowerCase().includes('upgrade');
        const sumAcvFam = (rows: any[], fam: 'NUBE' | 'LEGACY' | null) =>
          rows.filter((v) => !fam || classifyFamilia(v) === fam).reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
        const countUpgFam = (rows: any[], fam: 'NUBE' | 'LEGACY' | null) =>
          rows.filter((v) => isUpg(v) && (!fam || classifyFamilia(v) === fam)).length;

        // Mes (PROD-)
        const monthlyAcvNube = sumAcvFam(prodRows, 'NUBE');
        const monthlyAcvLegacy = sumAcvFam(prodRows, 'LEGACY');
        const monthlyAcvTotal = sumAcvFam(prodRows, null);

        // Día (PROD-)
        const today_ = prodRows.filter((v: any) => v.fecha_facturacion === todayStr2);
        const dailyAcvNube = sumAcvFam(today_, 'NUBE');
        const dailyAcvLegacy = sumAcvFam(today_, 'LEGACY');
        const dailyAcvTotal = sumAcvFam(today_, null);

        // Semana (PROD-) upgrades
        const weekRows = prodRows.filter((v: any) => v.fecha_facturacion >= weekStart);
        const weeklyUpgradesNube = countUpgFam(weekRows, 'NUBE');
        const weeklyUpgradesLegacy = countUpgFam(weekRows, 'LEGACY');
        const weeklyUpgradesTotal = countUpgFam(weekRows, null);

        // Cumplimiento mes (SUM-)
        const monthlyMetaSum = sumRows.reduce((s, v) => s + (Number(v.meta) || 0), 0);
        const monthlyAcvSum = sumRows.reduce((s, v) => s + (Number(v.acv_plus) || 0), 0);
        const monthlyCumplimientoPct = monthlyMetaSum > 0 ? (monthlyAcvSum / monthlyMetaSum) * 100 : 0;

        // Racha El artillero — lun/mar/mié de la semana actual
        const artilleroDias: VcMetrics['artilleroDias'] = [];
        for (let i = 0; i < 3; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          if (d > now) break;
          const fechaStr = d.toISOString().split('T')[0];
          const dayRows = prodRows.filter((v: any) => v.fecha_facturacion === fechaStr);
          artilleroDias.push({
            fecha: fechaStr,
            nube: sumAcvFam(dayRows, 'NUBE'),
            legacy: sumAcvFam(dayRows, 'LEGACY'),
            cumple: false, // calculado al renderizar
          });
        }

        setVcMetrics({
          dailyAcvNube, dailyAcvLegacy, dailyAcvTotal,
          weeklyUpgradesNube, weeklyUpgradesLegacy, weeklyUpgradesTotal,
          monthlyAcvNube, monthlyAcvLegacy, monthlyAcvTotal,
          monthlyCumplimientoPct, monthlyAcvSum, monthlyMetaSum,
          artilleroDias,
        });
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

  const pickFamilia = (fam?: string | null): 'NUBE' | 'LEGACY' | 'AMBAS' => {
    const f = (fam || 'AMBAS').toUpperCase();
    return f === 'NUBE' || f === 'LEGACY' ? f : 'AMBAS';
  };

  const getVcProgress = (reto: VcCatalogReto): { current: number; target: number; pct: number; label: string } => {
    const umbral = Number(reto.umbral) || 0;
    if (umbral === 0) return { current: 0, target: 1, pct: 0, label: '' };
    const fam = pickFamilia(reto.familia_vc);
    switch (reto.kpi) {
      case 'acv_plus': {
        const window = normalizeCatalogWindow(reto.ventana_tiempo);
        const pickAcv = (which: 'daily' | 'monthly') => {
          if (which === 'daily') {
            return fam === 'NUBE' ? vcMetrics.dailyAcvNube
              : fam === 'LEGACY' ? vcMetrics.dailyAcvLegacy
              : vcMetrics.dailyAcvTotal;
          }
          return fam === 'NUBE' ? vcMetrics.monthlyAcvNube
            : fam === 'LEGACY' ? vcMetrics.monthlyAcvLegacy
            : vcMetrics.monthlyAcvTotal;
        };
        if (window === 'DIARIO' || window === 'MENSUAL') {
          const current = pickAcv(window === 'DIARIO' ? 'daily' : 'monthly');
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
        const current = fam === 'NUBE' ? vcMetrics.weeklyUpgradesNube
          : fam === 'LEGACY' ? vcMetrics.weeklyUpgradesLegacy
          : vcMetrics.weeklyUpgradesTotal;
        return {
          current,
          target: umbral,
          pct: Math.min(100, (current / umbral) * 100),
          label: `${current} / ${umbral} upgrades`,
        };
      }
      case 'cumplimiento_pct':
      case 'conversiones': {
        const current = vcMetrics.monthlyCumplimientoPct;
        return {
          current,
          target: umbral,
          pct: Math.min(100, (current / umbral) * 100),
          label: `${current.toFixed(1)}% / ${umbral}%`,
        };
      }
      default:
        return { current: 0, target: 1, pct: 0, label: '' };
    }
  };

  const renderRachaCard = (racha: VcRacha) => {
    const fam = pickFamilia(racha.familia_vc);
    const umbralN = Number(racha.umbral_verde) || 0;
    const umbralL = Number(racha.umbral_legacy) || 0;
    const dias = vcMetrics.artilleroDias.map((d) => {
      const cumple = fam === 'NUBE' ? d.nube >= umbralN
        : fam === 'LEGACY' ? d.legacy >= umbralL
        : (d.nube >= umbralN || d.legacy >= umbralL);
      return { ...d, cumple };
    });
    const cumplidos = dias.filter((d) => d.cumple).length;
    const totalDias = 3;
    const pct = (cumplidos / totalDias) * 100;
    const completa = cumplidos === totalDias && dias.length === totalDias;
    const dayLabels = ['Lun', 'Mar', 'Mié'];

    return (
      <motion.div
        key={racha.id}
        className={cn('bg-white border rounded-2xl p-5 transition-all relative overflow-hidden border-l-4 shadow-smooth-sm', completa ? 'border-l-accent' : 'border-l-siigo-yellow')}
        variants={scoreboardSlide}
        whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em] font-heading">
            🔥 RACHA · LUN/MAR/MIÉ
          </span>
          {completa && <span className="text-[9px] font-bold text-white bg-accent px-2 py-0.5 rounded-full">✅ COMPLETADA</span>}
        </div>
        <div className="flex items-center gap-3 mb-3 mt-2">
          <span className="text-3xl">{racha.emoji || '🔥'}</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{racha.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {racha.objetivo_descripcion || `Logra ${fam === 'LEGACY' ? `$${(umbralL/1_000_000).toFixed(0)}M Legacy` : fam === 'NUBE' ? `$${(umbralN/1_000_000).toFixed(0)}M Nube` : `$${(umbralN/1_000_000).toFixed(0)}M Nube ó $${(umbralL/1_000_000).toFixed(0)}M Legacy`} cada Lun/Mar/Mié`}
            </p>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              <span className="text-[9px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">ACV diario</span>
              <span className="text-[9px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{familiaLabel(racha.familia_vc)}</span>
              <span className="text-[9px] font-semibold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">x{racha.multiplicador_sp} SP semanal</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {dayLabels.map((lbl, idx) => {
            const d = dias[idx];
            const valor = d ? (fam === 'LEGACY' ? d.legacy : fam === 'NUBE' ? d.nube : Math.max(d.nube, d.legacy)) : 0;
            const target = fam === 'LEGACY' ? umbralL : fam === 'NUBE' ? umbralN : umbralN;
            const ok = d?.cumple;
            return (
              <div key={lbl} className={cn('rounded-lg p-2 text-center border', ok ? 'bg-accent/10 border-accent' : d ? 'bg-muted/40 border-muted' : 'bg-muted/20 border-dashed border-muted')}>
                <p className="text-[10px] font-bold uppercase">{lbl} {ok && '✅'}</p>
                <p className="text-[10px] text-muted-foreground">${(valor / 1_000_000).toFixed(1)}M</p>
                <p className="text-[9px] text-muted-foreground">/ ${(target / 1_000_000).toFixed(0)}M</p>
              </div>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{cumplidos} / {totalDias} días cumplidos</span>
            <span className="font-scoreboard">{Math.round(pct)}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </motion.div>
    );
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

  // ── Helpers VN ─────────────────────────────────────────────────────────────
  const vnMetaDiaria = vnDiasHabiles > 0 ? vnMetaNubes / vnDiasHabiles : 0;

  const vnSemanasConProgreso = vnSemanas.map((sem) => {
    const prog = vnProgresoSemanal.find((p) => p.semana_numero === sem.numero);
    const esFuturo = todayStr < sem.fecha_inicio;
    const esActual = todayStr >= sem.fecha_inicio && todayStr <= sem.fecha_fin;
    const acvReal  = prog?.acv_real ?? 0;
    const metaSem  = prog?.meta_semanal_acv ?? 0;
    return { ...sem, prog, esFuturo, esActual, acvReal, metaSem };
  });

  const vnSemanaActual = vnSemanas.find(
    (s) => todayStr >= s.fecha_inicio && todayStr <= s.fecha_fin,
  );
  const vnProgSemanaActual = vnSemanaActual
    ? vnProgresoSemanal.find((p) => p.semana_numero === vnSemanaActual.numero)
    : null;

  const vnProgHoy = vnProgresoDiario.find((p) => p.fecha_evaluacion === todayStr);
  const esFestivoHoy = vnFestivos.includes(todayStr);

  const vnRachasDiarias  = vnRachaEstados.filter((r) => r.rachas_vn_config?.tipo === 'DIARIA');
  const vnRachasSemanales= vnRachaEstados.filter((r) => r.rachas_vn_config?.tipo === 'SEMANAL');

  const fmtACV = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${v.toLocaleString()}`;

  // ── Render VN section ───────────────────────────────────────────────────
  if (isVN) {
    return (
      <Layout title="🎯 Retos VN">
        <div className="space-y-8 max-w-4xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <span className="material-icons-outlined text-primary text-2xl">flag</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Mis Retos VN</h1>
              <p className="text-sm text-muted-foreground">
                {profile?.canal} · {profile?.pais} · {anioMesStr}
              </p>
            </div>
          </div>

          {dataLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : (
            <>
              {/* ── Cards de retos ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* CARD 1: El Golazo del Día */}
                {(() => {
                  const reto = vnRetos.find((r) => r.tipo === 'DIARIO');
                  if (!reto) return null;
                  const nubes = vnProgHoy?.nubes_vendidas ?? 0;
                  const meta  = vnProgHoy?.meta_diaria_nubes ?? vnMetaDiaria;
                  const pct   = meta > 0 ? Math.min(100, (nubes / meta) * 100) : 0;
                  const cumple= vnProgHoy?.cumple ?? false;
                  const spGanado = vnProgHoy?.sp_con_racha ?? 0;
                  const rachaD = vnRachasDiarias[0];
                  const rachaActiva = rachaD?.racha_activa ?? false;
                  return (
                    <motion.div
                      className={cn(
                        'bg-white border rounded-2xl p-5 shadow-smooth-sm border-l-4',
                        cumple ? 'border-l-accent' : 'border-l-primary',
                      )}
                      variants={scoreboardSlide}
                      initial="hidden" animate="show"
                      whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em]">📅 DIARIO</span>
                        {cumple && <span className="text-[9px] font-bold text-white bg-accent px-2 py-0.5 rounded-full">✅ CUMPLIDO</span>}
                        {esFestivoHoy && <span className="text-[9px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">🎉 FESTIVO</span>}
                      </div>
                      <div className="flex items-center gap-3 mb-3 mt-2">
                        <span className="text-3xl">{cumple ? '⚽' : '🎯'}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-foreground">{reto.nombre}</p>
                          <p className="text-xs text-muted-foreground">Nubes vendidas hoy vs meta diaria</p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            <span className="text-[9px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Meta: {Math.ceil(meta)} nubes/día
                            </span>
                            {rachaActiva && (
                              <span className="text-[9px] font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                                🔥 Racha x{rachaD?.rachas_vn_config?.multiplicador}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            'text-xs font-bold font-scoreboard px-3 py-1.5 rounded-lg block',
                            cumple ? 'bg-siigo-red text-white' : 'bg-muted text-muted-foreground',
                          )}>
                            🎁 {cumple ? `+${spGanado}` : reto.sp_base} SP
                          </span>
                        </div>
                      </div>
                      {!esFestivoHoy && (
                        <div className="space-y-1.5 mt-2">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{nubes} / {Math.ceil(meta)} nubes</span>
                            <span className="font-scoreboard">{Math.round(pct)}%</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                          {reto.acumular_finde_al_viernes && (
                            <p className="text-[9px] text-muted-foreground">
                              💡 Ventas sáb+dom se suman al viernes
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })()}

                {/* CARD 2: La Jugada de la Semana */}
                {(() => {
                  const reto = vnRetos.find((r) => r.tipo === 'SEMANAL');
                  if (!reto) return null;
                  const prog = vnProgSemanaActual;
                  const acvReal = prog?.acv_real ?? 0;
                  const metaSem = prog?.meta_semanal_acv ?? 0;
                  const pct = metaSem > 0 ? Math.min(100, (acvReal / metaSem) * 100) : 0;
                  const cumple = prog?.cumple ?? false;
                  const spDisponible = vnSemanaActual?.sp ?? reto.sp_semanal_sem1;
                  const rachaS = vnRachasSemanales[0];
                  const rachaActiva = rachaS?.racha_activa ?? false;
                  return (
                    <motion.div
                      className={cn(
                        'bg-white border rounded-2xl p-5 shadow-smooth-sm border-l-4',
                        cumple ? 'border-l-accent' : 'border-l-siigo-yellow',
                      )}
                      variants={scoreboardSlide}
                      initial="hidden" animate="show"
                      whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em]">📆 SEMANAL</span>
                        {cumple && <span className="text-[9px] font-bold text-white bg-accent px-2 py-0.5 rounded-full">✅ CUMPLIDO</span>}
                      </div>
                      <div className="flex items-center gap-3 mb-3 mt-2">
                        <span className="text-3xl">{cumple ? '🏅' : '⚡'}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-foreground">{reto.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {vnSemanaActual
                              ? `Sem ${vnSemanaActual.numero} · ${vnSemanaActual.fecha_inicio} → ${vnSemanaActual.fecha_fin}`
                              : 'ACV semanal vs meta'}
                          </p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {rachaActiva && (
                              <span className="text-[9px] font-semibold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                                ⚡ Racha x{rachaS?.rachas_vn_config?.multiplicador}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            'text-xs font-bold font-scoreboard px-3 py-1.5 rounded-lg block',
                            cumple ? 'bg-siigo-red text-white' : 'bg-muted text-muted-foreground',
                          )}>
                            🎁 {cumple ? `+${prog?.sp_con_racha ?? spDisponible}` : spDisponible} SP
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5 mt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{fmtACV(acvReal)} / {fmtACV(metaSem)}</span>
                          <span className="font-scoreboard">{Math.round(pct)}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                      {/* Mini tabla de semanas */}
                      <div className="mt-3 grid grid-cols-4 gap-1">
                        {vnSemanasConProgreso.map((s) => (
                          <div key={s.numero}
                            className={cn(
                              'rounded-lg p-1.5 text-center border text-[9px]',
                              s.prog?.cumple ? 'bg-accent/10 border-accent'
                                : s.esActual ? 'bg-primary/10 border-primary'
                                : s.esFuturo ? 'bg-muted/20 border-dashed border-muted'
                                : 'bg-red-50 border-red-200',
                            )}>
                            <p className="font-bold">S{s.numero}</p>
                            <p className="text-muted-foreground">{s.sp}SP</p>
                            <p>{s.prog?.cumple ? '✅' : s.esFuturo ? '🔒' : s.esActual ? '▶️' : '❌'}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })()}

                {/* CARD 3: La Bota de Oro */}
                {(() => {
                  const reto = vnRetos.find((r) => r.tipo === 'MENSUAL');
                  if (!reto) return null;
                  const prog = vnProgresoMensual;
                  const acvReal = prog?.acv_real ?? 0;
                  const metaMes = prog?.meta_mensual_acv ?? 0;
                  const pct = metaMes > 0 ? Math.min(100, (acvReal / metaMes) * 100) : 0;
                  const cumple = prog?.cumple ?? false;
                  const color = pct >= 100 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600';
                  return (
                    <motion.div
                      className={cn(
                        'bg-white border rounded-2xl p-5 shadow-smooth-sm border-l-4',
                        cumple ? 'border-l-accent' : 'border-l-muted',
                      )}
                      variants={scoreboardSlide}
                      initial="hidden" animate="show"
                      whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em]">🗓️ MENSUAL</span>
                        {cumple && <span className="text-[9px] font-bold text-white bg-accent px-2 py-0.5 rounded-full">✅ LOGRADO</span>}
                      </div>
                      <div className="flex items-center gap-3 mb-3 mt-2">
                        <span className="text-3xl">{cumple ? '👟' : '🥾'}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-foreground">{reto.nombre}</p>
                          <p className="text-xs text-muted-foreground">ACV mensual ≥ 100% meta</p>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            'text-xs font-bold font-scoreboard px-3 py-1.5 rounded-lg block',
                            cumple ? 'bg-siigo-red text-white' : 'bg-muted text-muted-foreground',
                          )}>
                            🎁 {cumple ? '+7' : '7'} SP
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5 mt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{fmtACV(acvReal)} / {fmtACV(metaMes)}</span>
                          <span className={cn('font-scoreboard font-bold', color)}>{Math.round(pct)}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    </motion.div>
                  );
                })()}
              </div>

              {/* ── Rachas ── */}
              {vnRachaEstados.length > 0 && (
                <div>
                  <h2 className="text-base font-bold text-foreground mb-3">🔥 Mis Rachas</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {vnRachaEstados.map((estado) => {
                      const conf = estado.rachas_vn_config;
                      if (!conf) return null;
                      const req  = conf.dias_consecutivos_requeridos;
                      const actual = estado.dias_o_semanas_consecutivas;
                      const pct = Math.min(100, (actual / req) * 100);
                      const label = conf.tipo === 'DIARIA' ? 'días consecutivos' : 'semanas consecutivas';
                      return (
                        <motion.div key={estado.racha_id}
                          className={cn(
                            'bg-white border rounded-2xl p-5 shadow-smooth-sm border-l-4',
                            estado.racha_activa ? 'border-l-orange-400' : 'border-l-muted',
                          )}
                          variants={scoreboardSlide} initial="hidden" animate="show">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                              🔥 RACHA {conf.tipo}
                            </span>
                            {estado.racha_activa && (
                              <span className="text-[9px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full">
                                🔥 ACTIVA x{conf.multiplicador}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-foreground mb-1">{conf.nombre}</p>
                          <p className="text-xs text-muted-foreground mb-3">
                            {estado.racha_activa
                              ? `¡Multiplicador x${conf.multiplicador} activo! Mantén la racha.`
                              : `Necesitas ${req} ${label} para activar el multiplicador x${conf.multiplicador}`}
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{actual} / {req} {label}</span>
                              <span className="font-scoreboard">{Math.round(pct)}%</span>
                            </div>
                            <Progress value={pct} className="h-2" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Medallas ── */}
              {vnMedallas.length > 0 && (
                <div>
                  <h2 className="text-base font-bold text-foreground mb-3">🏅 Mis Medallas VN</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {vnMedallas.map((m) => (
                      <motion.div key={m.id}
                        className={cn(
                          'bg-white border rounded-xl p-4 text-center transition-all',
                          m.ganada ? 'border-accent shadow-smooth-sm' : 'opacity-50 grayscale',
                        )}
                        variants={scoreboardSlide} initial="hidden" animate="show">
                        <span className="text-3xl block mb-2">{m.emoji}</span>
                        <p className="text-xs font-bold text-foreground">{m.nombre}</p>
                        {m.descripcion && <p className="text-[9px] text-muted-foreground mt-0.5">{m.descripcion}</p>}
                        <p className={cn('text-xs font-semibold mt-1', m.ganada ? 'text-accent' : 'text-muted-foreground')}>
                          {m.ganada ? `✅ +${m.sp_reward} SP` : `🔒 ${m.sp_reward} SP`}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="🎯 Retos">
      <Tabs defaultValue="diarios" className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <TabsList className="w-full bg-white border border-border">
            <TabsTrigger value="diarios" className="flex-1">📋 Diarios</TabsTrigger>
            <TabsTrigger value="semanales" className="flex-1">📅 Semanales</TabsTrigger>
            <TabsTrigger value="mensuales" className="flex-1">🏆 Mensuales</TabsTrigger>
            <TabsTrigger value="rachas" className="flex-1">🔥 Rachas</TabsTrigger>
          </TabsList>
        </motion.div>

        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}</div>
        ) : (
          <>
            <TabsContent value="diarios">{renderTab('DIARIO', periodoHoy)}</TabsContent>
            <TabsContent value="semanales">{renderTab('SEMANAL', periodoSemana)}</TabsContent>
            <TabsContent value="mensuales">{renderTab('MENSUAL', periodoMes)}</TabsContent>
            <TabsContent value="rachas">
              <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {vcRachas.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No hay rachas activas en este momento.</p>
                )}
                {vcRachas.map((r) => renderRachaCard(r))}
              </motion.div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </Layout>
  );
};

export default Retos;
