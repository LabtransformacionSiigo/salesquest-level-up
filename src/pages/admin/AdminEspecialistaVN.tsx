import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const inputClass =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const TogglePill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-background text-muted-foreground border-border hover:border-primary/50',
    )}
  >
    {children}
  </button>
);

const CANALES_VN = ['VN_EMPRESARIOS', 'VN_ALIADOS'] as const;
const PAISES_VN = ['COL', 'ECU'] as const;

const COND_OPTIONS: { value: string; label: string; needsValor: boolean }[] = [
  { value: 'racha_diaria_activada', label: '🔥 Activar racha diaria por primera vez', needsValor: false },
  { value: 'racha_semanal_activada', label: '⚡ Activar racha semanal por primera vez', needsValor: false },
  { value: 'reto_diario_completado_n', label: '📅 Completar N veces el reto diario', needsValor: true },
  { value: 'reto_semanal_completado_n', label: '📆 Completar N semanas el reto semanal', needsValor: true },
  { value: 'reto_mensual_completado', label: '🏆 Completar la Bota de Oro', needsValor: false },
  { value: 'cumplimiento_100_pct_mes', label: '🎯 ACV ≥ 100% de meta en el mes', needsValor: false },
];

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ───────────────────────── TAB RETOS ─────────────────────────
const RetosTab = () => {
  const { toast } = useToast();
  const [retos, setRetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    tipo: 'DIARIO',
    kpi: 'NUBES',
    canal: [] as string[],
    paises: [] as string[],
    sp_base: 2,
    sp_semanal_sem1: 7,
    sp_semanal_sem2: 7,
    sp_semanal_sem3: 5,
    sp_semanal_sem4: 5,
    acumular_finde_al_viernes: true,
    fecha_inicio: '',
    fecha_fin: '',
  });

  const fetchRetos = async () => {
    setLoading(true);
    const { data } = await supabase.from('retos_vn_config').select('*').order('created_at', { ascending: false });
    setRetos(data ?? []);
    setLoading(false);
  };
  useEffect(() => { fetchRetos(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      nombre: '', tipo: 'DIARIO', kpi: 'NUBES', canal: [], paises: [],
      sp_base: 2, sp_semanal_sem1: 7, sp_semanal_sem2: 7, sp_semanal_sem3: 5, sp_semanal_sem4: 5,
      acumular_finde_al_viernes: true, fecha_inicio: '', fecha_fin: '',
    });
  };

  const handleTipoChange = (tipo: string) => {
    setForm((f) => ({ ...f, tipo, kpi: tipo === 'DIARIO' ? 'NUBES' : 'ACV' }));
  };

  const toggleArr = (key: 'canal' | 'paises', value: string) => {
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));
  };

  const handleSave = async () => {
    if (!form.nombre || !form.fecha_inicio || !form.fecha_fin || form.canal.length === 0 || form.paises.length === 0) {
      toast({ title: 'Faltan campos', description: 'Nombre, canal, países y fechas son obligatorios', variant: 'destructive' });
      return;
    }
    const payload = { ...form };
    const { error } = editingId
      ? await supabase.from('retos_vn_config').update(payload).eq('id', editingId)
      : await supabase.from('retos_vn_config').insert(payload);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingId ? 'Reto actualizado' : 'Reto creado' });
    resetForm();
    fetchRetos();
  };

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      nombre: r.nombre, tipo: r.tipo, kpi: r.kpi,
      canal: r.canal ?? [], paises: r.paises ?? [],
      sp_base: r.sp_base, sp_semanal_sem1: r.sp_semanal_sem1, sp_semanal_sem2: r.sp_semanal_sem2,
      sp_semanal_sem3: r.sp_semanal_sem3, sp_semanal_sem4: r.sp_semanal_sem4,
      acumular_finde_al_viernes: r.acumular_finde_al_viernes,
      fecha_inicio: r.fecha_inicio, fecha_fin: r.fecha_fin,
    });
  };

  const handleToggle = async (r: any) => {
    await supabase.from('retos_vn_config').update({ activo: !r.activo }).eq('id', r.id);
    fetchRetos();
  };
  const handleDelete = async (r: any) => {
    if (!confirm(`¿Eliminar reto "${r.nombre}"?`)) return;
    await supabase.from('retos_vn_config').delete().eq('id', r.id);
    fetchRetos();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-bold text-foreground">{editingId ? 'Editar reto' : 'Nuevo reto VN'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre">
            <input className={inputClass} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <select className={inputClass} value={form.tipo} onChange={(e) => handleTipoChange(e.target.value)}>
              <option value="DIARIO">DIARIO — Golazo del Día</option>
              <option value="SEMANAL">SEMANAL — Jugada de la Semana</option>
              <option value="MENSUAL">MENSUAL — Bota de Oro</option>
            </select>
          </Field>
          <Field label="KPI (auto)" hint="DIARIO usa NUBES; SEMANAL/MENSUAL usan ACV">
            <input className={inputClass} value={form.kpi} readOnly />
          </Field>
          <Field label="Canal">
            <div className="flex gap-2 flex-wrap">
              {CANALES_VN.map((c) => (
                <TogglePill key={c} active={form.canal.includes(c)} onClick={() => toggleArr('canal', c)}>{c}</TogglePill>
              ))}
            </div>
          </Field>
          <Field label="Países">
            <div className="flex gap-2 flex-wrap">
              {PAISES_VN.map((p) => (
                <TogglePill key={p} active={form.paises.includes(p)} onClick={() => toggleArr('paises', p)}>{p}</TogglePill>
              ))}
            </div>
          </Field>
          {form.tipo !== 'SEMANAL' && (
            <Field label="SP base">
              <input type="number" className={inputClass} value={form.sp_base} onChange={(e) => setForm({ ...form, sp_base: Number(e.target.value) })} />
            </Field>
          )}
          {form.tipo === 'SEMANAL' && (
            <div className="md:col-span-2 grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((n) => (
                <Field key={n} label={`SP S${n}`}>
                  <input
                    type="number"
                    className={inputClass}
                    value={(form as any)[`sp_semanal_sem${n}`]}
                    onChange={(e) => setForm({ ...form, [`sp_semanal_sem${n}`]: Number(e.target.value) } as any)}
                  />
                </Field>
              ))}
            </div>
          )}
          {form.tipo === 'DIARIO' && (
            <div className="md:col-span-2 flex items-center gap-3 bg-muted/40 p-3 rounded-lg">
              <Switch checked={form.acumular_finde_al_viernes} onCheckedChange={(v) => setForm({ ...form, acumular_finde_al_viernes: v })} />
              <div className="text-xs">
                <p className="font-semibold">Acumular finde al viernes</p>
                <p className="text-muted-foreground">Ventas del sábado y domingo se suman al viernes anterior.</p>
              </div>
            </div>
          )}
          <Field label="Fecha inicio">
            <input type="date" className={inputClass} value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
          </Field>
          <Field label="Fecha fin">
            <input type="date" className={inputClass} value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave}>{editingId ? 'Actualizar' : 'Crear reto'}</Button>
          {editingId && <Button variant="outline" onClick={resetForm}>Cancelar</Button>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-bold">Retos configurados</div>
        {loading ? <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Nombre</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">KPI</th>
                  <th className="text-left p-3">Canal</th>
                  <th className="text-left p-3">Países</th>
                  <th className="text-left p-3">SP</th>
                  <th className="text-left p-3">Vigencia</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {retos.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 font-semibold">{r.nombre}</td>
                    <td className="p-3">{r.tipo}</td>
                    <td className="p-3">{r.kpi}</td>
                    <td className="p-3 text-xs">{(r.canal ?? []).join(', ')}</td>
                    <td className="p-3 text-xs">{(r.paises ?? []).join(', ')}</td>
                    <td className="p-3">{r.tipo === 'SEMANAL' ? `${r.sp_semanal_sem1}/${r.sp_semanal_sem2}/${r.sp_semanal_sem3}/${r.sp_semanal_sem4}` : r.sp_base}</td>
                    <td className="p-3 text-xs">{r.fecha_inicio} → {r.fecha_fin}</td>
                    <td className="p-3"><Badge variant={r.activo ? 'default' : 'secondary'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                    <td className="p-3 flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleToggle(r)}>{r.activo ? 'Desactivar' : 'Activar'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r)}>🗑️</Button>
                    </td>
                  </tr>
                ))}
                {retos.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Sin retos configurados.</td></tr>}
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
};

