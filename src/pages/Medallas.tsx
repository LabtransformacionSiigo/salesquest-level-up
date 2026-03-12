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

const MEDALLAS_SISTEMA = [
  { id: 'primera_conquista', nombre: 'Primera Conquista', sp: 100, condicion: 'Generar $50M COP en un mes', emoji: '🎯', categoria: 'Desempeño' },
  { id: 'sello_cumplimiento', nombre: 'Sello de Cumplimiento', sp: 300, condicion: 'Cumplir 100% de la meta mensual ($400M COP)', emoji: '✅', categoria: 'Desempeño' },
  { id: 'sobre_la_cima', nombre: 'Sobre la Cima', sp: 500, condicion: 'Superar 110% de la meta ($440M COP)', emoji: '⛰️', categoria: 'Desempeño' },
  { id: 'golpe_autoridad', nombre: 'Golpe de Autoridad', sp: 800, condicion: 'Superar 125% de la meta ($500M COP)', emoji: '💥', categoria: 'Desempeño' },
  { id: 'record_personal', nombre: 'Récord Personal', sp: 400, condicion: 'Superar tu propio récord mensual histórico', emoji: '📈', categoria: 'Desempeño' },
  { id: 'el_millon', nombre: 'El Millón', sp: 1500, condicion: 'Acumular $1.000M COP en el año', emoji: '💰', categoria: 'Desempeño' },
  { id: 'pulso_constante', nombre: 'Pulso Constante', sp: 600, condicion: '3 meses consecutivos cumpliendo meta', emoji: '💓', categoria: 'Consistencia' },
  { id: 'imparable', nombre: 'Imparable', sp: 1000, condicion: '4 meses consecutivos en verde', emoji: '🚀', categoria: 'Consistencia' },
  { id: 'sin_piedad', nombre: 'Sin Piedad', sp: 2000, condicion: 'Ningún mes del año bajo el 85% de meta', emoji: '🔱', categoria: 'Consistencia' },
  { id: 'dominante_mes', nombre: 'El Dominante del Mes', sp: 500, condicion: 'Ser el #1 en ingresos del mes', emoji: '👑', categoria: 'Especiales' },
  { id: 'arranque_elite', nombre: 'Arranque de Élite', sp: 250, condicion: 'Superar $200M COP en la primera quincena', emoji: '⚡', categoria: 'Especiales' },
  { id: 'cierre_leyenda', nombre: 'Cierre de Leyenda', sp: 350, condicion: 'Generar más de $100M COP en una semana', emoji: '🌟', categoria: 'Especiales' },
];

const Medallas = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [misMediallas, setMisMedallas] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('medallas')
      .select('*')
      .eq('gerente_id', profile.id)
      .then(({ data }) => {
        setMisMedallas(data || []);
        setDataLoading(false);
      });
  }, [profile?.id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const medallaIds = new Set(misMediallas.map(m => m.medalla));
  const obtenidas = MEDALLAS_SISTEMA.filter(m => medallaIds.has(m.id));
  const categorias = ['Desempeño', 'Consistencia', 'Especiales'];

  return (
    <Layout title="Vitrina de Logros">
      <div className="space-y-6">
        {/* Counter */}
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Mis Medallas</h2>
            <p className="text-sm text-muted-foreground">Completa retos para desbloquear logros</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">{obtenidas.length}<span className="text-lg text-muted-foreground">/{MEDALLAS_SISTEMA.length}</span></p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Obtenidas</p>
          </div>
        </div>

        {dataLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : (
          categorias.map(cat => (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <MI icon={cat === 'Desempeño' ? 'trending_up' : cat === 'Consistencia' ? 'sync' : 'star'} className="text-primary text-lg" />
                {cat}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {MEDALLAS_SISTEMA.filter(m => m.categoria === cat).map(medalla => {
                  const desbloqueada = medallaIds.has(medalla.id);
                  const dataMedalla = misMediallas.find(m => m.medalla === medalla.id);

                  return (
                    <div key={medalla.id} className={cn(
                      "bg-card border rounded-2xl p-5 text-center transition-all group relative",
                      desbloqueada
                        ? "border-accent/30 shadow-smooth-sm"
                        : "border-border opacity-60 grayscale hover:opacity-80 hover:grayscale-0"
                    )}>
                      <p className="text-4xl mb-3">{desbloqueada ? medalla.emoji : '🔒'}</p>
                      <p className="text-sm font-bold text-foreground mb-1">{medalla.nombre}</p>
                      <span className="inline-block text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full mb-2">
                        +{medalla.sp} SP
                      </span>

                      {desbloqueada && dataMedalla && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(dataMedalla.fecha_desbloqueo).toLocaleDateString('es')}
                        </p>
                      )}

                      {/* Hover tooltip for locked */}
                      {!desbloqueada && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 rounded-2xl p-4">
                          <p className="text-xs text-muted-foreground text-center">{medalla.condicion}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
};

export default Medallas;
