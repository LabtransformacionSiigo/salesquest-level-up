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

const Medallas = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [misMedallas, setMisMedallas] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id || !profile?.canal) return;

    Promise.all([
      supabase.from('medallas').select('*').eq('gerente_id', profile.id),
      supabase.from('catalogo_medallas').select('*').eq('canal', profile.canal).eq('activo', true).order('condicion_tipo').order('nombre'),
    ]).then(([mRes, cRes]) => {
      setMisMedallas(mRes.data || []);
      setCatalogo(cRes.data || []);
      setDataLoading(false);
    });
  }, [profile?.id, profile?.canal]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const medallaNames = new Set(misMedallas.map(m => m.medalla));
  const obtenidas = catalogo.filter(m => medallaNames.has(m.nombre));

  // Group by condicion_tipo
  const grupos: Record<string, any[]> = {};
  catalogo.forEach(m => {
    const key = m.condicion_tipo;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(m);
  });

  const grupoLabels: Record<string, { label: string; icon: string }> = {
    primera_venta: { label: 'Primera Venta', icon: 'celebration' },
    cantidad: { label: 'Cantidad Acumulada', icon: 'trending_up' },
    monto: { label: 'Monto Acumulado', icon: 'payments' },
    cumplimiento: { label: 'Cumplimiento', icon: 'verified' },
  };

  return (
    <Layout title="Vitrina de Logros">
      <div className="space-y-6">
        {/* Counter */}
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Mis Medallas</h2>
            <p className="text-sm text-muted-foreground">
              Canal: <span className="text-primary font-semibold">{profile?.canal?.replace(/_/g, ' ')}</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">{obtenidas.length}<span className="text-lg text-muted-foreground">/{catalogo.length}</span></p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Obtenidas</p>
          </div>
        </div>

        {dataLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : (
          Object.entries(grupos).map(([tipo, medallas]) => {
            const info = grupoLabels[tipo] || { label: tipo, icon: 'star' };
            return (
              <div key={tipo}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MI icon={info.icon} className="text-primary text-lg" />
                  {info.label}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {medallas.map(medalla => {
                    const desbloqueada = medallaNames.has(medalla.nombre);
                    const dataMedalla = misMedallas.find(m => m.medalla === medalla.nombre);

                    return (
                      <div key={medalla.id} className={cn(
                        "bg-card border rounded-2xl p-5 text-center transition-all group relative",
                        desbloqueada
                          ? "border-accent/30 shadow-smooth-sm"
                          : "border-border opacity-60 grayscale hover:opacity-80 hover:grayscale-0"
                      )}>
                        <p className="text-4xl mb-3">{desbloqueada ? medalla.emoji : '🔒'}</p>
                        <p className="text-sm font-bold text-foreground mb-1">{medalla.nombre}</p>
                        {medalla.producto && (
                          <span className="inline-block text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full mb-1">
                            {medalla.producto}
                          </span>
                        )}
                        <span className="inline-block text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full mb-2">
                          +{medalla.sp} SP
                        </span>

                        {desbloqueada && dataMedalla && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(dataMedalla.fecha_desbloqueo).toLocaleDateString('es')}
                          </p>
                        )}

                        {!desbloqueada && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 rounded-2xl p-4">
                            <p className="text-xs text-muted-foreground text-center">{medalla.descripcion}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {!dataLoading && catalogo.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <MI icon="emoji_events" className="text-5xl mb-3" />
            <p>No hay medallas configuradas para tu canal</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Medallas;
