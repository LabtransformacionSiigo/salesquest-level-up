import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const CANALES = ['VN_EMPRESARIOS', 'VN_ALIADOS', 'VC'];

const AdminRachas = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ canal: 'VC', nombre: '', descripcion: '', condicion_tipo: 'ventas_semanales', umbral_verde: 0, activo: true });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchConfigs();
  }, [isAuthenticated]);

  const fetchConfigs = async () => {
    const { data } = await supabase.from('config_rachas').select('*').order('canal');
    setConfigs(data || []);
    setDataLoading(false);
  };

  const handleSave = async () => {
    const payload = { ...form, umbral_verde: Number(form.umbral_verde) };
    if (editing) {
      const { error } = await supabase.from('config_rachas').update(payload).eq('id', editing);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Configuración actualizada ✅' });
    } else {
      const { error } = await supabase.from('config_rachas').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Configuración creada ✅' });
    }
    setEditing(null);
    setShowAdd(false);
    fetchConfigs();
  };

  const startEdit = (c: any) => {
    setEditing(c.id);
    setForm({ canal: c.canal, nombre: c.nombre, descripcion: c.descripcion || '', condicion_tipo: c.condicion_tipo, umbral_verde: c.umbral_verde, activo: c.activo });
    setShowAdd(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="Admin · Rachas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Configuración de Rachas por Canal</h2>
          <Button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ canal: 'VC', nombre: '', descripcion: '', condicion_tipo: 'ventas_semanales', umbral_verde: 0, activo: true }); }}>
            <MI icon="add_circle" className="text-sm mr-1" /> Nueva Racha
          </Button>
        </div>

        {showAdd && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{editing ? 'Editar Configuración' : 'Nueva Configuración'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <select value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                {CANALES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={form.condicion_tipo} onChange={e => setForm(f => ({ ...f, condicion_tipo: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                <option value="ventas_semanales">Ventas Semanales</option>
                <option value="referidos_semanales">Referidos Semanales</option>
                <option value="acv_semanal">ACV+ Semanal</option>
                <option value="conversiones_semanales">Conversiones Semanales</option>
              </select>
              <input type="number" value={form.umbral_verde} onChange={e => setForm(f => ({ ...f, umbral_verde: Number(e.target.value) }))} placeholder="Umbral verde" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción" className="h-10 rounded-lg border border-border bg-background px-3 text-sm col-span-2" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>{editing ? 'Guardar' : 'Crear'}</Button>
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancelar</Button>
            </div>
          </div>
        )}

        {dataLoading ? <Skeleton className="h-64" /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CANALES.map(canal => (
              <div key={canal} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MI icon="local_fire_department" className="text-accent text-lg" />
                  {canal.replace(/_/g, ' ')}
                </h3>
                {configs.filter(c => c.canal === canal).map(c => (
                  <div key={c.id} className={cn("bg-card border rounded-2xl p-5 group relative", c.activo ? "border-border" : "border-destructive/20 opacity-60")}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🔥</span>
                      <span className="text-sm font-bold text-foreground">{c.nombre}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.descripcion}</p>
                    <div className="flex gap-2 mt-3">
                      <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">{c.condicion_tipo.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">Umbral: ${(c.umbral_verde / 1_000_000).toFixed(0)}M</span>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(c)} className="text-primary hover:text-primary/80"><MI icon="edit" className="text-sm" /></button>
                    </div>
                  </div>
                ))}
                {configs.filter(c => c.canal === canal).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin configuración</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminRachas;
