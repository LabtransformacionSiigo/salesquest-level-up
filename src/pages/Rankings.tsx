import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, podiumBounce } from '@/lib/animations';
import { normalizePersonName } from '@/lib/vc-advisor-metrics';
import colombiaFlag from '@/assets/flags/colombia.svg';
import mexicoFlag from '@/assets/flags/mexico.svg';
import ecuadorFlag from '@/assets/flags/ecuador.svg';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

const FLAG_IMG: Record<string, string> = { COL: colombiaFlag, CO: colombiaFlag, MEX: mexicoFlag, MX: mexicoFlag, ECU: ecuadorFlag, EC: ecuadorFlag };
const CANALES_LABEL: Record<string, string> = { VN_EMPRESARIOS: 'Empresarios', VN_ALIADOS: 'Aliados', VC: 'Venta Cruzada' };
const REFERIDOS_LABEL: Record<string, string> = { VN_ALIADOS: 'Ref. Contador', VN_EMPRESARIOS: 'Referidos' };
const PAIS_LABEL: Record<string, string> = { COL: 'Colombia', MEX: 'México', ECU: 'Ecuador' };
const PODIUM_EMOJIS = ['🥇', '🥈', '🥉'];
const PODIUM_COLORS = ['border-yellow bg-siigo-yellow/5', 'border-muted-foreground/30', 'border-orange/40'];
type RankingTab = 'comerciales' | 'gerentes';

const FlagIcon = ({ pais }: { pais?: string | null }) => {
  const src = FLAG_IMG[pais?.trim().toUpperCase() || ''];
  return src ? <img src={src} alt={pais || ''} className="h-4 w-4 rounded-full object-cover" /> : <span className="text-base">🌎</span>;
};

