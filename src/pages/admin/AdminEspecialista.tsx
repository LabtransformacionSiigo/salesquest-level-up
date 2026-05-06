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
  { value: 'acv_plus', label: '💰 ACV+ (monto en pesos)', shortLabel: 'ACV', valorLabel: 'Meta en pesos COP (ej: 15000000)', valorHint: 'Los asesores deben superar este monto', tipoMetrica: 'ACV' },
  { value: 'upgrades', label: '⬆️ Upgrades (cantidad)', shortLabel: 'Upgrades', valorLabel: 'Número de upgrades requeridos', valorHint: 'Los asesores deben alcanzar esta cantidad', tipoMetrica: 'UNIDADES' },
  { value: 'conversiones', label: '🔄 Conversiones (% sobre cuota)', shortLabel: 'Conversiones', valorLabel: '% mínimo de conversiones (ej: 33)', valorHint: 'Porcentaje mínimo de conversiones requerido', tipoMetrica: 'UNIDADES' },
  { value: 'cumplimiento_pct', label: '🎯 % Cumplimiento de meta', shortLabel: '% Cumplimiento', valorLabel: '% de cumplimiento requerido (ej: 120)', valorHint: 'Porcentaje de la meta que deben alcanzar', tipoMetrica: 'CUMPLIMIENTO_META_ACV_PLUS' },
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

  const isAdmin = profile?.role === 'admin';
  const isEspecialista = profile?.role === 'especialista';

  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isEspecialista)) return;
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
    setPermisos(perm);

    // Gerentes en scope (filtrados por país y canal del especialista; admin ve todos)
    let gerentesQuery = supabase.from('gerentes').select('id, nombre, canal, pais, celula').eq('activo', true).order('nombre');
    if (!isAdmin) {
      const canales = perm.operaciones.map(operacionToCanal).filter(Boolean) as string[];
      if (perm.paises.length > 0) gerentesQuery = gerentesQuery.in('pais', perm.paises);
      if (canales.length > 0) gerentesQuery = gerentesQuery.in('canal', canales);
    }

    const [r1, r2, r3, gQ] = await Promise.all([
      supabase.from('catalogo_retos').select('*').order('ventana_tiempo'),
      supabase.from('config_rachas').select('*').order('nombre'),
      supabase.from('catalogo_medallas').select('*').order('nombre'),
      gerentesQuery,
    ]);
    setRetos(r1.data || []);
    setRachas(r2.data || []);
    setMedallas(r3.data || []);
    setGerentes(gQ.data || []);
    setDataLoading(false);
  };

  const isInScope = (item: any) => {
    if (isAdmin) return true;
    if (!permisos) return false;
    const paisOk = !item.pais || permisos.paises.includes(item.pais);
    // Mapear canal del item (VC / VN_ALIADOS / VN_EMPRESARIOS) a la operación equivalente
    const canalToOp: Record<string, string> = {
      VC: 'Venta Cruzada',
      VN_ALIADOS: 'Venta Nueva (Aliados)',
      VN_EMPRESARIOS: 'Venta Nueva (Empresarios)',
    };
    const opFromCanal = item.canal ? canalToOp[item.canal] : null;
    const opEffective = item.operacion || opFromCanal;
    const opOk = !opEffective || permisos.operaciones.includes(opEffective);
    return paisOk && opOk;
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
  if (!isAdmin && !isEspecialista) return <Navigate to="/dashboard" replace />;

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
        </div>

        {dataLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <Tabs defaultValue="retos" className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-xl">
              <TabsTrigger value="retos">
                <MI icon="emoji_events" className="text-sm mr-1.5" /> Retos
              </TabsTrigger>
              <TabsTrigger value="rachas">
                <MI icon="local_fire_department" className="text-sm mr-1.5" /> Rachas
              </TabsTrigger>
              <TabsTrigger value="medallas">
                <MI icon="military_tech" className="text-sm mr-1.5" /> Medallas
              </TabsTrigger>
              <TabsTrigger value="logros" onClick={fetchLogros}>🏆 Logros Ganados</TabsTrigger>
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
              {loadingLogros ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : logros.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-4xl mb-2">🏆</p>
                  <p className="font-medium">Aún no hay logros registrados</p>
                  <p className="text-sm mt-1">Ejecuta la evaluación para que el sistema otorgue SP Canje a los gerentes que cumplieron retos</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Tipo</th>
                        <th className="pb-2 pr-4">Gerente</th>
                        <th className="pb-2 pr-4">Reto / Medalla</th>
                        <th className="pb-2 pr-4">Período</th>
                        <th className="pb-2 pr-4">Ventana</th>
                        <th className="pb-2">SP Canje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logros.map((l, i) => (
                        <tr key={i} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.tipo === 'reto' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {l.tipo === 'reto' ? '🎯 Reto' : '🏅 Medalla'}
                            </span>
                          </td>
                          <td className="py-2 pr-4 font-medium">{l.gerente}</td>
                          <td className="py-2 pr-4">{l.nombre}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{l.periodo}</td>
                          <td className="py-2 pr-4 text-muted-foreground capitalize">{l.ventana}</td>
                          <td className="py-2 font-bold text-green-600">+{l.sp} SP</td>
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
              <Field label="KPI de medición">
                <select
                  value={form.kpi}
                  onChange={(e) => setForm({ ...form, kpi: e.target.value })}
                  className={inputClass}
                >
                  {KPIS_RETOS.map((k) => (
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
                <Field label="Tipo de métrica" hint={`Métricas válidas para ${canalForm || form.operacion || 'el frente'}`}>
                  <select
                    value={form.tipo_metrica}
                    onChange={(e) => setForm({ ...form, tipo_metrica: e.target.value })}
                    className={inputClass}
                  >
                    {metricasDisponibles.map((t) => (
                      <option key={t} value={t}>
                        {t === 'NUBE' ? nubeLabel.toUpperCase() : t}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
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
              <Field label="KPI de medición">
                <select
                  value={form.kpi}
                  onChange={(e) => setForm({ ...form, kpi: e.target.value })}
                  className={inputClass}
                >
                  {KPIS_RETOS.map((k) => (
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

export default AdminEspecialista;
