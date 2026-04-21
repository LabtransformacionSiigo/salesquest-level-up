import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  COUNTRY_LABELS,
  SUPPORTED_COUNTRIES,
  getFamiliesForCountry,
  getSkusForCountry,
  type CountryCode,
  type ProductFamily,
} from '@/lib/product-families';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const CANALES = [
  { value: 'VN_EMPRESARIOS', label: 'VN Empresarios' },
  { value: 'VN_ALIADOS', label: 'VN Aliados' },
  { value: 'VC', label: 'Venta Cruzada' },
];

const FAMILY_LABELS: Record<ProductFamily, string> = {
  FE: 'Familia FE (Facturación)',
  NUBE: 'Familia Nube',
  CONTADOR: 'Familia Contador',
};

const CONDICIONES = [
  { value: 'primera_venta', label: 'Primera Venta', desc: 'Se otorga al realizar la primera venta del producto' },
  { value: 'cantidad', label: 'Cantidad Acumulada', desc: 'Se otorga al alcanzar X unidades vendidas' },
  { value: 'monto', label: 'Monto Acumulado', desc: 'Se otorga al alcanzar $X en ventas' },
  { value: 'cumplimiento', label: 'Cumplimiento de Meta', desc: 'Se otorga al alcanzar X% de cumplimiento' },
];

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const inputClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors";

