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

const AdminAsesores = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [asesores, setAsesores] = useState<any[]>([]);
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', gerente_id: '', canal: 'VC', pais: 'MEX', activo: true });
  const [filterGerente, setFilterGerente] = useState('TODOS');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    const [aRes, gRes] = await Promise.all([
      supabase.from('asesores').select('*, gerentes(nombre)').order('nombre'),
      supabase.from('gerentes').select('id, nombre').eq('activo', true).order('nombre'),
    ]);
    setAsesores(aRes.data || []);
    setGerentes(gRes.data || []);
    setDataLoading(false);
  };

  const handleSave = async () => {
    if (editing) {
      const { error } = await supabase.from('asesores').update(form).eq('id', editing);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Asesor actualizado ✅' });
    } else {
      const { error } = await supabase.from('asesores').insert(form);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Asesor creado ✅' });
    }
    setEditing(null);
    setShowAdd(false);
    fetchData();
  };

  const startEdit = (a: any) => {
    setEditing(a.id);
    setForm({ nombre: a.nombre, email: a.email, gerente_id: a.gerente_id, canal: a.canal || 'VC', pais: a.pais || 'MEX', activo: a.activo ?? true });
    setShowAdd(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const filtered = filterGerente === 'TODOS' ? asesores : asesores.filter(a => a.gerente_id === filterGerente);

  return (
    <Layout title="Admin · Asesores">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Gestión de Asesores</h2>
          <Button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ nombre: '', email: '', gerente_id: '', canal: 'VC', pais: 'MEX', activo: true }); }}>
            <MI icon="person_add" className="text-sm mr-1" /> Nuevo Asesor
          </Button>
        </div>

        {/* Filter by líder */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterGerente('TODOS')} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", filterGerente === 'TODOS' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>
            Todos
          </button>
          {gerentes.map(g => (
            <button key={g.id} onClick={() => setFilterGerente(g.id)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", filterGerente === g.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>
              {g.nombre}
            </button>
          ))}
        </div>

        {showAdd && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{editing ? 'Editar Asesor' : 'Nuevo Asesor'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <select value={form.gerente_id} onChange={e => setForm(f => ({ ...f, gerente_id: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                <option value="">Seleccionar líder...</option>
                {gerentes.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
              <select value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                <option value="VN_EMPRESARIOS">VN Empresarios</option>
                <option value="VN_ALIADOS">VN Aliados</option>
                <option value="VC">VC</option>
              </select>
              <select value={form.pais} onChange={e => setForm(f => ({ ...f, pais: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                <option value="COL">COL</option>
                <option value="MEX">MEX</option>
                <option value="ECU">ECU</option>
              </select>
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

        {dataLoading ? <Skeleton className="h-64" /> : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Líder</th>
                  <th className="text-left px-4 py-3">Canal</th>
                  <th className="text-left px-4 py-3">País</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-center px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{a.nombre}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.email}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.gerentes?.nombre || '-'}</td>
                    <td className="px-4 py-3"><span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{a.canal?.replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.pais}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", a.activo ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive")}>
                        {a.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => startEdit(a)} className="text-primary hover:text-primary/80">
                        <MI icon="edit" className="text-base" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Sin asesores</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminAsesores;