const formatMoney = (val: number | null | undefined) => {
  const n = Number(val) || 0;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

const getCurrentConventionYear = () => new Date().getFullYear();

const sumMonthlyConvention = <T extends { sp?: number | null }>(rows: T[]) =>
  (rows || []).reduce((total, row) => total + (Number(row.sp) || 0), 0);

const Rankings = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [ranking, setRanking] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tab, setTab] = useState<RankingTab>('comerciales');
  const isVC = profile?.canal === 'VC';
  const isVN = profile?.canal === 'VN_ALIADOS' || profile?.canal === 'VN_EMPRESARIOS';
  const userPais = profile?.pais || 'COL';

  const fetchRanking = async () => {
    if (!profile?.canal) return;
    setDataLoading(true);
    const currentConventionYear = getCurrentConventionYear();

    if (isVC) {
      if (tab === 'comerciales') {
        const [comRes, gerentesRes, asesoresRes, ventasRes] = await Promise.all([
          supabase.from('ranking_vc_comerciales' as any).select('*'),
          supabase.from('gerentes').select('nombre, pais').eq('canal', 'VC'),
          supabase.from('asesores').select('nombre, sp_canje').eq('canal', 'VC'),
          supabase.from('ventas').select('comercial, anio, mes, acv_plus, meta').eq('canal', 'VC').eq('anio', currentConventionYear).like('documento_factura', 'SUM-%').range(0, 5000),
        ]);
        const gerentePaisMap = new Map<string, string>();
        (gerentesRes.data || []).forEach((g: any) => {
          if (g.nombre) gerentePaisMap.set(g.nombre, g.pais || 'COL');
        });
        const monthlyByComercial = new Map<string, Map<string, { acv: number; meta: number }>>();
        (ventasRes.data || []).forEach((row: any) => {
          const comercial = normalizePersonName(row.comercial);
          const monthNumber = ({ Enero: '01', Febrero: '02', Marzo: '03', Abril: '04', Mayo: '05', Junio: '06', Julio: '07', Agosto: '08', Septiembre: '09', Octubre: '10', Noviembre: '11', Diciembre: '12' } as Record<string, string>)[row.mes || ''];
          if (!comercial || !row.anio || !monthNumber) return;

          const period = `${row.anio}${monthNumber}`;
          const monthly = monthlyByComercial.get(comercial) || new Map<string, { acv: number; meta: number }>();
          const current = monthly.get(period) || { acv: 0, meta: 0 };
          current.acv += Number(row.acv_plus) || 0;
          current.meta += Number(row.meta) || 0;
          monthly.set(period, current);
          monthlyByComercial.set(comercial, monthly);
        });
        const spByComercial = new Map<string, number>();
        monthlyByComercial.forEach((months, comercial) => {
          const rows = [...months.values()].map((month) => ({ sp: month.meta > 0 && month.acv > 0 ? Math.round((month.acv / month.meta) * 100) : 0 }));
          spByComercial.set(comercial, sumMonthlyConvention(rows));
        });
        const canjeablesByComercial = new Map<string, number>();
        (asesoresRes.data || []).forEach((a: any) => {
          if (a.nombre) canjeablesByComercial.set(normalizePersonName(a.nombre), Number(a.sp_canje) || 0);
        });
        const currentName = normalizePersonName(profile?.nombre);
        const mapped = (comRes.data || []).map((r: any) => ({
          id: `${r.nombre}-${r.gerente_nombre}`,
          nombre: r.nombre,
          gerente_nombre: r.gerente_nombre,
          kpi_value: Math.round(Number(r.acv_total) || 0),
          meta_total: Math.round(Number(r.meta_total) || 0),
          sp_totales: spByComercial.get(normalizePersonName(r.nombre)) || 0,
          pct_cumplimiento: Number(r.pct_cumplimiento) || 0,
          ventas_count: r.ventas_count,
          posicion: r.posicion,
          canal: 'VC',
          pais: gerentePaisMap.get(r.gerente_nombre) || 'COL',
          sp_canje: canjeablesByComercial.get(normalizePersonName(r.nombre)) || 0,
          nivel: null,
          isCurrent: profile?.role === 'asesor' && normalizePersonName(r.nombre) === currentName,
        }));
        // Filter by user's country
        setRanking(mapped.filter(r => r.pais === userPais));
      } else {
        // Gerentes VC — filter by user's country
        const [vcGerentesRes, spRes, gerentesRes] = await Promise.all([
          supabase.from('ranking_vc_gerentes' as any).select('*').eq('pais', userPais),
          supabase.from('ranking_general').select('id, sp_totales, nivel, user_id, avatar_url').eq('canal', 'VC'),
          supabase.from('gerentes').select('id, sp_canje').eq('canal', 'VC').eq('pais', userPais),
        ]);
        const spMap = new Map<string, any>();
        (spRes.data || []).forEach((s: any) => {
          if (s.id) spMap.set(s.id, s);
        });
        const canjeablesMap = new Map<string, number>();
        (gerentesRes.data || []).forEach((g: any) => {
          if (g.id) canjeablesMap.set(g.id, Number(g.sp_canje) || 0);
        });
        const mapped = (vcGerentesRes.data || []).map((r: any) => {
          const sp = spMap.get(r.gerente_id);
          return {
            id: r.gerente_id,
            nombre: r.nombre,
            pais: r.pais,
            canal: 'VC',
            kpi_value: Math.round(Number(r.acv_total) || 0),
            meta_total: Math.round(Number(r.meta_total) || 0),
            pct_cumplimiento: Number(r.pct_cumplimiento) || 0,
            sp_totales: sp?.sp_totales || 0,
            sp_canje: canjeablesMap.get(r.gerente_id) || 0,
            nivel: sp?.nivel || null,
            user_id: sp?.user_id || null,
            avatar_url: sp?.avatar_url || null,
            posicion: r.posicion,
          };
        });
        setRanking(mapped);
      }
    } else if (isVN) {
      // VN channels
      const areaFilter = profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Leads Mercadeo Digital';
      if (tab === 'comerciales') {
        // Build ranking directly from productividad_asesores
        const [productividadRes, asesoresRes, metasGerentesRes] = await Promise.all([
          supabase.from('productividad_asesores').select('asesor, anio_mes, ventas, meta, cant_recomendados, pais, celula, acv_f').eq('area', areaFilter).gte('anio_mes', `${currentConventionYear}01`).lte('anio_mes', `${currentConventionYear}12`).eq('pais', userPais).range(0, 5000),
          supabase.from('asesores').select('nombre, sp_canje, pais').eq('canal', profile.canal),
          supabase.from('metas_gerentes').select('celula, canal_direccion, meta_total_acv, cuota'),
        ]);
        const canjeMap = new Map<string, number>();
        (asesoresRes.data || []).forEach((a: any) => {
          if (a.nombre) canjeMap.set(normalizePersonName(a.nombre), Number(a.sp_canje) || 0);
        });
        // Build meta ACV by celula
        const canalNormR = profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Empresarios';
        const metaAcvByCelula = new Map<string, number>();
        (metasGerentesRes.data || []).forEach((m: any) => {
          const key = `${(m.celula || '').trim()}|${m.canal_direccion}`;
          metaAcvByCelula.set(key, Number(m.meta_total_acv) || Number(m.cuota) || 0);
        });
        const currentMonth = `${currentConventionYear}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        // Aggregate by advisor
        const advisorAgg = new Map<string, { ventas: number; meta: number; recomendados: number; unidades: number; acv: number; celula: string; months: Map<string, { ventas: number; meta: number; acv: number }> }>();
        (productividadRes.data || []).forEach((row: any) => {
          const name = row.asesor;
          if (!name) return;
          const key = normalizePersonName(name);
          const agg = advisorAgg.get(key) || { ventas: 0, meta: 0, recomendados: 0, unidades: 0, acv: 0, celula: '', months: new Map() };
          agg.celula = row.celula || agg.celula;
          // Monthly aggregation for SP calculation
          const period = String(row.anio_mes || '');
          const cm = agg.months.get(period) || { ventas: 0, meta: 0, acv: 0 };
          cm.ventas += Number(row.ventas) || 0;
          cm.meta += Number(row.meta) || 0;
          cm.acv += Number(row.acv_f) || 0;
          agg.months.set(period, cm);
          // Current month totals
          if (period === currentMonth) {
            agg.ventas += Number(row.ventas) || 0;
            agg.meta += Number(row.meta) || 0;
            agg.recomendados += Number(row.cant_recomendados) || 0;
          }
          // Totals across all months
          agg.unidades += Number(row.ventas) || 0;
          agg.acv += Number(row.acv_f) || 0;
          advisorAgg.set(key, agg);
          // Keep original name
          if (!agg.celula) agg.celula = row.celula || '';
        });
        // Build ranking entries
        const entries: any[] = [];
        advisorAgg.forEach((agg, key) => {
          const teamMetaAcv = metaAcvByCelula.get(`${agg.celula}|${canalNormR}`) || 0;
          // SP Convención = sum of monthly ACV / Meta ACV (como VC)
          const spConv = [...agg.months.values()].reduce((total, m) => {
            if (teamMetaAcv > 0 && m.acv > 0) return total + Math.round((m.acv / teamMetaAcv) * 100);
            // Fallback to units if no meta ACV
            if (m.meta > 0 && m.ventas > 0) return total + Math.round((m.ventas / m.meta) * 100);
            return total;
          }, 0);
          // Current month ACV compliance
          const currentAcv = [...agg.months.entries()].filter(([p]) => p === currentMonth).reduce((s, [, m]) => s + m.acv, 0);
          const pct = teamMetaAcv > 0 && currentAcv > 0
            ? Math.round((currentAcv / teamMetaAcv) * 100)
            : (agg.meta > 0 && agg.ventas > 0 ? Math.round((agg.ventas / agg.meta) * 100) : 0);
          // Find original name from data
          const originalName = (productividadRes.data || []).find((r: any) => normalizePersonName(r.asesor) === key)?.asesor || key;
          entries.push({
            id: key,
            nombre: originalName,
            gerente_nombre: agg.celula,
            kpi_value: Math.round(agg.acv),
            meta_acv: teamMetaAcv,
            unidades_total: agg.unidades,
            cant_recomendados: agg.recomendados,
            pct_cumplimiento: pct,
            ventas_count: agg.unidades,
            posicion: 0,
            canal: profile.canal,
            pais: userPais,
            sp_totales: spConv,
            sp_canje: canjeMap.get(key) || 0,
            nivel: null,
          });
        });
        setRanking(entries);
      } else {
        // Gerentes tab for VN: aggregate productividad_asesores by celula (team)
        const areaFilter = profile.canal === 'VN_ALIADOS' ? 'Aliados' : 'Leads Mercadeo Digital';
        const [productividadRes, gerentesRes, rolesRes] = await Promise.all([
          supabase.from('productividad_asesores').select('asesor, celula, anio_mes, ventas, meta, cant_recomendados, acv_f, pais').eq('area', areaFilter).gte('anio_mes', `${currentConventionYear}01`).lte('anio_mes', `${currentConventionYear}12`).eq('pais', userPais).range(0, 5000),
          supabase.from('gerentes').select('nombre, celula, sp_canje, user_id').eq('canal', profile.canal).eq('pais', userPais),
          supabase.from('user_roles').select('user_id, role'),
        ]);
        const currentMonth = `${currentConventionYear}${String(new Date().getMonth() + 1).padStart(2, '0')}`;

        const asesorNames = new Set<string>();
        (productividadRes.data || []).forEach((row: any) => {
          if (row.asesor) asesorNames.add(normalizePersonName(row.asesor));
        });

        const roleByUserId = new Map<string, string>();
        (rolesRes.data || []).forEach((row: any) => {
          if (row.user_id && row.role) roleByUserId.set(row.user_id, row.role);
        });

        const gerentesByCelula = new Map<string, { nombre: string; sp_canje: number }>();
        const gerentesByCell = new Map<string, Array<{ nombre: string; sp_canje: number; user_id?: string | null }>>();
        (gerentesRes.data || []).forEach((g: any) => {
          if (!g.celula) return;
          const list = gerentesByCell.get(g.celula) || [];
          list.push({ nombre: g.nombre, sp_canje: Number(g.sp_canje) || 0, user_id: g.user_id });
          gerentesByCell.set(g.celula, list);
        });

        gerentesByCell.forEach((members, celula) => {
          const roleMatches = members.filter((member) => {
            if (!member.user_id) return false;
            const role = roleByUserId.get(member.user_id);
            return role === 'gerente' || role === 'admin';
          });

          const explicitLeader = roleMatches.find((member) => !asesorNames.has(normalizePersonName(member.nombre))) || roleMatches[0];
          if (explicitLeader) {
            gerentesByCelula.set(celula, explicitLeader);
            return;
          }

          const nonAsesor = members.find((member) => !asesorNames.has(normalizePersonName(member.nombre)));
          if (nonAsesor) {
            gerentesByCelula.set(celula, nonAsesor);
            return;
          }

          if (members.length > 0) {
            gerentesByCelula.set(celula, members[0]);
          }
        });

        // Aggregate by celula + month
        const celulaAgg = new Map<string, { months: Map<string, { ventas: number; meta: number }>; recomendados: number; unidades: number; acv: number; currentVentas: number; currentMeta: number; currentRecomendados: number; currentAcv: number }>();
        (productividadRes.data || []).forEach((row: any) => {
          const celula = row.celula;
          if (!celula) return;
          const agg = celulaAgg.get(celula) || { months: new Map(), recomendados: 0, unidades: 0, acv: 0, currentVentas: 0, currentMeta: 0, currentRecomendados: 0, currentAcv: 0 };
          const period = String(row.anio_mes || '');
          const cm = agg.months.get(period) || { ventas: 0, meta: 0 };
          cm.ventas += Number(row.ventas) || 0;
          cm.meta += Number(row.meta) || 0;
          agg.months.set(period, cm);
          agg.unidades += Number(row.ventas) || 0;
          agg.acv += Number(row.acv_f) || 0;
          if (period === currentMonth) {
            agg.currentVentas += Number(row.ventas) || 0;
            agg.currentMeta += Number(row.meta) || 0;
            agg.currentRecomendados += Number(row.cant_recomendados) || 0;
            agg.currentAcv += Number(row.acv_f) || 0;
          }
          celulaAgg.set(celula, agg);
        });
        const entries: any[] = [];
        celulaAgg.forEach((agg, celula) => {
          const spConv = [...agg.months.values()].reduce((total, m) => {
            if (m.meta > 0 && m.ventas > 0) return total + Math.round((m.ventas / m.meta) * 100);
            return total;
          }, 0);
          const pct = agg.currentMeta > 0 && agg.currentVentas > 0 ? Math.round((agg.currentVentas / agg.currentMeta) * 100) : 0;
          const gerenteInfo = gerentesByCelula.get(celula);
          entries.push({
            id: celula,
            nombre: gerenteInfo?.nombre || celula,
            celula_nombre: celula,
            canal: profile.canal,
            pais: userPais,
            kpi_value: Math.round(agg.currentAcv),
            acv_total_year: Math.round(agg.acv),
            meta_total: agg.currentMeta,
            unidades_logradas: agg.currentVentas,
            unidades_total: agg.unidades,
            cant_recomendados: agg.currentRecomendados,
            pct_cumplimiento: pct,
            sp_totales: spConv,
            sp_canje: gerenteInfo?.sp_canje || 0,
            nivel: null,
            posicion: 0,
          });
        });
        setRanking(entries);
      }
    } else {
      const [rankRes, kpiRes, gerentesRes] = await Promise.all([
        supabase.from('ranking_general').select('*').eq('canal', profile.canal).eq('pais', userPais),
        supabase.from('kpis_mes_actual').select('gerente_id, acv_f, sc_creados').eq('canal', profile.canal),
        supabase.from('gerentes').select('id, sp_canje').eq('canal', profile.canal).eq('pais', userPais),
      ]);
      const kpiMap = new Map<string, { acv: number; units: number }>();
      (kpiRes.data || []).forEach((k: any) => {
        if (k.gerente_id) kpiMap.set(k.gerente_id, { acv: Number(k.acv_f) || 0, units: Number(k.sc_creados) || 0 });
      });
      const canjeablesMap = new Map<string, number>();
      (gerentesRes.data || []).forEach((g: any) => {
        if (g.id) canjeablesMap.set(g.id, Number(g.sp_canje) || 0);
      });
      setRanking((rankRes.data || []).map((r: any) => ({
        ...r,
        kpi_value: kpiMap.get(r.id)?.acv || 0,
        units: kpiMap.get(r.id)?.units || 0,
        sp_canje: canjeablesMap.get(r.id) || 0,
      })));
    }
    setDataLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated || !profile?.canal) return;
    fetchRanking();
    const channel = supabase.channel('ranking-live').on('postgres_changes', { event: '*', schema: 'public', table: 'sp_acumulados' }, () => fetchRanking()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, profile?.canal, tab, profile?.nombre, profile?.role, userPais]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isComercialTab = (isVC || isVN) && tab === 'comerciales';
  const isGerentesVCTab = isVC && tab === 'gerentes';
  const isGerentesVNTab = isVN && tab === 'gerentes';

  // Sort by SP totales as primary, then by % cumplimiento
  const sorted = [...ranking].sort((a, b) => {
    const spDiff = (b.sp_totales || 0) - (a.sp_totales || 0);
    if (spDiff !== 0) return spDiff;
    const pctDiff = (b.pct_cumplimiento ?? 0) - (a.pct_cumplimiento ?? 0);
    if (pctDiff !== 0) return pctDiff;
    return (b.kpi_value || 0) - (a.kpi_value || 0);
  });

  const entityLabel = isComercialTab ? 'Comercial' : 'Gerente';
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <Layout title={`🏆 Ranking · ${CANALES_LABEL[profile?.canal || ''] || profile?.canal}`}>
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        {/* Tabs + Country indicator */}
        <motion.div className="flex items-center justify-between flex-wrap gap-3" variants={fadeUpItem}>
          <div className="flex gap-2">
            {(isVC || isVN) && (
              <>
                <button onClick={() => setTab('comerciales')} className={cn("px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2", tab === 'comerciales' ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40")}>
                  👤 {isVN ? 'Asesores' : 'Comerciales'}
                </button>
                <button onClick={() => setTab('gerentes')} className={cn("px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2", tab === 'gerentes' ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40")}>
                  👥 Gerentes
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted border border-border text-foreground">
              <FlagIcon pais={userPais} /> {PAIS_LABEL[userPais] || userPais}
            </span>
            <span className="text-[10px] text-white bg-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> EN VIVO
            </span>
          </div>
        </motion.div>

        {dataLoading ? <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}</div> : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {top3.map((g, i) => (
                  <motion.div
                    key={g.id}
                    className={cn(
                      "bg-white rounded-3xl border-2 p-6 text-center relative overflow-hidden shadow-smooth-sm",
                      PODIUM_COLORS[i],
                      (g.isCurrent || g.user_id === profile?.user_id) && "ring-2 ring-primary"
                    )}
                    variants={podiumBounce}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  >
                    {i === 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow to-transparent" />}
                    <motion.p className="text-4xl mb-2" animate={{ rotate: [0, -8, 8, -4, 4, 0] }} transition={{ duration: 0.6, delay: i * 0.15 + 0.4 }}>{PODIUM_EMOJIS[i]}</motion.p>
                    <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 mx-auto flex items-center justify-center text-3xl mb-2">🏅</div>
                    <p className="font-bold font-heading text-secondary text-lg">{g.nombre}</p>
                    {g.celula_nombre && g.celula_nombre !== g.nombre && (
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">📋 {g.celula_nombre}</p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                      <FlagIcon pais={g.pais} /> {g.canal?.replace(/_/g, ' ')}
                    </p>

                    {/* SP — HERO metric */}
                    <motion.div
                      className="mt-4 mb-3"
                      initial={{ opacity: 0, scale: 0.3 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 12, delay: i * 0.15 + 0.5 }}
                    >
                      <div className="inline-flex items-center gap-2 bg-primary/10 rounded-2xl px-5 py-3">
                        <motion.span
                          className="text-2xl"
                          animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                        >⚡</motion.span>
                        <AnimatedCounter value={g.sp_totales || 0} className="text-3xl font-black font-scoreboard text-primary" duration={1.2} />
                        <span className="text-xs font-bold text-primary/70 font-scoreboard">Siigo Points</span>
                      </div>
                    </motion.div>

                    <div className="mt-2 flex justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-bold font-scoreboard text-accent">
                        🎁 {(g.sp_canje || 0).toLocaleString()} <span className="text-[10px] text-accent/70">SP Canje</span>
                      </span>
                    </div>

                    {/* Secondary metrics */}
                    <div className="flex items-center justify-center gap-3 text-xs flex-wrap">
                      {(isComercialTab || isGerentesVCTab || isGerentesVNTab) && (
                        <>
                          {/* % Cumpl — always shown */}
                          <div>
                            <p className="text-sm font-bold font-scoreboard text-foreground">{g.pct_cumplimiento != null ? `${Math.round(g.pct_cumplimiento)}%` : '—'}</p>
                            <p className="text-[10px] text-muted-foreground font-heading uppercase">Cumpl.</p>
                          </div>
                          {/* VN: Unidades + Referidos */}
                          {(isGerentesVNTab || (isVN && isComercialTab)) && (
                            <>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-foreground">{(g.unidades_logradas || g.unidades_total || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">Unidades</p>
                              </div>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-primary">{formatMoney(g.kpi_value)}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">ACV+</p>
                              </div>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-accent">{(g.cant_recomendados || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">{REFERIDOS_LABEL[profile?.canal || ''] || 'Referidos'}</p>
                              </div>
                            </>
                          )}
                          {/* VC: ACV + Meta */}
                          {(isComercialTab || isGerentesVCTab) && !isVN && (
                            <>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-foreground">{formatMoney(g.kpi_value)}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">ACV+</p>
                              </div>
                              <div className="w-px h-6 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-muted-foreground">{formatMoney(g.meta_total)}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">Meta</p>
                              </div>
                            </>
                          )}
                        </>
                      )}
                      {!isComercialTab && !isGerentesVCTab && !isGerentesVNTab && g.kpi_value > 0 && (
                        <div>
                          <p className="text-sm font-bold font-scoreboard text-accent">{formatMoney(g.kpi_value)}</p>
                          <p className="text-[10px] text-muted-foreground font-heading uppercase">ACV+</p>
                        </div>
                      )}
                    </div>

                    {!isComercialTab && g.nivel && <span className="inline-block mt-2 text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span>}
                    {isComercialTab && g.gerente_nombre && <p className="text-[10px] text-muted-foreground mt-2">Líder: {g.gerente_nombre}</p>}
                    {isGerentesVNTab && g.celula_nombre && g.celula_nombre !== g.nombre && <p className="text-[10px] text-muted-foreground mt-2">📋 {g.celula_nombre}</p>}
                    {(g.isCurrent || g.user_id === profile?.user_id) && <span className="inline-block mt-2 text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">Tú</span>}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Full table */}
            {rest.length > 0 && (
              <motion.div className="bg-white border border-border rounded-2xl overflow-hidden shadow-smooth-sm" variants={fadeUpItem}>
                <div className="bg-primary px-4 py-3"><p className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 font-heading">📋 Tabla Completa</p></div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-primary text-white text-[11px] uppercase tracking-wider font-heading">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">{entityLabel}</th>
                      {isComercialTab && <th className="text-left px-4 py-3">Líder</th>}
                      <th className="text-right px-4 py-3">⚡ Siigo Points</th>
                      <th className="text-right px-4 py-3">🎁 Canjeables</th>
                      {(isComercialTab || isGerentesVCTab) && !isVN && (
                        <>
                          <th className="text-right px-4 py-3">% Cumpl.</th>
                          <th className="text-right px-4 py-3">ACV+</th>
                          <th className="text-right px-4 py-3">Meta</th>
                        </>
                      )}
                      {(isGerentesVNTab || (isVN && isComercialTab)) && (
                        <>
                          <th className="text-right px-4 py-3">% Cumpl.</th>
                          <th className="text-right px-4 py-3">Unidades</th>
                          <th className="text-right px-4 py-3">ACV+</th>
                          <th className="text-right px-4 py-3">{REFERIDOS_LABEL[profile?.canal || ''] || 'Referidos'}</th>
                        </>
                      )}
                      {!isComercialTab && !isGerentesVCTab && !isGerentesVNTab && (
                        <>
                          <th className="text-right px-4 py-3">ACV+</th>
                          <th className="text-left px-4 py-3">Nivel</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((g, i) => (
                      <motion.tr
                        key={g.id}
                        className={cn(
                          "border-b border-border hover:bg-primary/5 transition-colors",
                          (g.isCurrent || g.user_id === profile?.user_id) && "bg-primary/10 font-semibold"
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 + 0.3 }}
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground font-scoreboard">{i + 4}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FlagIcon pais={g.pais} />
                            <div>
                              <span className="text-sm text-foreground">{g.nombre}</span>
                              {g.celula_nombre && g.celula_nombre !== g.nombre && (
                                <p className="text-[10px] text-muted-foreground">📋 {g.celula_nombre}</p>
                              )}
                            </div>
                            {(g.isCurrent || g.user_id === profile?.user_id) && <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">Tú</span>}
                          </div>
                        </td>
                        {isComercialTab && <td className="px-4 py-3 text-xs text-muted-foreground">{g.gerente_nombre || '—'}</td>}
                        {/* SP Ranking — prominent */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-base font-black font-scoreboard text-primary">{(g.sp_totales || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-primary/60 ml-1 font-scoreboard">PTS</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-black font-scoreboard text-accent">{(g.sp_canje || 0).toLocaleString()}</span>
                        </td>
                        {(isComercialTab || isGerentesVCTab) && !isVN && (
                          <>
                            <td className="px-4 py-3 text-sm font-bold font-scoreboard text-foreground text-right">{g.pct_cumplimiento != null ? `${Math.round(g.pct_cumplimiento)}%` : '—'}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.kpi_value)}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.meta_total)}</td>
                          </>
                        )}
                        {(isGerentesVNTab || (isVN && isComercialTab)) && (
                          <>
                            <td className="px-4 py-3 text-sm font-bold font-scoreboard text-foreground text-right">{g.pct_cumplimiento != null ? `${Math.round(g.pct_cumplimiento)}%` : '—'}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-foreground text-right">{(g.unidades_logradas || g.unidades_total || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-primary text-right">{formatMoney(g.kpi_value)}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-accent text-right">{(g.cant_recomendados || 0).toLocaleString()}</td>
                          </>
                        )}
                        {!isComercialTab && !isGerentesVCTab && !isGerentesVNTab && (
                          <>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{formatMoney(g.kpi_value)}</td>
                            <td className="px-4 py-3"><span className="text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span></td>
                          </>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
            {sorted.length === 0 && (
              <motion.div className="text-center py-16" variants={fadeUpItem}>
                <div className="text-7xl mb-4 opacity-30">📊</div>
                <p className="text-lg font-bold text-muted-foreground">Sin datos de ranking</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Los datos aparecerán cuando se sincronicen las ventas</p>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </Layout>
  );
};

export default Rankings;
