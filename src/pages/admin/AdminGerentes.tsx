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
const PAISES = ['COL', 'MEX', 'ECU'];

const AdminGerentes = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', canal: 'VC', pais: 'MEX', lider: '', activo: true });
  const [showAdd, setShowAdd] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchGerentes();
  }, [isAuthenticated]);

  const fetchGerentes = async () => {
    const { data } = await supabase.from('gerentes').select('*').order('nombre');
    setGerentes(data || []);
    setDataLoading(false);
  };

  const handleSave = async () => {
    if (editing) {
      const { error } = await supabase.from('gerentes').update(form).eq('id', editing);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Líder actualizado ✅' });
    } else {
      const { error } = await supabase.from('gerentes').insert(form);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Líder creado ✅' });
    }
    setEditing(null);
    setShowAdd(false);
    fetchGerentes();
  };

  const startEdit = (g: any) => {
    setEditing(g.id);
    setForm({ nombre: g.nombre, email: g.email, canal: g.canal || 'VC', pais: g.pais || 'MEX', lider: g.lider || '', activo: g.activo ?? true });
    setShowAdd(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="Admin · Líderes">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Gestión de Líderes</h2>
          <Button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ nombre: '', email: '', canal: 'VC', pais: 'MEX', lider: '', activo: true }); }}>
            <MI icon="person_add" className="text-sm mr-1" /> Nuevo Líder
          </Button>
        </div>

        {showAdd && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{editing ? 'Editar Líder' : 'Nuevo Líder'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <select value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                {CANALES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={form.pais} onChange={e => setForm(f => ({ ...f, pais: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input value={form.lider} onChange={e => setForm(f => ({ ...f, lider: e.target.value }))} placeholder="Gerente" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                Activo
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>{editing ? 'Guardar' : 'Crear'}</Button>
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancelar</Button>
            </div>
          </div>
        )}

        {dataLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Canal</th>
                  <th className="text-left px-4 py-3">País</th>
                  <th className="text-left px-4 py-3">Líder</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-center px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gerentes.map(g => (
                  <tr key={g.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{g.nombre}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{g.email}</td>
                    <td className="px-4 py-3"><span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{g.canal?.replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{g.pais}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{g.lider || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", g.activo ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive")}>
                        {g.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => startEdit(g)} className="text-primary hover:text-primary/80">
                        <MI icon="edit" className="text-base" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminGerentes;
