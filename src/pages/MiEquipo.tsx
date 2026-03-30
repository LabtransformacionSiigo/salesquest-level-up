import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem } from '@/lib/animations';
import { useGamificationMetrics } from '@/hooks/useGamificationMetrics';
import colombiaFlag from '@/assets/flags/colombia.svg';
import mexicoFlag from '@/assets/flags/mexico.svg';
import ecuadorFlag from '@/assets/flags/ecuador.svg';
import usaFlag from '@/assets/flags/united-states.svg';

const FLAG_MAP: Record<string, string> = {
  COL: colombiaFlag, CO: colombiaFlag,
  MEX: mexicoFlag, MX: mexicoFlag,
  ECU: ecuadorFlag, EC: ecuadorFlag,
  USA: usaFlag, US: usaFlag,
};

const normalizeCountryCode = (pais?: string | null) => pais?.trim().toUpperCase() || '';

const MiEquipo = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { team, loading: dataLoading } = useGamificationMetrics(profile);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const activos = team.filter(a => a.activo);

  return (
    <Layout title="👥 Mi Equipo">
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
        {/* Header */}
        <motion.div className="bg-card border border-border border-t-[3px] border-t-primary rounded-2xl p-6 flex items-center justify-between shadow-smooth-sm" variants={fadeUpItem}>
          <div>
            <h2 className="text-lg font-bold font-heading text-secondary flex items-center gap-2"><span>👥</span> Mi Equipo</h2>
            <p className="text-sm text-muted-foreground">{profile?.canal === 'VC' ? 'Comerciales a tu cargo' : 'Asesores a tu cargo'}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold font-scoreboard text-primary">{activos.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Activos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold font-scoreboard text-muted-foreground">{team.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
          </div>
        </motion.div>

        {dataLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}</div>
        ) : team.length > 0 ? (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" variants={staggerContainer} initial="hidden" animate="show">
            {team.map(a => {
              const countryFlag = FLAG_MAP[normalizeCountryCode(a.pais)];

              return (
                <motion.div key={a.id} className={cn("bg-white border border-border rounded-2xl p-6 transition-all hover:shadow-smooth-md shadow-smooth-sm", !a.activo && "opacity-50")} variants={fadeUpItem}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-xl">
                      👤
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{a.nombre}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full">{a.canal?.replace(/_/g, ' ')}</span>
                    {countryFlag ? (
                      <img src={countryFlag} alt={`Bandera de ${a.pais}`} className="h-4 w-4 rounded-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-sm">🌎</span>
                    )}
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", a.activo ? "bg-accent text-white" : "bg-destructive/10 text-destructive")}>
                      {a.activo ? '✅ Activo' : '⏸️ Inactivo'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div className="text-center py-16" variants={fadeUpItem}>
            <div className="text-7xl mb-4 opacity-30">👥</div>
            <p className="text-lg font-bold text-muted-foreground">No tienes asesores asignados</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Los asesores aparecerán aquí cuando se configuren</p>
          </motion.div>
        )}
      </motion.div>
    </Layout>
  );
};

export default MiEquipo;
