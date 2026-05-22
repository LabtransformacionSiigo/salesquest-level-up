import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn('material-icons-outlined', className)}>{icon}</span>
);

import {
  COUNTRY_LABELS,
  SUPPORTED_COUNTRIES,
  getFamiliesForCountry,
  getSkusForCountry,
  type CountryCode,
  type ProductFamily,
} from '@/lib/product-families';

const PAISES_LABEL: Record<string, string> = COUNTRY_LABELS;
const OPERACIONES = ['Venta Cruzada', 'Venta Nueva (Empresarios)', 'Venta Nueva (Aliados)'];
const VENTANAS_OPTS = [
  { value: 'DIARIO', label: '📅 Diario (se evalúa cada día)' },
  { value: 'SEMANAL', label: '📆 Semanal (se evalúa cada viernes)' },
  { value: 'MENSUAL', label: '🗓️ Mensual (se evalúa último día hábil)' },
];
const TIPO_METRICA = ['UNIDADES', 'ACV', 'CUMPLIMIENTO_META_ACV_PLUS', 'RECOMENDADOS'];
const TIPO_EVENTO_MEDALLA_OPTS = [
  { value: 'PRIMERA_VENTA', label: '⭐ Primera venta del tipo' },
  { value: 'PRIMER_RECONOCIMIENTO', label: '🏅 Primer reconocimiento' },
  { value: 'CUMPLIMIENTO_TEMPRANO_UNIDADES', label: '⚡ Cumplimiento anticipado' },
  { value: 'CANTIDAD_VENTAS_FAMILIA', label: '📦 Acumular cantidad de ventas' },
];

const CANALES_RETOS = [
  { value: 'VC', label: 'Venta Cruzada' },
  { value: 'VN_ALIADOS', label: 'VN Aliados' },
  { value: 'VN_EMPRESARIOS', label: 'VN Empresarios' },
];
const KPIS_RETOS = [
  { value: 'acv_plus', label: '💰 ACV+ (monto en pesos)', shortLabel: 'ACV', valorLabel: 'Meta en MONTO (ej: 15000000)', valorHint: 'Los asesores deben superar este monto', tipoMetrica: 'ACV', canales: ['VC', 'VN_ALIADOS', 'VN_EMPRESARIOS'] },
  { value: 'upgrades', label: '⬆️ Upgrades (cantidad)', shortLabel: 'Upgrades', valorLabel: 'Número de upgrades requeridos', valorHint: 'Los asesores deben alcanzar esta cantidad', tipoMetrica: 'UNIDADES', canales: ['VC'] },
  { value: 'conversiones', label: '🔄 Conversiones (% sobre cuota)', shortLabel: 'Conversiones', valorLabel: '% mínimo de conversiones (ej: 33)', valorHint: 'Porcentaje mínimo de conversiones requerido', tipoMetrica: 'UNIDADES', canales: ['VC'] },
  { value: 'cumplimiento_pct', label: '🎯 % Cumplimiento de meta', shortLabel: '% Cumplimiento', valorLabel: '% de cumplimiento requerido (ej: 120)', valorHint: 'Porcentaje de la meta que deben alcanzar', tipoMetrica: 'CUMPLIMIENTO_META_ACV_PLUS', canales: ['VC', 'VN_ALIADOS', 'VN_EMPRESARIOS'] },
];
const FAMILIAS_VC = [
  { value: 'NUBE', label: '☁️ Nube' },
  { value: 'LEGACY', label: '🏢 Legacy (Pyme + Ilimitada)' },
  { value: 'AMBAS', label: '🌐 Todos (Nube + Legacy)' },
];
const CONDICIONES_RACHA = [
  { value: 'VENTA_DIARIA_CONSECUTIVA', label: 'Ventas diarias consecutivas' },
  { value: 'CUMPLIMIENTO_DIARIO', label: 'Cumplimiento diario de meta' },
];

// Métricas disponibles según canal (operación)
const METRICAS_POR_CANAL: Record<string, string[]> = {
  VC: ['UNIDADES', 'ACV', 'CUMPLIMIENTO_META_ACV_PLUS', 'RECOMENDADOS'],
  VN_ALIADOS: ['UNIDADES', 'ACV', 'CUMPLIMIENTO_META_ACV_PLUS', 'FE', 'NUBE'],
  VN_EMPRESARIOS: ['UNIDADES', 'ACV', 'CUMPLIMIENTO_META_ACV_PLUS', 'FE', 'NUBE'],
};

// Helpers de mapeo operación↔canal (compartidos)
const opToCanalGlobal = (op: string): string | null =>
  op === 'Venta Cruzada' ? 'VC'
  : op === 'Venta Nueva (Aliados)' ? 'VN_ALIADOS'
  : op === 'Venta Nueva (Empresarios)' ? 'VN_EMPRESARIOS'
  : null;

// Etiqueta dinámica para "Nube" según país/operación
const labelNubeOCampana = (pais: string, operacion: string) =>
  pais === 'MEX' && operacion === 'Venta Nueva (Empresarios)' ? 'Campaña' : 'Nube';

interface Permisos {
  paises: string[];
  operaciones: string[];
}