// ───────────────────────── TAB RACHAS ─────────────────────────
const RachasTab = () => {
  const { toast } = useToast();
  const [rachas, setRachas] = useState<any[]>([]);
  const [retos, setRetos] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '', tipo: 'DIARIA',
    dias_consecutivos_requeridos: 3, multiplicador: 1.5,
    reto_ref_id: '', canal: [] as string[], paises: [] as string[],
    fecha_inicio: '', fecha_fin: '',
  });

  const fetchData = async () => {
    const [{ data: r }, { data: rr }] = await Promise.all([
      supabase.from('rachas_vn_config').select('*').order('created_at', { ascending: false }),
      supabase.from('retos_vn_config').select('id,nombre,tipo').eq('activo', true),
    ]);
    setRachas(r ?? []);
    setRetos(rr ?? []);
  };
  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ nombre: '', tipo: 'DIARIA', dias_consecutivos_requeridos: 3, multiplicador: 1.5, reto_ref_id: '', canal: [], paises: [], fecha_inicio: '', fecha_fin: '' });
  };

  const handleTipoChange = (tipo: string) => {
    setForm((f) => ({ ...f, tipo, dias_consecutivos_requeridos: tipo === 'DIARIA' ? 3 : 2, multiplicador: tipo === 'DIARIA' ? 1.5 : 2.0 }));
  };

  const toggleArr = (key: 'canal' | 'paises', value: string) => {
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));
  };

  const retosFiltrados = retos.filter((r) => (form.tipo === 'DIARIA' ? r.tipo === 'DIARIO' : r.tipo === 'SEMANAL'));

  const handleSave = async () => {
    if (!form.nombre || !form.fecha_inicio || !form.fecha_fin) {
      toast({ title: 'Faltan campos', variant: 'destructive' });
      return;
    }
    const payload = { ...form, reto_ref_id: form.reto_ref_id || null };
    const { error } = editingId
      ? await supabase.from('rachas_vn_config').update(payload).eq('id', editingId)
      : await supabase.from('rachas_vn_config').insert(payload);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingId ? 'Racha actualizada' : 'Racha creada' });
    resetForm(); fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-bold">{editingId ? 'Editar racha' : 'Nueva racha VN'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre"><input className={inputClass} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
          <Field label="Tipo">
            <select className={inputClass} value={form.tipo} onChange={(e) => handleTipoChange(e.target.value)}>
              <option value="DIARIA">DIARIA</option>
              <option value="SEMANAL">SEMANAL</option>
            </select>
          </Field>
          <Field label="Días/semanas consecutivos requeridos" hint="La racha activa el multiplicador al SUPERAR este valor (ej: 3 días → activa en el día 4).">
            <input type="number" className={inputClass} value={form.dias_consecutivos_requeridos} onChange={(e) => setForm({ ...form, dias_consecutivos_requeridos: Number(e.target.value) })} />
          </Field>
          <Field label="Multiplicador">
            <input type="number" step="0.1" className={inputClass} value={form.multiplicador} onChange={(e) => setForm({ ...form, multiplicador: Number(e.target.value) })} />
          </Field>
          <Field label="Reto vinculado">
            <select className={inputClass} value={form.reto_ref_id} onChange={(e) => setForm({ ...form, reto_ref_id: e.target.value })}>
              <option value="">— Ninguno —</option>
              {retosFiltrados.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </Field>
          <Field label="Canal">
            <div className="flex gap-2 flex-wrap">{CANALES_VN.map((c) => <TogglePill key={c} active={form.canal.includes(c)} onClick={() => toggleArr('canal', c)}>{c}</TogglePill>)}</div>
          </Field>
          <Field label="Países">
            <div className="flex gap-2 flex-wrap">{PAISES_VN.map((p) => <TogglePill key={p} active={form.paises.includes(p)} onClick={() => toggleArr('paises', p)}>{p}</TogglePill>)}</div>
          </Field>
          <Field label="Fecha inicio"><input type="date" className={inputClass} value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} /></Field>
          <Field label="Fecha fin"><input type="date" className={inputClass} value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} /></Field>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave}>{editingId ? 'Actualizar' : 'Crear racha'}</Button>
          {editingId && <Button variant="outline" onClick={resetForm}>Cancelar</Button>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-bold">Rachas configuradas</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr><th className="text-left p-3">Nombre</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Requeridos</th><th className="text-left p-3">Mult.</th><th className="text-left p-3">Canal</th><th className="text-left p-3">Países</th><th className="text-left p-3">Vigencia</th><th className="text-left p-3">Estado</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {rachas.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{r.nombre}</td>
                  <td className="p-3">{r.tipo}</td>
                  <td className="p-3">{r.dias_consecutivos_requeridos}</td>
                  <td className="p-3">x{r.multiplicador}</td>
                  <td className="p-3 text-xs">{(r.canal ?? []).join(', ')}</td>
                  <td className="p-3 text-xs">{(r.paises ?? []).join(', ')}</td>
                  <td className="p-3 text-xs">{r.fecha_inicio} → {r.fecha_fin}</td>
                  <td className="p-3"><Badge variant={r.activo ? 'default' : 'secondary'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="p-3 flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(r.id); setForm({ nombre: r.nombre, tipo: r.tipo, dias_consecutivos_requeridos: r.dias_consecutivos_requeridos, multiplicador: r.multiplicador, reto_ref_id: r.reto_ref_id ?? '', canal: r.canal ?? [], paises: r.paises ?? [], fecha_inicio: r.fecha_inicio, fecha_fin: r.fecha_fin }); }}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={async () => { await supabase.from('rachas_vn_config').update({ activo: !r.activo }).eq('id', r.id); fetchData(); }}>{r.activo ? 'Desactivar' : 'Activar'}</Button>
                  </td>
                </tr>
              ))}
              {rachas.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Sin rachas configuradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────── TAB MEDALLAS ─────────────────────────
const MedallasTab = () => {
  const { toast } = useToast();
  const [medallas, setMedallas] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '', descripcion: '', emoji: '🏅',
    condicion_tipo: 'racha_diaria_activada', condicion_valor: 1,
    sp_reward: 5, canal: [] as string[], paises: [] as string[],
  });

  const fetchM = async () => {
    const { data } = await supabase.from('medallas_vn_config').select('*').order('created_at', { ascending: false });
    setMedallas(data ?? []);
  };
  useEffect(() => { fetchM(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ nombre: '', descripcion: '', emoji: '🏅', condicion_tipo: 'racha_diaria_activada', condicion_valor: 1, sp_reward: 5, canal: [], paises: [] });
  };

  const toggleArr = (key: 'canal' | 'paises', value: string) => {
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));
  };

  const condCfg = COND_OPTIONS.find((o) => o.value === form.condicion_tipo);

  const handleSave = async () => {
    if (!form.nombre) { toast({ title: 'Nombre obligatorio', variant: 'destructive' }); return; }
    const { error } = editingId
      ? await supabase.from('medallas_vn_config').update(form).eq('id', editingId)
      : await supabase.from('medallas_vn_config').insert(form);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingId ? 'Medalla actualizada' : 'Medalla creada' });
    resetForm(); fetchM();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-bold">{editingId ? 'Editar medalla' : 'Nueva medalla VN'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre"><input className={inputClass} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
          <Field label="Emoji"><input className={inputClass} value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} /></Field>
          <Field label="Descripción"><input className={inputClass} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Field>
          <Field label="Condición">
            <select className={inputClass} value={form.condicion_tipo} onChange={(e) => setForm({ ...form, condicion_tipo: e.target.value })}>
              {COND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          {condCfg?.needsValor && (
            <Field label="N (cantidad requerida)">
              <input type="number" className={inputClass} value={form.condicion_valor} onChange={(e) => setForm({ ...form, condicion_valor: Number(e.target.value) })} />
            </Field>
          )}
          <Field label="SP Reward"><input type="number" className={inputClass} value={form.sp_reward} onChange={(e) => setForm({ ...form, sp_reward: Number(e.target.value) })} /></Field>
          <Field label="Canal">
            <div className="flex gap-2 flex-wrap">{CANALES_VN.map((c) => <TogglePill key={c} active={form.canal.includes(c)} onClick={() => toggleArr('canal', c)}>{c}</TogglePill>)}</div>
          </Field>
          <Field label="Países">
            <div className="flex gap-2 flex-wrap">{PAISES_VN.map((p) => <TogglePill key={p} active={form.paises.includes(p)} onClick={() => toggleArr('paises', p)}>{p}</TogglePill>)}</div>
          </Field>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave}>{editingId ? 'Actualizar' : 'Crear medalla'}</Button>
          {editingId && <Button variant="outline" onClick={resetForm}>Cancelar</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {medallas.map((m) => (
          <div key={m.id} className="rounded-xl border border-border bg-card p-4 flex gap-3">
            <div className="text-4xl">{m.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-bold truncate">{m.nombre}</p>
                <Badge variant={m.activo ? 'default' : 'secondary'}>{m.activo ? 'On' : 'Off'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{m.descripcion}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{COND_OPTIONS.find((o) => o.value === m.condicion_tipo)?.label}</p>
              <p className="text-xs font-bold text-primary mt-1">+{m.sp_reward} SP</p>
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditingId(m.id); setForm({ nombre: m.nombre, descripcion: m.descripcion ?? '', emoji: m.emoji, condicion_tipo: m.condicion_tipo, condicion_valor: m.condicion_valor, sp_reward: m.sp_reward, canal: m.canal ?? [], paises: m.paises ?? [] }); }}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await supabase.from('medallas_vn_config').update({ activo: !m.activo }).eq('id', m.id); fetchM(); }}>{m.activo ? 'Desactivar' : 'Activar'}</Button>
              </div>
            </div>
          </div>
        ))}
        {medallas.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-6">Sin medallas configuradas.</p>}
      </div>
    </div>
  );
};

