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
  VN_EMPRESARIOS: 'Grupo A — Empresarios',
  VN_ALIADOS: 'Grupo B — Aliados',
  VC: 'Grupo C — Venta Cruzada',
};

const PAISES = [
  { value: 'TODOS', label: '🌎 Todos' },
  { value: 'COL', label: '🇨🇴 COL' },
  { value: 'MEX', label: '🇲🇽 MEX' },
  { value: 'ECU', label: '🇪🇨 ECU' },
];

const PODIUM_EMOJIS = ['🥇', '🥈', '🥉'];
const PODIUM_COLORS = [
  'border-accent/50 shadow-glow-gold',
  'border-muted-foreground/30',
  'border-orange/40',
];

const Rankings = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [ranking, setRanking] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [pais, setPais] = useState('TODOS');

  const fetchRanking = async () => {
    if (!profile?.canal) return;
    let query = supabase.from('ranking_general').select('*').eq('canal', profile.canal);
    if (pais !== 'TODOS') query = query.eq('pais', pais);
    const { data } = await query;
    setRanking(data || []);
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
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <Layout title={`🏆 ${CANALES_LABEL[profile?.canal || ''] || profile?.canal}`}>
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        {/* Country filter */}
        <motion.div className="flex flex-wrap items-center gap-2" variants={fadeUpItem}>
          <span className="text-xs font-semibold text-muted-foreground mr-2">🌎 Selección:</span>
          {PAISES.map(p => (
            <motion.button key={p.value} onClick={() => setPais(p.value)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                pais === p.value ? "bg-primary text-primary-foreground border-primary shadow-glow-green" : "glass-card border-border/30 text-muted-foreground hover:text-foreground")}>
              {p.label}
            </motion.button>
          ))}
          <span className="ml-auto text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> EN VIVO
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
                    className={cn("glass-card rounded-3xl border-2 p-6 text-center relative overflow-hidden", PODIUM_COLORS[i], g.user_id === profile?.user_id && "ring-2 ring-primary")}
                    variants={podiumBounce}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  >
                    {/* Neon glow top border */}
                    {i === 0 && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent" />}
                    
                    <motion.p className="text-4xl mb-2" animate={{ rotate: [0, -8, 8, -4, 4, 0] }} transition={{ duration: 0.6, delay: i * 0.15 + 0.4 }}>{PODIUM_EMOJIS[i]}</motion.p>
                    
                    <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary/30 mx-auto flex items-center justify-center text-3xl mb-2 shadow-glow-green">
                      {g.avatar_url || '⚽'}
                    </div>
                    <p className="font-bold text-foreground text-lg">{g.nombre}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                      <span className="text-base">{FLAG_MAP[g.pais] || '🌎'}</span> {g.canal?.replace(/_/g, ' ')}
                    </p>
                    <motion.p 
                      className="text-2xl font-bold font-scoreboard text-neon-green mt-3"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: i * 0.1 + 0.5 }}
                    >{(g.sp_totales || 0).toLocaleString()} SP</motion.p>
                    <span className="inline-block mt-2 text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">{g.nivel}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Group stage table */}
            {rest.length > 0 && (
              <motion.div className="scoreboard-card rounded-2xl overflow-hidden" variants={fadeUpItem}>
                <div className="px-4 py-3 border-b border-border/30">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    📋 Fase de Grupos · Tabla Completa
                  </p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30 text-[11px] text-muted-foreground uppercase tracking-wider">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">DT</th>
                      <th className="text-left px-4 py-3">Selección</th>
                      <th className="text-right px-4 py-3">SP</th>
                      <th className="text-left px-4 py-3">Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((g, i) => (
                      <motion.tr 
                        key={g.id}
                        className={cn("border-b border-border/20 hover:bg-primary/5 transition-colors", g.user_id === profile?.user_id && "bg-primary/10 font-semibold")}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: i * 0.04 + 0.3 }}
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground font-scoreboard">{i + 4}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{FLAG_MAP[g.pais] || '🌎'}</span>
                            <span className="text-lg">{g.avatar_url || '⚽'}</span>
                            <span className="text-sm text-foreground">{g.nombre}</span>
                            {g.user_id === profile?.user_id && <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">Tú</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{g.canal?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-sm font-bold font-scoreboard text-neon-green text-right">{(g.sp_totales || 0).toLocaleString()}</td>
                        <td className="px-4 py-3"><span className="text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">{g.nivel}</span></td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
            {sorted.length === 0 && (
              <motion.div className="text-center py-16" variants={fadeUpItem}>
                <div className="text-7xl mb-4 opacity-30">🏟️</div>
                <p className="text-lg font-bold text-muted-foreground">El estadio está vacío</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Los datos del ranking aparecerán aquí</p>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </Layout>
  );
};

export default Rankings;
