import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn('material-icons-outlined', className)}>{icon}</span>
);

const PAISES_LABEL: Record<string, string> = { COL: 'Colombia', ECU: 'Ecuador', URU: 'Uruguay', MEX: 'México' };
const OPERACIONES = ['Venta Cruzada', 'Venta Nueva (Empresarios)', 'Venta Nueva (Aliados)'];

const inputClass =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

interface Permisos {
  paises: string[];
  operaciones: string[];
}

const AdminEspecialistaPremios = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [permisos, setPermisos] = useState<Permisos | null>(null);
  const [premios, setPremios] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const isAdmin = profile?.role === 'admin';
  const isEspecialista = profile?.role === 'especialista';

  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isEspecialista)) return;
    loadAll();
  }, [isAuthenticated, profile?.role, profile?.user_id]);

  const loadAll = async () => {
    setDataLoading(true);
    let perm: Permisos = { paises: ['COL', 'ECU', 'URU', 'MEX'], operaciones: OPERACIONES };
    if (isEspecialista && profile?.user_id) {
      const { data } = await supabase
        .from('especialista_permisos')
        .select('paises, operaciones')
        .eq('user_id', profile.user_id)
        .maybeSingle();
      if (data) perm = { paises: data.paises || [], operaciones: data.operaciones || [] };
    }
    setPermisos(perm);

    const { data } = await supabase.from('premios').select('*').order('nombre');
    setPremios(data || []);
    setDataLoading(false);
  };

  const isInScope = (p: any) => {
    if (isAdmin) return true;
    if (!permisos) return false;
    const paisOk = !p.pais || permisos.paises.includes(p.pais);
    const opOk = !p.operacion || permisos.operaciones.includes(p.operacion);
    return paisOk && opOk;
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    const { error } = await supabase.from('premios').update({ activo: !activo }).eq('id', id);
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    toast({ title: activo ? 'Desactivado' : 'Activado ✅' });
    loadAll();
  };

  const savePremio = async (payload: any, id?: string) => {
    const action = id
      ? supabase.from('premios').update(payload).eq('id', id)
      : supabase.from('premios').insert(payload);
    const { error } = await action;
    if (error) return toast({ title: 'Error', description: error.message, variant: 'destructive' });
    toast({ title: id ? 'Actualizado ✅' : 'Creado ✅' });
    setEditing(null);
    loadAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin && !isEspecialista) return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="Premios — Especialista">
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-accent/10 to-primary/10 border border-border rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
              <MI icon="storefront" className="text-accent text-xl" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">Catálogo de Premios</h2>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? 'Acceso total. Puedes crear premios para cualquier país u operación.'
                  : 'Solo puedes crear, editar y activar premios dentro de tu alcance asignado:'}
              </p>
            </div>
          </div>
          {!isAdmin && permisos && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="bg-card/60 border border-border rounded-xl p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <MI icon="public" className="text-xs" /> Países asignados
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {permisos.paises.map((p) => (
                    <span key={p} className="text-xs font-semibold bg-primary/15 text-primary px-2.5 py-1 rounded-full">
                      {PAISES_LABEL[p] || p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-card/60 border border-border rounded-xl p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <MI icon="business_center" className="text-xs" /> Operaciones asignadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {permisos.operaciones.map((o) => (
                    <span key={o} className="text-xs font-semibold bg-accent/15 text-accent px-2.5 py-1 rounded-full">
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {dataLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">{premios.length} premios en el catálogo</p>
              <Button size="sm" onClick={() => setEditing({})}>
                <MI icon="add" className="text-sm mr-1" /> Nuevo premio
              </Button>
            </div>
            {premios.length === 0 && (
              <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
                Sin premios. Crea el primero con el botón "Nuevo premio".
              </div>
            )}
            {premios.map((p) => {
              const inScope = isInScope(p);
              return (
                <div
                  key={p.id}
                  className={cn(
                    'bg-card border rounded-2xl p-5 flex items-start gap-4 transition-all',
                    p.activo ? 'border-primary/40' : 'border-border',
                    !inScope && 'opacity-50',
                  )}
                >
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <MI icon="redeem" className="text-muted-foreground text-2xl" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-bold text-foreground">{p.nombre}</h4>
                      {p.pais && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                          {PAISES_LABEL[p.pais] || p.pais}
                        </span>
                      )}
                      {p.operacion && (
                        <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-semibold">
                          {p.operacion}
                        </span>
                      )}
                      {!p.pais && !p.operacion && (
                        <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-semibold">
                          Genérico
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.descripcion}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className="text-[11px] text-primary font-semibold">{p.costo_puntos} SP</p>
                      <p className="text-[11px] text-muted-foreground">Stock: {p.stock}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Switch checked={!!p.activo} disabled={!inScope} onCheckedChange={() => toggleActivo(p.id, p.activo)} />
                    <Button size="sm" variant="outline" disabled={!inScope} onClick={() => setEditing(p)}>
                      <MI icon="edit" className="text-sm" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {editing && permisos && (
          <PremioDrawer
            data={editing}
            permisos={permisos}
            isAdmin={isAdmin}
            onClose={() => setEditing(null)}
            onSave={(p) => savePremio(p, editing.id)}
          />
        )}
      </div>
    </Layout>
  );
};

const PremioDrawer = ({ data, permisos, isAdmin, onClose, onSave }: any) => {
  const { toast } = useToast();
  const paisesPerm = isAdmin ? ['COL', 'ECU', 'URU', 'MEX'] : permisos.paises;
  const opsPerm = isAdmin ? OPERACIONES : permisos.operaciones;

  const [form, setForm] = useState<any>({
    nombre: data.nombre || '',
    descripcion: data.descripcion || '',
    costo_puntos: data.costo_puntos ?? 100,
    stock: data.stock ?? 0,
    imagen_url: data.imagen_url || '',
    pais: data.pais || (paisesPerm[0] ?? ''),
    operacion: data.operacion || (opsPerm[0] ?? ''),
    activo: data.activo ?? false,
  });
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Máximo 5MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('premios-images').upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      toast({ title: 'Error al subir', description: error.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('premios-images').getPublicUrl(fileName);
    setForm({ ...form, imagen_url: urlData.publicUrl });
    setUploading(false);
    toast({ title: 'Imagen subida ✅' });
  };

  const handleSave = () => {
    onSave({
      nombre: form.nombre,
      descripcion: form.descripcion,
      costo_puntos: Number(form.costo_puntos),
      stock: Number(form.stock),
      imagen_url: form.imagen_url || null,
      pais: form.pais || null,
      operacion: form.operacion || null,
      activo: form.activo,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <MI icon={data.id ? 'edit' : 'add_circle'} className="text-primary" />
            </div>
            <h3 className="text-base font-bold text-foreground">{data.id ? 'Editar premio' : 'Nuevo premio'}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
            <MI icon="close" className="text-lg" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Section: Imagen */}
          <section>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MI icon="image" className="text-sm" /> Imagen del premio
            </p>
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.imagen_url ? (
                  <img src={form.imagen_url} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <MI icon="redeem" className="text-muted-foreground text-3xl" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="block">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="premio-file" />
                  <span className={cn(
                    "inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors",
                    uploading && "opacity-60 pointer-events-none"
                  )}>
                    <MI icon={uploading ? 'hourglass_empty' : 'upload'} className="text-sm" />
                    {uploading ? 'Subiendo...' : 'Subir desde computador'}
                  </span>
                </label>
                <label htmlFor="premio-file" className="block text-[10px] text-muted-foreground">
                  PNG, JPG o WEBP · Máx 5MB
                </label>
                <div className="pt-1">
                  <label className="text-[10px] text-muted-foreground">O pega una URL</label>
                  <Input
                    value={form.imagen_url}
                    onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
                    placeholder="https://..."
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section: Información */}
          <section>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MI icon="info" className="text-sm" /> Información
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-foreground">Nombre del premio</label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="mt-1.5" placeholder="Ej: Audífonos inalámbricos" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-foreground">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows={2}
                  className={cn(inputClass, 'mt-1.5 py-2 h-auto resize-none')}
                  placeholder="Detalles del premio..."
                />
              </div>
            </div>
          </section>

          {/* Section: Alcance */}
          <section>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MI icon="public" className="text-sm" /> Alcance
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground">País</label>
                <select value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} className={cn(inputClass, 'mt-1.5')}>
                  <option value="">— Sin país —</option>
                  {paisesPerm.map((p: string) => (
                    <option key={p} value={p}>{PAISES_LABEL[p] || p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Operación</label>
                <select value={form.operacion} onChange={(e) => setForm({ ...form, operacion: e.target.value })} className={cn(inputClass, 'mt-1.5')}>
                  <option value="">— Sin operación —</option>
                  {opsPerm.map((o: string) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Section: Valores */}
          <section>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MI icon="paid" className="text-sm" /> Valores
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Costo en SP</label>
                <Input type="number" value={form.costo_puntos} onChange={(e) => setForm({ ...form, costo_puntos: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Stock disponible</label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between bg-muted/40 border border-border rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Activo en la tienda</p>
                <p className="text-[11px] text-muted-foreground">Los usuarios podrán verlo y canjearlo</p>
              </div>
              <Switch checked={!!form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={uploading || !form.nombre}>
            <MI icon="save" className="text-sm mr-1" />
            {data.id ? 'Guardar Cambios' : 'Crear premio'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminEspecialistaPremios;
