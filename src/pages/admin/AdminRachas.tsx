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

const CONDICION_TIPOS = [
  { value: 'ventas_semanales', label: 'Ventas Semanales', desc: 'Suma de valor_producto en la semana' },
  { value: 'referidos_semanales', label: 'Referidos Semanales', desc: 'Cantidad de referidos en la semana' },
  { value: 'acv_semanal', label: 'ACV+ Semanal', desc: 'ACV+ acumulado en la semana' },
  { value: 'conversiones_semanales', label: 'Conversiones Semanales', desc: 'Número de conversiones en la semana' },
];

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const inputClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors";

const AdminRachas = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ canal: 'VC', nombre: '', descripcion: '', condicion_tipo: 'ventas_semanales', umbral_verde: 0, activo: true, familia_vc: 'AMBAS', umbral_legacy: 0, dias_lun_mie: false, multiplicador_sp: 1.0 });

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
    if (!form.nombre.trim()) {
      toast({ title: 'Campo requerido', description: 'El nombre es obligatorio', variant: 'destructive' });
      return;
    }
    const payload = {
      ...form,
      umbral_verde: Number(form.umbral_verde),
      umbral_legacy: form.umbral_legacy != null && form.umbral_legacy !== '' ? Number(form.umbral_legacy) : null,
      multiplicador_sp: Number(form.multiplicador_sp) || 1.0,
      familia_vc: form.canal === 'VC' ? form.familia_vc : null,
      dias_lun_mie: !!form.dias_lun_mie,
    };
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
    setForm({
      canal: c.canal, nombre: c.nombre, descripcion: c.descripcion || '', condicion_tipo: c.condicion_tipo,
      umbral_verde: c.umbral_verde ?? 0, activo: c.activo,
      familia_vc: c.familia_vc || 'AMBAS',
      umbral_legacy: c.umbral_legacy ?? 0,
      dias_lun_mie: !!c.dias_lun_mie,
      multiplicador_sp: c.multiplicador_sp ?? 1.0,
    });
    setShowAdd(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const selectedCondicion = CONDICION_TIPOS.find(c => c.value === form.condicion_tipo);

  return (
    <Layout title="Admin · Rachas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Configuración de Rachas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Define los umbrales semanales por canal para activar rachas</p>
          </div>
          <Button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ canal: 'VC', nombre: '', descripcion: '', condicion_tipo: 'ventas_semanales', umbral_verde: 0, activo: true, familia_vc: 'AMBAS', umbral_legacy: 0, dias_lun_mie: false, multiplicador_sp: 1.0 }); }}>
            <MI icon="add_circle" className="text-sm mr-1" /> Nueva Racha
          </Button>
        </div>

        {/* Form */}
        {showAdd && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MI icon={editing ? 'edit' : 'local_fire_department'} className="text-accent text-base" />
                {editing ? 'Editar Configuración' : 'Nueva Configuración de Racha'}
              </h3>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground">
                <MI icon="close" className="text-lg" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Nombre de la racha">
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Racha de Ventas VC" className={inputClass} />
              </Field>
              <Field label="Canal">
                <select value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} className={inputClass}>
                  {CANALES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Tipo de condición" hint={selectedCondicion?.desc}>
                <select value={form.condicion_tipo} onChange={e => setForm(f => ({ ...f, condicion_tipo: e.target.value }))} className={inputClass}>
                  {CONDICION_TIPOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Valor (mínimo diario/semanal)" hint={form.familia_vc === 'AMBAS' || form.familia_vc === 'NUBE' ? 'Umbral para Nube' : 'Umbral principal'}>
                <input type="number" value={form.umbral_verde} onChange={e => setForm(f => ({ ...f, umbral_verde: Number(e.target.value) }))} className={inputClass} />
              </Field>
              {form.canal === 'VC' && (
                <Field label="Familia VC">
                  <select value={form.familia_vc} onChange={e => setForm(f => ({ ...f, familia_vc: e.target.value }))} className={inputClass}>
                    <option value="NUBE">Nube</option>
                    <option value="LEGACY">Legacy (Pyme + Ilimitada)</option>
                    <option value="AMBAS">Ambas</option>
                  </select>
                </Field>
              )}
              {form.canal === 'VC' && (form.familia_vc === 'AMBAS' || form.familia_vc === 'LEGACY') && (
                <Field label="Umbral Legacy" hint="Umbral diferenciado para Pyme/Ilimitada">
                  <input type="number" value={form.umbral_legacy} onChange={e => setForm(f => ({ ...f, umbral_legacy: Number(e.target.value) }))} className={inputClass} />
                </Field>
              )}
              <Field label="Multiplicador SP" hint="Ej: 2.0 = duplica los SP de la semana">
                <input type="number" step="0.1" value={form.multiplicador_sp} onChange={e => setForm(f => ({ ...f, multiplicador_sp: Number(e.target.value) }))} className={inputClass} />
              </Field>
              <Field label="Descripción">
                <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción breve" className={inputClass} />
              </Field>
              <div className="flex items-end gap-4 col-span-2">
                <label className="flex items-center gap-2.5 h-10 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                  <span className="font-medium text-foreground">Racha activa</span>
                </label>
                <label className="flex items-center gap-2.5 h-10 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!form.dias_lun_mie} onChange={e => setForm(f => ({ ...f, dias_lun_mie: e.target.checked }))} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                  <span className="font-medium text-foreground">Lunes a miércoles consecutivos</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? 'Guardar Cambios' : 'Crear Racha'}</Button>
            </div>
          </div>
        )}

        {/* Cards by canal */}
        {dataLoading ? <Skeleton className="h-64" /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CANALES.map(canal => {
              const canalConfigs = configs.filter(c => c.canal === canal.value);
              return (
                <div key={canal.value} className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <MI icon="local_fire_department" className="text-accent text-lg" />
                    {canal.label}
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full ml-auto">{canalConfigs.length} reglas</span>
                  </h3>
                  {canalConfigs.map(c => (
                    <div key={c.id} className={cn(
                      "bg-card border rounded-2xl p-5 group relative transition-all hover:shadow-smooth-sm",
                      c.activo ? "border-border" : "border-destructive/20 opacity-60"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">🔥</span>
                        <span className="text-sm font-bold text-foreground">{c.nombre}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{c.descripcion}</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                          {CONDICION_TIPOS.find(ct => ct.value === c.condicion_tipo)?.label || c.condicion_tipo}
                        </span>
                        {c.familia_vc && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">{c.familia_vc}</span>
                        )}
                        <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-semibold">
                          Valor: ${(c.umbral_verde / 1_000_000).toFixed(0)}M
                        </span>
                        {c.umbral_legacy ? (
                          <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-semibold">
                            Legacy: ${(c.umbral_legacy / 1_000_000).toFixed(0)}M
                          </span>
                        ) : null}
                        {c.multiplicador_sp && c.multiplicador_sp !== 1 && (
                          <span className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-bold">{c.multiplicador_sp}x</span>
                        )}
                        {c.dias_lun_mie && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Lun-Mié</span>
                        )}
                        {!c.activo && <span className="text-[9px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold">Inactiva</span>}
                      </div>
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(c)} className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors">
                          <MI icon="edit" className="text-sm" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {canalConfigs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
                      <MI icon="local_fire_department" className="text-3xl mb-1 opacity-30" />
                      <p className="text-xs">Sin configuración</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminRachas;
