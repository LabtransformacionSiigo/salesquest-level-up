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
    if (!form.nombre.trim() || !form.email.trim() || !form.gerente_id) {
      toast({ title: 'Campos requeridos', description: 'Nombre, email y gerente son obligatorios', variant: 'destructive' });
      return;
    }
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
  const activos = asesores.filter(a => a.activo).length;

  return (
    <Layout title="Admin · Asesores">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Gestión de Asesores</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{activos} activos de {asesores.length} registrados</p>
          </div>
          <Button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ nombre: '', email: '', gerente_id: '', canal: 'VC', pais: 'MEX', activo: true }); }}>
            <MI icon="person_add" className="text-sm mr-1" /> Nuevo Asesor
          </Button>
        </div>

        {/* Filter by líder */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterGerente('TODOS')} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", filterGerente === 'TODOS' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
            Todos ({asesores.length})
          </button>
          {gerentes.map(g => {
            const count = asesores.filter(a => a.gerente_id === g.id).length;
            return (
              <button key={g.id} onClick={() => setFilterGerente(g.id)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", filterGerente === g.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                {g.nombre} ({count})
              </button>
            );
          })}
        </div>

        {/* Form */}
        {showAdd && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MI icon={editing ? 'edit' : 'person_add'} className="text-primary text-base" />
                {editing ? 'Editar Asesor' : 'Registrar Nuevo Asesor'}
              </h3>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground">
                <MI icon="close" className="text-lg" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Nombre completo">
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: María López" className={inputClass} />
              </Field>
              <Field label="Correo electrónico">
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@siigo.com" className={inputClass} />
              </Field>
              <Field label="Líder asignado">
                <select value={form.gerente_id} onChange={e => setForm(f => ({ ...f, gerente_id: e.target.value }))} className={inputClass}>
                  <option value="">Seleccionar líder...</option>
                  {gerentes.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
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
              <div className="flex items-end">
                <label className="flex items-center gap-2.5 h-10 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                  <span className="font-medium text-foreground">Asesor activo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? 'Guardar Cambios' : 'Crear Asesor'}</Button>
            </div>
          </div>
        )}

        {/* Table */}
        {dataLoading ? <Skeleton className="h-64" /> : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider bg-muted/30">
                  <th className="text-left px-4 py-3">Asesor</th>
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
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">{a.avatar_url || '👤'}</div>
                        <span className="text-sm font-medium text-foreground">{a.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.email}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.gerentes?.nombre || '—'}</td>
                    <td className="px-4 py-3"><span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{CANALES.find(c => c.value === a.canal)?.label || a.canal}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.pais}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", a.activo ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive")}>
                        {a.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => startEdit(a)} className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center justify-center transition-colors">
                        <MI icon="edit" className="text-base" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Sin asesores registrados</td></tr>
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
