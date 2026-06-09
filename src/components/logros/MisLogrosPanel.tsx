import { useEffect, useMemo, useState } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SpRow {
  id?: string;
  fuente: string;
  sp: number;
  periodo: string;
  detalle: string | null;
  created_at?: string;
}

interface CanjeRow {
  id: string;
  premio_nombre: string | null;
  puntos_gastados: number;
  fecha_canje: string;
  estado: string;
}

interface RetoAsignado {
  id: string;
  nombre: string;
  tipo: string;
  sp_total: number;
  fuente: 'VC' | 'VN';
  ganados: number;
  sp_ganado: number;
  emoji?: string;
  familia?: string | null;
  kpi?: string | null;
}

const FUENTE_META: Record<string, { label: string; icon: string; color: string }> = {
  RETO_DIARIO: { label: 'Reto diario', icon: '📅', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  RETO_SEMANAL: { label: 'Reto semanal', icon: '📆', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  RETO_MENSUAL: { label: 'Reto mensual', icon: '🗓️', color: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  MEDALLA: { label: 'Medalla', icon: '🏅', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  RECONOCIMIENTO_RECIBIDO: { label: 'Reconocimiento recibido', icon: '💌', color: 'bg-pink-500/10 text-pink-700 dark:text-pink-300' },
  RECONOCIMIENTO_ENVIADO: { label: 'Reconocimiento enviado', icon: '✉️', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
};

const parseNombre = (fuente: string, detalle: string | null) => {
  if (!detalle) return FUENTE_META[fuente]?.label || fuente;
  const splitter = detalle.includes(' — ') ? ' — ' : (detalle.includes(' - ') ? ' - ' : null);
  if (splitter) return detalle.split(splitter)[0].trim();
  return detalle;
};

const fmtFecha = (s?: string) => s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MisLogrosPanel = ({ hideAssignedRetos = false }: { hideAssignedRetos?: boolean }) => {
  const { profile } = useSupabaseAuthContext();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SpRow[]>([]);
  const [canjes, setCanjes] = useState<CanjeRow[]>([]);
  const [retosAsignados, setRetosAsignados] = useState<RetoAsignado[]>([]);
  const [saldoConsolidado, setSaldoConsolidado] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const cargar = async () => {
    if (!profile?.id) return;
    const mes = new Date().toISOString().slice(0, 7);
    const canal = (profile as any).canal as string | null;
    const pais = (profile as any).pais as string | null;
    const familia = (profile as any).familia_vc as string | null;

    const isVn = canal && canal !== 'VC';
    const [spRes, canjesRes, vcRes, vnRes, saldoRes, vnDiarioRes, vnSemanalRes, vnMensualRes, vnCatalogRes] = await Promise.all([
      supabase
        .from('sp_acumulados')
        .select('fuente, sp, periodo, detalle, created_at, tipo_sp')
        .eq('gerente_id', profile.id)
        .or('tipo_sp.eq.canje,tipo_sp.is.null')
        .in('fuente', ['RETO_DIARIO','RETO_SEMANAL','RETO_MENSUAL','MEDALLA','RECONOCIMIENTO_RECIBIDO','RECONOCIMIENTO_ENVIADO'])
        .gt('sp', 0)
        .order('created_at', { ascending: false }),
      supabase
        .from('canjes')
        .select('id, puntos_gastados, fecha_canje, estado, premios(nombre)')
        .eq('gerente_id', profile.id)
        .order('fecha_canje', { ascending: false }),
      canal === 'VC' && !hideAssignedRetos
        ? supabase
            .from('catalogo_retos')
            .select('id, nombre, ventana_tiempo, sp_otorgados, emoji, familia, kpi, pais, canal, familia_vc, activo')
            .eq('activo', true)
        : Promise.resolve({ data: [] as any[] }),
      canal && canal !== 'VC' && !hideAssignedRetos
        ? supabase
            .from('retos_vn_config')
            .select('id, nombre, tipo, sp_base, sp_semanal_sem1, sp_semanal_sem2, sp_semanal_sem3, sp_semanal_sem4, kpi, paises, canal, activo, fecha_inicio, fecha_fin')
            .eq('activo', true)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from('gerentes')
        .select('sp_canje')
        .eq('id', profile.id)
        .maybeSingle(),
      isVn
        ? supabase.from('retos_vn_progreso_diario' as any).select('reto_id, fecha_evaluacion, sp_otorgados, sp_con_racha, cumple, evaluado_at').eq('gerente_id', profile.id).eq('cumple', true)
        : Promise.resolve({ data: [] as any[] }),
      isVn
        ? supabase.from('retos_vn_progreso_semanal' as any).select('reto_id, anio_mes, semana_numero, sp_otorgados, sp_con_racha, cumple, evaluado_at').eq('gerente_id', profile.id).eq('cumple', true)
        : Promise.resolve({ data: [] as any[] }),
      isVn
        ? supabase.from('retos_vn_progreso_mensual' as any).select('reto_id, anio_mes, sp_otorgados, cumple, evaluado_at').eq('gerente_id', profile.id).eq('cumple', true)
        : Promise.resolve({ data: [] as any[] }),
      isVn
        ? supabase.from('retos_vn_config' as any).select('id, nombre, tipo')
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const retoNameById = new Map(((vnCatalogRes.data || []) as any[]).map((r) => [String(r.id), String(r.nombre || '')]));
    const vnProgressRows: SpRow[] = [
      ...((vnDiarioRes.data || []) as any[]).map((r) => ({
        fuente: 'RETO_DIARIO',
        sp: Number(r.sp_con_racha ?? r.sp_otorgados) || 0,
        periodo: String(r.fecha_evaluacion || ''),
        detalle: `${retoNameById.get(String(r.reto_id)) || 'Reto diario'} — DIARIO`,
        created_at: r.evaluado_at,
      })),
      ...((vnSemanalRes.data || []) as any[]).map((r) => ({
        fuente: 'RETO_SEMANAL',
        sp: Number(r.sp_con_racha ?? r.sp_otorgados) || 0,
        periodo: `${r.anio_mes}-S${r.semana_numero}`,
        detalle: `${retoNameById.get(String(r.reto_id)) || 'Reto semanal'} — SEMANAL`,
        created_at: r.evaluado_at,
      })),
      ...((vnMensualRes.data || []) as any[]).map((r) => ({
        fuente: 'RETO_MENSUAL',
        sp: Number(r.sp_otorgados) || 0,
        periodo: String(r.anio_mes || ''),
        detalle: `${retoNameById.get(String(r.reto_id)) || 'Reto mensual'} — MENSUAL`,
        created_at: r.evaluado_at,
      })),
    ].filter((r) => r.periodo);
    const baseRows = (spRes.data || []) as SpRow[];
    const spRows = vnProgressRows.length > 0
      ? [...baseRows.filter((r) => !String(r.fuente || '').startsWith('RETO_')), ...vnProgressRows]
      : baseRows;
    setRows(spRows);
    setSaldoConsolidado(Number((saldoRes.data as any)?.sp_canje ?? (profile as any)?.sp_canje ?? 0) || 0);
    setCanjes(((canjesRes.data || []) as any[]).map(c => ({
      id: c.id,
      puntos_gastados: c.puntos_gastados,
      fecha_canje: c.fecha_canje,
      estado: c.estado,
      premio_nombre: c.premios?.nombre || null,
    })));

    const mesYYYYMM = mes.replace('-', '');
    const norm = (s: string) => (s || '').normalize('NFKD').replace(/\s+/g, ' ').trim().toLowerCase();
    const retoSpRows = spRows.filter(r =>
      typeof r.fuente === 'string' &&
      r.fuente.startsWith('RETO_') &&
      (r.periodo?.startsWith(mes) || r.periodo?.startsWith(mesYYYYMM))
    );
    const matchReto = (nombre: string) => {
      const n = norm(nombre);
      let count = 0, sp = 0;
      for (const r of retoSpRows) {
        const d = norm(r.detalle || '');
        if (d === n || d.startsWith(n + ' ') || d.startsWith(n + ' —') || d.startsWith(n + ' ·') || d.startsWith(n + ' -')) {
          count++;
          sp += Number(r.sp) || 0;
        }
      }
      return { count, sp };
    };

    const asignados: RetoAsignado[] = [];
    for (const r of (vcRes.data || []) as any[]) {
      if (pais && r.pais && r.pais !== pais) continue;
      if (r.canal && r.canal !== 'VC') continue;
      if (familia && r.familia_vc && r.familia_vc !== familia) continue;
      const g = matchReto(r.nombre);
      asignados.push({
        id: r.id, nombre: r.nombre, tipo: String(r.ventana_tiempo || '').toUpperCase(),
        sp_total: Number(r.sp_otorgados || 0), fuente: 'VC',
        ganados: g.count, sp_ganado: g.sp, emoji: r.emoji,
        familia: r.familia || r.familia_vc, kpi: r.kpi,
      });
    }
    for (const r of (vnRes.data || []) as any[]) {
      const paises: string[] = r.paises || [];
      const canales: string[] = r.canal || [];
      if (pais && paises.length && !paises.includes(pais)) continue;
      if (canal && canales.length && !canales.includes(canal)) continue;
      const sp_total = r.tipo === 'SEMANAL'
        ? Number(r.sp_semanal_sem1 || 0) + Number(r.sp_semanal_sem2 || 0) + Number(r.sp_semanal_sem3 || 0) + Number(r.sp_semanal_sem4 || 0)
        : Number(r.sp_base || 0);
      const g = matchReto(r.nombre);
      asignados.push({
        id: r.id, nombre: r.nombre, tipo: r.tipo,
        sp_total, fuente: 'VN', ganados: g.count, sp_ganado: g.sp, kpi: r.kpi,
      });
    }

    setRetosAsignados(asignados);
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    if (!profile?.id) return;
    setLoading(true);
    cargar();
    const interval = setInterval(cargar, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const totales = useMemo(() => {
    let ganado = 0;
    for (const r of rows) ganado += Number(r.sp) || 0;
    const gastado = canjes
      .filter(c => c.estado !== 'rechazado')
      .reduce((s, c) => s + Number(c.puntos_gastados || 0), 0);
    const saldoPerfil = Math.max(Number((profile as any)?.sp_canje) || 0, saldoConsolidado);
    const saldoHistorial = Math.max(ganado - gastado, 0);

    // El encabezado viene del saldo consolidado del perfil. Si el historial de
    // sp_acumulados aún no trae detalle, Mis Logros debe reconciliarse con ese
    // saldo para no mostrar 0 cuando el usuario sí tiene SP Canje disponible.
    const saldo = Math.max(saldoHistorial, saldoPerfil);
    return { ganado: Math.max(ganado, saldo + gastado), gastado, saldo, reconciliado: saldoPerfil > saldoHistorial };
  }, [rows, canjes, profile, saldoConsolidado]);

  const renderTabla = (filtro: (r: SpRow) => boolean, emptyMsg: string) => {
    const list = rows.filter(filtro);
    if (list.length === 0) {
      if (totales.reconciliado && filtro({ fuente: 'RETO_DIARIO', sp: totales.saldo, periodo: '', detalle: null })) {
        return (
          <div className="overflow-x-auto border border-border rounded-xl bg-card">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-medium">Saldo SP Canje consolidado</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300">
                      🎁 SP Canje
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground tabular-nums">—</td>
                  <td className="p-3 text-xs text-muted-foreground">—</td>
                  <td className="p-3 text-right tabular-nums font-bold text-accent">+{totales.saldo}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }
      return (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          {emptyMsg}
        </div>
      );
    }
    return (
      <div className="overflow-x-auto border border-border rounded-xl bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-bold">Logro</th>
              <th className="text-left p-3 font-bold w-32">Tipo</th>
              <th className="text-left p-3 font-bold w-28">Periodo</th>
              <th className="text-left p-3 font-bold w-32">Fecha</th>
              <th className="text-right p-3 font-bold w-24">SP Canje</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const meta = FUENTE_META[r.fuente];
              return (
                <tr key={i} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-medium">{parseNombre(r.fuente, r.detalle)}</td>
                  <td className="p-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold', meta?.color)}>
                      {meta?.icon} {meta?.label || r.fuente}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground tabular-nums">{r.periodo}</td>
                  <td className="p-3 text-xs text-muted-foreground">{fmtFecha(r.created_at)}</td>
                  <td className="p-3 text-right tabular-nums font-bold text-accent">+{r.sp}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-bold">
              <td colSpan={4} className="p-3 text-right">Subtotal</td>
              <td className="p-3 text-right tabular-nums text-accent">
                +{list.reduce((s, r) => s + Number(r.sp || 0), 0)} SP
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  if (loading) return <Skeleton className="h-96" />;
  const logrosCount = rows.length || (totales.reconciliado ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-2xl bg-gradient-to-br from-accent/10 via-primary/5 to-transparent p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-secondary flex items-center gap-2">🏆 Mis Logros</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Aquí ves todos los retos, medallas y reconocimientos que has desbloqueado, y cómo se acumulan en tu saldo de <b>SP Canje</b>.
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            Auto-actualiza cada 5 min · Última: {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {!hideAssignedRetos && retosAsignados.length > 0 && (
        <div className="border border-border rounded-2xl bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-secondary flex items-center gap-2">🎯 Retos activos asignados a ti</h3>
              <p className="text-xs text-muted-foreground">
                Filtrados por tu frente: <b>{(profile as any).pais || '—'}</b> · <b>{(profile as any).canal || '—'}</b>
                {(profile as any).familia_vc ? <> · <b>{(profile as any).familia_vc}</b></> : null}
              </p>
            </div>
            <Badge variant="outline">{retosAsignados.length} retos</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {retosAsignados
              .sort((a, b) => (b.ganados - a.ganados) || a.nombre.localeCompare(b.nombre))
              .map(r => {
                const desbloqueado = r.ganados > 0;
                return (
                  <div key={`${r.fuente}-${r.id}`} className={cn('border rounded-xl p-3 transition-all', desbloqueado ? 'border-accent bg-accent/5' : 'border-border bg-muted/20')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <span>{r.emoji || (r.tipo === 'DIARIO' ? '📅' : r.tipo === 'SEMANAL' ? '📆' : '🗓️')}</span>
                          {r.tipo || '—'} · {r.fuente}
                        </div>
                        <div className="text-sm font-bold text-foreground truncate" title={r.nombre}>{r.nombre}</div>
                        {r.kpi && <div className="text-[10px] text-muted-foreground mt-0.5">KPI: {r.kpi}</div>}
                      </div>
                      <Badge className={cn('shrink-0 text-[10px]', desbloqueado ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                        {desbloqueado ? `✓ GANADO ×${r.ganados}` : 'PENDIENTE'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">SP potencial: <b className="text-foreground">{r.sp_total}</b></span>
                      <span className={cn('font-bold tabular-nums', desbloqueado ? 'text-accent' : 'text-muted-foreground')}>
                        {desbloqueado ? `+${r.sp_ganado} SP` : '0 SP'}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase font-bold">SP ganado</div>
          <div className="text-3xl font-extrabold text-accent tabular-nums mt-1">+{totales.ganado}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Retos + Medallas + Reconocimientos</div>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase font-bold">SP canjeado</div>
          <div className="text-3xl font-extrabold text-destructive tabular-nums mt-1">−{totales.gastado}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Premios y beneficios canjeados</div>
        </div>
        <div className="border-2 border-accent rounded-xl bg-accent/5 p-4">
          <div className="text-xs text-accent uppercase font-bold">Saldo disponible</div>
          <div className="text-3xl font-extrabold text-accent tabular-nums mt-1">{totales.saldo}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Ganado − Canjeado</div>
        </div>
        <div className="border border-border rounded-xl bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase font-bold">Logros desbloqueados</div>
          <div className="text-3xl font-extrabold text-primary tabular-nums mt-1">{logrosCount}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Total histórico</div>
        </div>
      </div>

      {/* Resumen por fuente — mismo desglose que ve el Especialista en su tabla */}
      {(() => {
        const FUENTES = ['RETO_DIARIO','RETO_SEMANAL','RETO_MENSUAL','MEDALLA','RECONOCIMIENTO_RECIBIDO'] as const;
        const mesYYYYMM = new Date().toISOString().slice(0,7);
        const mesAlt = mesYYYYMM.replace('-','');
        const resumen = FUENTES.map(f => {
          const all = rows.filter(r => r.fuente === f);
          const mes = all.filter(r => r.periodo?.startsWith(mesYYYYMM) || r.periodo?.startsWith(mesAlt));
          return {
            fuente: f,
            meta: FUENTE_META[f],
            mesCount: mes.length,
            mesSp: mes.reduce((s,r)=>s+Number(r.sp||0),0),
            totalCount: all.length,
            totalSp: all.reduce((s,r)=>s+Number(r.sp||0),0),
          };
        }).filter(x => x.totalCount > 0);
        if (resumen.length === 0) return null;
        return (
          <div className="border border-border rounded-2xl bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-secondary flex items-center gap-2">📊 Resumen SP Canje por fuente</h3>
              <span className="text-xs text-muted-foreground">Mismo desglose que ve tu Especialista</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-2 font-bold">Fuente</th>
                    <th className="text-right p-2 font-bold">Este mes</th>
                    <th className="text-right p-2 font-bold">SP este mes</th>
                    <th className="text-right p-2 font-bold">Total 2026</th>
                    <th className="text-right p-2 font-bold">SP total</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map(r => (
                    <tr key={r.fuente} className="border-t border-border">
                      <td className="p-2">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold', r.meta?.color)}>
                          {r.meta?.icon} {r.meta?.label}
                        </span>
                      </td>
                      <td className="p-2 text-right tabular-nums">{r.mesCount}</td>
                      <td className="p-2 text-right tabular-nums font-bold text-accent">+{r.mesSp}</td>
                      <td className="p-2 text-right tabular-nums">{r.totalCount}</td>
                      <td className="p-2 text-right tabular-nums font-bold text-accent">+{r.totalSp}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="p-2">Total</td>
                    <td className="p-2 text-right tabular-nums">{resumen.reduce((s,r)=>s+r.mesCount,0)}</td>
                    <td className="p-2 text-right tabular-nums text-accent">+{resumen.reduce((s,r)=>s+r.mesSp,0)}</td>
                    <td className="p-2 text-right tabular-nums">{resumen.reduce((s,r)=>s+r.totalCount,0)}</td>
                    <td className="p-2 text-right tabular-nums text-accent">+{resumen.reduce((s,r)=>s+r.totalSp,0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}



      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="grid grid-cols-5 w-full bg-card border border-border">
          <TabsTrigger value="todos">Todos ({logrosCount})</TabsTrigger>
          <TabsTrigger value="retos">🎯 Retos</TabsTrigger>
          <TabsTrigger value="medallas">🏅 Medallas</TabsTrigger>
          <TabsTrigger value="reconocimientos">💌 Reconocimientos</TabsTrigger>
          <TabsTrigger value="canjes">🎁 Canjes ({canjes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="todos" className="mt-4">{renderTabla(() => true, 'Aún no has desbloqueado logros. ¡Sigue jugando!')}</TabsContent>
        <TabsContent value="retos" className="mt-4">{renderTabla(r => r.fuente.startsWith('RETO_'), 'Aún no has ganado retos.')}</TabsContent>
        <TabsContent value="medallas" className="mt-4">{renderTabla(r => r.fuente === 'MEDALLA', 'Aún no has desbloqueado medallas.')}</TabsContent>
        <TabsContent value="reconocimientos" className="mt-4">{renderTabla(r => r.fuente.startsWith('RECONOCIMIENTO_'), 'Aún no tienes reconocimientos.')}</TabsContent>
        <TabsContent value="canjes" className="mt-4">
          {canjes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">Aún no has canjeado premios.</div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-xl bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-3 font-bold">Premio</th>
                    <th className="text-left p-3 font-bold w-32">Fecha</th>
                    <th className="text-left p-3 font-bold w-32">Estado</th>
                    <th className="text-right p-3 font-bold w-28">SP gastados</th>
                  </tr>
                </thead>
                <tbody>
                  {canjes.map(c => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                      <td className="p-3 font-medium">{c.premio_nombre || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{fmtFecha(c.fecha_canje)}</td>
                      <td className="p-3">
                        <Badge variant={c.estado === 'rechazado' ? 'destructive' : c.estado === 'aprobado' || c.estado === 'entregado' ? 'default' : 'secondary'}>
                          {c.estado}
                        </Badge>
                      </td>
                      <td className={cn('p-3 text-right tabular-nums font-bold', c.estado === 'rechazado' ? 'line-through text-muted-foreground' : 'text-destructive')}>
                        −{c.puntos_gastados}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MisLogrosPanel;
