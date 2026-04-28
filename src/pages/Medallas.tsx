import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, trophyWobble, popIn } from '@/lib/animations';
import { getVcAdvisorSnapshot, isVcAdvisorProfile } from '@/lib/vc-advisor-data';
import { filterCatalogByScope } from '@/lib/catalog-scope';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import medallaImg from '@/assets/medalla.png';
import candadoImg from '@/assets/candado.png';

const TROPHY_LABELS: Record<string, { label: string; emoji: string }> = {
  primera_venta: { label: 'Primera Venta', emoji: '🎯' },
  cantidad: { label: 'Por Cantidad', emoji: '📦' },
  monto: { label: 'Por Monto', emoji: '💰' },
  cumplimiento: { label: 'Cumplimiento', emoji: '🏆' },
};

const Medallas = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [misMedallas, setMisMedallas] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const isVcAdvisor = isVcAdvisorProfile(profile);

  useEffect(() => {
    if (!profile?.id || !profile?.canal) return;
    let cancelled = false;

    const fetchData = async () => {
      setDataLoading(true);
      if (isVcAdvisor) {
        const snapshot = await getVcAdvisorSnapshot(profile);
        if (cancelled) return;
        setMisMedallas(snapshot?.medals || []);
        setCatalogo(snapshot?.catalog || []);
        setDataLoading(false);
        return;
      }
      const [mRes, cRes] = await Promise.all([
        supabase.from('medallas').select('*').eq('gerente_id', profile.id),
        supabase.from('catalogo_medallas').select('*').eq('activo', true).or(`canal.eq.${profile.canal ?? 'VC'},canal.is.null`).order('condicion_tipo').order('nombre'),
      ]);
      if (cancelled) return;
      setMisMedallas(mRes.data || []);
      setCatalogo(filterCatalogByScope(cRes.data || [], profile));
      setDataLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.canal, profile?.nombre, profile?.gerente_id, profile?.role, isVcAdvisor]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const medallaNames = new Set(misMedallas.map((m) => m.medalla));
  const obtenidas = catalogo.filter((m) => medallaNames.has(m.nombre));
  const grupos: Record<string, any[]> = {};
  catalogo.forEach((m) => {
    const key = m.condicion_tipo;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(m);
  });

  return (
    <Layout title="🏅 Medallas">
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        <motion.div
          className="bg-card border border-border border-t-[3px] border-t-primary rounded-2xl p-6 flex items-center justify-between shadow-smooth-sm"
          variants={fadeUpItem}
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
        >
          <div>
            <h2 className="text-lg font-bold font-heading text-secondary flex items-center gap-2">
              <span>🏅</span> Mis Medallas
            </h2>
            <p className="text-sm text-muted-foreground">
              Canal: <span className="text-primary font-semibold">{profile?.canal?.replace(/_/g, ' ')}</span>
            </p>
          </div>
          <motion.div
            className="text-center"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
          >
            <div className="flex items-baseline gap-0.5">
              <AnimatedCounter value={obtenidas.length} className="text-3xl font-bold font-scoreboard text-primary" />
              <span className="text-lg text-muted-foreground font-scoreboard">/{catalogo.length}</span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Obtenidas</p>
          </motion.div>
        </motion.div>

        {dataLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : (
          Object.entries(grupos).map(([tipo, medallas]) => {
            const info = TROPHY_LABELS[tipo] || { label: tipo, emoji: '🏅' };
            return (
              <motion.div key={tipo} variants={fadeUpItem}>
                <h3 className="text-sm font-semibold font-heading text-secondary mb-3 flex items-center gap-2">
                  <span className="text-lg">{info.emoji}</span>
                  {info.label}
                </h3>
                <motion.div
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  {medallas.map((medalla, idx) => {
                    const desbloqueada = medallaNames.has(medalla.nombre);
                    const dataMedalla = misMedallas.find((m) => m.medalla === medalla.nombre);

                    return (
                      <motion.div
                        key={medalla.id}
                        className={cn(
                          'bg-white border rounded-2xl p-5 text-center transition-all group relative overflow-hidden shadow-smooth-sm',
                          desbloqueada
                            ? 'border-yellow bg-siigo-yellow/5 trophy-card'
                            : 'border-border opacity-60 grayscale hover:opacity-80 hover:grayscale-0'
                        )}
                        variants={desbloqueada ? trophyWobble : popIn}
                        whileHover={{ scale: 1.04, y: -6, transition: { duration: 0.2 } }}
                        whileTap={{ scale: 0.97 }}
                      >
                        {desbloqueada && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-b from-yellow/10 to-transparent pointer-events-none" />
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow/20 to-transparent pointer-events-none"
                              initial={{ x: '-100%' }}
                              animate={{ x: '200%' }}
                              transition={{ duration: 2, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
                            />
                          </>
                        )}

                        <motion.div
                          className="mb-3 relative z-10 flex justify-center"
                          animate={desbloqueada ? { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 0.8, delay: idx * 0.1 + 0.3 }}
                        >
                          <img src={desbloqueada ? medallaImg : candadoImg} alt={desbloqueada ? 'Medalla' : 'Bloqueada'} className="w-16 h-16 object-contain" />
                        </motion.div>
                        <p className="text-sm font-bold text-foreground mb-1 relative z-10">{medalla.nombre}</p>
                        {(medalla.fecha_inicio || medalla.fecha_fin) && (
                          <p className="text-[9px] text-muted-foreground mb-1 relative z-10">
                            Vigente hasta: {medalla.fecha_fin || 'Sin límite'}
                          </p>
                        )}
                        {medalla.producto && (
                          <span className="inline-block text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full mb-1 relative z-10">
                            {medalla.producto}
                          </span>
                        )}
                        <span className="inline-block text-[10px] font-semibold font-scoreboard bg-accent text-white px-2 py-0.5 rounded-full mb-2 relative z-10" title="Se suman a puntos canjeables">
                          🎁 +{medalla.sp} Canjeables
                        </span>

                        {desbloqueada && dataMedalla?.fecha_desbloqueo && (
                          <p className="text-[10px] text-muted-foreground relative z-10">
                            {new Date(dataMedalla.fecha_desbloqueo).toLocaleDateString('es')}
                          </p>
                        )}

                        {!desbloqueada && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-2xl p-4">
                            <p className="text-xs text-muted-foreground text-center">{medalla.descripcion}</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              </motion.div>
            );
          })
        )}

        {!dataLoading && catalogo.length === 0 && (
          <motion.div className="text-center py-16 text-muted-foreground" variants={fadeUpItem}>
            <motion.span
              className="text-5xl mb-3 block"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >🏅</motion.span>
            <p>No hay medallas configuradas para tu canal</p>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default Medallas;
