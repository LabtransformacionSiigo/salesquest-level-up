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

const CANALES = [
  { value: 'VN_EMPRESARIOS', label: 'VN Empresarios' },
  { value: 'VN_ALIADOS', label: 'VN Aliados' },
  { value: 'VC', label: 'Venta Cruzada' },
];
const PAISES = [
  { value: 'COL', label: '🇨🇴 Colombia' },
  { value: 'MEX', label: '🇲🇽 México' },
  { value: 'ECU', label: '🇪🇨 Ecuador' },
];

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground">{label}</label>
    {children}
  </div>
);

const inputClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors";

const AdminGerentes = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', canal: 'VC', pais: 'MEX', activo: true });
  const [showAdd, setShowAdd] = useState(false);
  const [filterCanal, setFilterCanal] = useState('TODOS');

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
    if (!form.nombre.trim() || !form.email.trim()) {
      toast({ title: 'Campos requeridos', description: 'Nombre y email son obligatorios', variant: 'destructive' });
      return;
    }
    if (editing) {
      const { error } = await supabase.from('gerentes').update(form).eq('id', editing);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Gerente actualizado ✅' });
    } else {
      const { error } = await supabase.from('gerentes').insert(form);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Gerente creado ✅' });
    }
    setEditing(null);
    setShowAdd(false);
    fetchGerentes();
  };

  const startEdit = (g: any) => {
    setEditing(g.id);
    setForm({ nombre: g.nombre, email: g.email, canal: g.canal || 'VC', pais: g.pais || 'MEX', activo: g.activo ?? true });
    setShowAdd(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const filtered = filterCanal === 'TODOS' ? gerentes : gerentes.filter(g => g.canal === filterCanal);
  const activos = gerentes.filter(g => g.activo).length;

  return (
    <Layout title="Admin · Gerentes">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Gestión de Gerentes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{activos} activos de {gerentes.length} registrados</p>
          </div>
          <Button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ nombre: '', email: '', canal: 'VC', pais: 'MEX', activo: true }); }}>
            <MI icon="person_add" className="text-sm mr-1" /> Nuevo Gerente
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterCanal('TODOS')} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", filterCanal === 'TODOS' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
            Todos ({gerentes.length})
          </button>
          {CANALES.map(c => (
            <button key={c.value} onClick={() => setFilterCanal(c.value)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", filterCanal === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
              {c.label} ({gerentes.filter(g => g.canal === c.value).length})
            </button>
          ))}
        </div>

        {/* Form */}
        {showAdd && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MI icon={editing ? 'edit' : 'person_add'} className="text-primary text-base" />
                {editing ? 'Editar Líder' : 'Registrar Nuevo Líder'}
              </h3>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground">
                <MI icon="close" className="text-lg" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Nombre completo">
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Carlos Mendoza" className={inputClass} />
              </Field>
              <Field label="Correo electrónico">
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@siigo.com" className={inputClass} />
              </Field>
              <Field label="Canal">
                <select value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} className={inputClass}>
                  {CANALES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="País">
                <select value={form.pais} onChange={e => setForm(f => ({ ...f, pais: e.target.value }))} className={inputClass}>
                  {PAISES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Gerente (jefe directo)">
                <input value={form.lider} onChange={e => setForm(f => ({ ...f, lider: e.target.value }))} placeholder="Nombre del gerente" className={inputClass} />
              </Field>
              <div className="flex items-end">
                <label className="flex items-center gap-2.5 h-10 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                  <span className="font-medium text-foreground">Líder activo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? 'Guardar Cambios' : 'Crear Líder'}</Button>
            </div>
          </div>
        )}

        {/* Table */}
        {dataLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider bg-muted/30">
                  <th className="text-left px-4 py-3">Líder</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Canal</th>
                  <th className="text-left px-4 py-3">País</th>
                  <th className="text-left px-4 py-3">Gerente</th>
                  <th className="text-center px-4 py-3">Estado</th>
                  <th className="text-center px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">{g.avatar_url || '👤'}</div>
                        <span className="text-sm font-medium text-foreground">{g.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{g.email}</td>
                    <td className="px-4 py-3"><span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{CANALES.find(c => c.value === g.canal)?.label || g.canal}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{g.pais}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{g.lider || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", g.activo ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive")}>
                        {g.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => startEdit(g)} className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center justify-center transition-colors">
                        <MI icon="edit" className="text-base" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Sin líderes registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminGerentes;
