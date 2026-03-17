import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, podiumBounce } from '@/lib/animations';

const FLAG_MAP: Record<string, string> = { COL: '🇨🇴', MEX: '🇲🇽', ECU: '🇪🇨', USA: '🇺🇸' };

const CANALES_LABEL: Record<string, string> = {
  VN_EMPRESARIOS: 'Empresarios',
  VN_ALIADOS: 'Aliados',
  VC: 'Venta Cruzada',
};

const PAISES = [
  { value: 'TODOS', label: '🌎 Todos' },
  { value: 'COL', label: '🇨🇴 COL' },
  { value: 'MEX', label: '🇲🇽 MEX' },
  { value: 'ECU', label: '🇪🇨 ECU' },
];

const PODIUM_EMOJIS = ['🥇', '🥈', '🥉'];
const PODIUM_COLORS = [
  'border-yellow bg-siigo-yellow/5',
  'border-muted-foreground/30',
  'border-orange/40',
];

const Rankings = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [ranking, setRanking] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [pais, setPais] = useState('TODOS');

  const isVC = profile?.canal === 'VC';

  const fetchRanking = async () => {
    if (!profile?.canal) return;

    if (isVC) {
      // VC: rank by comercial (sales rep) using ACV Plus
      const { data } = await supabase.from('ranking_vc_comerciales').select('*');
      setRanking((data || []).map((r: any) => ({
        id: r.nombre,
        nombre: r.nombre,
        gerente_nombre: r.gerente_nombre,
        sp_totales: Math.round(Number(r.acv_total) || 0),
        ventas_count: r.ventas_count,
        posicion: r.posicion,
        canal: 'VC',
        pais: 'COL',
        nivel: null,
      })));
    } else {
      let query = supabase.from('ranking_general').select('*').eq('canal', profile.canal);
      if (pais !== 'TODOS') query = query.eq('pais', pais);
      const { data } = await query;
      setRanking(data || []);
    }
    setDataLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated || !profile?.canal) return;
    fetchRanking();
    const channel = supabase.channel('ranking-live').on('postgres_changes', { event: '*', schema: 'public', table: 'sp_acumulados' }, () => fetchRanking()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, profile?.canal, pais]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const sorted = [...ranking].sort((a, b) => (b.sp_totales || 0) - (a.sp_totales || 0));
  const metricLabel = isVC ? 'ACV' : 'SP';
  const formatMetric = (val: number) => isVC ? `$${(val / 1000000).toFixed(1)}M` : val.toLocaleString();
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <Layout title={`🏆 Ranking · ${CANALES_LABEL[profile?.canal || ''] || profile?.canal}`}>
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        {/* Country filter */}
        <motion.div className="flex flex-wrap items-center gap-2" variants={fadeUpItem}>
          <span className="text-xs font-semibold text-muted-foreground mr-2">🌎 País:</span>
          {PAISES.map(p => (
            <motion.button key={p.value} onClick={() => setPais(p.value)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                pais === p.value ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:text-foreground")}>
              {p.label}
            </motion.button>
          ))}
          <span className="ml-auto text-[10px] text-white bg-primary px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> EN VIVO
          </span>
        </motion.div>

        {dataLoading ? (
          <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}</div>
        ) : (
          <>
            {/* Podium */}
            {top3.length > 0 && (
              <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {top3.map((g, i) => (
                  <motion.div 
                    key={g.id} 
                    className={cn("bg-white rounded-3xl border-2 p-6 text-center relative overflow-hidden shadow-smooth-sm", PODIUM_COLORS[i], g.user_id === profile?.user_id && "ring-2 ring-primary")}
                    variants={podiumBounce}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  >
                    {i === 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow to-transparent" />}
                    
                    <motion.p className="text-4xl mb-2" animate={{ rotate: [0, -8, 8, -4, 4, 0] }} transition={{ duration: 0.6, delay: i * 0.15 + 0.4 }}>{PODIUM_EMOJIS[i]}</motion.p>
                    
                    <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 mx-auto flex items-center justify-center text-3xl mb-2">
                      🏅
                    </div>
                    <p className="font-bold font-heading text-secondary text-lg">{g.nombre}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                      <span className="text-base">{FLAG_MAP[g.pais] || '🌎'}</span> {g.canal?.replace(/_/g, ' ')}
                    </p>
                    <motion.p 
                      className="text-2xl font-bold font-scoreboard text-primary mt-3"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: i * 0.1 + 0.5 }}
                    >{formatMetric(g.sp_totales || 0)} {metricLabel}</motion.p>
                    {!isVC && <span className="inline-block mt-2 text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span>}
                    {isVC && g.gerente_nombre && <p className="text-[10px] text-muted-foreground mt-2">Líder: {g.gerente_nombre}</p>}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Table */}
            {rest.length > 0 && (
              <motion.div className="bg-white border border-border rounded-2xl overflow-hidden shadow-smooth-sm" variants={fadeUpItem}>
                <div className="bg-primary px-4 py-3">
                  <p className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 font-heading">
                    📋 Tabla Completa
                  </p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-primary text-white text-[11px] uppercase tracking-wider font-heading">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Gerente</th>
                      <th className="text-left px-4 py-3">Canal</th>
                      <th className="text-right px-4 py-3">SP</th>
                      <th className="text-left px-4 py-3">Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((g, i) => (
                      <motion.tr 
                        key={g.id}
                        className={cn("border-b border-border hover:bg-primary/5 transition-colors row-alt", g.user_id === profile?.user_id && "bg-primary/10 font-semibold")}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: i * 0.04 + 0.3 }}
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground font-scoreboard">{i + 4}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{FLAG_MAP[g.pais] || '🌎'}</span>
                            <span className="text-sm text-foreground">{g.nombre}</span>
                            {g.user_id === profile?.user_id && <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">Tú</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{g.canal?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-sm font-bold font-scoreboard text-primary text-right">{(g.sp_totales || 0).toLocaleString()}</td>
                        <td className="px-4 py-3"><span className="text-[10px] font-semibold bg-primary text-white px-2 py-0.5 rounded-full">{g.nivel}</span></td>
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
