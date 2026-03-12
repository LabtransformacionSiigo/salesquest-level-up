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
const CONDICIONES = [
  { value: 'primera_venta', label: 'Primera Venta' },
  { value: 'cantidad', label: 'Cantidad Acumulada' },
  { value: 'monto', label: 'Monto Acumulado' },
  { value: 'cumplimiento', label: 'Cumplimiento Meta' },
];

const AdminMedallas = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filterCanal, setFilterCanal] = useState('TODOS');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ canal: 'VC', nombre: '', descripcion: '', condicion_tipo: 'primera_venta', producto: '', cantidad_requerida: 1, sp: 100, emoji: '🏅', activo: true });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchCatalogo();
  }, [isAuthenticated]);

  const fetchCatalogo = async () => {
    const { data } = await supabase.from('catalogo_medallas').select('*').order('canal').order('nombre');
    setCatalogo(data || []);
    setDataLoading(false);
  };

  const handleSave = async () => {
    const payload = { ...form, cantidad_requerida: Number(form.cantidad_requerida), sp: Number(form.sp) };
    if (editing) {
      const { error } = await supabase.from('catalogo_medallas').update(payload).eq('id', editing);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Medalla actualizada ✅' });
    } else {
      const { error } = await supabase.from('catalogo_medallas').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Medalla creada ✅' });
    }
    setEditing(null);
    setShowAdd(false);
    fetchCatalogo();
  };

  const startEdit = (m: any) => {
    setEditing(m.id);
    setForm({ canal: m.canal, nombre: m.nombre, descripcion: m.descripcion || '', condicion_tipo: m.condicion_tipo, producto: m.producto || '', cantidad_requerida: m.cantidad_requerida, sp: m.sp, emoji: m.emoji || '🏅', activo: m.activo });
    setShowAdd(true);
  };

  const toggleActivo = async (m: any) => {
    await supabase.from('catalogo_medallas').update({ activo: !m.activo }).eq('id', m.id);
    fetchCatalogo();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const filtered = filterCanal === 'TODOS' ? catalogo : catalogo.filter(m => m.canal === filterCanal);

  return (
    <Layout title="Admin · Medallas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Catálogo de Medallas</h2>
          <Button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ canal: 'VC', nombre: '', descripcion: '', condicion_tipo: 'primera_venta', producto: '', cantidad_requerida: 1, sp: 100, emoji: '🏅', activo: true }); }}>
            <MI icon="add_circle" className="text-sm mr-1" /> Nueva Medalla
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterCanal('TODOS')} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border", filterCanal === 'TODOS' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>Todos</button>
          {CANALES.map(c => (
            <button key={c} onClick={() => setFilterCanal(c)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border", filterCanal === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{c.replace(/_/g, ' ')}</button>
          ))}
        </div>

        {showAdd && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{editing ? 'Editar Medalla' : 'Nueva Medalla'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="Emoji" className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-center text-2xl" />
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" className="h-10 rounded-lg border border-border bg-background px-3 text-sm col-span-2" />
              <select value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                {CANALES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción" className="h-10 rounded-lg border border-border bg-background px-3 text-sm col-span-2" />
              <select value={form.condicion_tipo} onChange={e => setForm(f => ({ ...f, condicion_tipo: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                {CONDICIONES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input value={form.producto} onChange={e => setForm(f => ({ ...f, producto: e.target.value }))} placeholder="Producto (ej: Nube, FE)" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <input type="number" value={form.cantidad_requerida} onChange={e => setForm(f => ({ ...f, cantidad_requerida: Number(e.target.value) }))} placeholder="Cantidad" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <input type="number" value={form.sp} onChange={e => setForm(f => ({ ...f, sp: Number(e.target.value) }))} placeholder="SP otorgados" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>{editing ? 'Guardar' : 'Crear'}</Button>
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancelar</Button>
            </div>
          </div>
        )}

        {dataLoading ? <Skeleton className="h-64" /> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(m => (
              <div key={m.id} className={cn("bg-card border rounded-2xl p-5 text-center relative group", m.activo ? "border-border" : "border-destructive/20 opacity-60")}>
                <p className="text-4xl mb-2">{m.emoji}</p>
                <p className="text-sm font-bold text-foreground">{m.nombre}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{m.descripcion}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m.canal?.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">+{m.sp} SP</span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">{m.condicion_tipo.replace(/_/g, ' ')} · {m.producto || 'General'} · ×{m.cantidad_requerida}</p>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(m)} className="text-primary hover:text-primary/80"><MI icon="edit" className="text-sm" /></button>
                  <button onClick={() => toggleActivo(m)} className={cn("hover:opacity-80", m.activo ? "text-destructive" : "text-secondary")}>
                    <MI icon={m.activo ? "visibility_off" : "visibility"} className="text-sm" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminMedallas;
