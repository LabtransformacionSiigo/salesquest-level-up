import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const MiEquipo = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [asesores, setAsesores] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('asesores')
      .select('*')
      .eq('gerente_id', profile.id)
      .order('nombre')
      .then(({ data }) => {
        setAsesores(data || []);
        setDataLoading(false);
      });
  }, [profile?.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const activos = asesores.filter(a => a.activo);
  const inactivos = asesores.filter(a => !a.activo);
  const displayed = showAll ? asesores : activos;

  const formatFechaIngreso = (createdAt: string | null) => {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    return d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  };

  return (
    <Layout title="Mi Equipo">
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Mis Asesores</h2>
            <p className="text-sm text-muted-foreground">Equipo comercial a tu cargo</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-secondary">{activos.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Activos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-muted-foreground">{asesores.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAll(false)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              !showAll ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Activos ({activos.length})
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              showAll ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Todos ({asesores.length})
          </button>
        </div>

        {dataLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : displayed.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map(a => (
              <div key={a.id} className={cn("bg-card border rounded-2xl p-6", a.activo ? "border-border" : "border-border opacity-60")}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl">
                    {a.avatar_url || '👤'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{a.nombre}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </div>
                </div>

                {/* Fecha ingreso */}
                 {a.created_at && (
                   <p className="text-[10px] text-muted-foreground mb-3">
                     📅 En el equipo desde: {formatFechaIngreso(a.created_at)}
                  </p>
                )}

                {/* CRM Placeholder */}
                <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 mb-3">
                  <p className="text-[10px] text-accent font-medium flex items-center gap-1">
                    <MI icon="info" className="text-xs" />
                    Datos disponibles al conectar con fuente CRM
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{a.canal?.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{a.pais}</span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", a.activo ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive")}>
                    {a.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <MI icon="groups" className="text-5xl mb-3" />
            <p>No tienes asesores asignados</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MiEquipo;
