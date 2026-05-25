import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, popIn } from '@/lib/animations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, ShoppingBag, History, Package } from 'lucide-react';

interface Premio {
  id: string;
  nombre: string;
  descripcion: string | null;
  costo_puntos: number;
  imagen_url: string | null;
  stock: number;
  activo: boolean;
  pais: string | null;
  operacion: string | null;
}


interface Canje {
  id: string;
  puntos_gastados: number;
  fecha_canje: string;
  estado: string;
  premios?: { nombre: string; imagen_url: string | null } | null;
}

const Premios = () => {
  const { profile, isAuthenticated, loading, refreshProfile } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [premios, setPremios] = useState<Premio[]>([]);
  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [canjeando, setCanjeando] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    const fetch = async () => {
      const [premiosRes, canjesRes] = await Promise.all([
        supabase.from('premios').select('*').eq('activo', true).gt('stock', 0).order('costo_puntos', { ascending: true }),
        supabase.from('canjes').select('id, puntos_gastados, fecha_canje, estado, premios(nombre, imagen_url)').eq('gerente_id', profile.id).order('fecha_canje', { ascending: false }),
      ]);
      const norm = (v?: string | null) => String(v || '').trim().toUpperCase();
      const userPais = norm(profile?.pais);
      const userCanal = norm(profile?.canal);
      const scoped = ((premiosRes.data || []) as Premio[]).filter((p) => {
        const paisOk = !p.pais || norm(p.pais) === userPais;
        const canalOk = !p.operacion || norm(p.operacion) === userCanal;
        return paisOk && canalOk;
      });
      setPremios(scoped);
      setCanjes((canjesRes.data || []) as any[]);
      setDataLoading(false);

    };
    fetch();
  }, [profile?.id]);

  const handleCanjear = async (premio: Premio) => {
    if (!profile?.id) return;
    setCanjeando(premio.id);
    const { data, error } = await supabase.rpc('canjear_premio', { p_gerente_id: profile.id, p_premio_id: premio.id });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (data && typeof data === 'object' && 'success' in (data as any)) {
      const result = data as any;
      if (!result.success) {
        toast({ title: 'No se pudo canjear', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '🎁 ¡Premio canjeado!', description: `Has canjeado "${premio.nombre}" por ${premio.costo_puntos} puntos` });
        setPremios(prev => prev.map(p => p.id === premio.id ? { ...p, stock: p.stock - 1 } : p).filter(p => p.stock > 0));
        const canjesRes = await supabase.from('canjes').select('id, puntos_gastados, fecha_canje, estado, premios(nombre, imagen_url)').eq('gerente_id', profile.id).order('fecha_canje', { ascending: false });
        setCanjes((canjesRes.data || []) as any[]);
        refreshProfile?.();
      }
    }
    setCanjeando(null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

   const saldo = profile?.sp_canje || 0;
  const siigoPoints = profile?.sp_totales || 0;

  return (
    <Layout title="🎁 Tienda de Beneficios ">
      <motion.div className="space-y-6 max-w-[1200px]" variants={staggerContainer} initial="hidden" animate="show">

        {/* Balance Card */}
        <motion.div
          className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground shadow-smooth"
          variants={fadeUpItem}
        >
          <div className="flex items-center justify-between gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 flex-1">
              <div>
                <p className="text-sm opacity-80">Tus Siigo Points</p>
                <p className="text-4xl font-black font-scoreboard">{siigoPoints.toLocaleString()}</p>
                <p className="text-xs opacity-60 mt-1">Solo cumplimiento de meta</p>
              </div>
              <div>
                <p className="text-sm opacity-80">Tus canjeables</p>
                <p className="text-4xl font-black font-scoreboard">{saldo.toLocaleString()}</p>
                <p className="text-xs opacity-60 mt-1">Medallas, retos y reconocimientos</p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Gift className="w-16 h-16 opacity-30" />
            </motion.div>
          </div>
        </motion.div>

        <Tabs defaultValue="catalogo">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="catalogo" className="gap-2"><ShoppingBag className="w-4 h-4" /> Catálogo</TabsTrigger>
            <TabsTrigger value="historial" className="gap-2"><History className="w-4 h-4" /> Mis Canjes</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo">
            {dataLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
              </div>
            ) : premios.length === 0 ? (
              <motion.div className="text-center py-16 bg-card rounded-2xl border border-border mt-4" variants={popIn}>
                <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg font-bold text-foreground">Próximamente</p>
                <p className="text-sm text-muted-foreground">Aún no hay premios disponibles. ¡Sigue acumulando puntos!</p>
              </motion.div>
            ) : (
              <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-4" variants={staggerContainer} initial="hidden" animate="show">
                {premios.map((premio) => {
                  const canAfford = saldo >= premio.costo_puntos;
                  return (
                    <motion.div
                      key={premio.id}
                      className="bg-card border border-border rounded-2xl overflow-hidden shadow-smooth-sm hover:shadow-smooth transition-all"
                      variants={fadeUpItem}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    >
                      {premio.imagen_url ? (
                        <div className="h-40 bg-muted overflow-hidden">
                          <img src={premio.imagen_url} alt={premio.nombre} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-40 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                          <Gift className="w-16 h-16 text-primary/30" />
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="font-bold text-foreground text-base">{premio.nombre}</h3>
                        {premio.descripcion && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{premio.descripcion}</p>}
                        <div className="flex items-center justify-between mt-4">
                          <div>
                            <p className="text-lg font-black font-scoreboard text-primary">{premio.costo_puntos.toLocaleString()}</p>
                         <p className="text-[10px] text-muted-foreground">canjeables</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground mb-1">Stock: {premio.stock}</p>
                            <Button
                              size="sm"
                              disabled={!canAfford || canjeando === premio.id}
                              onClick={() => handleCanjear(premio)}
                              className={cn(!canAfford && 'opacity-50')}
                            >
                              {canjeando === premio.id ? '...' : canAfford ? 'Canjear' : 'Sin canjeables'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="historial">
            <motion.div className="bg-card border border-border rounded-2xl mt-4 overflow-hidden" variants={fadeUpItem}>
              {canjes.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aún no has canjeado ningún premio</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase">Premio</th>
                       <th className="text-center px-5 py-3 text-xs font-bold text-muted-foreground uppercase">Canjeables</th>
                      <th className="text-center px-5 py-3 text-xs font-bold text-muted-foreground uppercase">Estado</th>
                      <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground uppercase">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {canjes.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="px-5 py-3 font-medium">{(c as any).premios?.nombre || '—'}</td>
                        <td className="px-5 py-3 text-center font-scoreboard text-primary">{c.puntos_gastados}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={cn(
                            'text-xs font-bold px-2 py-0.5 rounded-full',
                            c.estado === 'entregado' ? 'bg-accent/20 text-accent' : c.estado === 'cancelado' ? 'bg-destructive/20 text-destructive' : 'bg-orange/20 text-orange'
                          )}>
                            {c.estado === 'entregado' ? '✅ Entregado' : c.estado === 'cancelado' ? '❌ Cancelado' : '⏳ Pendiente'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-muted-foreground text-xs">{new Date(c.fecha_canje).toLocaleDateString('es')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </Layout>
  );
};

export default Premios;
