import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, podiumBounce } from '@/lib/animations';
import { normalizePersonName, calculateSpFromRevenue } from '@/lib/vc-advisor-metrics';
import colombiaFlag from '@/assets/flags/colombia.svg';
import mexicoFlag from '@/assets/flags/mexico.svg';
import ecuadorFlag from '@/assets/flags/ecuador.svg';

const FLAG_IMG: Record<string, string> = { COL: colombiaFlag, CO: colombiaFlag, MEX: mexicoFlag, MX: mexicoFlag, ECU: ecuadorFlag, EC: ecuadorFlag };
const CANALES_LABEL: Record<string, string> = { VN_EMPRESARIOS: 'Empresarios', VN_ALIADOS: 'Aliados', VC: 'Venta Cruzada' };
const KPI_LABEL: Record<string, string> = { VC: 'ACV+', VN_EMPRESARIOS: 'ACV+', VN_ALIADOS: 'ACV+' };
const PAISES = [
  { value: 'TODOS', label: '🌎 Todos' },
  { value: 'COL', label: '🇨🇴 Colombia' },
  { value: 'MEX', label: '🇲🇽 México' },
  { value: 'ECU', label: '🇪🇨 Ecuador' },
];
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

const Rankings = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [ranking, setRanking] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [pais, setPais] = useState('TODOS');
  const [tab, setTab] = useState<RankingTab>('comerciales');
  const isVC = profile?.canal === 'VC';

  const fetchRanking = async () => {
    if (!profile?.canal) return;
    setDataLoading(true);

    if (isVC) {
      if (tab === 'comerciales') {
        const [comRes, gerentesRes] = await Promise.all([
          supabase.from('ranking_vc_comerciales' as any).select('*'),
          supabase.from('gerentes').select('nombre, pais').eq('canal', 'VC'),
        ]);
        const gerentePaisMap = new Map<string, string>();
        (gerentesRes.data || []).forEach((g: any) => {
          if (g.nombre) gerentePaisMap.set(g.nombre, g.pais || 'COL');
        });
        const currentName = normalizePersonName(profile?.nombre);
        const mapped = (comRes.data || []).map((r: any) => ({
          id: `${r.nombre}-${r.gerente_nombre}`,
          nombre: r.nombre,
          gerente_nombre: r.gerente_nombre,
          kpi_value: Math.round(Number(r.acv_total) || 0),
          sp_totales: calculateSpFromRevenue(Math.round(Number(r.acv_total) || 0)),
          ventas_count: r.ventas_count,
          posicion: r.posicion,
          canal: 'VC',
          pais: gerentePaisMap.get(r.gerente_nombre) || 'COL',
          nivel: null,
          isCurrent: profile?.role === 'asesor' && normalizePersonName(r.nombre) === currentName,
        }));
        setRanking(pais !== 'TODOS' ? mapped.filter(r => r.pais === pais) : mapped);
      } else {
        // Gerentes VC: fetch ranking + ACV data
        let rankQuery = supabase.from('ranking_general').select('*').eq('canal', 'VC');
        if (pais !== 'TODOS') rankQuery = rankQuery.eq('pais', pais);
        const [rankRes, acvRes] = await Promise.all([
          rankQuery,
          supabase.from('acv_vc_mensual').select('gerente_id, acv_plus_total').order('anio', { ascending: false }),
        ]);
        const acvMap = new Map<string, number>();
        (acvRes.data || []).forEach((a: any) => {
          if (a.gerente_id && !acvMap.has(a.gerente_id)) {
            acvMap.set(a.gerente_id, Number(a.acv_plus_total) || 0);
          }
        });
        setRanking((rankRes.data || []).map((r: any) => ({
          ...r,
          kpi_value: acvMap.get(r.id) || 0,
        })));
      }
    } else {
      // VN channels: fetch ranking + KPIs
      let query = supabase.from('ranking_general').select('*').eq('canal', profile.canal);
      if (pais !== 'TODOS') query = query.eq('pais', pais);
      const [rankRes, kpiRes] = await Promise.all([
        query,
        supabase.from('kpis_mes_actual').select('gerente_id, acv_f, sc_creados').eq('canal', profile.canal),
      ]);
      const kpiMap = new Map<string, { acv: number; units: number }>();
      (kpiRes.data || []).forEach((k: any) => {
        if (k.gerente_id) kpiMap.set(k.gerente_id, { acv: Number(k.acv_f) || 0, units: Number(k.sc_creados) || 0 });
      });
      setRanking((rankRes.data || []).map((r: any) => ({
        ...r,
        kpi_value: kpiMap.get(r.id)?.acv || 0,
        units: kpiMap.get(r.id)?.units || 0,
      })));
    }
    setDataLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated || !profile?.canal) return;
    fetchRanking();
    const channel = supabase.channel('ranking-live').on('postgres_changes', { event: '*', schema: 'public', table: 'sp_acumulados' }, () => fetchRanking()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, profile?.canal, pais, tab, profile?.nombre, profile?.role]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isComercialTab = isVC && tab === 'comerciales';
  const sorted = [...ranking].sort((a, b) => {
    if (isComercialTab) return (b.kpi_value || 0) - (a.kpi_value || 0);
    return (b.sp_totales || 0) - (a.sp_totales || 0);
  });
  const kpiLabel = KPI_LABEL[profile?.canal || ''] || 'ACV+';
  const entityLabel = isComercialTab ? 'Comercial' : 'Gerente';
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <Layout title={`🏆 Ranking · ${CANALES_LABEL[profile?.canal || ''] || profile?.canal}`}>
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        {isVC && (
          <motion.div className="flex gap-2" variants={fadeUpItem}>
            <button onClick={() => setTab('comerciales')} className={cn("px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2", tab === 'comerciales' ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40")}>
              👤 Comerciales (ACV+)
            </button>
            <button onClick={() => setTab('gerentes')} className={cn("px-5 py-2.5 rounded-full text-sm font-semibold transition-all border-2", tab === 'gerentes' ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40")}>
              👥 Gerentes (SP)
            </button>
          </motion.div>
        )}

        <motion.div className="flex flex-wrap items-center gap-2" variants={fadeUpItem}>
          <span className="text-xs font-semibold text-muted-foreground mr-2">🌎 País:</span>
          {PAISES.map(p => (
            <motion.button key={p.value} onClick={() => setPais(p.value)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all border", pais === p.value ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:text-foreground")}>
              {p.label}
            </motion.button>
          ))}
          <span className="ml-auto text-[10px] text-white bg-primary px-2 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> EN VIVO</span>
        </motion.div>

        {dataLoading ? <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}</div> : (
          <>
            {top3.length > 0 && (
              <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {top3.map((g, i) => (
                  <motion.div key={g.id} className={cn("bg-white rounded-3xl border-2 p-6 text-center relative overflow-hidden shadow-smooth-sm", PODIUM_COLORS[i], (g.isCurrent || g.user_id === profile?.user_id) && "ring-2 ring-primary")} variants={podiumBounce} whileHover={{ y: -6, transition: { duration: 0.2 } }}>
                    {i === 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow to-transparent" />}
                    <motion.p className="text-4xl mb-2" animate={{ rotate: [0, -8, 8, -4, 4, 0] }} transition={{ duration: 0.6, delay: i * 0.15 + 0.4 }}>{PODIUM_EMOJIS[i]}</motion.p>
                    <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 mx-auto flex items-center justify-center text-3xl mb-2">🏅</div>
                    <p className="font-bold font-heading text-secondary text-lg">{g.nombre}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                      <FlagIcon pais={g.pais} /> {g.canal?.replace(/_/g, ' ')}
                    </p>

                    {/* KPI + SP metrics */}
                    <div className="flex items-center justify-center gap-3 mt-3">
                      {isComercialTab ? (
                        <>
                          <div>
                            <motion.p className="text-2xl font-bold font-scoreboard text-primary" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: i * 0.1 + 0.5 }}>
                              {formatMoney(g.kpi_value)}
                            </motion.p>
                            <p className="text-[10px] text-muted-foreground font-heading uppercase">ACV+</p>
                          </div>
                          <div className="w-px h-8 bg-border" />
                          <div>
                            <p className="text-sm font-bold font-scoreboard text-accent">{(g.sp_totales || 0).toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground font-heading uppercase">SP</p>
                          </div>
                          {(g.ventas_count > 0) && (
                            <>
                              <div className="w-px h-8 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-accent">{g.ventas_count}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">Uds</p>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div>
                            <motion.p className="text-2xl font-bold font-scoreboard text-primary" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15, delay: i * 0.1 + 0.5 }}>
                              {(g.sp_totales || 0).toLocaleString()}
                            </motion.p>
                            <p className="text-[10px] text-muted-foreground font-heading uppercase">SP</p>
                          </div>
                          {(g.kpi_value > 0) && (
                            <>
                              <div className="w-px h-8 bg-border" />
                              <div>
                                <p className="text-sm font-bold font-scoreboard text-accent">{formatMoney(g.kpi_value)}</p>
                                <p className="text-[10px] text-muted-foreground font-heading uppercase">{kpiLabel}</p>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {!isComercialTab && g.nivel && <span className="inline-block mt-2 text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span>}
                    {isComercialTab && g.gerente_nombre && <p className="text-[10px] text-muted-foreground mt-2">Líder: {g.gerente_nombre}</p>}
                    {(g.isCurrent || g.user_id === profile?.user_id) && <span className="inline-block mt-2 text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">Tú</span>}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {rest.length > 0 && (
              <motion.div className="bg-white border border-border rounded-2xl overflow-hidden shadow-smooth-sm" variants={fadeUpItem}>
                <div className="bg-primary px-4 py-3"><p className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 font-heading">📋 Tabla Completa</p></div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-primary text-white text-[11px] uppercase tracking-wider font-heading">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">{entityLabel}</th>
                      {isComercialTab && <th className="text-left px-4 py-3">Líder</th>}
                      {!isComercialTab && <th className="text-left px-4 py-3">Canal</th>}
                      {isComercialTab ? (
                        <>
                          <th className="text-right px-4 py-3">ACV+</th>
                          <th className="text-right px-4 py-3">SP</th>
                          <th className="text-right px-4 py-3">Uds</th>
                        </>
                      ) : (
                        <>
                          <th className="text-right px-4 py-3">SP</th>
                          <th className="text-right px-4 py-3">{kpiLabel}</th>
                        </>
                      )}
                      {!isComercialTab && <th className="text-left px-4 py-3">Nivel</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((g, i) => (
                      <motion.tr key={g.id} className={cn("border-b border-border hover:bg-primary/5 transition-colors row-alt", (g.isCurrent || g.user_id === profile?.user_id) && "bg-primary/10 font-semibold")} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: i * 0.04 + 0.3 }}>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-scoreboard">{g.posicion || i + 4}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {!isComercialTab && <FlagIcon pais={g.pais} />}
                            <span className="text-sm text-foreground">{g.nombre}</span>
                            {(g.isCurrent || g.user_id === profile?.user_id) && <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">Tú</span>}
                          </div>
                        </td>
                        {isComercialTab && <td className="px-4 py-3 text-xs text-muted-foreground">{g.gerente_nombre || '—'}</td>}
                        {!isComercialTab && <td className="px-4 py-3 text-xs text-muted-foreground">{g.canal?.replace(/_/g, ' ')}</td>}
                        {isComercialTab ? (
                          <>
                            <td className="px-4 py-3 text-sm font-bold font-scoreboard text-primary text-right">{formatMoney(g.kpi_value)}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-accent text-right">{(g.sp_totales || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-muted-foreground text-right">{g.ventas_count || 0}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-sm font-bold font-scoreboard text-primary text-right">{(g.sp_totales || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm font-scoreboard text-accent text-right">{formatMoney(g.kpi_value)}</td>
                          </>
                        )}
                        {!isComercialTab && <td className="px-4 py-3"><span className="text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span></td>}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
            {sorted.length === 0 && <motion.div className="text-center py-16" variants={fadeUpItem}><div className="text-7xl mb-4 opacity-30">📊</div><p className="text-lg font-bold text-muted-foreground">Sin datos de ranking</p><p className="text-sm text-muted-foreground/60 mt-1">Los datos aparecerán cuando se sincronicen las ventas</p></motion.div>}
          </>
        )}
      </motion.div>
    </Layout>
  );
};

export default Rankings;