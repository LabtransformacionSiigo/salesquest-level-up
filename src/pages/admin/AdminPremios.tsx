import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Package, ClipboardList, Plus, Trash2, Edit } from 'lucide-react';

interface Premio {
  id: string;
  nombre: string;
  descripcion: string | null;
  costo_puntos: number;
  imagen_url: string | null;
  stock: number;
  activo: boolean;
}

interface Canje {
  id: string;
  puntos_gastados: number;
  fecha_canje: string;
  estado: string;
  gerentes?: { nombre: string } | null;
  premios?: { nombre: string } | null;
}

const AdminPremios = () => {
  const { toast } = useToast();
  const [premios, setPremios] = useState<Premio[]>([]);
  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', costo_puntos: 0, imagen_url: '', stock: 0 });

  const fetchData = async () => {
    const [premiosRes, canjesRes] = await Promise.all([
      supabase.from('premios').select('*').order('created_at', { ascending: false }),
      supabase.from('canjes').select('id, puntos_gastados, fecha_canje, estado, gerentes(nombre), premios(nombre)').order('fecha_canje', { ascending: false }).limit(100),
    ]);
    setPremios((premiosRes.data || []) as Premio[]);
    setCanjes((canjesRes.data || []) as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.nombre || form.costo_puntos <= 0) {
      toast({ title: 'Error', description: 'Nombre y costo son obligatorios', variant: 'destructive' });
      return;
    }
    const payload = { nombre: form.nombre, descripcion: form.descripcion || null, costo_puntos: form.costo_puntos, imagen_url: form.imagen_url || null, stock: form.stock };
    if (editId) {
      const { error } = await supabase.from('premios').update(payload).eq('id', editId);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: '✅ Premio actualizado' });
    } else {
      const { error } = await supabase.from('premios').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: '✅ Premio creado' });
    }
    setShowForm(false);
    setEditId(null);
    setForm({ nombre: '', descripcion: '', costo_puntos: 0, imagen_url: '', stock: 0 });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este premio?')) return;
    await supabase.from('premios').delete().eq('id', id);
    fetchData();
  };

  const handleToggle = async (id: string, activo: boolean) => {
    await supabase.from('premios').update({ activo: !activo }).eq('id', id);
    fetchData();
  };

  const handleEstado = async (canjeId: string, estado: string) => {
    await supabase.from('canjes').update({ estado }).eq('id', canjeId);
    fetchData();
    toast({ title: `Canje marcado como ${estado}` });
  };

  const startEdit = (p: Premio) => {
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', costo_puntos: p.costo_puntos, imagen_url: p.imagen_url || '', stock: p.stock });
    setEditId(p.id);
    setShowForm(true);
  };

  if (loading) return <Layout title="⚙️ Configurar Beneficios "><div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div></Layout>;

  return (
    <Layout title="⚙️ Configurar Beneficios ">
      <Tabs defaultValue="catalogo" className="max-w-[1200px]">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="catalogo" className="gap-2"><Package className="w-4 h-4" /> Catálogo</TabsTrigger>
          <TabsTrigger value="canjes" className="gap-2"><ClipboardList className="w-4 h-4" /> Canjes</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-foreground">{premios.length} premios</h2>
            <Button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nombre: '', descripcion: '', costo_puntos: 0, imagen_url: '', stock: 0 }); }} className="gap-2">
              <Plus className="w-4 h-4" /> Nuevo Premio
            </Button>
          </div>

          {showForm && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-foreground">{editId ? 'Editar Premio' : 'Nuevo Premio'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Nombre *</label>
                  <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Costo en Puntos *</label>
                  <Input type="number" value={form.costo_puntos} onChange={e => setForm({ ...form, costo_puntos: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Stock</label>
                  <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">URL de Imagen</label>
                  <Input value={form.imagen_url} onChange={e => setForm({ ...form, imagen_url: e.target.value })} placeholder="https://..." />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Descripción</label>
                  <Input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave}>{editId ? 'Guardar Cambios' : 'Crear Premio'}</Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancelar</Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {premios.map(p => (
              <div key={p.id} className={cn('bg-card border border-border rounded-xl p-4 flex items-center gap-4', !p.activo && 'opacity-50')}>
                {p.imagen_url ? (
                  <img src={p.imagen_url} alt={p.nombre} className="w-14 h-14 rounded-lg object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center"><Gift className="w-6 h-6 text-primary/40" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground truncate">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">{p.costo_puntos} pts · Stock: {p.stock}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(p.id, p.activo)}>{p.activo ? 'Desactivar' : 'Activar'}</Button>
                  <Button variant="ghost" size="icon" onClick={() => startEdit(p)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="canjes" className="mt-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {canjes.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hay canjes registrados</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Usuario</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Premio</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Puntos</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Estado</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {canjes.map(c => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3">{(c as any).gerentes?.nombre || '—'}</td>
                      <td className="px-4 py-3">{(c as any).premios?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-center font-scoreboard">{c.puntos_gastados}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          c.estado === 'entregado' ? 'bg-accent/20 text-accent' : c.estado === 'cancelado' ? 'bg-destructive/20 text-destructive' : 'bg-orange/20 text-orange'
                        )}>
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.estado === 'pendiente' && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => handleEstado(c.id, 'entregado')}>✅ Entregar</Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleEstado(c.id, 'cancelado')}>❌</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default AdminPremios;
