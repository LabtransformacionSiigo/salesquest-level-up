import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface DetalleRow {
  gerente_id: string;
  gerente_nombre: string;
  reto: string;
  ventana: string;
  kpi: string;
  familia: string;
  umbral: number;
  valor_alcanzado: number;
  cumplido: boolean;
  sp_otorgables: number;
  periodo: string;
  ya_completado: boolean;
}

interface Props {
  /** Países a los que tiene scope el especialista. Vacío = todos */
  paisesScope?: string[];
}

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n * 100) / 100);
};

const AuditoriaRetosVC = ({ paisesScope = [] }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [detalle, setDetalle] = useState<DetalleRow[]>([]);
  const [gerentePais, setGerentePais] = useState<Record<string, string>>({});
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [filtroReto, setFiltroReto] = useState<string>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'CUMPLEN_PENDIENTE' | 'CUMPLEN' | 'CERCA' | 'NO_CUMPLEN'>('CUMPLEN_PENDIENTE');
  const [busqueda, setBusqueda] = useState('');
  const [aplicandoFix, setAplicandoFix] = useState(false);

  const ejecutarAuditoria = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const base = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${base}/functions/v1/evaluar-retos-vc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ dry_run: true }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'Auditoría falló');
      const rows: DetalleRow[] = json.detalle || [];

      // Cargar país de cada gerente para filtrar por scope y mostrar
      const ids = [...new Set(rows.map(r => r.gerente_id))];
      let paisMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: gs } = await supabase
          .from('gerentes').select('id, pais').in('id', ids);
        for (const g of (gs || []) as any[]) paisMap[g.id] = g.pais || '';
      }
      setGerentePais(paisMap);
      setDetalle(rows);
      setLastRun(new Date());
      toast({ title: '✅ Auditoría ejecutada', description: `${rows.length} combinaciones evaluadas` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const aplicarOtorgamiento = async () => {
    if (!confirm('Esto ejecutará la evaluación REAL y otorgará SP Canje a quienes cumplan. ¿Continuar?')) return;
    setAplicandoFix(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const base = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${base}/functions/v1/evaluar-retos-vc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ dry_run: false }),
      });
      const json = await res.json();
      toast({
        title: json?.ok ? '✅ Evaluación aplicada' : '⚠️ Resultado con observaciones',
        description: `Retos otorgados: ${json?.totalRetos ?? 0} · SP: ${json?.totalSp ?? 0}`,
      });
      await ejecutarAuditoria();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setAplicandoFix(false);
    }
  };

  // Filtro por scope del especialista
  const detalleScope = useMemo(() => {
    if (!paisesScope || paisesScope.length === 0) return detalle;
    return detalle.filter(r => {
      const p = gerentePais[r.gerente_id];
      return !p || paisesScope.includes(p);
    });
  }, [detalle, gerentePais, paisesScope]);

  const retosUnicos = useMemo(() => {
    const set = new Set(detalleScope.map(r => r.reto));
    return Array.from(set).sort();
  }, [detalleScope]);

  const filtrado = useMemo(() => {
    return detalleScope.filter(r => {
      if (filtroReto !== 'TODOS' && r.reto !== filtroReto) return false;
      if (busqueda && !r.gerente_nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
      const pct = r.umbral > 0 ? (r.valor_alcanzado / r.umbral) * 100 : 0;
      if (filtroEstado === 'CUMPLEN_PENDIENTE') return r.cumplido && !r.ya_completado;
      if (filtroEstado === 'CUMPLEN') return r.cumplido;
      if (filtroEstado === 'CERCA') return !r.cumplido && pct >= 70;
      if (filtroEstado === 'NO_CUMPLEN') return !r.cumplido;
      return true;
    });
  }, [detalleScope, filtroReto, filtroEstado, busqueda]);

  // Resumen por reto
  const resumenPorReto = useMemo(() => {
    const map = new Map<string, { reto: string; ventana: string; kpi: string; umbral: number; sp: number; total: number; cumplen: number; pendientes: number; otorgados: number }>();
    for (const r of detalleScope) {
      const k = r.reto;
      const cur = map.get(k) || { reto: r.reto, ventana: r.ventana, kpi: r.kpi, umbral: r.umbral, sp: r.sp_otorgables, total: 0, cumplen: 0, pendientes: 0, otorgados: 0 };
      cur.total++;
      if (r.cumplido) {
        cur.cumplen++;
        if (r.ya_completado) cur.otorgados++;
        else cur.pendientes++;
      }
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.pendientes - a.pendientes || a.reto.localeCompare(b.reto));
  }, [detalleScope]);

  const totales = useMemo(() => {
    const cumplen = detalleScope.filter(r => r.cumplido).length;
    const pendientes = detalleScope.filter(r => r.cumplido && !r.ya_completado).length;
    const otorgados = detalleScope.filter(r => r.cumplido && r.ya_completado).length;
    const spPendiente = detalleScope
      .filter(r => r.cumplido && !r.ya_completado)
      .reduce((s, r) => s + (r.sp_otorgables || 0), 0);
    return { total: detalleScope.length, cumplen, pendientes, otorgados, spPendiente };
  }, [detalleScope]);

  return (
    <div className="border border-border rounded-2xl bg-gradient-to-br from-blue-50/50 via-card to-transparent dark:from-blue-950/20 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            🔍 Auditoría de Retos VC
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Simula la evaluación de todos los retos activos VC sobre los datos reales del mes, sin otorgar SP.
            Permite ver <b>quién cumple y por qué no se ha otorgado</b> el SP Canje. Si hay pendientes con SP no otorgado, puedes aplicarlos desde aquí.
          </p>
          {paisesScope.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Alcance: <b>{paisesScope.join(', ')}</b>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={ejecutarAuditoria} disabled={loading} variant="outline">
            {loading ? '⏳ Auditando…' : '🔍 Ejecutar auditoría'}
          </Button>
          {totales.pendientes > 0 && (
            <Button onClick={aplicarOtorgamiento} disabled={aplicandoFix} className="bg-green-600 hover:bg-green-700 text-white">
              {aplicandoFix ? '⏳' : `▶ Otorgar ${totales.pendientes} pendientes (+${totales.spPendiente} SP)`}
            </Button>
          )}
        </div>
      </div>

      {lastRun && (
        <div className="text-[11px] text-muted-foreground">
          Última auditoría: {lastRun.toLocaleString('es-CO')}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-48" />
      ) : detalle.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
          Pulsa <b>Ejecutar auditoría</b> para diagnosticar por qué los gerentes no han recibido SP Canje.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-border rounded-xl bg-card p-3">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Evaluaciones</div>
              <div className="text-2xl font-extrabold tabular-nums">{totales.total}</div>
              <div className="text-[10px] text-muted-foreground">gerente × reto</div>
            </div>
            <div className="border border-border rounded-xl bg-card p-3">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Cumplen</div>
              <div className="text-2xl font-extrabold tabular-nums text-blue-600">{totales.cumplen}</div>
            </div>
            <div className={cn('border rounded-xl p-3', totales.pendientes > 0 ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20' : 'border-border bg-card')}>
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Pendientes de otorgar</div>
              <div className={cn('text-2xl font-extrabold tabular-nums', totales.pendientes > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                {totales.pendientes}
              </div>
              <div className="text-[10px] text-muted-foreground">+{totales.spPendiente} SP</div>
            </div>
            <div className="border border-border rounded-xl bg-card p-3">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Ya otorgados</div>
              <div className="text-2xl font-extrabold tabular-nums text-green-600">{totales.otorgados}</div>
            </div>
          </div>

          {/* Resumen por reto */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="px-4 py-2 bg-muted/40 text-sm font-bold">Resumen por reto</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/20">
                  <tr className="text-left">
                    <th className="p-2 font-semibold">Reto</th>
                    <th className="p-2 font-semibold">Ventana / KPI</th>
                    <th className="p-2 font-semibold text-right">Umbral</th>
                    <th className="p-2 font-semibold text-right">SP</th>
                    <th className="p-2 font-semibold text-right">Gerentes</th>
                    <th className="p-2 font-semibold text-right">Cumplen</th>
                    <th className="p-2 font-semibold text-right">Pendientes</th>
                    <th className="p-2 font-semibold text-right">Otorgados</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenPorReto.map(r => (
                    <tr key={r.reto} className="border-t border-border hover:bg-muted/20 cursor-pointer"
                        onClick={() => { setFiltroReto(r.reto); setFiltroEstado('TODOS'); }}>
                      <td className="p-2 font-medium">{r.reto}</td>
                      <td className="p-2 text-xs text-muted-foreground capitalize">{r.ventana} · {r.kpi}</td>
                      <td className="p-2 text-right tabular-nums">{fmt(r.umbral)}</td>
                      <td className="p-2 text-right tabular-nums">{r.sp}</td>
                      <td className="p-2 text-right tabular-nums">{r.total}</td>
                      <td className="p-2 text-right tabular-nums font-bold text-blue-600">{r.cumplen}</td>
                      <td className={cn('p-2 text-right tabular-nums font-bold', r.pendientes > 0 ? 'text-amber-600' : 'text-muted-foreground')}>{r.pendientes}</td>
                      <td className="p-2 text-right tabular-nums text-green-600">{r.otorgados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Filtros detalle */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select value={filtroReto} onChange={e => setFiltroReto(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="TODOS">Todos los retos</option>
              {retosUnicos.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="CUMPLEN_PENDIENTE">⚠️ Cumplen y aún sin SP</option>
              <option value="CUMPLEN">✅ Todos los que cumplen</option>
              <option value="CERCA">🟡 Cerca (≥70%)</option>
              <option value="NO_CUMPLEN">❌ No cumplen</option>
              <option value="TODOS">Todos</option>
            </select>
            <Input placeholder="Buscar gerente…" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="md:col-span-2" />
          </div>

          {/* Detalle */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="px-4 py-2 bg-muted/40 text-sm font-bold flex items-center justify-between">
              <span>Detalle ({filtrado.length})</span>
              {filtroEstado === 'CUMPLEN_PENDIENTE' && filtrado.length === 0 && totales.cumplen === 0 && (
                <Badge variant="outline" className="text-[10px]">Nadie cumple los umbrales actuales</Badge>
              )}
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2">Gerente</th>
                    <th className="p-2">País</th>
                    <th className="p-2">Reto</th>
                    <th className="p-2">Ventana</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-right">Umbral</th>
                    <th className="p-2 text-right">%</th>
                    <th className="p-2 text-center">Estado</th>
                    <th className="p-2 text-right">SP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrado.slice(0, 500).map((r, i) => {
                    const pct = r.umbral > 0 ? (r.valor_alcanzado / r.umbral) * 100 : 0;
                    let estado: { txt: string; cls: string };
                    if (r.cumplido && r.ya_completado) estado = { txt: '✅ SP otorgado', cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' };
                    else if (r.cumplido) estado = { txt: '⚠️ Cumple sin SP', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' };
                    else if (pct >= 70) estado = { txt: '🟡 Cerca', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300' };
                    else estado = { txt: '❌ No cumple', cls: 'bg-muted text-muted-foreground' };
                    return (
                      <tr key={i} className="border-t border-border hover:bg-muted/20">
                        <td className="p-2 font-medium">{r.gerente_nombre}</td>
                        <td className="p-2 text-xs text-muted-foreground">{gerentePais[r.gerente_id] || '—'}</td>
                        <td className="p-2 text-xs">{r.reto}</td>
                        <td className="p-2 text-xs text-muted-foreground capitalize">{r.ventana}</td>
                        <td className="p-2 text-right tabular-nums">{fmt(r.valor_alcanzado)}</td>
                        <td className="p-2 text-right tabular-nums text-muted-foreground">{fmt(r.umbral)}</td>
                        <td className={cn('p-2 text-right tabular-nums font-bold', pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-muted-foreground')}>
                          {pct.toFixed(0)}%
                        </td>
                        <td className="p-2 text-center">
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap', estado.cls)}>{estado.txt}</span>
                        </td>
                        <td className="p-2 text-right tabular-nums font-bold">{r.sp_otorgables}</td>
                      </tr>
                    );
                  })}
                  {filtrado.length === 0 && (
                    <tr><td colSpan={9} className="p-8 text-center text-muted-foreground text-sm">Sin resultados con los filtros actuales</td></tr>
                  )}
                </tbody>
              </table>
              {filtrado.length > 500 && (
                <div className="p-2 text-center text-xs text-muted-foreground border-t border-border">
                  Mostrando 500 de {filtrado.length}. Refina filtros para ver más.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditoriaRetosVC;
