import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem } from '@/lib/animations';

const FLAG_MAP: Record<string, string> = { COL: '🇨🇴', MEX: '🇲🇽', ECU: '🇪🇨', USA: '🇺🇸' };

// 4-3-3 formation positions (top to bottom)
const FORMATION_433 = [
  // Front 3 (attackers)
  [{ top: '8%', left: '20%' }, { top: '5%', left: '50%' }, { top: '8%', left: '80%' }],
  // Mid 3
  [{ top: '35%', left: '25%' }, { top: '30%', left: '50%' }, { top: '35%', left: '75%' }],
  // Back 4
  [{ top: '60%', left: '15%' }, { top: '58%', left: '38%' }, { top: '58%', left: '62%' }, { top: '60%', left: '85%' }],
  // GK
  [{ top: '85%', left: '50%' }],
];

const getPositions = (count: number) => {
  const all = FORMATION_433.flat();
  return all.slice(0, Math.min(count, all.length));
};

const MiEquipo = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [asesores, setAsesores] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [view, setView] = useState<'pitch' | 'grid'>('pitch');

  useEffect(() => {
    if (!profile?.id) return;
    supabase.from('asesores').select('*').eq('gerente_id', profile.id).order('nombre')
      .then(({ data }) => { setAsesores(data || []); setDataLoading(false); });
  }, [profile?.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const activos = asesores.filter(a => a.activo);
  const positions = getPositions(activos.length);

  return (
    <Layout title="👕 Mi Plantilla">
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        {/* Header */}
        <motion.div className="scoreboard-card rounded-2xl p-6 flex items-center justify-between" variants={fadeUpItem}>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><span>👕</span> Mi Plantilla</h2>
            <p className="text-sm text-muted-foreground">Tu equipo en la cancha</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold font-scoreboard text-neon-green">{activos.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Titulares</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold font-scoreboard text-muted-foreground">{asesores.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Convocados</p>
            </div>
          </div>
        </motion.div>

        {/* View toggle */}
        <motion.div className="flex items-center gap-2" variants={fadeUpItem}>
          <button onClick={() => setView('pitch')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all", view === 'pitch' ? "bg-primary text-primary-foreground shadow-glow-green" : "bg-muted text-muted-foreground")}>
            🏟️ Cancha
          </button>
          <button onClick={() => setView('grid')} className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all", view === 'grid' ? "bg-primary text-primary-foreground shadow-glow-green" : "bg-muted text-muted-foreground")}>
            📋 Lista
          </button>
        </motion.div>

        {dataLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}</div>
        ) : activos.length > 0 ? (
          <>
            {/* ═══ FOOTBALL PITCH VIEW ═══ */}
            {view === 'pitch' && (
              <motion.div className="football-pitch rounded-3xl p-6 relative" style={{ minHeight: '500px' }} variants={fadeUpItem}>
                {/* Pitch lines */}
                <div className="absolute top-[15%] left-[30%] right-[30%] bottom-[15%] border border-white/10 rounded-lg" />
                {/* Penalty areas */}
                <div className="absolute top-0 left-[25%] right-[25%] h-[18%] border-b border-l border-r border-white/10 rounded-b-lg" />
                <div className="absolute bottom-0 left-[25%] right-[25%] h-[18%] border-t border-l border-r border-white/10 rounded-t-lg" />

                {activos.map((a, i) => {
                  const pos = positions[i];
                  if (!pos) return null;
                  return (
                    <motion.div
                      key={a.id}
                      className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2"
                      style={{ top: pos.top, left: pos.left }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: i * 0.08 }}
                      whileHover={{ scale: 1.15, y: -4 }}
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/30 border-2 border-primary/50 flex items-center justify-center text-xl shadow-glow-green backdrop-blur-sm">
                        {a.avatar_url || '⚽'}
                      </div>
                      <div className="glass-card rounded-lg px-2 py-1 text-center max-w-[100px]">
                        <p className="text-[10px] font-bold text-foreground truncate">{a.nombre?.split(' ')[0]}</p>
                        <p className="text-[8px] text-muted-foreground">{FLAG_MAP[a.pais] || '🌎'} #{i + 1}</p>
                      </div>
                    </motion.div>
                  );
                })}

                {/* DT (Manager) at bottom */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center text-lg">
                    {profile?.avatar_url || '👔'}
                  </div>
                  <span className="text-[9px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">DT</span>
                </div>
              </motion.div>
            )}

            {/* ═══ GRID VIEW ═══ */}
            {view === 'grid' && (
              <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
                {asesores.map(a => (
                  <motion.div key={a.id} className={cn("glass-card rounded-2xl p-6 transition-all hover:shadow-glow-green", !a.activo && "opacity-50")} variants={fadeUpItem}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-xl">
                        {a.avatar_url || '⚽'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{a.nombre}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{a.canal?.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{FLAG_MAP[a.pais] || '🌎'} {a.pais}</span>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", a.activo ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                        {a.activo ? '⚽ Titular' : '🔄 Banca'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        ) : (
          <motion.div className="text-center py-16" variants={fadeUpItem}>
            <div className="text-7xl mb-4 opacity-30">⚽</div>
            <p className="text-lg font-bold text-muted-foreground">No tienes jugadores en tu plantilla</p>
            <p className="text-sm text-muted-foreground/60 mt-1">El estadio está vacío... ¡Hora de reclutar!</p>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default MiEquipo;