// ───────────────────────── TAB METAS NUBES ─────────────────────────
const MetasNubesTab = () => {
  const { toast } = useToast();
  const [mes, setMes] = useState(currentMonth());
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: g } = await supabase.from('gerentes').select('id,nombre,pais,canal')
      .in('canal', ['VN_EMPRESARIOS', 'VN_ALIADOS']).in('pais', ['COL', 'ECU']).eq('activo', true).order('pais').order('nombre');
    const { data: m } = await supabase.from('metas_nubes_mensuales').select('gerente_id,meta_nubes').eq('anio_mes', mes);
    setGerentes(g ?? []);
    const map: Record<string, number> = {};
    (m ?? []).forEach((row: any) => { map[row.gerente_id] = row.meta_nubes; });
    setMetas(map);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, [mes]);

  const handleSave = async () => {
    const rows = gerentes.map((g) => ({ gerente_id: g.id, anio_mes: mes, pais: g.pais, meta_nubes: metas[g.id] ?? 0 }));
    const { error } = await supabase.from('metas_nubes_mensuales').upsert(rows, { onConflict: 'gerente_id,anio_mes' });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Metas guardadas' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <Field label="Mes"><input type="month" className={inputClass} value={mes} onChange={(e) => setMes(e.target.value)} /></Field>
        <Button onClick={handleSave}>Guardar metas</Button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> :
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase"><tr><th className="text-left p-3">Gerente</th><th className="text-left p-3">País</th><th className="text-left p-3">Canal</th><th className="text-left p-3">Meta nubes/mes</th></tr></thead>
            <tbody>
              {gerentes.map((g) => (
                <tr key={g.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{g.nombre}</td>
                  <td className="p-3">{g.pais}</td>
                  <td className="p-3 text-xs">{g.canal}</td>
                  <td className="p-3">
                    <input type="number" className={cn(inputClass, 'max-w-[140px]')} value={metas[g.id] ?? ''} onChange={(e) => setMetas({ ...metas, [g.id]: Number(e.target.value) })} />
                  </td>
                </tr>
              ))}
              {gerentes.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sin gerentes VN.</td></tr>}
            </tbody>
          </table>
        }
      </div>
    </div>
  );
};