const inputClass =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const AdminEspecialista = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [ejecutando, setEjecutando] = useState(false);
  const handleEjecutarEvaluacion = async () => {
    setEjecutando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluar-retos-vc`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ dry_run: false }),
        }
      );
      const result = await res.json();
      if (result.ok) {
        toast({
          title: '✅ Evaluación completada',
          description: `Retos otorgados: ${result.totalRetos} · SP Canje: ${result.totalSp}`,
        });
        fetchLogros();
      } else {
        toast({ title: '⚠️ Resultado con errores', description: JSON.stringify(result.errores?.slice(0, 2)), variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setEjecutando(false);
    }
  };
  const [logros, setLogros] = useState<any[]>([]);
  const [loadingLogros, setLoadingLogros] = useState(false);
  const [logrosFiltro, setLogrosFiltro] = useState<{ tipo: string; desde: string; hasta: string; q: string }>({
    tipo: 'TODOS', desde: '', hasta: '', q: '',
  });
  const fetchLogros = async () => {
    setLoadingLogros(true);
    // Fuente única: sp_acumulados (incluye retos diarios/semanales/mensuales, rachas y medallas)
    const { data: spRows } = await supabase
      .from('sp_acumulados')
      .select('id, gerente_id, fuente, sp, periodo, detalle, created_at, gerentes(nombre, canal, pais)')
      .in('fuente', ['RETO_DIARIO', 'RETO_SEMANAL', 'RETO_MENSUAL', 'MEDALLA'])
      .gt('sp', 0) // excluir logros revocados (sp=0) para no inflar el conteo
      .order('created_at', { ascending: false })
      .limit(500);

    const items = (spRows || []).map((r: any) => {
      const detalle = String(r.detalle || '');
      const esRacha = detalle.startsWith('RACHA');
      const esMedalla = r.fuente === 'MEDALLA';
      const tipoLogro = esMedalla ? 'medalla' : esRacha ? 'racha' : 'reto';
      // Nombre antes del primer "·"
      const nombre = detalle.split('·')[0]?.trim() || detalle || r.fuente;
      const ventana = r.fuente === 'RETO_DIARIO' ? 'diario'
        : r.fuente === 'RETO_SEMANAL' ? 'semanal'
        : r.fuente === 'RETO_MENSUAL' ? 'mensual'
        : '—';
      return {
        id: r.id,
        tipo: tipoLogro,
        gerente: r.gerentes?.nombre || r.gerente_id,
        canal: r.gerentes?.canal || '',
        pais: r.gerentes?.pais || '',
        nombre,
        detalle,
        periodo: r.periodo,
        sp: r.sp,
        ventana,
        fecha: r.created_at,
      };
    });
    setLogros(items);
    setLoadingLogros(false);
  };
  const logrosFiltrados = logros.filter((l) => {
    if (logrosFiltro.tipo !== 'TODOS' && l.tipo !== logrosFiltro.tipo) return false;
    if (logrosFiltro.q && !`${l.gerente} ${l.nombre}`.toLowerCase().includes(logrosFiltro.q.toLowerCase())) return false;
    if (logrosFiltro.desde && l.fecha && l.fecha.slice(0, 10) < logrosFiltro.desde) return false;
    if (logrosFiltro.hasta && l.fecha && l.fecha.slice(0, 10) > logrosFiltro.hasta) return false;
    return true;
  });
  const totalSpFiltrado = logrosFiltrados.reduce((s, l) => s + (Number(l.sp) || 0), 0);
  const [permisos, setPermisos] = useState<Permisos | null>(null);
  const [retos, setRetos] = useState<any[]>([]);
  const [rachas, setRachas] = useState<any[]>([]);
  const [medallas, setMedallas] = useState<any[]>([]);
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editing, setEditing] = useState<{ tipo: string; data: any } | null>(null);

  // VN state
  const [retosVN, setRetosVN] = useState<any[]>([]);
  const [rachasVN, setRachasVN] = useState<any[]>([]);
  const [medallasVN, setMedallasVN] = useState<any[]>([]);
  const [editingVN, setEditingVN] = useState<{ tabla: string; data: any } | null>(null);
  const [evalFechaVN, setEvalFechaVN] = useState<string>(new Date().toISOString().split('T')[0]);
  const [evalDryRunVN, setEvalDryRunVN] = useState<boolean>(true);
  const [evalLoadingVN, setEvalLoadingVN] = useState<boolean>(false);
  const [evalResultadosVN, setEvalResultadosVN] = useState<any[]>([]);

  const isAdmin = profile?.role === 'admin';
  const isEspecialista = profile?.role === 'especialista';
  const isAprobador = profile?.role === 'aprobador';

  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isEspecialista && !isAprobador)) return;
    loadAll();
  }, [isAuthenticated, profile?.role, profile?.user_id]);

  // Map operación → canal de gerente para filtrar el selector
  const operacionToCanal = (op: string): string | null => {
    if (op === 'Venta Cruzada') return 'VC';
    if (op === 'Venta Nueva (Aliados)') return 'VN_ALIADOS';
    if (op === 'Venta Nueva (Empresarios)') return 'VN_EMPRESARIOS';
    return null;
  };

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
    if (isAprobador && profile?.user_id) {
      const { data } = await supabase
        .from('aprobador_permisos' as any)
        .select('paises, operaciones')
        .eq('user_id', profile.user_id)
        .maybeSingle();
      if (data) perm = { paises: (data as any).paises || [], operaciones: (data as any).operaciones || [] };
    }
    setPermisos(perm);

    // Gerentes en scope (filtrados por país y canal del especialista; admin ve todos)
    const canalesScope = perm.operaciones.map(operacionToCanal).filter(Boolean) as string[];
    let gerentesQuery = supabase.from('gerentes').select('id, nombre, canal, pais, celula').eq('activo', true).order('nombre');
    if (!isAdmin) {
      if (perm.paises.length > 0) gerentesQuery = gerentesQuery.in('pais', perm.paises);
      if (canalesScope.length > 0) gerentesQuery = gerentesQuery.in('canal', canalesScope);
    }

    // Filtros server-side por canal/pais (defensa en profundidad)
    const buildRetoQuery = () => {
      let q = supabase.from('catalogo_retos').select('*').order('ventana_tiempo');
      if (!isAdmin) {
        if (canalesScope.length > 0) q = q.in('canal', canalesScope);
        if (perm.paises.length > 0) q = q.in('pais', perm.paises);
      }
      return q;
    };
    const buildRachaQuery = () => {
      let q = supabase.from('config_rachas').select('*').order('nombre');
      if (!isAdmin) {
        if (canalesScope.length > 0) q = q.in('canal', canalesScope);
        if (perm.paises.length > 0) q = q.in('pais', perm.paises);
      }
      return q;
    };
    const buildMedallaQuery = () => {
      let q = supabase.from('catalogo_medallas').select('*').order('nombre');
      if (!isAdmin) {
        if (canalesScope.length > 0) q = q.in('canal', canalesScope);
        if (perm.paises.length > 0) q = q.in('pais', perm.paises);
      }
      return q;
    };

    const [r1, r2, r3, gQ] = await Promise.all([
      buildRetoQuery(),
      buildRachaQuery(),
      buildMedallaQuery(),
      gerentesQuery,
    ]);
    setRetos(r1.data || []);
    setRachas(r2.data || []);
    setMedallas(r3.data || []);
    setGerentes(gQ.data || []);

    // VN data (sólo si tiene operaciones VN en su scope)
    const tieneVN = isAdmin || perm.operaciones.some((op: string) =>
      op === 'Venta Nueva (Empresarios)' || op === 'Venta Nueva (Aliados)'
    );
    if (tieneVN) {
      const [rv, rvr, rvm] = await Promise.all([
        supabase.from('retos_vn_config' as any).select('*').order('tipo'),
        supabase.from('rachas_vn_config' as any).select('*').order('nombre'),
        supabase.from('medallas_vn_config' as any).select('*').order('nombre'),
      ]);
      setRetosVN((rv.data as any[]) || []);
      setRachasVN((rvr.data as any[]) || []);
      setMedallasVN((rvm.data as any[]) || []);
    } else {
      setRetosVN([]); setRachasVN([]); setMedallasVN([]);
    }

    setDataLoading(false);
  };

  const isInScope = (item: any) => {
    if (isAdmin) return true;
    if (!permisos) return false;
    if (!item.pais) return false;
    if (!item.canal && !item.operacion) return false;
    const paisOk = permisos.paises.includes(item.pais);
    const canalToOp: Record<string, string> = {
      VC: 'Venta Cruzada',
      VN_ALIADOS: 'Venta Nueva (Aliados)',
      VN_EMPRESARIOS: 'Venta Nueva (Empresarios)',
    };
    const opFromCanal = item.canal ? canalToOp[item.canal] : null;
    const opEffective = item.operacion || opFromCanal;
    const opOk = opEffective ? permisos.operaciones.includes(opEffective) : false;
    return paisOk && opOk;
  };

  // VN scope check: item tiene paises[] y canal[]
  const isInScopeVN = (item: any): boolean => {
    if (isAdmin) return true;
    if (!permisos) return false;
    const paisOk = !item.paises?.length ||
      item.paises.some((p: string) => permisos.paises.includes(p));
    const canalToOp: Record<string, string> = {
      VN_EMPRESARIOS: 'Venta Nueva (Empresarios)',
      VN_ALIADOS: 'Venta Nueva (Aliados)',
    };
    const canalOk = !item.canal?.length ||
      item.canal.some((c: string) => {
        const op = canalToOp[c];
        return op && permisos.operaciones.includes(op);
      });
    return paisOk && canalOk;
  };

  const toggleVN = async (tabla: string, id: string, activo: boolean) => {
    const { error } = await supabase.from(tabla as any).update({ activo: !activo }).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: activo ? 'Desactivado' : 'Activado ✅' });
    loadAll();
  };

  const deleteVN = async (tabla: string, id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from(tabla as any).delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Eliminado ✅' }); loadAll();
  };

  const saveVN = async (tabla: string, payload: any, id?: string) => {
    const action = id
      ? supabase.from(tabla as any).update(payload).eq('id', id)
      : supabase.from(tabla as any).insert(payload);
    const { error } = await action;
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: id ? 'Actualizado ✅' : 'Creado ✅' });
    setEditingVN(null);
    loadAll();
  };

  const ejecutarEvaluacionVN = async () => {
    setEvalLoadingVN(true);
    setEvalResultadosVN([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluar-retos-vn`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ fecha: evalFechaVN, dry_run: evalDryRunVN }),
        }
      );
      const result = await res.json();
      if (result.ok) {
        setEvalResultadosVN(result.resultados ?? []);
        toast({ title: evalDryRunVN ? '🔍 Simulación completada' : '✅ Evaluación completada', description: `${result.evaluados ?? (result.resultados?.length ?? 0)} evaluaciones` });
      } else {
        toast({ title: '⚠️ Error', description: result.error ?? JSON.stringify(result), variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setEvalLoadingVN(false); }
  };

  const toggleActivo = async (tipo: 'reto' | 'racha' | 'medalla', id: string, activo: boolean) => {
    const table = tipo === 'reto' ? 'catalogo_retos' : tipo === 'racha' ? 'config_rachas' : 'catalogo_medallas';
    const { error } = await supabase.from(table).update({ activo: !activo }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: activo ? 'Desactivado' : 'Activado ✅' });
    loadAll();
  };

  const deleteItem = async (tipo: 'reto' | 'racha' | 'medalla', id: string, nombre: string) => {
    const tipoLabel = tipo === 'reto' ? 'reto' : tipo === 'racha' ? 'racha' : 'medalla';
    if (!window.confirm(`¿Seguro que deseas eliminar el ${tipoLabel} "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const table = tipo === 'reto' ? 'catalogo_retos' : tipo === 'racha' ? 'config_rachas' : 'catalogo_medallas';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} eliminado ✅` });
    loadAll();
  };

  const saveItem = async (tipo: string, payload: any, id?: string) => {
    // Validación scope: especialistas no pueden crear/editar fuera de su scope
    if (!isAdmin && permisos) {
      const canalPayload = payload.canal || (payload.operacion ? opToCanalGlobal(payload.operacion) : null);
      const canalesPermitidos = permisos.operaciones.map(opToCanalGlobal).filter(Boolean) as string[];
      if (!canalPayload || !canalesPermitidos.includes(canalPayload)) {
        toast({ title: 'Sin permiso', description: 'No puedes crear/editar elementos para este frente', variant: 'destructive' });
        return;
      }
      if (!payload.pais || !permisos.paises.includes(payload.pais)) {
        toast({ title: 'Sin permiso', description: 'No puedes crear/editar elementos para ese país', variant: 'destructive' });
        return;
      }
    }
    const table = tipo === 'reto' ? 'catalogo_retos' : tipo === 'racha' ? 'config_rachas' : 'catalogo_medallas';
    const action = id
      ? supabase.from(table as any).update(payload).eq('id', id)
      : supabase.from(table as any).insert(payload);
    const { error } = await action;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
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
  if (!isAdmin && !isEspecialista && !isAprobador) return <Navigate to="/dashboard" replace />;

  const tieneVN = isAdmin || (permisos?.operaciones || []).some((op: string) => op.includes('Venta Nueva'));

  return (
    <Layout title="Panel Especialista">
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-border rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <MI icon="shield_person" className="text-primary text-xl" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">Configuración de Gamificación</h2>
              <p className="text-xs text-muted-foreground">
                {isAdmin
                  ? 'Acceso total como Administrador. Puedes configurar retos, rachas y medallas para cualquier país u operación.'
                  : 'Solo puedes crear, editar y activar retos, rachas y medallas dentro del siguiente alcance:'}
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
                  {permisos.paises.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sin países</span>
                  ) : (
                    permisos.paises.map((p) => (
                      <span key={p} className="text-xs font-semibold bg-primary/15 text-primary px-2.5 py-1 rounded-full">
                        {PAISES_LABEL[p] || p}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="bg-card/60 border border-border rounded-xl p-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <MI icon="business_center" className="text-xs" /> Operaciones asignadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {permisos.operaciones.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sin operaciones</span>
                  ) : (
                    permisos.operaciones.map((o) => (
                      <span key={o} className="text-xs font-semibold bg-accent/15 text-accent px-2.5 py-1 rounded-full">
                        {o}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          {isAprobador && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-start gap-2">
              <MI icon="verified_user" className="text-base" />
              <span>
                Eres <strong>Aprobador</strong>. Puedes activar o desactivar retos, rachas y medallas VN,
                pero no crear, editar ni eliminar.
              </span>
            </div>
          )}
        </div>

        {dataLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <Tabs defaultValue="retos" className="w-full">
            <TabsList className={`grid w-full ${tieneVN ? 'grid-cols-6 max-w-3xl' : 'grid-cols-4 max-w-xl'}`}>
              <TabsTrigger value="retos">
                <MI icon="emoji_events" className="text-sm mr-1.5" /> Retos
              </TabsTrigger>
              <TabsTrigger value="rachas">
                <MI icon="local_fire_department" className="text-sm mr-1.5" /> Rachas
              </TabsTrigger>
              <TabsTrigger value="medallas">
                <MI icon="military_tech" className="text-sm mr-1.5" /> Medallas
              </TabsTrigger>
              {tieneVN && (
                <TabsTrigger value="retos-vn">
                  <MI icon="sports_soccer" className="text-sm mr-1.5" /> Retos VN
                </TabsTrigger>
              )}
              {tieneVN && (
                <TabsTrigger value="rachas-vn">
                  <MI icon="bolt" className="text-sm mr-1.5" /> Rachas/Medallas VN
                </TabsTrigger>
              )}
              <TabsTrigger value="logros" onClick={fetchLogros}>🏆 Logros</TabsTrigger>
            </TabsList>

            <TabsContent value="retos" className="mt-6">
              <ItemList
                items={retos}
                tipo="reto"
                permisos={permisos}
                gerentes={gerentes}
                isAdmin={isAdmin}
                isInScope={isInScope}
                onToggle={toggleActivo}
                onEdit={(d) => setEditing({ tipo: 'reto', data: d })}
                onNew={() => setEditing({ tipo: 'reto', data: {} })}
                onDelete={deleteItem}
              />
            </TabsContent>
            <TabsContent value="rachas" className="mt-6">
              <ItemList
                items={rachas}
                tipo="racha"
                permisos={permisos}
                gerentes={gerentes}
                isAdmin={isAdmin}
                isInScope={isInScope}
                onToggle={toggleActivo}
                onEdit={(d) => setEditing({ tipo: 'racha', data: d })}
                onNew={() => setEditing({ tipo: 'racha', data: {} })}
                onDelete={deleteItem}
              />
            </TabsContent>
            <TabsContent value="medallas" className="mt-6">
              <ItemList
                items={medallas}
                tipo="medalla"
                permisos={permisos}
                gerentes={gerentes}
                isAdmin={isAdmin}
                isInScope={isInScope}
                onToggle={toggleActivo}
                onEdit={(d) => setEditing({ tipo: 'medalla', data: d })}
                onNew={() => setEditing({ tipo: 'medalla', data: {} })}
                onDelete={deleteItem}
              />
            </TabsContent>

            {/* ==================== TAB: RETOS VN ==================== */}
            {tieneVN && (
              <TabsContent value="retos-vn" className="mt-6 space-y-6">
                {!isAprobador && (
                  <RetoVNForm
                    editing={editingVN?.tabla === 'retos_vn_config' ? editingVN.data : null}
                    permisos={permisos}
                    isAdmin={isAdmin}
                    onCancel={() => setEditingVN(null)}
                    onSave={(payload, id) => saveVN('retos_vn_config', payload, id)}
                  />
                )}

                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <h3 className="font-semibold text-sm">Retos VN configurados</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {['Nombre','Tipo','KPI','Canal','Países','SP','Fechas','Estado','Acciones'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {retosVN.filter(isInScopeVN).map((r: any) => (
                          <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium">{r.nombre}</td>
                            <td className="px-4 py-2.5"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{r.tipo}</span></td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.kpi}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{(r.canal||[]).join(', ')}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{(r.paises||[]).join(', ')}</td>
                            <td className="px-4 py-2.5 text-xs font-mono">
                              {r.tipo === 'SEMANAL'
                                ? `S1:${r.sp_semanal_sem1} S2:${r.sp_semanal_sem2} S3:${r.sp_semanal_sem3} S4:${r.sp_semanal_sem4}`
                                : r.sp_base}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.fecha_inicio} → {r.fecha_fin}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                                {r.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <button onClick={() => toggleVN('retos_vn_config', r.id, r.activo)}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title={r.activo ? 'Desactivar' : 'Activar'}>
                                  <MI icon={r.activo ? 'toggle_on' : 'toggle_off'} className="text-base" />
                                </button>
                                {!isAprobador && (
                                  <>
                                    <button onClick={() => setEditingVN({ tabla: 'retos_vn_config', data: r })}
                                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                      <MI icon="edit" className="text-base" />
                                    </button>
                                    <button onClick={() => deleteVN('retos_vn_config', r.id, r.nombre)}
                                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                                      <MI icon="delete" className="text-base" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {retosVN.filter(isInScopeVN).length === 0 && (
                          <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin retos VN en tu alcance</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {!isAprobador && (
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <h3 className="font-semibold text-sm">⚙️ Ejecutar evaluación VN</h3>
                    <div className="flex items-end gap-4 flex-wrap">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Fecha a evaluar</label>
                        <input type="date" className={inputClass + ' w-48'} value={evalFechaVN}
                          onChange={(e) => setEvalFechaVN(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">Modo</label>
                        <div className="flex items-center gap-2 pt-1">
                          <Switch checked={evalDryRunVN} onCheckedChange={setEvalDryRunVN} />
                          <span className={`text-xs font-semibold ${evalDryRunVN ? 'text-amber-600' : 'text-green-600'}`}>
                            {evalDryRunVN ? 'Simulación' : 'Evaluación real'}
                          </span>
                        </div>
                      </div>
                      <Button onClick={ejecutarEvaluacionVN} disabled={evalLoadingVN}
                        className={!evalDryRunVN ? 'bg-green-600 hover:bg-green-700' : ''}>
                        {evalLoadingVN ? 'Evaluando…' : evalDryRunVN ? 'Simular' : 'Ejecutar evaluación'}
                      </Button>
                    </div>
                    {evalResultadosVN.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>{['Gerente','País','Reto','Tipo','Cumple','%','SP base','SP+Racha'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {evalResultadosVN.map((r: any, i: number) => (
                              <tr key={i} className={r.cumple ? 'bg-green-50/40' : r.cumple === false ? 'bg-red-50/20' : ''}>
                                <td className="px-3 py-1.5">{r.gerente}</td>
                                <td className="px-3 py-1.5">{r.pais}</td>
                                <td className="px-3 py-1.5">{r.reto}</td>
                                <td className="px-3 py-1.5">{r.tipo ?? '—'}</td>
                                <td className="px-3 py-1.5">{r.cumple === true ? '✅' : r.cumple === false ? '❌' : r.resultado ?? '—'}</td>
                                <td className="px-3 py-1.5">{r.pct ?? '—'}</td>
                                <td className="px-3 py-1.5">{r.spBase ?? r.sp ?? '—'}</td>
                                <td className="px-3 py-1.5 font-semibold text-primary">{r.spConRacha ?? r.sp ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            )}

            {/* ==================== TAB: RACHAS Y MEDALLAS VN ==================== */}
            {tieneVN && (
              <TabsContent value="rachas-vn" className="mt-6 space-y-6">
                {!isAprobador && (
                  <RachaVNForm
                    editing={editingVN?.tabla === 'rachas_vn_config' ? editingVN.data : null}
                    permisos={permisos}
                    isAdmin={isAdmin}
                    retosVN={retosVN.filter(isInScopeVN)}
                    onCancel={() => setEditingVN(null)}
                    onSave={(payload, id) => saveVN('rachas_vn_config', payload, id)}
                  />
                )}

                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <h3 className="font-semibold text-sm">Rachas VN configuradas</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>{['Nombre','Tipo','Días/Sem req.','Multiplicador','Reto vinculado','Canal','Países','Estado','Acciones'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rachasVN.filter(isInScopeVN).map((r: any) => {
                          const retoRef = retosVN.find((rt: any) => rt.id === r.reto_ref_id);
                          return (
                            <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2.5 font-medium">{r.nombre}</td>
                              <td className="px-4 py-2.5"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{r.tipo}</span></td>
                              <td className="px-4 py-2.5 text-center">{r.dias_consecutivos_requeridos}</td>
                              <td className="px-4 py-2.5 font-mono">x{r.multiplicador}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{retoRef?.nombre ?? '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{(r.canal||[]).join(', ')}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{(r.paises||[]).join(', ')}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                                  {r.activo ? 'Activa' : 'Inactiva'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => toggleVN('rachas_vn_config', r.id, r.activo)}
                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                    <MI icon={r.activo ? 'toggle_on' : 'toggle_off'} className="text-base" />
                                  </button>
                                  {!isAprobador && (
                                    <>
                                      <button onClick={() => setEditingVN({ tabla: 'rachas_vn_config', data: r })}
                                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                        <MI icon="edit" className="text-base" />
                                      </button>
                                      <button onClick={() => deleteVN('rachas_vn_config', r.id, r.nombre)}
                                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                                        <MI icon="delete" className="text-base" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {rachasVN.filter(isInScopeVN).length === 0 && (
                          <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin rachas VN en tu alcance</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Medallas VN */}
                {!isAprobador && (
                  <MedallaVNForm
                    editing={editingVN?.tabla === 'medallas_vn_config' ? editingVN.data : null}
                    permisos={permisos}
                    isAdmin={isAdmin}
                    onCancel={() => setEditingVN(null)}
                    onSave={(payload, id) => saveVN('medallas_vn_config', payload, id)}
                  />
                )}

                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <h3 className="font-semibold text-sm">Medallas VN configuradas</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>{['Emoji','Nombre','Condición','Valor','SP','Canal','Países','Estado','Acciones'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {medallasVN.filter(isInScopeVN).map((m: any) => (
                          <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 text-xl">{m.emoji}</td>
                            <td className="px-4 py-2.5 font-medium">{m.nombre}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.condicion_tipo}</td>
                            <td className="px-4 py-2.5 text-xs">{m.condicion_valor}</td>
                            <td className="px-4 py-2.5 font-mono text-xs">{m.sp_reward}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{(m.canal||[]).join(', ')}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{(m.paises||[]).join(', ')}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${m.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                                {m.activo ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <button onClick={() => toggleVN('medallas_vn_config', m.id, m.activo)}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                  <MI icon={m.activo ? 'toggle_on' : 'toggle_off'} className="text-base" />
                                </button>
                                {!isAprobador && (
                                  <>
                                    <button onClick={() => setEditingVN({ tabla: 'medallas_vn_config', data: m })}
                                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                      <MI icon="edit" className="text-base" />
                                    </button>
                                    <button onClick={() => deleteVN('medallas_vn_config', m.id, m.nombre)}
                                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                                      <MI icon="delete" className="text-base" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {medallasVN.filter(isInScopeVN).length === 0 && (
                          <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">Sin medallas VN en tu alcance</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="logros" className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Logros ganados por gerentes</h3>
                  <p className="text-sm text-muted-foreground">Retos completados y medallas desbloqueadas</p>
                </div>
                <Button
                  onClick={handleEjecutarEvaluacion}
                  disabled={ejecutando}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {ejecutando ? '⏳ Evaluando...' : '▶ Ejecutar Evaluación Ahora'}
                </Button>
              </div>
              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
                <select
                  value={logrosFiltro.tipo}
                  onChange={(e) => setLogrosFiltro({ ...logrosFiltro, tipo: e.target.value })}
                  className={inputClass}
                >
                  <option value="TODOS">Todos los tipos</option>
                  <option value="reto">🎯 Retos</option>
                  <option value="racha">🔥 Rachas</option>
                  <option value="medalla">🏅 Medallas</option>
                </select>
                <Input
                  type="date"
                  value={logrosFiltro.desde}
                  onChange={(e) => setLogrosFiltro({ ...logrosFiltro, desde: e.target.value })}
                  placeholder="Desde"
                />
                <Input
                  type="date"
                  value={logrosFiltro.hasta}
                  onChange={(e) => setLogrosFiltro({ ...logrosFiltro, hasta: e.target.value })}
                  placeholder="Hasta"
                />
                <Input
                  placeholder="Buscar gerente o reto…"
                  value={logrosFiltro.q}
                  onChange={(e) => setLogrosFiltro({ ...logrosFiltro, q: e.target.value })}
                  className="md:col-span-2"
                />
              </div>

              <div className="flex items-center gap-4 mb-3 text-sm">
                <span className="px-3 py-1 rounded-full bg-muted font-medium">{logrosFiltrados.length} logros</span>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold">+{totalSpFiltrado} SP Canje</span>
              </div>

              {loadingLogros ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : logrosFiltrados.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-4xl mb-2">🏆</p>
                  <p className="font-medium">No hay logros que coincidan</p>
                  <p className="text-sm mt-1">Ejecuta la evaluación o ajusta los filtros</p>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left text-muted-foreground">
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Gerente</th>
                        <th className="p-2">Canal/País</th>
                        <th className="p-2">Reto / Racha / Medalla</th>
                        <th className="p-2">Ventana</th>
                        <th className="p-2">Período</th>
                        <th className="p-2">Fecha exacta</th>
                        <th className="p-2 text-right">SP Canje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logrosFiltrados.map((l) => (
                        <tr key={l.id} className="border-t hover:bg-muted/30">
                          <td className="p-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              l.tipo === 'reto' ? 'bg-blue-100 text-blue-700'
                              : l.tipo === 'racha' ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {l.tipo === 'reto' ? '🎯 Reto' : l.tipo === 'racha' ? '🔥 Racha' : '🏅 Medalla'}
                            </span>
                          </td>
                          <td className="p-2 font-medium">{l.gerente}</td>
                          <td className="p-2 text-xs text-muted-foreground">{l.canal} · {l.pais}</td>
                          <td className="p-2" title={l.detalle}>{l.nombre}</td>
                          <td className="p-2 text-muted-foreground capitalize">{l.ventana}</td>
                          <td className="p-2 text-muted-foreground">{l.periodo}</td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {l.fecha ? new Date(l.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                          <td className="p-2 font-bold text-green-600 text-right">+{l.sp} SP</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {editing && permisos && (
          <EditDrawer
            tipo={editing.tipo}
            data={editing.data}
            permisos={permisos}
            gerentes={gerentes}
            isAdmin={isAdmin}
            onClose={() => setEditing(null)}
            onSave={(p) => saveItem(editing.tipo, p, editing.data.id)}
          />
        )}
      </div>
    </Layout>
  );
};

const ItemList = ({
  items,
  tipo,
  gerentes = [],
  isAdmin,
  isInScope,
  onToggle,
  onEdit,
  onNew,
  onDelete,
}: any) => {
  const visibleItems = isAdmin ? items : items.filter((it: any) => isInScope(it));
  const banner =
    tipo === 'reto'
      ? 'Los retos activos aparecen automáticamente en el dashboard de cada asesor según su familia (Nube/Legacy). El progreso se calcula en tiempo real desde sus ventas.'
      : tipo === 'racha'
      ? 'Las rachas se evalúan automáticamente. El multiplicador SP se aplica el viernes si el asesor cumplió los días requeridos.'
      : 'Las medallas se desbloquean automáticamente cuando el asesor cumple la condición. Se otorgan una sola vez.';
  return (
  <div className="space-y-3">
    <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 flex items-start gap-2">
      <MI icon="info" className="text-primary text-base mt-0.5" />
      <p className="text-xs text-foreground/80 leading-relaxed">{banner}</p>
    </div>
    <div className="flex justify-between items-center">
      <p className="text-xs text-muted-foreground">{visibleItems.length} elementos</p>
      <Button size="sm" onClick={onNew}>
        <MI icon="add" className="text-sm mr-1" /> Nuevo
      </Button>
    </div>
    {visibleItems.length === 0 && (
      <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
        Sin elementos. Crea el primero con el botón "Nuevo".
      </div>
    )}
    {visibleItems.map((it: any) => {
      const inScope = isInScope(it);
      return (
        <div
          key={it.id}
          className={cn(
            'bg-card border rounded-2xl p-5 flex items-start gap-4 transition-all',
            it.activo ? 'border-primary/40' : 'border-border',
            !inScope && 'opacity-50',
          )}
        >
          <div className="text-2xl">{it.emoji || '🎯'}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-sm font-bold text-foreground">{it.nombre}</h4>
              {it.ventana_tiempo && (
                <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">{it.ventana_tiempo}</span>
              )}
              {it.familia && (
                <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">{it.familia}</span>
              )}
              {it.canal && tipo === 'reto' && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">{it.canal}</span>
              )}
              {it.kpi && (
                <span className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-semibold">
                  {KPIS_RETOS.find(k => k.value === it.kpi)?.label || it.kpi}
                </span>
              )}
              {it.familia_vc && (
                <span className="text-[10px] bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">{it.familia_vc}</span>
              )}
              {it.pais && (
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{it.pais}</span>
              )}
              {it.operacion && (
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{it.operacion}</span>
              )}
              {it.gerente_id && (
                <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <MI icon="person" className="text-[11px]" />
                  {gerentes.find((g: any) => g.id === it.gerente_id)?.nombre || 'Gerente específico'}
                </span>
              )}
              {!it.pais && !it.operacion && !it.gerente_id && (
                <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-semibold">
                  Genérico (sin país/op)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{it.objetivo_descripcion || it.descripcion}</p>
            <p className="text-[11px] text-primary font-semibold mt-1">
              {tipo === 'racha' ? `× ${it.multiplicador_sp || 1.0} SP` : `+${it.sp_otorgados || it.sp || 0} SP`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Switch checked={!!it.activo} disabled={!inScope} onCheckedChange={() => onToggle(tipo, it.id, it.activo)} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!inScope} onClick={() => onEdit(it)}>
                <MI icon="edit" className="text-sm" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!inScope}
                onClick={() => onDelete?.(tipo, it.id, it.nombre)}
                title="Eliminar"
              >
                <MI icon="delete" className="text-sm" />
              </Button>
            </div>
          </div>
        </div>
      );
    })}
  </div>
  );
};

const EditDrawer = ({ tipo, data, permisos, gerentes = [], isAdmin, onClose, onSave }: any) => {
  // Para especialistas: si solo tienen 1 país / 1 operación → forzar y bloquear.
  const paisesPerm: string[] = isAdmin ? ['COL', 'ECU', 'URU', 'MEX'] : (permisos.paises || []);
  const opsPerm: string[] = isAdmin ? OPERACIONES : (permisos.operaciones || []);
  const paisLocked = !isAdmin && paisesPerm.length === 1;
  const opLocked = !isAdmin && opsPerm.length === 1;
  const paisDefault = paisLocked ? paisesPerm[0] : (data.pais || (paisesPerm[0] ?? ''));
  const opDefault = opLocked ? opsPerm[0] : (data.operacion || (opsPerm[0] ?? ''));
  const canalDefault = data.canal || opToCanalGlobal(opDefault) || 'VC';

  const [form, setForm] = useState<any>({
    nombre: data.nombre || '',
    objetivo_descripcion: data.objetivo_descripcion || data.descripcion || '',
    sp_otorgados: data.sp_otorgados ?? data.sp ?? 0,
    sp: data.sp ?? data.sp_otorgados ?? 0,
    emoji: data.emoji || '🎯',
    pais: paisDefault,
    operacion: opDefault,
    gerente_id: data.gerente_id || '',
    activo: data.activo ?? false,
    // reto
    ventana_tiempo: data.ventana_tiempo || 'DIARIO',
    tipo_metrica: data.tipo_metrica || 'UNIDADES',
    familia: data.familia || '',
    umbral: data.umbral ?? 0,
    kpi: data.kpi || 'acv_plus',
    familia_vc: data.familia_vc || 'AMBAS',
    // racha / canal compartido — se sincroniza con la operación
    canal: canalDefault,
    condicion_tipo: data.condicion_tipo || 'VENTA_DIARIA_CONSECUTIVA',
    multiplicador_sp: data.multiplicador_sp ?? 1.5,
    dias_requeridos: data.dias_requeridos ?? 7,
    umbral_verde: data.umbral_verde ?? 1,
    umbral_legacy: data.umbral_legacy ?? 0,
    dias_lun_mie: data.dias_lun_mie ?? false,
    // medalla
    tipo_evento: data.tipo_evento || 'PRIMERA_VENTA',
    cantidad_requerida: data.cantidad_requerida ?? 1,
    fecha_inicio: data.fecha_inicio || '',
    fecha_fin: data.fecha_fin || '',
  });

  // Mantener canal y métricas sincronizados con la operación
  useEffect(() => {
    const canal = opToCanalGlobal(form.operacion);
    if (canal && canal !== form.canal) {
      setForm((f: any) => ({ ...f, canal }));
    }
    // Si la métrica actual no es válida para el canal, resetear a la primera disponible
    const metricasValidas = canal ? METRICAS_POR_CANAL[canal] : TIPO_METRICA;
    if (metricasValidas && !metricasValidas.includes(form.tipo_metrica)) {
      setForm((f: any) => ({ ...f, tipo_metrica: metricasValidas[0] }));
    }
    // Si el KPI actual no aplica al canal, resetear al primero válido
    if (canal) {
      const kpisValidos = KPIS_RETOS.filter(k => k.canales.includes(canal));
      if (form.kpi && !kpisValidos.some(k => k.value === form.kpi)) {
        setForm((f: any) => ({ ...f, kpi: kpisValidos[0]?.value || '' }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.operacion]);

  // Filtrar gerentes según país/canal seleccionado en el formulario
  const canalForm = opToCanalGlobal(form.operacion);
  const gerentesFiltrados = gerentes.filter((g: any) => {
    if (form.pais && g.pais !== form.pais) return false;
    if (canalForm && g.canal !== canalForm) return false;
    return true;
  });

  // Gerente solo aplica para Colombia + Venta Cruzada
  const showGerenteSelector = form.pais === 'COL' && form.operacion === 'Venta Cruzada';

  // Métricas disponibles según canal
  const metricasDisponibles = (canalForm && METRICAS_POR_CANAL[canalForm]) || TIPO_METRICA;

  // Etiqueta dinámica para Nube/Campaña
  const nubeLabel = labelNubeOCampana(form.pais, form.operacion);

  const handleSave = () => {
    // Garantizar país/canal correctos en el payload
    const canalFinal = opToCanalGlobal(form.operacion) || form.canal;
    let payload: any = {
      nombre: form.nombre,
      objetivo_descripcion: form.objetivo_descripcion,
      pais: form.pais || null,
      operacion: form.operacion || null,
      // Si el frente no es COL+VC, gerente_id siempre va null (aplica a todo el país/canal)
      gerente_id: showGerenteSelector ? (form.gerente_id || null) : null,
      activo: form.activo,
      emoji: form.emoji,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
    };
    if (tipo === 'reto') {
      const kpiCfg = KPIS_RETOS.find((k) => k.value === form.kpi);
      const tipoMetricaAuto = canalFinal === 'VC' && kpiCfg ? kpiCfg.tipoMetrica : form.tipo_metrica;
      payload = {
        ...payload,
        canal: canalFinal,
        ventana_tiempo: form.ventana_tiempo,
        tipo_metrica: tipoMetricaAuto,
        familia: canalFinal === 'VC' ? null : (form.familia || null),
        kpi: form.kpi,
        familia_vc: canalFinal === 'VC' ? form.familia_vc : null,
        umbral: Number(form.umbral),
        sp_otorgados: Number(form.sp_otorgados),
      };
    } else if (tipo === 'racha') {
      payload = {
        ...payload,
        canal: canalFinal,
        condicion_tipo: form.condicion_tipo,
        multiplicador_sp: Number(form.multiplicador_sp),
        dias_requeridos: Number(form.dias_requeridos),
        umbral_verde: Number(form.umbral_verde),
        familia_vc: canalFinal === 'VC' ? form.familia_vc : null,
        kpi: form.kpi,
        umbral_legacy: Number(form.umbral_legacy),
        dias_lun_mie: Boolean(form.dias_lun_mie),
      };
    } else {
      payload = {
        ...payload,
        canal: canalFinal,
        descripcion: form.objetivo_descripcion,
        condicion_tipo: form.tipo_evento === 'CANTIDAD_VENTAS_FAMILIA' ? 'cantidad' : 'evento',
        tipo_evento: form.tipo_evento,
        cantidad_requerida: Number(form.cantidad_requerida),
        sp: Number(form.sp),
        producto: canalFinal === 'VC' ? null : (form.familia || null),
      };
    }
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground">
            {data.id ? 'Editar' : 'Nuevo'} {tipo}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <MI icon="close" className="text-lg" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </Field>
          <Field label="Emoji">
            <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <Field label="Descripción del objetivo">
              <Input
                value={form.objetivo_descripcion}
                onChange={(e) => setForm({ ...form, objetivo_descripcion: e.target.value })}
              />
            </Field>
          </div>

          <Field label="País" hint={paisLocked ? 'Asignado por tu perfil de especialista' : (paisesPerm.length === 0 ? 'Sin países asignados' : undefined)}>
            <select
              value={form.pais}
              onChange={(e) => setForm({ ...form, pais: e.target.value, gerente_id: '' })}
              className={cn(inputClass, paisLocked && 'opacity-70 cursor-not-allowed')}
              disabled={paisLocked}
            >
              {!paisLocked && <option value="">— Sin país —</option>}
              {paisesPerm.map((p: string) => (
                <option key={p} value={p}>
                  {PAISES_LABEL[p] || p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Operación (Frente)" hint={opLocked ? 'Asignada por tu perfil de especialista' : undefined}>
            <select
              value={form.operacion}
              onChange={(e) => setForm({ ...form, operacion: e.target.value, gerente_id: '' })}
              className={cn(inputClass, opLocked && 'opacity-70 cursor-not-allowed')}
              disabled={opLocked}
            >
              {!opLocked && <option value="">— Sin operación —</option>}
              {opsPerm.map((o: string) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          {showGerenteSelector && (
            <div className="col-span-2">
              <Field
                label="Gerente asignado (opcional)"
                hint={
                  gerentesFiltrados.length === 0
                    ? 'No hay gerentes en Colombia · Venta Cruzada'
                    : 'Si seleccionas un gerente, esta configuración solo aplicará a su equipo. Déjalo vacío para todo VC Colombia.'
                }
              >
                <select
                  value={form.gerente_id}
                  onChange={(e) => setForm({ ...form, gerente_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">— Aplica a todo VC Colombia —</option>
                  {gerentesFiltrados.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre}{g.celula ? ` · ${g.celula}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {tipo === 'reto' && (() => {
            const kpiCfg = KPIS_RETOS.find(k => k.value === form.kpi) || KPIS_RETOS[0];
            return (
            <>
              <Field label="Canal" hint="Derivado de la operación">
                <select
                  value={form.canal}
                  className={cn(inputClass, 'opacity-70 cursor-not-allowed')}
                  disabled
                >
                  {CANALES_RETOS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="KPI de medición" hint={`KPIs válidos para ${form.canal || 'el canal seleccionado'}`}>
                <select
                  value={form.kpi}
                  onChange={(e) => setForm({ ...form, kpi: e.target.value })}
                  className={inputClass}
                >
                  {KPIS_RETOS.filter(k => !form.canal || k.canales.includes(form.canal)).map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ventana de tiempo">
                <select
                  value={form.ventana_tiempo}
                  onChange={(e) => setForm({ ...form, ventana_tiempo: e.target.value })}
                  className={inputClass}
                >
                  {VENTANAS_OPTS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Field>
              {form.canal === 'VC' && (
                <Field label="Familia VC" hint="A qué segmento aplica este reto">
                  <select
                    value={form.familia_vc}
                    onChange={(e) => setForm({ ...form, familia_vc: e.target.value })}
                    className={inputClass}
                  >
                    {FAMILIAS_VC.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </Field>
              )}
              {form.canal !== 'VC' && (
                <Field
                  label={`Familia de producto (${nubeLabel} / FE)`}
                  hint={form.pais ? `SKUs de ${PAISES_LABEL[form.pais] || form.pais} · define qué productos cuentan` : 'Selecciona un país para ver SKUs'}
                >
                  <select
                    value={form.familia}
                    onChange={(e) => setForm({ ...form, familia: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">— Todas las familias —</option>
                    {(form.pais ? getFamiliesForCountry(form.pais as CountryCode) : (['FE','NUBE','CONTADOR'] as ProductFamily[]))
                      .filter((f) => f !== 'CONTADOR')
                      .map((f) => (
                        <option key={f} value={f}>
                          {f === 'NUBE' ? nubeLabel.toUpperCase() : f}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <Field label={kpiCfg.valorLabel} hint={kpiCfg.valorHint}>
                <Input
                  type="number"
                  value={form.umbral}
                  onChange={(e) => setForm({ ...form, umbral: e.target.value })}
                />
              </Field>
              <Field label="🎁 SP Canje a otorgar (puntos canjeables por premios)">
                <Input
                  type="number"
                  value={form.sp_otorgados}
                  onChange={(e) => setForm({ ...form, sp_otorgados: e.target.value })}
                />
              </Field>
            </>
            );
          })()}

          {tipo === 'racha' && (
            <>
              <Field label="Canal" hint="Derivado de la operación">
                <select
                  value={form.canal}
                  className={cn(inputClass, 'opacity-70 cursor-not-allowed')}
                  disabled
                >
                  <option value="VC">VC</option>
                  <option value="VN_ALIADOS">VN Aliados</option>
                  <option value="VN_EMPRESARIOS">VN Empresarios</option>
                </select>
              </Field>
              <Field label="Condición">
                <select
                  value={form.condicion_tipo}
                  onChange={(e) => setForm({ ...form, condicion_tipo: e.target.value })}
                  className={inputClass}
                >
                  {CONDICIONES_RACHA.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Días consecutivos requeridos" hint="Cuántos días seguidos deben cumplir para activar el multiplicador">
                <Input
                  type="number"
                  value={form.dias_requeridos}
                  onChange={(e) => setForm({ ...form, dias_requeridos: e.target.value })}
                />
              </Field>
              <Field label="Multiplicador SP Canje (ej: 2 = duplica los puntos)" hint="Si logran la racha, sus SP Canje de esa semana se multiplican">
                <Input
                  type="number"
                  step="0.1"
                  value={form.multiplicador_sp}
                  onChange={(e) => setForm({ ...form, multiplicador_sp: e.target.value })}
                />
              </Field>
              {form.canal === 'VC' && (
                <Field label="Familia VC" hint="A qué segmento aplica esta racha">
                  <select
                    value={form.familia_vc}
                    onChange={(e) => setForm({ ...form, familia_vc: e.target.value })}
                    className={inputClass}
                  >
                    {FAMILIAS_VC.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="KPI de medición" hint={`KPIs válidos para ${form.canal || 'el canal seleccionado'}`}>
                <select
                  value={form.kpi}
                  onChange={(e) => setForm({ ...form, kpi: e.target.value })}
                  className={inputClass}
                >
                  {KPIS_RETOS.filter(k => !form.canal || k.canales.includes(form.canal)).map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Umbral Nube (COP o unidades)" hint="Monto o cantidad que deben alcanzar los asesores Nube cada día para mantener la racha">
                <Input
                  type="number"
                  value={form.umbral_verde}
                  onChange={(e) => setForm({ ...form, umbral_verde: e.target.value })}
                />
              </Field>
              {form.canal === 'VC' && (form.familia_vc === 'AMBAS' || form.familia_vc === 'LEGACY') && (
                <Field label="Umbral Legacy (COP o unidades)" hint="Dejar en 0 si esta racha no aplica a Legacy">
                  <Input
                    type="number"
                    value={form.umbral_legacy}
                    onChange={(e) => setForm({ ...form, umbral_legacy: e.target.value })}
                  />
                </Field>
              )}
              {Number(form.dias_requeridos) <= 3 && (
                <Field label="Solo evaluar Lunes-Miércoles" hint="Activa esto para rachas tipo 'El Artillero': el asesor cumple L-M-X y el viernes recibe el multiplicador">
                  <div className="flex items-center h-10">
                    <Switch
                      checked={Boolean(form.dias_lun_mie)}
                      onCheckedChange={(v) => setForm({ ...form, dias_lun_mie: v })}
                    />
                  </div>
                </Field>
              )}
            </>
          )}

          {tipo === 'medalla' && (
            <>
              <Field label="Canal" hint="Derivado de la operación">
                <select
                  value={form.canal}
                  className={cn(inputClass, 'opacity-70 cursor-not-allowed')}
                  disabled
                >
                  <option value="VC">VC</option>
                  <option value="VN_ALIADOS">VN Aliados</option>
                  <option value="VN_EMPRESARIOS">VN Empresarios</option>
                </select>
              </Field>
              <Field label="Tipo de evento">
                <select
                  value={form.tipo_evento}
                  onChange={(e) => setForm({ ...form, tipo_evento: e.target.value })}
                  className={inputClass}
                >
                  {TIPO_EVENTO_MEDALLA_OPTS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              {form.canal !== 'VC' && (
                <Field label="Familia (opcional)" hint={form.pais ? `SKUs de ${PAISES_LABEL[form.pais] || form.pais}` : 'Selecciona un país para ver SKUs'}>
                  <select
                    value={form.familia}
                    onChange={(e) => setForm({ ...form, familia: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">— N/A —</option>
                    {(form.pais ? getFamiliesForCountry(form.pais as CountryCode) : (['FE','NUBE','CONTADOR'] as ProductFamily[])).map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {form.tipo_evento === 'CANTIDAD_VENTAS_FAMILIA' && (
                <Field label="Cantidad de ventas necesarias para desbloquear">
                  <Input
                    type="number"
                    value={form.cantidad_requerida}
                    onChange={(e) => setForm({ ...form, cantidad_requerida: e.target.value })}
                  />
                </Field>
              )}
              <Field label="🎁 SP Canje al desbloquear (se otorgan una sola vez)">
                <Input
                  type="number"
                  value={form.sp}
                  onChange={(e) => setForm({ ...form, sp: e.target.value })}
                />
              </Field>
            </>
          )}

          <Field label="Vigencia desde" hint="Vacío = sin inicio">
            <Input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
          </Field>
          <Field label="Vigencia hasta" hint="Vacío = sin límite">
            <Input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
          </Field>

          <div className="col-span-2 flex items-center gap-2">
            <Switch checked={!!form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
            <span className="text-sm text-foreground font-medium">Activo</span>
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>{data.id ? 'Guardar Cambios' : 'Crear'}</Button>
        </div>
      </div>
    </div>
  );
};

// ============== VN FORMS ==============

const VN_CANAL_OPTS = [
  { value: 'VN_EMPRESARIOS', label: 'VN Empresarios', op: 'Venta Nueva (Empresarios)' },
  { value: 'VN_ALIADOS', label: 'VN Aliados', op: 'Venta Nueva (Aliados)' },
];

const useVNAllowedCanales = (permisos: any, isAdmin: boolean) =>
  VN_CANAL_OPTS.filter(c => isAdmin || (permisos?.operaciones || []).includes(c.op));

const useVNAllowedPaises = (permisos: any, isAdmin: boolean) => {
  const all = ['COL', 'ECU', 'URU', 'MEX'];
  return all.filter(p => isAdmin || (permisos?.paises || []).includes(p));
};

const ArrChips = ({ value, options, onChange }: { value: string[]; options: { value: string; label: string }[]; onChange: (v: string[]) => void }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(o => {
      const on = value.includes(o.value);
      return (
        <button type="button" key={o.value}
          onClick={() => onChange(on ? value.filter(v => v !== o.value) : [...value, o.value])}
          className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${on ? 'bg-primary text-white border-primary' : 'bg-background text-muted-foreground border-border'}`}>
          {o.label}
        </button>
      );
    })}
  </div>
);

const RetoVNForm = ({ editing, permisos, isAdmin, onCancel, onSave }: any) => {
  const allowedCanal = useVNAllowedCanales(permisos, isAdmin);
  const allowedPaises = useVNAllowedPaises(permisos, isAdmin);
  const [form, setForm] = useState<any>(editing || {});
  useEffect(() => { setForm(editing || {}); }, [editing]);
  const tipo = form.tipo || 'DIARIO';
  const kpi = tipo === 'DIARIO' ? 'NUBES' : 'ACV';
  const handleSave = () => {
    if (!form.nombre || !form.fecha_inicio || !form.fecha_fin) return;
    const payload: any = {
      nombre: form.nombre, tipo, kpi,
      canal: form.canal || [], paises: form.paises || [],
      sp_base: Number(form.sp_base ?? (tipo === 'DIARIO' ? 2 : 7)),
      sp_semanal_sem1: Number(form.sp_semanal_sem1 ?? 7),
      sp_semanal_sem2: Number(form.sp_semanal_sem2 ?? 7),
      sp_semanal_sem3: Number(form.sp_semanal_sem3 ?? 5),
      sp_semanal_sem4: Number(form.sp_semanal_sem4 ?? 5),
      acumular_finde_al_viernes: !!form.acumular_finde_al_viernes,
      activo: form.activo ?? true,
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
    };
    onSave(payload, form.id);
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm text-foreground">{form.id ? '✏️ Editar reto VN' : '➕ Nuevo reto VN'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre"><input className={inputClass} value={form.nombre || ''} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Field>
        <Field label="Tipo">
          <select className={inputClass} value={tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
            <option value="DIARIO">Diario</option>
            <option value="SEMANAL">Semanal</option>
            <option value="MENSUAL">Mensual</option>
          </select>
        </Field>
        <Field label="KPI"><input className={inputClass} value={kpi} readOnly /></Field>
        <Field label="Canal"><ArrChips value={form.canal || []} options={allowedCanal.map(c => ({ value: c.value, label: c.label }))} onChange={v => setForm({ ...form, canal: v })} /></Field>
        <Field label="Países"><ArrChips value={form.paises || []} options={allowedPaises.map(p => ({ value: p, label: p }))} onChange={v => setForm({ ...form, paises: v })} /></Field>
        {tipo !== 'SEMANAL' && (
          <Field label="SP base"><input type="number" className={inputClass} value={form.sp_base ?? (tipo === 'DIARIO' ? 2 : 7)} onChange={e => setForm({ ...form, sp_base: e.target.value })} /></Field>
        )}
        {tipo === 'SEMANAL' && (
          <div className="col-span-1 md:col-span-2 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(n => (
              <Field key={n} label={`SP Sem ${n}`}><input type="number" className={inputClass} value={form[`sp_semanal_sem${n}`] ?? (n <= 2 ? 7 : 5)} onChange={e => setForm({ ...form, [`sp_semanal_sem${n}`]: e.target.value })} /></Field>
            ))}
          </div>
        )}
        {tipo === 'DIARIO' && (
          <Field label="Acumular sáb/dom al viernes" hint="Ventas del fin de semana cuentan al viernes anterior">
            <div className="flex items-center gap-2 pt-2"><Switch checked={!!form.acumular_finde_al_viernes} onCheckedChange={v => setForm({ ...form, acumular_finde_al_viernes: v })} /></div>
          </Field>
        )}
        <Field label="Fecha inicio"><input type="date" className={inputClass} value={form.fecha_inicio || ''} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} /></Field>
        <Field label="Fecha fin"><input type="date" className={inputClass} value={form.fecha_fin || ''} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2 pt-2">
        {form.id && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
        <Button onClick={handleSave}>{form.id ? 'Guardar cambios' : 'Crear reto VN'}</Button>
      </div>
    </div>
  );
};

const RachaVNForm = ({ editing, permisos, isAdmin, retosVN, onCancel, onSave }: any) => {
  const allowedCanal = useVNAllowedCanales(permisos, isAdmin);
  const allowedPaises = useVNAllowedPaises(permisos, isAdmin);
  const [form, setForm] = useState<any>(editing || {});
  useEffect(() => { setForm(editing || {}); }, [editing]);
  const tipo = form.tipo || 'DIARIA';
  const retosFiltrados = (retosVN || []).filter((r: any) =>
    (tipo === 'DIARIA' && r.tipo === 'DIARIO') || (tipo === 'SEMANAL' && r.tipo === 'SEMANAL'),
  );
  const handleSave = () => {
    if (!form.nombre || !form.fecha_inicio || !form.fecha_fin) return;
    const payload: any = {
      nombre: form.nombre, tipo,
      dias_consecutivos_requeridos: Number(form.dias_consecutivos_requeridos ?? (tipo === 'DIARIA' ? 3 : 2)),
      multiplicador: Number(form.multiplicador ?? (tipo === 'DIARIA' ? 1.5 : 2.0)),
      reto_ref_id: form.reto_ref_id || null,
      canal: form.canal || [], paises: form.paises || [],
      activo: form.activo ?? true,
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
    };
    onSave(payload, form.id);
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">{form.id ? '✏️ Editar racha VN' : '➕ Nueva racha VN'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre"><input className={inputClass} value={form.nombre || ''} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Field>
        <Field label="Tipo">
          <select className={inputClass} value={tipo} onChange={e => {
            const t = e.target.value;
            setForm({ ...form, tipo: t, dias_consecutivos_requeridos: t === 'DIARIA' ? 3 : 2, multiplicador: t === 'DIARIA' ? 1.5 : 2.0 });
          }}>
            <option value="DIARIA">Diaria</option>
            <option value="SEMANAL">Semanal</option>
          </select>
        </Field>
        <Field label="Días/semanas requeridas" hint="La racha activa el multiplicador al superar este valor">
          <input type="number" className={inputClass} value={form.dias_consecutivos_requeridos ?? (tipo === 'DIARIA' ? 3 : 2)} onChange={e => setForm({ ...form, dias_consecutivos_requeridos: e.target.value })} />
        </Field>
        <Field label="Multiplicador"><input type="number" step="0.1" className={inputClass} value={form.multiplicador ?? (tipo === 'DIARIA' ? 1.5 : 2.0)} onChange={e => setForm({ ...form, multiplicador: e.target.value })} /></Field>
        <Field label="Reto vinculado">
          <select className={inputClass} value={form.reto_ref_id || ''} onChange={e => setForm({ ...form, reto_ref_id: e.target.value })}>
            <option value="">— Ninguno —</option>
            {retosFiltrados.map((r: any) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </Field>
        <div />
        <Field label="Canal"><ArrChips value={form.canal || []} options={allowedCanal.map(c => ({ value: c.value, label: c.label }))} onChange={v => setForm({ ...form, canal: v })} /></Field>
        <Field label="Países"><ArrChips value={form.paises || []} options={allowedPaises.map(p => ({ value: p, label: p }))} onChange={v => setForm({ ...form, paises: v })} /></Field>
        <Field label="Fecha inicio"><input type="date" className={inputClass} value={form.fecha_inicio || ''} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} /></Field>
        <Field label="Fecha fin"><input type="date" className={inputClass} value={form.fecha_fin || ''} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2 pt-2">
        {form.id && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
        <Button onClick={handleSave}>{form.id ? 'Guardar cambios' : 'Crear racha VN'}</Button>
      </div>
    </div>
  );
};

const MEDALLA_VN_CONDICIONES = [
  { value: 'racha_diaria_activada', label: 'Racha diaria activada' },
  { value: 'racha_semanal_activada', label: 'Racha semanal activada' },
  { value: 'reto_diario_completado_n', label: 'N retos diarios completados' },
  { value: 'reto_semanal_completado_n', label: 'N retos semanales completados' },
  { value: 'reto_mensual_completado', label: 'Reto mensual completado' },
  { value: 'cumplimiento_100_pct_mes', label: '100% cumplimiento del mes' },
];

const MedallaVNForm = ({ editing, permisos, isAdmin, onCancel, onSave }: any) => {
  const allowedCanal = useVNAllowedCanales(permisos, isAdmin);
  const allowedPaises = useVNAllowedPaises(permisos, isAdmin);
  const [form, setForm] = useState<any>(editing || {});
  useEffect(() => { setForm(editing || {}); }, [editing]);
  const handleSave = () => {
    if (!form.nombre) return;
    const payload: any = {
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      emoji: form.emoji || '🏅',
      lucide_icon: form.lucide_icon || 'Award',
      condicion_tipo: form.condicion_tipo || 'racha_diaria_activada',
      condicion_valor: Number(form.condicion_valor ?? 1),
      sp_reward: Number(form.sp_reward ?? 5),
      canal: form.canal || [], paises: form.paises || [],
      activo: form.activo ?? true,
      fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null,
    };
    onSave(payload, form.id);
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">{form.id ? '✏️ Editar medalla VN' : '➕ Nueva medalla VN'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre"><input className={inputClass} value={form.nombre || ''} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Field>
        <Field label="Emoji"><input className={inputClass} value={form.emoji || '🏅'} onChange={e => setForm({ ...form, emoji: e.target.value })} /></Field>
        <Field label="Descripción"><input className={inputClass} value={form.descripcion || ''} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></Field>
        <Field label="Condición">
          <select className={inputClass} value={form.condicion_tipo || 'racha_diaria_activada'} onChange={e => setForm({ ...form, condicion_tipo: e.target.value })}>
            {MEDALLA_VN_CONDICIONES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Valor (N)"><input type="number" className={inputClass} value={form.condicion_valor ?? 1} onChange={e => setForm({ ...form, condicion_valor: e.target.value })} /></Field>
        <Field label="SP otorgados"><input type="number" className={inputClass} value={form.sp_reward ?? 5} onChange={e => setForm({ ...form, sp_reward: e.target.value })} /></Field>
        <Field label="Canal"><ArrChips value={form.canal || []} options={allowedCanal.map(c => ({ value: c.value, label: c.label }))} onChange={v => setForm({ ...form, canal: v })} /></Field>
        <Field label="Países"><ArrChips value={form.paises || []} options={allowedPaises.map(p => ({ value: p, label: p }))} onChange={v => setForm({ ...form, paises: v })} /></Field>
      </div>
      <div className="flex gap-2 pt-2">
        {form.id && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
        <Button onClick={handleSave}>{form.id ? 'Guardar cambios' : 'Crear medalla VN'}</Button>
      </div>
    </div>
  );
};

export default AdminEspecialista;
