import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn('material-icons-outlined', className)}>{icon}</span>
);

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const inputClass =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

const CANALES = ['VN_EMPRESARIOS', 'VN_ALIADOS'];
const PAISES  = ['COL', 'ECU'];

const CONDICION_LABELS: Record<string, string> = {
  racha_diaria_activada:     '🔥 Activar racha diaria por primera vez',
  racha_semanal_activada:    '⚡ Activar racha semanal por primera vez',
  reto_diario_completado_n:  '📅 Completar N veces el reto diario',
  reto_semanal_completado_n: '📆 Completar N semanas el reto semanal',
  reto_mensual_completado:   '🏆 Completar el reto mensual (Bota de Oro)',
  cumplimiento_100_pct_mes:  '🎯 ACV ≥ 100 % de meta en el mes',
};

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface RetoVN {
  id: string;
  nombre: string;
  tipo: 'DIARIO' | 'SEMANAL' | 'MENSUAL';
  kpi: 'NUBES' | 'ACV';
  canal: string[];
  paises: string[];
  sp_base: number;
  sp_semanal_sem1: number;
  sp_semanal_sem2: number;
  sp_semanal_sem3: number;
  sp_semanal_sem4: number;
  acumular_finde_al_viernes: boolean;
  activo: boolean;
  fecha_inicio: string;
  fecha_fin: string;
}

interface RachaVN {
  id: string;
  nombre: string;
  tipo: 'DIARIA' | 'SEMANAL';
  dias_consecutivos_requeridos: number;
  multiplicador: number;
  reto_ref_id: string | null;
  canal: string[];
  paises: string[];
  activo: boolean;
  fecha_inicio: string;
  fecha_fin: string;
}

interface MedallaVN {
  id: string;
  nombre: string;
  descripcion: string;
  emoji: string;
  condicion_tipo: string;
  condicion_valor: number;
  sp_reward: number;
  canal: string[];
  paises: string[];
  activo: boolean;
}

interface CalendarioVN {
  id?: string;
  anio_mes: string;
  pais: string;
  dias_habiles: number;
  festivos: string[];
  semanas: { numero: number; fecha_inicio: string; fecha_fin: string; sp: number }[];
}

interface MetaNubesRow {
  gerente_id: string;
  gerente_nombre: string;
  pais: string;
  meta_nubes: number;
}

// ── Blanco de formularios ─────────────────────────────────────────────────────
const RETO_BLANK: Omit<RetoVN, 'id'> = {
  nombre: '', tipo: 'DIARIO', kpi: 'NUBES',
  canal: ['VN_EMPRESARIOS', 'VN_ALIADOS'],
  paises: ['COL', 'ECU'],
  sp_base: 2, sp_semanal_sem1: 7, sp_semanal_sem2: 7, sp_semanal_sem3: 5, sp_semanal_sem4: 5,
  acumular_finde_al_viernes: true, activo: true,
  fecha_inicio: '', fecha_fin: '',
};

const RACHA_BLANK: Omit<RachaVN, 'id'> = {
  nombre: '', tipo: 'DIARIA',
  dias_consecutivos_requeridos: 3,
  multiplicador: 1.5,
  reto_ref_id: null,
  canal: ['VN_EMPRESARIOS', 'VN_ALIADOS'],
  paises: ['COL', 'ECU'],
  activo: true,
  fecha_inicio: '', fecha_fin: '',
};

const MEDALLA_BLANK: Omit<MedallaVN, 'id'> = {
  nombre: '', descripcion: '', emoji: '🏅',
  condicion_tipo: 'reto_diario_completado_n',
  condicion_valor: 1, sp_reward: 5,
  canal: ['VN_EMPRESARIOS', 'VN_ALIADOS'],
  paises: ['COL', 'ECU'],
  activo: true,
};