// ───────────────────────── TAB CALENDARIO ─────────────────────────
const CalendarioTab = () => {
  const { toast } = useToast();
  const [mes, setMes] = useState(currentMonth());
  const [pais, setPais] = useState<'COL' | 'ECU'>('COL');
  const [diasHabiles, setDiasHabiles] = useState(20);
  const [festivos, setFestivos] = useState('');
  const [semanas, setSemanas] = useState<Array<{ numero: number; fecha_inicio: string; fecha_fin: string; sp: number }>>([
    { numero: 1, fecha_inicio: '', fecha_fin: '', sp: 7 },
    { numero: 2, fecha_inicio: '', fecha_fin: '', sp: 7 },
    { numero: 3, fecha_inicio: '', fecha_fin: '', sp: 5 },
    { numero: 4, fecha_inicio: '', fecha_fin: '', sp: 5 },
  ]);

  const fetchCfg = async () => {
    const { data } = await supabase.from('config_calendario_vn').select('*').eq('anio_mes', mes).eq('pais', pais).maybeSingle();
    if (data) {
      setDiasHabiles(data.dias_habiles);
      setFestivos((data.festivos ?? []).join('\n'));
      const sem = (data.semanas as any[]) ?? [];
      const filled = [1, 2, 3, 4].map((n) => sem.find((s) => s.numero === n) ?? { numero: n, fecha_inicio: '', fecha_fin: '', sp: n <= 2 ? 7 : 5 });
      setSemanas(filled);
    } else {
      setDiasHabiles(20); setFestivos('');
      setSemanas([
        { numero: 1, fecha_inicio: '', fecha_fin: '', sp: 7 },
        { numero: 2, fecha_inicio: '', fecha_fin: '', sp: 7 },
        { numero: 3, fecha_inicio: '', fecha_fin: '', sp: 5 },
        { numero: 4, fecha_inicio: '', fecha_fin: '', sp: 5 },
      ]);
    }
  };
  useEffect(() => { fetchCfg(); }, [mes, pais]);

  const handleSave = async () => {
    const festivosArr = festivos.split('\n').map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from('config_calendario_vn').upsert({
      anio_mes: mes, pais, dias_habiles: diasHabiles, festivos: festivosArr, semanas,
    }, { onConflict: 'anio_mes,pais' });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Calendario guardado' });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <Field label="Mes"><input type="month" className={inputClass} value={mes} onChange={(e) => setMes(e.target.value)} /></Field>
        <Field label="País">
          <select className={inputClass} value={pais} onChange={(e) => setPais(e.target.value as any)}>
            <option value="COL">COL</option><option value="ECU">ECU</option>
          </select>
        </Field>
        <Field label="Días hábiles"><input type="number" className={inputClass} value={diasHabiles} onChange={(e) => setDiasHabiles(Number(e.target.value))} /></Field>
      </div>
      <Field label="Festivos (uno por línea, YYYY-MM-DD)" hint="En estos días el reto diario no aplica.">
        <textarea className={cn(inputClass, 'h-24 py-2')} value={festivos} onChange={(e) => setFestivos(e.target.value)} />
      </Field>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase"><tr><th className="p-3 text-left">Semana</th><th className="p-3 text-left">Inicio</th><th className="p-3 text-left">Fin</th><th className="p-3 text-left">SP</th></tr></thead>
          <tbody>
            {semanas.map((s, idx) => (
              <tr key={s.numero} className="border-t border-border">
                <td className="p-3 font-semibold">S{s.numero}</td>
                <td className="p-3"><input type="date" className={inputClass} value={s.fecha_inicio} onChange={(e) => { const c = [...semanas]; c[idx] = { ...s, fecha_inicio: e.target.value }; setSemanas(c); }} /></td>
                <td className="p-3"><input type="date" className={inputClass} value={s.fecha_fin} onChange={(e) => { const c = [...semanas]; c[idx] = { ...s, fecha_fin: e.target.value }; setSemanas(c); }} /></td>
                <td className="p-3"><input type="number" className={cn(inputClass, 'max-w-[120px]')} value={s.sp} onChange={(e) => { const c = [...semanas]; c[idx] = { ...s, sp: Number(e.target.value) }; setSemanas(c); }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button onClick={handleSave}>Guardar calendario</Button>
    </div>
  );
};

// ───────────────────────── TAB EVALUACIÓN ─────────────────────────
const EvaluacionTab = () => {
  const { toast } = useToast();
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [dryRun, setDryRun] = useState(true);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);

  const handleEjecutar = async () => {
    setEjecutando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluar-retos-vn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ fecha, dry_run: dryRun }),
      });
      const json = await res.json();
      if (json.ok) {
        setResultados(json.resultados ?? []);
        toast({ title: dryRun ? '✅ Simulación completada' : '✅ Evaluación completada', description: `${json.evaluados} evaluados` });
      } else {
        toast({ title: 'Error', description: json.error ?? 'Falló la evaluación', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setEjecutando(false); }
  };

  const cumplidos = resultados.filter((r) => r.cumple === true).length;
  const noCumplidos = resultados.filter((r) => r.cumple === false).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Field label="Fecha a evaluar"><input type="date" className={inputClass} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
          <div className="flex items-center gap-3 bg-muted/40 rounded-lg p-3">
            <Switch checked={dryRun} onCheckedChange={setDryRun} />
            <div className="text-xs">
              <p className="font-semibold">Modo simulación (dry_run)</p>
              <p className="text-muted-foreground">No guarda nada.</p>
            </div>
          </div>
          <div>
            {dryRun
              ? <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/40">⚠️ Simulación — no guarda nada</Badge>
              : <Badge className="bg-green-500/20 text-green-700 border-green-500/40">✅ Evaluación real</Badge>}
          </div>
        </div>
        <Button onClick={handleEjecutar} disabled={ejecutando}>{ejecutando ? 'Ejecutando…' : 'Ejecutar'}</Button>
      </div>

      {resultados.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-3 border-b border-border text-sm font-bold">{cumplidos} cumplidos · {noCumplidos} no cumplidos · {resultados.length} total</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr><th className="p-2 text-left">Gerente</th><th className="p-2 text-left">País</th><th className="p-2 text-left">Reto</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-left">Período</th><th className="p-2 text-left">Cumple</th><th className="p-2 text-left">%</th><th className="p-2 text-left">SP base</th><th className="p-2 text-left">SP racha</th></tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={i} className={cn('border-t border-border', r.cumple === true ? 'bg-green-500/5' : r.cumple === false ? 'bg-red-500/5' : '')}>
                    <td className="p-2">{r.gerente}</td>
                    <td className="p-2">{r.pais}</td>
                    <td className="p-2">{r.reto}</td>
                    <td className="p-2">{r.tipo}</td>
                    <td className="p-2 text-xs">{r.fecha ?? (r.semana ? `S${r.semana}` : r.mes) ?? r.resultado}</td>
                    <td className="p-2">{r.cumple === true ? '✅' : r.cumple === false ? '❌' : '—'}</td>
                    <td className="p-2">{r.pct ?? '—'}</td>
                    <td className="p-2">{r.spBase ?? r.sp ?? '—'}</td>
                    <td className="p-2">{r.spConRacha ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminEspecialistaVN = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 rounded-full border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.role !== 'admin' && profile?.role !== 'especialista') return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="Gamificación VN">
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-bold">🎯 Gamificación VN</h1>
          <p className="text-sm text-muted-foreground">Retos, rachas, medallas y calendario para canal Venta Nueva (COL/ECU).</p>
        </header>
        <Tabs defaultValue="retos">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="retos">📅 Retos</TabsTrigger>
            <TabsTrigger value="rachas">🔥 Rachas</TabsTrigger>
            <TabsTrigger value="medallas">🏅 Medallas</TabsTrigger>
            <TabsTrigger value="metas">🎯 Metas Nubes</TabsTrigger>
            <TabsTrigger value="calendario">📆 Calendario</TabsTrigger>
            <TabsTrigger value="evaluacion">⚙️ Evaluación</TabsTrigger>
          </TabsList>
          <TabsContent value="retos"><RetosTab /></TabsContent>
          <TabsContent value="rachas"><RachasTab /></TabsContent>
          <TabsContent value="medallas"><MedallasTab /></TabsContent>
          <TabsContent value="metas"><MetasNubesTab /></TabsContent>
          <TabsContent value="calendario"><CalendarioTab /></TabsContent>
          <TabsContent value="evaluacion"><EvaluacionTab /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminEspecialistaVN;