const AdminMedallas = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filterCanal, setFilterCanal] = useState('TODOS');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    canal: 'VN_ALIADOS',
    pais: 'COL' as CountryCode,
    familia: 'FE' as ProductFamily,
    nombre: '',
    descripcion: '',
    condicion_tipo: 'primera_venta',
    producto: '',
    cantidad_requerida: 1,
    sp: 100,
    emoji: '🏅',
    activo: true,
  });

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
    if (!form.nombre.trim()) {
      toast({ title: 'Campo requerido', description: 'El nombre de la medalla es obligatorio', variant: 'destructive' });
      return;
    }
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

  const resetForm = () => setForm({ canal: 'VC', nombre: '', descripcion: '', condicion_tipo: 'primera_venta', producto: '', cantidad_requerida: 1, sp: 100, emoji: '🏅', activo: true });

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
  const selectedCondicion = CONDICIONES.find(c => c.value === form.condicion_tipo);

  const cantidadLabel = form.condicion_tipo === 'cantidad'
    ? 'Unidades requeridas'
    : form.condicion_tipo === 'monto'
      ? 'Monto requerido (COP)'
      : form.condicion_tipo === 'cumplimiento'
        ? '% de cumplimiento'
        : 'Cantidad';

  const cantidadHint = form.condicion_tipo === 'monto'
    ? 'Ej: 10000000 = $10M COP'
    : form.condicion_tipo === 'cumplimiento'
      ? 'Ej: 100 = 100% de la meta'
      : undefined;

  return (
    <Layout title="Admin · Medallas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Catálogo de Medallas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Define las medallas y logros que los líderes pueden desbloquear</p>
          </div>
          <Button onClick={() => { setShowAdd(!showAdd); setEditing(null); resetForm(); }}>
            <MI icon="add_circle" className="text-sm mr-1" /> Nueva Medalla
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterCanal('TODOS')} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", filterCanal === 'TODOS' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
            Todos ({catalogo.length})
          </button>
          {CANALES.map(c => {
            const count = catalogo.filter(m => m.canal === c.value).length;
            return (
              <button key={c.value} onClick={() => setFilterCanal(c.value)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", filterCanal === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                {c.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Form */}
        {showAdd && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MI icon={editing ? 'edit' : 'add_circle'} className="text-primary text-base" />
                {editing ? 'Editar Medalla' : 'Crear Nueva Medalla'}
              </h3>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground">
                <MI icon="close" className="text-lg" />
              </button>
            </div>

            {/* Section 1: Identidad */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Identidad de la Medalla</p>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-2">
                  <Field label="Emoji">
                    <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} className={cn(inputClass, "text-center text-2xl")} />
                  </Field>
                </div>
                <div className="col-span-5">
                  <Field label="Nombre de la medalla" hint="Nombre corto y descriptivo">
                    <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Primera Venta Nube" className={inputClass} />
                  </Field>
                </div>
                <div className="col-span-5">
                  <Field label="Descripción" hint="Se muestra al pasar el mouse sobre la medalla">
                    <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Realiza tu primera venta de Nube" className={inputClass} />
                  </Field>
                </div>
              </div>
            </div>

            {/* Section 2: Reglas */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reglas de Desbloqueo</p>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4">
                  <Field label="Canal">
                    <select value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} className={inputClass}>
                      {CANALES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="col-span-4">
                  <Field label="Tipo de condición" hint={selectedCondicion?.desc}>
                    <select value={form.condicion_tipo} onChange={e => setForm(f => ({ ...f, condicion_tipo: e.target.value }))} className={inputClass}>
                      {CONDICIONES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="col-span-4">
                  <Field label="Producto">
                    <select value={form.producto} onChange={e => setForm(f => ({ ...f, producto: e.target.value }))} className={inputClass}>
                      {PRODUCTOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            {/* Section 3: Valores */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valores</p>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4">
                  <Field label={cantidadLabel} hint={cantidadHint}>
                    <input type="number" value={form.cantidad_requerida} onChange={e => setForm(f => ({ ...f, cantidad_requerida: Number(e.target.value) }))} className={inputClass} />
                  </Field>
                </div>
                <div className="col-span-4">
                  <Field label="SP otorgados" hint="Puntos que recibe el líder al desbloquear">
                    <input type="number" value={form.sp} onChange={e => setForm(f => ({ ...f, sp: Number(e.target.value) }))} className={inputClass} />
                  </Field>
                </div>
                <div className="col-span-4 flex items-end">
                  <label className="flex items-center gap-2.5 h-10 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                    <span className="font-medium text-foreground">Medalla activa</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Preview + Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
                <span className="text-3xl">{form.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{form.nombre || 'Nombre de medalla'}</p>
                  <p className="text-[10px] text-muted-foreground">{form.descripcion || 'Descripción'}</p>
                  <div className="flex gap-1.5 mt-1">
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{CANALES.find(c => c.value === form.canal)?.label}</span>
                    {form.producto && <span className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{form.producto}</span>}
                    <span className="text-[9px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full">+{form.sp} SP</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancelar</Button>
                <Button onClick={handleSave}>{editing ? 'Guardar Cambios' : 'Crear Medalla'}</Button>
              </div>
            </div>
          </div>
        )}

        {/* Cards grid */}
        {dataLoading ? <Skeleton className="h-64" /> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(m => (
              <div key={m.id} className={cn(
                "bg-card border rounded-2xl p-5 text-center relative group transition-all hover:shadow-smooth-sm",
                m.activo ? "border-border" : "border-destructive/20 opacity-60"
              )}>
                <p className="text-4xl mb-2">{m.emoji}</p>
                <p className="text-sm font-bold text-foreground">{m.nombre}</p>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{m.descripcion}</p>
                <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{CANALES.find(c => c.value === m.canal)?.label || m.canal}</span>
                  <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">+{m.sp} SP</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
                  {m.producto && <span className="text-[9px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">{m.producto}</span>}
                  <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {CONDICIONES.find(c => c.value === m.condicion_tipo)?.label || m.condicion_tipo} · ×{m.cantidad_requerida}
                  </span>
                </div>
                {!m.activo && (
                  <span className="absolute top-2 left-2 text-[9px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold">Inactiva</span>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(m)} className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors">
                    <MI icon="edit" className="text-sm" />
                  </button>
                  <button onClick={() => toggleActivo(m)} className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors", m.activo ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-secondary/10 text-secondary hover:bg-secondary/20")}>
                    <MI icon={m.activo ? "visibility_off" : "visibility"} className="text-sm" />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <MI icon="emoji_events" className="text-4xl mb-2" />
                <p className="text-sm">No hay medallas en este canal</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminMedallas;
