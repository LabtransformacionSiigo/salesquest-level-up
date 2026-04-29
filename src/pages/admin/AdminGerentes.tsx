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

const normalizeCelula = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');

const AdminGerentes = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [celulasDisponibles, setCelulasDisponibles] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', canal: 'VC', pais: 'MEX', activo: true, celula: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [filterCanal, setFilterCanal] = useState('TODOS');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupPlan, setCleanupPlan] = useState<any | null>(null);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [repairingEspecialistas, setRepairingEspecialistas] = useState(false);

  const repararAcceso = async (g: any) => {
    if (!g?.email) {
      toast({ title: 'Sin email', description: 'Este gerente no tiene email configurado', variant: 'destructive' });
      return;
    }
    if (!confirm(`Reparar acceso de ${g.nombre}?\n\nEmail: ${g.email}\nContraseña nueva: SiigoArena2026!\n\nEsto crea/sincroniza la cuenta auth, resetea la contraseña y vincula el gerente correcto.`)) return;
    setRepairingId(g.id);
    try {
      const { data, error } = await supabase.functions.invoke('fix-account-access', {
        body: { email: g.email, password: 'SiigoArena2026!' },
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      const r = data?.results?.[0];
      if (r?.status === 'ok') {
        toast({ title: '✅ Acceso reparado', description: `${g.nombre} puede iniciar sesión con SiigoArena2026!` });
        fetchGerentes();
      } else {
        toast({ title: 'Error', description: r?.error || 'No se pudo reparar', variant: 'destructive' });
      }
    } finally {
      setRepairingId(null);
    }
  };

  const repararEspecialistas = async () => {
    if (repairingEspecialistas) return;
    if (!confirm('Reparar el acceso de TODOS los especialistas?\n\nSe resetea la contraseña a SiigoArena2026! para todas las cuentas con rol especialista.')) return;
    setRepairingEspecialistas(true);
    try {
      const { data, error } = await supabase.functions.invoke('fix-account-access', {
        body: { mode: 'especialistas', password: 'SiigoArena2026!' },
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({
        title: '✅ Especialistas reparados',
        description: `${data?.ok ?? 0} ok · ${data?.errors ?? 0} errores · contraseña: SiigoArena2026!`,
      });
    } finally {
      setRepairingEspecialistas(false);
    }
  };


  const isAdmin = profile?.role === 'admin';

  const sincronizarTodasLasCuentas = async () => {
    if (syncRunning) return;
    if (!confirm('¿Sincronizar TODAS las cuentas auth con la tabla de gerentes? Procesará en lotes y puede tardar varios minutos. Resetea la contraseña a SiigoArena2026!')) return;
    setSyncRunning(true);
    setSyncResult(null);
    try {
      let offset = 0;
      const limit = 100;
      let creados = 0, actualizados = 0, errores = 0, total = 0;
      const errorSamples: any[] = [];
      let safety = 0;
      while (safety++ < 200) {
        setSyncResult({ status: `Procesando lote desde ${offset}...`, total, creados, actualizados, errores });
        const { data, error } = await supabase.functions.invoke(
          'normalize-gerentes-emails',
          { body: { offset, limit } },
        );
        if (error) {
          toast({ title: 'Error en lote', description: `${error.message} (offset ${offset})`, variant: 'destructive' });
          break;
        }
        creados += data?.creados ?? 0;
        actualizados += data?.actualizados ?? 0;
        errores += data?.errores ?? 0;
        total = data?.total ?? total;
        if (Array.isArray(data?.errorSamples)) errorSamples.push(...data.errorSamples);
        if (data?.done || data?.nextOffset == null) break;
        offset = data.nextOffset;
      }
      setSyncResult({ total, creados, actualizados, errores, errorSamples: errorSamples.slice(0, 20) });
      toast({
        title: '✅ Sincronización completada',
        description: `Total: ${total} · Creados: ${creados} · Actualizados: ${actualizados} · Errores: ${errores}`,
      });
      fetchGerentes();
    } finally {
      setSyncRunning(false);
    }
  };

  const previewLimpiezaDuplicados = async () => {
    if (cleanupRunning) return;
    setCleanupRunning(true);
    setCleanupPlan(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        'cleanup-duplicated-gerentes',
        { body: { dryRun: true } },
      );
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setCleanupPlan(data);
      toast({ title: 'Plan generado', description: `${data?.renamed ?? 0} a renombrar · ${(data?.log ?? []).filter((l: any) => l.op === 'delete').length} a borrar` });
    } finally {
      setCleanupRunning(false);
    }
  };

  const ejecutarLimpiezaDuplicados = async () => {
    if (cleanupRunning) return;
    if (!confirm('¿Confirmas borrar los duplicados y sus cuentas auth? Esta acción es irreversible.')) return;
    setCleanupRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'cleanup-duplicated-gerentes',
        { body: {} },
      );
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({
        title: '✅ Limpieza ejecutada',
        description: `${data?.renamed ?? 0} renombrados · ${data?.deletedGerentes ?? 0} borrados · ${data?.deletedAuth ?? 0} auth eliminados`,
      });
      setCleanupPlan(null);
      fetchGerentes();
    } finally {
      setCleanupRunning(false);
    }
  };

  const crearCuentasFaltantes = async () => {
    if (bulkRunning) return;
    setBulkRunning(true);
    let total = 0;
    let totalLinked = 0;
    let totalErrors = 0;
    let offset = 0;
    const batchSize = 200;
    try {
      while (true) {
        setBulkStatus(`Procesando lote desde ${offset}…`);
        const { data, error } = await supabase.functions.invoke(
          'create-missing-gerente-accounts',
          { body: { offset, limit: batchSize, password: 'SiigoArena2026!' } },
        );
        if (error) {
          setBulkStatus(`❌ Error en lote ${offset}: ${error.message}`);
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          break;
        }
        const created = Number(data?.created ?? 0);
        const linked = Number(data?.linked_existing ?? 0);
        const errs = Number(data?.errors ?? 0);
        const processed = Number(data?.total_processed ?? 0);
        total += created;
        totalLinked += linked;
        totalErrors += errs;
        setBulkStatus(`✅ Lote ${offset}: +${created} creados, +${linked} vinculados, ${errs} errores. Total creados: ${total}`);
        if (processed < batchSize) break;
        offset += batchSize;
        await new Promise((r) => setTimeout(r, 1500));
      }
      setBulkStatus(`✅ Completado · ${total} creadas · ${totalLinked} vinculadas · ${totalErrors} errores`);
      toast({ title: 'Cuentas creadas', description: `${total} nuevas, ${totalLinked} vinculadas, ${totalErrors} errores` });
      fetchGerentes();
    } finally {
      setBulkRunning(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchGerentes();
  }, [isAuthenticated]);

  const fetchGerentes = async () => {
    const [gerentesRes, metasRes, productividadRes] = await Promise.all([
      supabase.from('gerentes').select('*').order('nombre'),
      supabase.from('metas_acv_gerentes' as any).select('celula').limit(5000),
      supabase.from('productividad_asesores').select('celula').limit(5000),
    ]);
    const allCelulas = [
      ...((gerentesRes.data || []).map((g: any) => g.celula)),
      ...(((metasRes.data as any[]) || []).map((r: any) => r.celula)),
      ...((productividadRes.data || []).map((r: any) => r.celula)),
    ];
    setGerentes(gerentesRes.data || []);
    setCelulasDisponibles([...new Set(allCelulas.map(normalizeCelula).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
    setDataLoading(false);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.email.trim()) {
      toast({ title: 'Campos requeridos', description: 'Nombre y email son obligatorios', variant: 'destructive' });
      return;
    }
    const payload = { ...form, celula: normalizeCelula(form.celula) || null };
    if (editing) {
      const { error } = await supabase.from('gerentes').update(payload).eq('id', editing);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Gerente actualizado ✅' });
    } else {
      const { error } = await supabase.from('gerentes').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Gerente creado ✅' });
    }
    setEditing(null);
    setShowAdd(false);
    fetchGerentes();
  };

  const startEdit = (g: any) => {
    setEditing(g.id);
    setForm({ nombre: g.nombre, email: g.email, canal: g.canal || 'VC', pais: g.pais || 'MEX', activo: g.activo ?? true, celula: g.celula || '' });
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={sincronizarTodasLasCuentas} disabled={syncRunning}>
              <MI icon="sync" className="text-sm mr-1" />
              {syncRunning ? 'Sincronizando…' : 'Sincronizar TODAS las cuentas'}
            </Button>
            <Button variant="outline" onClick={previewLimpiezaDuplicados} disabled={cleanupRunning}>
              <MI icon="cleaning_services" className="text-sm mr-1" />
              {cleanupRunning ? 'Procesando…' : 'Ejecutar limpieza duplicados'}
            </Button>
            <Button variant="outline" onClick={crearCuentasFaltantes} disabled={bulkRunning}>
              <MI icon="how_to_reg" className="text-sm mr-1" />
              {bulkRunning ? 'Creando…' : 'Crear cuentas faltantes'}
            </Button>
            <Button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ nombre: '', email: '', canal: 'VC', pais: 'MEX', activo: true, celula: '' }); }}>
              <MI icon="person_add" className="text-sm mr-1" /> Nuevo Gerente
            </Button>
          </div>
        </div>

        {syncResult && (
          <div className="text-xs bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
            <span className="font-semibold text-foreground">🔄 Sincronización:</span>
            <span className="text-muted-foreground">Total: <span className="text-foreground font-semibold">{syncResult.total ?? 0}</span></span>
            <span className="text-muted-foreground">Creados: <span className="text-secondary font-semibold">{syncResult.creados ?? 0}</span></span>
            <span className="text-muted-foreground">Actualizados: <span className="text-primary font-semibold">{syncResult.actualizados ?? 0}</span></span>
            <span className="text-muted-foreground">Errores: <span className={cn("font-semibold", (syncResult.errores ?? 0) > 0 ? "text-destructive" : "text-foreground")}>{syncResult.errores ?? 0}</span></span>
            <button onClick={() => setSyncResult(null)} className="ml-auto text-muted-foreground hover:text-foreground">
              <MI icon="close" className="text-base" />
            </button>
          </div>
        )}

        {bulkStatus && (
          <div className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2">
            {bulkStatus}
          </div>
        )}

        {cleanupPlan && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MI icon="preview" className="text-primary text-base" />
                Plan de limpieza (sin ejecutar)
              </h3>
              <button onClick={() => setCleanupPlan(null)} className="text-muted-foreground hover:text-foreground">
                <MI icon="close" className="text-lg" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="font-semibold text-foreground mb-1">✏️ Renombres ({cleanupPlan.renamed ?? 0})</div>
                <ul className="space-y-1 text-muted-foreground">
                  {(cleanupPlan.log ?? []).filter((l: any) => l.op === 'rename').map((l: any, i: number) => (
                    <li key={i} className="truncate"><span className="text-foreground">{l.from}</span> → <span className="text-primary">{l.to}</span></li>
                  ))}
                </ul>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="font-semibold text-foreground mb-1">🗑️ Borrados ({(cleanupPlan.log ?? []).filter((l: any) => l.op === 'delete').length})</div>
                <ul className="space-y-1 text-muted-foreground max-h-48 overflow-y-auto">
                  {(cleanupPlan.log ?? []).filter((l: any) => l.op === 'delete').map((l: any, i: number) => (
                    <li key={i} className="truncate">{l.email} {l.user_id && <span className="text-destructive">+ auth</span>}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setCleanupPlan(null)}>Cancelar</Button>
              <Button onClick={ejecutarLimpiezaDuplicados} disabled={cleanupRunning}>
                {cleanupRunning ? 'Ejecutando…' : 'Confirmar y ejecutar'}
              </Button>
            </div>
          </div>
        )}

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
                {editing ? 'Editar Gerente' : 'Registrar Nuevo Gerente'}
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
              <Field label="Célula / Equipo">
                <input value={form.celula} onChange={e => setForm(f => ({ ...f, celula: e.target.value }))} list="celulas-disponibles" placeholder="Selecciona una célula existente" className={inputClass} />
                <datalist id="celulas-disponibles">
                  {celulasDisponibles.map((celula) => <option key={celula} value={celula} />)}
                </datalist>
              </Field>
              <div className="flex items-end">
                <label className="flex items-center gap-2.5 h-10 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                  <span className="font-medium text-foreground">Gerente activo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? 'Guardar Cambios' : 'Crear Gerente'}</Button>
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
                  <th className="text-left px-4 py-3">Gerente</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Canal</th>
                  <th className="text-left px-4 py-3">País</th>
                  <th className="text-left px-4 py-3">Célula</th>
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
                    <td className="px-4 py-3 text-sm">{({'COL':'🇨🇴','MEX':'🇲🇽','ECU':'🇪🇨'} as any)[g.pais] || '🌎'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{g.celula || '—'}</td>
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
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Sin gerentes registrados</td></tr>
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