// ── Componente principal ──────────────────────────────────────────────────────
const AdminEspecialistaVN = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();

  const isAdmin       = profile?.role === 'admin';
  const isEspecialista = profile?.role === 'especialista';

  // ── Estado ────────────────────────────────────────────────────────────────
  const [retos,    setRetos]    = useState<RetoVN[]>([]);
  const [rachas,   setRachas]   = useState<RachaVN[]>([]);
  const [medallas, setMedallas] = useState<MedallaVN[]>([]);
  const [calendarios, setCalendarios] = useState<CalendarioVN[]>([]);
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [metasNubes, setMetasNubes] = useState<MetaNubesRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Formularios
  const [retoForm,    setRetoForm]    = useState<Omit<RetoVN, 'id'>>(RETO_BLANK);
  const [rachaForm,   setRachaForm]   = useState<Omit<RachaVN, 'id'>>(RACHA_BLANK);
  const [medallaForm, setMedallaForm] = useState<Omit<MedallaVN, 'id'>>(MEDALLA_BLANK);
  const [editingRetoId,    setEditingRetoId]    = useState<string | null>(null);
  const [editingRachaId,   setEditingRachaId]   = useState<string | null>(null);
  const [editingMedallaId, setEditingMedallaId] = useState<string | null>(null);

  // Calendario edit
  const [calMesElegido, setCalMesElegido] = useState('2025-05');
  const [calPaisElegido, setCalPaisElegido] = useState('COL');
  const [calForm, setCalForm] = useState<CalendarioVN>({
    anio_mes: '2025-05', pais: 'COL', dias_habiles: 19, festivos: [],
    semanas: [
      { numero: 1, fecha_inicio: '', fecha_fin: '', sp: 7 },
      { numero: 2, fecha_inicio: '', fecha_fin: '', sp: 7 },
      { numero: 3, fecha_inicio: '', fecha_fin: '', sp: 5 },
      { numero: 4, fecha_inicio: '', fecha_fin: '', sp: 5 },
    ],
  });

  // Metas nubes
  const [metasMes, setMetasMes] = useState('2025-05');

  // Evaluación
  const [evalFecha, setEvalFecha]   = useState(new Date().toISOString().split('T')[0]);
  const [evalDryRun, setEvalDryRun] = useState(true);
  const [evalLoading, setEvalLoading]   = useState(false);
  const [evalResultados, setEvalResultados] = useState<any[]>([]);

  // ── Carga de datos ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setDataLoading(true);
    const [
      { data: r }, { data: ra }, { data: m }, { data: cal },
      { data: g },
    ] = await Promise.all([
      supabase.from('retos_vn_config').select('*').order('created_at', { ascending: false }),
      supabase.from('rachas_vn_config').select('*').order('created_at', { ascending: false }),
      supabase.from('medallas_vn_config').select('*').order('created_at', { ascending: false }),
      supabase.from('config_calendario_vn').select('*').order('anio_mes'),
      supabase.from('gerentes').select('id, nombre, pais, canal')
        .in('canal', ['VN_EMPRESARIOS', 'VN_ALIADOS'])
        .in('pais', ['COL', 'ECU'])
        .eq('activo', true)
        .order('nombre'),
    ]);
    setRetos((r ?? []) as RetoVN[]);
    setRachas((ra ?? []) as RachaVN[]);
    setMedallas((m ?? []) as MedallaVN[]);
    setCalendarios((cal ?? []) as CalendarioVN[]);
    setGerentes(g ?? []);
    setDataLoading(false);
  }, []);

  const loadMetasNubes = useCallback(async (mes: string) => {
    const { data: g } = await supabase
      .from('gerentes').select('id, nombre, pais')
      .in('canal', ['VN_EMPRESARIOS', 'VN_ALIADOS'])
      .in('pais', ['COL', 'ECU']).eq('activo', true).order('nombre');
    const gerentesArr = g ?? [];
    const { data: metas } = await supabase
      .from('metas_nubes_mensuales')
      .select('gerente_id, meta_nubes')
      .eq('anio_mes', mes);
    const metasMap = new Map((metas ?? []).map((m: any) => [m.gerente_id, m.meta_nubes]));
    setMetasNubes(gerentesArr.map((ger: any) => ({
      gerente_id: ger.id,
      gerente_nombre: ger.nombre,
      pais: ger.pais,
      meta_nubes: metasMap.get(ger.id) ?? 0,
    })));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isEspecialista)) return;
    loadAll();
  }, [isAuthenticated, isAdmin, isEspecialista, loadAll]);

  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isEspecialista)) return;
    loadMetasNubes(metasMes);
  }, [metasMes, isAuthenticated, isAdmin, isEspecialista, loadMetasNubes]);

  // ── Sincronizar form de calendario al cambiar selección ──────────────────
  useEffect(() => {
    const existing = calendarios.find(
      (c) => c.anio_mes === calMesElegido && c.pais === calPaisElegido,
    );
    if (existing) {
      setCalForm({ ...existing });
    } else {
      setCalForm({
        anio_mes: calMesElegido, pais: calPaisElegido,
        dias_habiles: 20, festivos: [],
        semanas: [
          { numero: 1, fecha_inicio: '', fecha_fin: '', sp: 7 },
          { numero: 2, fecha_inicio: '', fecha_fin: '', sp: 7 },
          { numero: 3, fecha_inicio: '', fecha_fin: '', sp: 5 },
          { numero: 4, fecha_inicio: '', fecha_fin: '', sp: 5 },
        ],
      });
    }
  }, [calMesElegido, calPaisElegido, calendarios]);

  // ── Guardar reto ──────────────────────────────────────────────────────────
  const saveReto = async () => {
    if (!retoForm.nombre.trim() || !retoForm.fecha_inicio || !retoForm.fecha_fin) {
      toast({ title: 'Faltan campos', description: 'Nombre y fechas son obligatorios', variant: 'destructive' });
      return;
    }
    const payload = {
      ...retoForm,
      kpi: retoForm.tipo === 'DIARIO' ? 'NUBES' : 'ACV',
      updated_at: new Date().toISOString(),
    };
    const { error } = editingRetoId
      ? await supabase.from('retos_vn_config').update(payload).eq('id', editingRetoId)
      : await supabase.from('retos_vn_config').insert(payload);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingRetoId ? '✅ Reto actualizado' : '✅ Reto creado' });
    setRetoForm(RETO_BLANK);
    setEditingRetoId(null);
    loadAll();
  };

  const toggleRetoActivo = async (id: string, activo: boolean) => {
    await supabase.from('retos_vn_config').update({ activo: !activo }).eq('id', id);
    loadAll();
  };

  const deleteReto = async (id: string) => {
    if (!confirm('¿Eliminar este reto?')) return;
    await supabase.from('retos_vn_config').delete().eq('id', id);
    loadAll();
  };

  const editReto = (r: RetoVN) => {
    setRetoForm({ ...r });
    setEditingRetoId(r.id);
  };

  // ── Guardar racha ─────────────────────────────────────────────────────────
  const saveRacha = async () => {
    if (!rachaForm.nombre.trim() || !rachaForm.fecha_inicio || !rachaForm.fecha_fin) {
      toast({ title: 'Faltan campos', description: 'Nombre y fechas son obligatorios', variant: 'destructive' });
      return;
    }
    const payload = { ...rachaForm, updated_at: new Date().toISOString() };
    const { error } = editingRachaId
      ? await supabase.from('rachas_vn_config').update(payload).eq('id', editingRachaId)
      : await supabase.from('rachas_vn_config').insert(payload);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingRachaId ? '✅ Racha actualizada' : '✅ Racha creada' });
    setRachaForm(RACHA_BLANK);
    setEditingRachaId(null);
    loadAll();
  };

  const toggleRachaActiva = async (id: string, activo: boolean) => {
    await supabase.from('rachas_vn_config').update({ activo: !activo }).eq('id', id);
    loadAll();
  };

  const deleteRacha = async (id: string) => {
    if (!confirm('¿Eliminar esta racha?')) return;
    await supabase.from('rachas_vn_config').delete().eq('id', id);
    loadAll();
  };

  // ── Guardar medalla ───────────────────────────────────────────────────────
  const saveMedalla = async () => {
    if (!medallaForm.nombre.trim()) {
      toast({ title: 'Faltan campos', description: 'Nombre es obligatorio', variant: 'destructive' });
      return;
    }
    const payload = { ...medallaForm };
    const { error } = editingMedallaId
      ? await supabase.from('medallas_vn_config').update(payload).eq('id', editingMedallaId)
      : await supabase.from('medallas_vn_config').insert(payload);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingMedallaId ? '✅ Medalla actualizada' : '✅ Medalla creada' });
    setMedallaForm(MEDALLA_BLANK);
    setEditingMedallaId(null);
    loadAll();
  };

  const toggleMedallaActiva = async (id: string, activo: boolean) => {
    await supabase.from('medallas_vn_config').update({ activo: !activo }).eq('id', id);
    loadAll();
  };

  // ── Guardar calendario ────────────────────────────────────────────────────
  const saveCalendario = async () => {
    const payload = { ...calForm, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from('config_calendario_vn')
      .upsert(payload, { onConflict: 'anio_mes,pais' });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Calendario guardado' });
    loadAll();
  };

  // ── Guardar metas nubes ───────────────────────────────────────────────────
  const saveMetasNubes = async () => {
    const rows = metasNubes.map((m) => ({
      gerente_id: m.gerente_id, anio_mes: metasMes,
      meta_nubes: m.meta_nubes, pais: m.pais,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('metas_nubes_mensuales')
      .upsert(rows, { onConflict: 'gerente_id,anio_mes' });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Metas de nubes guardadas', description: `${rows.length} gerentes actualizados` });
  };

  // ── Ejecutar evaluación ───────────────────────────────────────────────────
  const ejecutarEvaluacion = async () => {
    setEvalLoading(true);
    setEvalResultados([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluar-retos-vn`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ fecha: evalFecha, dry_run: evalDryRun }),
        },
      );
      const result = await res.json();
      if (result.ok) {
        setEvalResultados(result.resultados ?? []);
        toast({
          title: evalDryRun ? '🔍 Simulación completada' : '✅ Evaluación completada',
          description: `${result.evaluados} evaluaciones procesadas`,
        });
      } else {
        toast({ title: '⚠️ Error en evaluación', description: result.error ?? JSON.stringify(result), variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error de conexión', description: e.message, variant: 'destructive' });
    } finally {
      setEvalLoading(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin && !isEspecialista) return <Navigate to="/dashboard" replace />;

  // ── Multi-select helper ───────────────────────────────────────────────────
  const toggleArr = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout title="Gamificación VN — Colombia & Ecuador">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <MI icon="emoji_events" className="text-primary text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gamificación VN</h1>
            <p className="text-sm text-muted-foreground">Colombia & Ecuador · Empresarios & Aliados</p>
          </div>
        </div>

        {dataLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <Tabs defaultValue="retos">
            <TabsList className="flex flex-wrap gap-1 h-auto p-1">
              <TabsTrigger value="retos">📅 Retos</TabsTrigger>
              <TabsTrigger value="rachas">🔥 Rachas</TabsTrigger>
              <TabsTrigger value="medallas">🏅 Medallas</TabsTrigger>
              <TabsTrigger value="metas">🎯 Metas Nubes</TabsTrigger>
              <TabsTrigger value="calendario">📆 Calendario</TabsTrigger>
              <TabsTrigger value="evaluacion">⚙️ Evaluación</TabsTrigger>
            </TabsList>

            {/* ════════════════════════════════════════════════════════
                TAB 1 — RETOS
            ════════════════════════════════════════════════════════ */}
            <TabsContent value="retos" className="space-y-6 mt-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="font-semibold text-base text-foreground">
                  {editingRetoId ? '✏️ Editar reto' : '➕ Nuevo reto VN'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre *">
                    <input className={inputClass} value={retoForm.nombre}
                      onChange={(e) => setRetoForm({ ...retoForm, nombre: e.target.value })}
                      placeholder="ej. El Golazo del Día" />
                  </Field>
                  <Field label="Tipo *">
                    <select className={inputClass} value={retoForm.tipo}
                      onChange={(e) => {
                        const tipo = e.target.value as RetoVN['tipo'];
                        setRetoForm({ ...retoForm, tipo, kpi: tipo === 'DIARIO' ? 'NUBES' : 'ACV' });
                      }}>
                      <option value="DIARIO">📅 Diario — meta nubes/día</option>
                      <option value="SEMANAL">📆 Semanal — meta ACV/semana</option>
                      <option value="MENSUAL">🗓️ Mensual — meta ACV/mes</option>
                    </select>
                  </Field>
                  <Field label="KPI (derivado del tipo)">
                    <input className={cn(inputClass, 'opacity-60')} readOnly
                      value={retoForm.tipo === 'DIARIO' ? 'NUBES (unidades de nube)' : 'ACV (ingreso acumulado)'} />
                  </Field>
                  <Field label={retoForm.tipo === 'DIARIO' ? 'SP por cumplir (base)' : retoForm.tipo === 'MENSUAL' ? 'SP por cumplir' : 'SP semana 1'}>
                    {retoForm.tipo === 'SEMANAL' ? (
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((sem) => {
                          const key = `sp_semanal_sem${sem}` as keyof typeof retoForm;
                          return (
                            <div key={sem}>
                              <p className="text-[10px] text-muted-foreground mb-1">S{sem}</p>
                              <input className={inputClass} type="number" min={0}
                                value={retoForm[key] as number}
                                onChange={(e) => setRetoForm({ ...retoForm, [key]: Number(e.target.value) })} />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <input className={inputClass} type="number" min={0}
                        value={retoForm.sp_base}
                        onChange={(e) => setRetoForm({ ...retoForm, sp_base: Number(e.target.value) })} />
                    )}
                  </Field>
                  <Field label="Fecha inicio *">
                    <input className={inputClass} type="date" value={retoForm.fecha_inicio}
                      onChange={(e) => setRetoForm({ ...retoForm, fecha_inicio: e.target.value })} />
                  </Field>
                  <Field label="Fecha fin *">
                    <input className={inputClass} type="date" value={retoForm.fecha_fin}
                      onChange={(e) => setRetoForm({ ...retoForm, fecha_fin: e.target.value })} />
                  </Field>
                  <Field label="Canales">
                    <div className="flex gap-2">
                      {CANALES.map((c) => (
                        <button key={c} type="button"
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                            retoForm.canal.includes(c)
                              ? 'bg-primary text-white border-primary'
                              : 'border-border text-muted-foreground hover:bg-muted')}
                          onClick={() => setRetoForm({ ...retoForm, canal: toggleArr(retoForm.canal, c) })}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Países">
                    <div className="flex gap-2">
                      {PAISES.map((p) => (
                        <button key={p} type="button"
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                            retoForm.paises.includes(p)
                              ? 'bg-primary text-white border-primary'
                              : 'border-border text-muted-foreground hover:bg-muted')}
                          onClick={() => setRetoForm({ ...retoForm, paises: toggleArr(retoForm.paises, p) })}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </Field>
                  {retoForm.tipo === 'DIARIO' && (
                    <Field label="Sumar ventas sáb+dom al viernes" hint="La venta del fin de semana se acumula al viernes anterior">
                      <div className="flex items-center gap-2 pt-1">
                        <Switch checked={retoForm.acumular_finde_al_viernes}
                          onCheckedChange={(v) => setRetoForm({ ...retoForm, acumular_finde_al_viernes: v })} />
                        <span className="text-sm">{retoForm.acumular_finde_al_viernes ? 'Activo' : 'Inactivo'}</span>
                      </div>
                    </Field>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveReto} className="gap-2">
                    <MI icon="save" className="text-sm" />
                    {editingRetoId ? 'Actualizar reto' : 'Crear reto'}
                  </Button>
                  {editingRetoId && (
                    <Button variant="outline" onClick={() => { setRetoForm(RETO_BLANK); setEditingRetoId(null); }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              {/* Tabla de retos */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="font-semibold text-sm text-foreground">Retos configurados ({retos.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Nombre', 'Tipo', 'KPI', 'Canal', 'Países', 'SP', 'Fechas', 'Estado', 'Acciones'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {retos.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-foreground">{r.nombre}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline">{r.tipo}</Badge></td>
                          <td className="px-4 py-2.5 text-muted-foreground">{r.kpi}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.canal.join(', ')}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.paises.join(', ')}</td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {r.tipo === 'SEMANAL'
                              ? `S1:${r.sp_semanal_sem1} S2:${r.sp_semanal_sem2} S3:${r.sp_semanal_sem3} S4:${r.sp_semanal_sem4}`
                              : r.sp_base}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {r.fecha_inicio} → {r.fecha_fin}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={r.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                              {r.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => editReto(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <MI icon="edit" className="text-base" />
                              </button>
                              <button onClick={() => toggleRetoActivo(r.id, r.activo)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <MI icon={r.activo ? 'toggle_on' : 'toggle_off'} className="text-base" />
                              </button>
                              <button onClick={() => deleteReto(r.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                                <MI icon="delete" className="text-base" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {retos.length === 0 && (
                        <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin retos configurados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ════════════════════════════════════════════════════════
                TAB 2 — RACHAS
            ════════════════════════════════════════════════════════ */}
            <TabsContent value="rachas" className="space-y-6 mt-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="font-semibold text-base text-foreground">
                  {editingRachaId ? '✏️ Editar racha' : '➕ Nueva racha VN'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre *">
                    <input className={inputClass} value={rachaForm.nombre}
                      onChange={(e) => setRachaForm({ ...rachaForm, nombre: e.target.value })}
                      placeholder="ej. Racha Diaria, Racha Semanal" />
                  </Field>
                  <Field label="Tipo *">
                    <select className={inputClass} value={rachaForm.tipo}
                      onChange={(e) => {
                        const tipo = e.target.value as RachaVN['tipo'];
                        setRachaForm({
                          ...rachaForm, tipo,
                          dias_consecutivos_requeridos: tipo === 'DIARIA' ? 3 : 2,
                          multiplicador: tipo === 'DIARIA' ? 1.5 : 2,
                        });
                      }}>
                      <option value="DIARIA">🔥 Diaria — x1.5 desde el día 4</option>
                      <option value="SEMANAL">⚡ Semanal — x2 desde la semana 3</option>
                    </select>
                  </Field>
                  <Field label="Días/semanas consecutivos requeridos"
                    hint="La racha se activa al superar este umbral (ej: 3 días → activa en el día 4)">
                    <input className={inputClass} type="number" min={1}
                      value={rachaForm.dias_consecutivos_requeridos}
                      onChange={(e) => setRachaForm({ ...rachaForm, dias_consecutivos_requeridos: Number(e.target.value) })} />
                  </Field>
                  <Field label="Multiplicador de SP" hint="1.5 para diaria, 2.0 para semanal">
                    <input className={inputClass} type="number" step="0.1" min={1}
                      value={rachaForm.multiplicador}
                      onChange={(e) => setRachaForm({ ...rachaForm, multiplicador: Number(e.target.value) })} />
                  </Field>
                  <Field label="Reto al que aplica" hint="SP del reto asociado se multiplican">
                    <select className={inputClass}
                      value={rachaForm.reto_ref_id ?? ''}
                      onChange={(e) => setRachaForm({ ...rachaForm, reto_ref_id: e.target.value || null })}>
                      <option value="">— Sin reto vinculado —</option>
                      {retos.filter((r) =>
                        (rachaForm.tipo === 'DIARIA' ? r.tipo === 'DIARIO' : r.tipo === 'SEMANAL')
                      ).map((r) => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Canales">
                    <div className="flex gap-2">
                      {CANALES.map((c) => (
                        <button key={c} type="button"
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                            rachaForm.canal.includes(c)
                              ? 'bg-primary text-white border-primary'
                              : 'border-border text-muted-foreground hover:bg-muted')}
                          onClick={() => setRachaForm({ ...rachaForm, canal: toggleArr(rachaForm.canal, c) })}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Países">
                    <div className="flex gap-2">
                      {PAISES.map((p) => (
                        <button key={p} type="button"
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                            rachaForm.paises.includes(p)
                              ? 'bg-primary text-white border-primary'
                              : 'border-border text-muted-foreground hover:bg-muted')}
                          onClick={() => setRachaForm({ ...rachaForm, paises: toggleArr(rachaForm.paises, p) })}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Fecha inicio *">
                    <input className={inputClass} type="date" value={rachaForm.fecha_inicio}
                      onChange={(e) => setRachaForm({ ...rachaForm, fecha_inicio: e.target.value })} />
                  </Field>
                  <Field label="Fecha fin *">
                    <input className={inputClass} type="date" value={rachaForm.fecha_fin}
                      onChange={(e) => setRachaForm({ ...rachaForm, fecha_fin: e.target.value })} />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveRacha} className="gap-2">
                    <MI icon="save" className="text-sm" />
                    {editingRachaId ? 'Actualizar racha' : 'Crear racha'}
                  </Button>
                  {editingRachaId && (
                    <Button variant="outline" onClick={() => { setRachaForm(RACHA_BLANK); setEditingRachaId(null); }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              {/* Tabla rachas */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="font-semibold text-sm text-foreground">Rachas configuradas ({rachas.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Nombre', 'Tipo', 'Días/Sem requeridos', 'Multiplicador', 'Reto vinculado', 'Estado', 'Acciones'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rachas.map((r) => {
                        const retoRef = retos.find((rt) => rt.id === r.reto_ref_id);
                        return (
                          <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-foreground">{r.nombre}</td>
                            <td className="px-4 py-2.5"><Badge variant="outline">{r.tipo}</Badge></td>
                            <td className="px-4 py-2.5 text-center">{r.dias_consecutivos_requeridos}</td>
                            <td className="px-4 py-2.5 font-mono">x{r.multiplicador}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{retoRef?.nombre ?? '—'}</td>
                            <td className="px-4 py-2.5">
                              <Badge className={r.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                                {r.activo ? 'Activa' : 'Inactiva'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setRachaForm({ ...r }); setEditingRachaId(r.id); }}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                  <MI icon="edit" className="text-base" />
                                </button>
                                <button onClick={() => toggleRachaActiva(r.id, r.activo)}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                  <MI icon={r.activo ? 'toggle_on' : 'toggle_off'} className="text-base" />
                                </button>
                                <button onClick={() => deleteRacha(r.id)}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                                  <MI icon="delete" className="text-base" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {rachas.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin rachas configuradas</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ════════════════════════════════════════════════════════
                TAB 3 — MEDALLAS
            ════════════════════════════════════════════════════════ */}
            <TabsContent value="medallas" className="space-y-6 mt-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="font-semibold text-base text-foreground">
                  {editingMedallaId ? '✏️ Editar medalla' : '➕ Nueva medalla VN'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre *">
                    <input className={inputClass} value={medallaForm.nombre}
                      onChange={(e) => setMedallaForm({ ...medallaForm, nombre: e.target.value })}
                      placeholder="ej. Primer Golazo" />
                  </Field>
                  <Field label="Emoji">
                    <input className={inputClass} value={medallaForm.emoji}
                      onChange={(e) => setMedallaForm({ ...medallaForm, emoji: e.target.value })}
                      placeholder="🏅" />
                  </Field>
                  <Field label="Descripción" hint="Opcional — aparece en la vista del gerente">
                    <input className={inputClass} value={medallaForm.descripcion}
                      onChange={(e) => setMedallaForm({ ...medallaForm, descripcion: e.target.value })} />
                  </Field>
                  <Field label="SP de recompensa">
                    <input className={inputClass} type="number" min={0}
                      value={medallaForm.sp_reward}
                      onChange={(e) => setMedallaForm({ ...medallaForm, sp_reward: Number(e.target.value) })} />
                  </Field>
                  <Field label="Condición de desbloqueo *">
                    <select className={inputClass} value={medallaForm.condicion_tipo}
                      onChange={(e) => setMedallaForm({ ...medallaForm, condicion_tipo: e.target.value })}>
                      {Object.entries(CONDICION_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </Field>
                  {['reto_diario_completado_n', 'reto_semanal_completado_n'].includes(medallaForm.condicion_tipo) && (
                    <Field label="Valor N (cantidad de veces)" hint="Cuántas veces debe cumplirse para desbloquear">
                      <input className={inputClass} type="number" min={1}
                        value={medallaForm.condicion_valor}
                        onChange={(e) => setMedallaForm({ ...medallaForm, condicion_valor: Number(e.target.value) })} />
                    </Field>
                  )}
                  <Field label="Canales">
                    <div className="flex gap-2">
                      {CANALES.map((c) => (
                        <button key={c} type="button"
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                            medallaForm.canal.includes(c)
                              ? 'bg-primary text-white border-primary'
                              : 'border-border text-muted-foreground hover:bg-muted')}
                          onClick={() => setMedallaForm({ ...medallaForm, canal: toggleArr(medallaForm.canal, c) })}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Países">
                    <div className="flex gap-2">
                      {PAISES.map((p) => (
                        <button key={p} type="button"
                          className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                            medallaForm.paises.includes(p)
                              ? 'bg-primary text-white border-primary'
                              : 'border-border text-muted-foreground hover:bg-muted')}
                          onClick={() => setMedallaForm({ ...medallaForm, paises: toggleArr(medallaForm.paises, p) })}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveMedalla} className="gap-2">
                    <MI icon="save" className="text-sm" />
                    {editingMedallaId ? 'Actualizar medalla' : 'Crear medalla'}
                  </Button>
                  {editingMedallaId && (
                    <Button variant="outline" onClick={() => { setMedallaForm(MEDALLA_BLANK); setEditingMedallaId(null); }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              {/* Grid de medallas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {medallas.map((m) => (
                  <div key={m.id} className={cn(
                    'rounded-xl border bg-card p-4 space-y-2 transition-opacity',
                    !m.activo && 'opacity-50',
                  )}>
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{m.emoji}</span>
                      <Badge className={m.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                        {m.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                    <p className="font-semibold text-sm text-foreground">{m.nombre}</p>
                    {m.descripcion && <p className="text-xs text-muted-foreground">{m.descripcion}</p>}
                    <p className="text-xs text-muted-foreground">{CONDICION_LABELS[m.condicion_tipo] ?? m.condicion_tipo}</p>
                    {['reto_diario_completado_n', 'reto_semanal_completado_n'].includes(m.condicion_tipo) && (
                      <p className="text-xs text-muted-foreground">N = {m.condicion_valor}</p>
                    )}
                    <p className="text-xs font-semibold text-primary">+{m.sp_reward} SP</p>
                    <div className="flex items-center gap-1 pt-1">
                      <button onClick={() => { setMedallaForm({ ...m }); setEditingMedallaId(m.id); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <MI icon="edit" className="text-base" />
                      </button>
                      <button onClick={() => toggleMedallaActiva(m.id, m.activo)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <MI icon={m.activo ? 'toggle_on' : 'toggle_off'} className="text-base" />
                      </button>
                    </div>
                  </div>
                ))}
                {medallas.length === 0 && (
                  <div className="col-span-3 py-10 text-center text-muted-foreground text-sm">Sin medallas configuradas</div>
                )}
              </div>
            </TabsContent>

            {/* ════════════════════════════════════════════════════════
                TAB 4 — METAS NUBES
            ════════════════════════════════════════════════════════ */}
            <TabsContent value="metas" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-4 mb-4">
                  <Field label="Mes">
                    <input className={inputClass} type="month" value={metasMes}
                      onChange={(e) => setMetasMes(e.target.value)} style={{ width: 160 }} />
                  </Field>
                  <Button onClick={saveMetasNubes} className="gap-2 mt-5">
                    <MI icon="save" className="text-sm" />
                    Guardar metas
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Gerente', 'País', 'Meta nubes/mes (unidades)'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {metasNubes.map((m, idx) => (
                        <tr key={m.gerente_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2 font-medium text-foreground">{m.gerente_nombre}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline">{m.pais}</Badge>
                          </td>
                          <td className="px-4 py-2">
                            <input className={cn(inputClass, 'w-32')} type="number" min={0}
                              value={m.meta_nubes}
                              onChange={(e) => {
                                const updated = [...metasNubes];
                                updated[idx] = { ...m, meta_nubes: Number(e.target.value) };
                                setMetasNubes(updated);
                              }} />
                          </td>
                        </tr>
                      ))}
                      {metasNubes.length === 0 && (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin gerentes VN activos en COL/ECU</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ════════════════════════════════════════════════════════
                TAB 5 — CALENDARIO
            ════════════════════════════════════════════════════════ */}
            <TabsContent value="calendario" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <Field label="Mes">
                    <input className={inputClass} type="month" value={calMesElegido}
                      onChange={(e) => setCalMesElegido(e.target.value)} style={{ width: 160 }} />
                  </Field>
                  <Field label="País">
                    <select className={inputClass} value={calPaisElegido}
                      onChange={(e) => setCalPaisElegido(e.target.value)} style={{ width: 120 }}>
                      {PAISES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Días hábiles">
                    <input className={cn(inputClass, 'w-24')} type="number" min={0}
                      value={calForm.dias_habiles}
                      onChange={(e) => setCalForm({ ...calForm, dias_habiles: Number(e.target.value) })} />
                  </Field>
                </div>

                <Field label="Festivos (una fecha por línea, formato YYYY-MM-DD)"
                  hint="En días festivos el reto diario no aplica">
                  <textarea
                    className={cn(inputClass, 'h-24 resize-none py-2')}
                    value={(calForm.festivos ?? []).join('\n')}
                    onChange={(e) => setCalForm({
                      ...calForm,
                      festivos: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                    })}
                    placeholder="2025-05-01&#10;2025-05-19" />
                </Field>

                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Semanas del mes</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {['Semana', 'Fecha inicio', 'Fecha fin', 'SP'].map((h) => (
                            <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(calForm.semanas ?? []).map((sem, idx) => (
                          <tr key={sem.numero}>
                            <td className="px-4 py-1.5 font-medium text-foreground">Semana {sem.numero}</td>
                            <td className="px-4 py-1.5">
                              <input className={cn(inputClass, 'w-36')} type="date" value={sem.fecha_inicio}
                                onChange={(e) => {
                                  const s = [...calForm.semanas];
                                  s[idx] = { ...s[idx], fecha_inicio: e.target.value };
                                  setCalForm({ ...calForm, semanas: s });
                                }} />
                            </td>
                            <td className="px-4 py-1.5">
                              <input className={cn(inputClass, 'w-36')} type="date" value={sem.fecha_fin}
                                onChange={(e) => {
                                  const s = [...calForm.semanas];
                                  s[idx] = { ...s[idx], fecha_fin: e.target.value };
                                  setCalForm({ ...calForm, semanas: s });
                                }} />
                            </td>
                            <td className="px-4 py-1.5">
                              <input className={cn(inputClass, 'w-16')} type="number" min={0}
                                value={sem.sp}
                                onChange={(e) => {
                                  const s = [...calForm.semanas];
                                  s[idx] = { ...s[idx], sp: Number(e.target.value) };
                                  setCalForm({ ...calForm, semanas: s });
                                }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Button onClick={saveCalendario} className="gap-2">
                  <MI icon="save" className="text-sm" />
                  Guardar calendario {calMesElegido} {calPaisElegido}
                </Button>
              </div>

              {/* Resumen calendarios existentes */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="font-semibold text-sm">Calendarios configurados ({calendarios.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {['Mes', 'País', 'Días hábiles', 'Festivos', 'Semanas'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {calendarios.map((c) => (
                        <tr key={`${c.anio_mes}-${c.pais}`} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{c.anio_mes}</td>
                          <td className="px-4 py-2.5"><Badge variant="outline">{c.pais}</Badge></td>
                          <td className="px-4 py-2.5 text-center">{c.dias_habiles}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {(c.festivos ?? []).join(', ') || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {(c.semanas ?? []).map((s: any) => `S${s.numero}:${s.fecha_inicio}→${s.fecha_fin}(${s.sp}SP)`).join(' | ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* ════════════════════════════════════════════════════════
                TAB 6 — EVALUACIÓN
            ════════════════════════════════════════════════════════ */}
            <TabsContent value="evaluacion" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="font-semibold text-base text-foreground">⚙️ Ejecutar evaluación VN</h2>
                <div className="flex flex-wrap items-end gap-4">
                  <Field label="Fecha a evaluar">
                    <input className={cn(inputClass, 'w-44')} type="date" value={evalFecha}
                      onChange={(e) => setEvalFecha(e.target.value)} />
                  </Field>
                  <Field label="Modo simulación (sin guardar)">
                    <div className="flex items-center gap-2 pt-1">
                      <Switch checked={evalDryRun} onCheckedChange={setEvalDryRun} />
                      <span className={cn('text-sm font-semibold', evalDryRun ? 'text-amber-600' : 'text-green-600')}>
                        {evalDryRun ? 'Simulación activa' : 'Evaluación real'}
                      </span>
                    </div>
                  </Field>
                  <Button onClick={ejecutarEvaluacion} disabled={evalLoading}
                    className={cn('gap-2', !evalDryRun && 'bg-green-600 hover:bg-green-700')}>
                    <MI icon={evalLoading ? 'sync' : 'play_arrow'} className={cn('text-sm', evalLoading && 'animate-spin')} />
                    {evalLoading ? 'Evaluando…' : evalDryRun ? 'Simular evaluación' : 'Ejecutar evaluación'}
                  </Button>
                </div>

                {!evalDryRun && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    ⚠️ En modo real se otorgarán SP y se guardarán los progresos. Esta acción es idempotente — si ya fue evaluada la fecha/semana/mes, no se duplicará.
                  </div>
                )}
              </div>

              {evalResultados.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Resultados ({evalResultados.length})</h3>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="text-green-600 font-semibold">
                        ✅ {evalResultados.filter((r) => r.cumple === true).length} cumplidos
                      </span>
                      <span>
                        ❌ {evalResultados.filter((r) => r.cumple === false).length} no cumplidos
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {['Gerente', 'País', 'Reto', 'Tipo', 'Período', 'Resultado', '% Cumpl.', 'SP base', 'SP con racha'].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {evalResultados.map((r, i) => (
                          <tr key={i} className={cn('hover:bg-muted/30 transition-colors',
                            r.cumple === true ? 'bg-green-50/30' : r.cumple === false ? 'bg-red-50/20' : '')}>
                            <td className="px-3 py-2 font-medium text-foreground text-xs">{r.gerente}</td>
                            <td className="px-3 py-2 text-xs"><Badge variant="outline">{r.pais}</Badge></td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{r.reto}</td>
                            <td className="px-3 py-2 text-xs"><Badge variant="outline">{r.tipo ?? '—'}</Badge></td>
                            <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                              {r.fecha ?? r.mes ?? (r.semana ? `S${r.semana}` : '—')}
                            </td>
                            <td className="px-3 py-2">
                              {r.cumple === true
                                ? <Badge className="bg-green-100 text-green-700 text-xs">✅ Cumple</Badge>
                                : r.cumple === false
                                ? <Badge className="bg-red-100 text-red-700 text-xs">❌ No cumple</Badge>
                                : <Badge variant="outline" className="text-xs">{r.resultado ?? '—'}</Badge>}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{r.pct ?? '—'}</td>
                            <td className="px-3 py-2 font-mono text-xs">{r.spBase ?? r.sp ?? '—'}</td>
                            <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">
                              {r.spConRacha ?? r.sp ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
};

export default AdminEspecialistaVN;
