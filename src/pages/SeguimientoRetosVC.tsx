import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Layout from '@/components/layout/Layout';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';


interface RetoDetalle {
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

interface RachaDetalle {
  gerente_id: string;
  gerente_nombre: string;
  racha: string;
  umbral: number;
  dias: { fecha: string; total: number }[];
  dias_cumplidos: number;
  cumple: boolean;
  sp: number;
  ya_completado: boolean;
}

interface DryRunResponse {
  ok: boolean;
  dry_run: boolean;
  detalle: RetoDetalle[];
  rachaSimulacion: RachaDetalle[];
}

const fmtValor = (kpi: string, v: number, umbral: number) => {
  if (kpi === 'acv_plus') return `$${(v / 1_000_000).toFixed(1)}M / $${(umbral / 1_000_000).toFixed(0)}M`;
  if (kpi === 'cumplimiento_pct' || kpi === 'conversiones') return `${v.toFixed(1)}% / ${umbral}%`;
  return `${Math.round(v)} / ${umbral}`;
};

const ventanaLabel = (v: string) =>
  v === 'diario' ? 'Diario' : v === 'semanal' ? 'Semanal' : v === 'mensual' ? 'Mensual' : v;

const ventanaColor = (v: string) =>
  v === 'diario' ? 'bg-blue-500/10 text-blue-600 border-blue-200'
    : v === 'semanal' ? 'bg-purple-500/10 text-purple-600 border-purple-200'
    : 'bg-amber-500/10 text-amber-600 border-amber-200';

const SeguimientoRetosVC = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [data, setData] = useState<DryRunResponse | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  const [ganados, setGanados] = useState<any[]>([]);
  const [gerentesVcMap, setGerentesVcMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingData(true);
      setErr(null);
      const [{ data: res, error }, { data: gan }, { data: gvc }] = await Promise.all([
        supabase.functions.invoke('evaluar-retos-vc', { body: { dry_run: true } }),
        supabase
          .from('sp_acumulados')
          .select('gerente_id, fuente, sp, periodo, detalle, created_at')
          .in('fuente', ['RETO_DIARIO', 'RETO_SEMANAL', 'RETO_MENSUAL'])
          .eq('tipo_sp', 'canje')
          .order('created_at', { ascending: false }),
        supabase.from('gerentes').select('id, nombre').eq('canal', 'VC'),
      ]);
      if (cancel) return;
      if (error) setErr(error.message);
      else setData(res as DryRunResponse);
      setGanados(gan || []);
      const m = new Map<string, string>();
      (gvc || []).forEach((g: any) => m.set(g.id, g.nombre));
      setGerentesVcMap(m);
      setLoadingData(false);
    })();
    return () => { cancel = true; };
  }, []);

  const exportarExcel = () => {
    if (!data) return;
    const q = filtro.trim().toLowerCase();
    const matchNombre = (n: string) => !q || (n || '').toLowerCase().includes(q);

    const hoja1: any[] = [];
    for (const r of data.detalle || []) {
      if (!matchNombre(r.gerente_nombre)) continue;
      const pct = r.umbral > 0 ? Math.min(100, (r.valor_alcanzado / r.umbral) * 100) : 0;
      const cumplido = r.cumplido || r.ya_completado;
      hoja1.push({
        Gerente: r.gerente_nombre,
        Tipo: ventanaLabel(r.ventana),
        Reto: r.reto,
        KPI: r.kpi,
        Umbral: r.umbral,
        'Valor alcanzado': r.valor_alcanzado,
        '% Avance': Number(pct.toFixed(1)),
        Estado: cumplido ? 'Cumplido' : pct >= 70 ? 'Falta poco' : 'Pendiente',
      });
    }
    for (const r of data.rachaSimulacion || []) {
      if (!matchNombre(r.gerente_nombre)) continue;
      const pct = Math.min(100, (r.dias_cumplidos / 3) * 100);
      const cumplido = r.cumple || r.ya_completado;
      hoja1.push({
        Gerente: r.gerente_nombre,
        Tipo: 'Racha',
        Reto: r.racha,
        KPI: 'acv_plus diario',
        Umbral: r.umbral,
        'Valor alcanzado': `${r.dias_cumplidos}/3`,
        '% Avance': Number(pct.toFixed(1)),
        Estado: cumplido ? 'Cumplido' : pct >= 70 ? 'Falta poco' : 'Pendiente',
      });
    }

    const tipoFromFuente = (f: string) =>
      f === 'RETO_DIARIO' ? 'Diario' : f === 'RETO_SEMANAL' ? 'Semanal' : f === 'RETO_MENSUAL' ? 'Mensual' : f;
    const parseReto = (detalle: string) => {
      if (!detalle) return '';
      if (detalle.startsWith('RACHA')) {
        const parts = detalle.split(' · ');
        return (parts[1] || parts[0]).trim();
      }
      return (detalle.split(' · ')[0] || '').trim();
    };
    const parseValor = (detalle: string) => {
      if (!detalle) return '';
      const m = /valor:(\d+(?:\.\d+)?)/i.exec(detalle);
      return m ? Number(m[1]) : '';
    };
    const fmtFecha = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const hoja2: any[] = [];
    for (const g of ganados) {
      const nombre = gerentesVcMap.get(g.gerente_id);
      if (!nombre) continue;
      if (!matchNombre(nombre)) continue;
      hoja2.push({
        Gerente: nombre,
        Tipo: tipoFromFuente(g.fuente),
        Reto: parseReto(g.detalle),
        Periodo: g.periodo,
        'Fecha registro': fmtFecha(g.created_at),
        'SP ganado': g.sp,
        'Monto/Valor': parseValor(g.detalle),
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hoja1), 'Avance de retos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hoja2), 'Retos ganados (detalle)');
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Seguimiento_Retos_VC_${today}.xlsx`);
  };

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { nombre: string; retos: RetoDetalle[]; rachas: RachaDetalle[] }>();
    for (const r of data.detalle || []) {
      const k = r.gerente_id;
      if (!map.has(k)) map.set(k, { nombre: r.gerente_nombre, retos: [], rachas: [] });
      map.get(k)!.retos.push(r);
    }
    for (const r of data.rachaSimulacion || []) {
      const k = r.gerente_id;
      if (!map.has(k)) map.set(k, { nombre: r.gerente_nombre, retos: [], rachas: [] });
      map.get(k)!.rachas.push(r);
    }
    const arr = Array.from(map.entries()).map(([id, v]) => {
      const items = [
        ...v.retos.map((r) => ({
          pct: r.umbral > 0 ? Math.min(100, (r.valor_alcanzado / r.umbral) * 100) : 0,
          cumplido: r.cumplido || r.ya_completado,
        })),
        ...v.rachas.map((r) => ({
          pct: 3 > 0 ? Math.min(100, (r.dias_cumplidos / 3) * 100) : 0,
          cumplido: r.cumple || r.ya_completado,
        })),
      ];
      const pendientes = items.filter((i) => !i.cumplido);
      const maxPendiente = pendientes.length ? Math.max(...pendientes.map((i) => i.pct)) : -1;
      const cumplidosCount = items.filter((i) => i.cumplido).length;
      return { id, ...v, maxPendiente, cumplidosCount, totalItems: items.length };
    });
    const q = filtro.trim().toLowerCase();
    return arr
      .filter((g) => !q || g.nombre.toLowerCase().includes(q))
      .sort((a, b) => b.maxPendiente - a.maxPendiente);
  }, [data, filtro]);

  const resumen = useMemo(() => {
    if (!data) return { totalGerentes: 0, retosCumplidos: 0, retosCerca: 0, rachasCumplidas: 0, rachasCerca: 0 };
    const gerentesSet = new Set<string>();
    let retosCumplidos = 0, retosCerca = 0, rachasCumplidas = 0, rachasCerca = 0;
    for (const r of data.detalle || []) {
      gerentesSet.add(r.gerente_id);
      if (r.cumplido || r.ya_completado) retosCumplidos++;
      else if (r.umbral > 0 && (r.valor_alcanzado / r.umbral) >= 0.7) retosCerca++;
    }
    for (const r of data.rachaSimulacion || []) {
      gerentesSet.add(r.gerente_id);
      if (r.cumple || r.ya_completado) rachasCumplidas++;
      else if ((r.dias_cumplidos / 3) >= 0.7) rachasCerca++;
    }
    return { totalGerentes: gerentesSet.size, retosCumplidos, retosCerca, rachasCumplidas, rachasCerca };
  }, [data]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.role !== 'admin' && profile?.role !== 'especialista') return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="Seguimiento de retos VC">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Seguimiento de retos VC</h1>
            <p className="text-muted-foreground">Avance en vivo de cada gerente para motivarlos a cerrar retos y rachas.</p>
          </div>
          <Button onClick={exportarExcel} disabled={loadingData || !data} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar a Excel
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Gerentes</p><p className="text-2xl font-bold">{resumen.totalGerentes}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Retos cumplidos</p><p className="text-2xl font-bold text-emerald-600">{resumen.retosCumplidos}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Retos cerca (≥70%)</p><p className="text-2xl font-bold text-amber-600">{resumen.retosCerca}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rachas cumplidas</p><p className="text-2xl font-bold text-emerald-600">{resumen.rachasCumplidas}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rachas cerca (≥70%)</p><p className="text-2xl font-bold text-amber-600">{resumen.rachasCerca}</p></CardContent></Card>
        </div>

        <Input
          placeholder="Buscar por nombre del gerente…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="max-w-md"
        />


        {err && <div className="text-destructive text-sm">Error: {err}</div>}

        {loadingData ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-muted-foreground">Sin datos.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <Card key={g.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <CardTitle className="text-lg">{g.nombre}</CardTitle>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{g.cumplidosCount}/{g.totalItems} completados</Badge>
                      {g.maxPendiente >= 70 && <Badge className="bg-amber-500">🔥 Cerca de cerrar</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {g.retos
                    .slice()
                    .sort((a, b) => {
                      const pa = a.cumplido || a.ya_completado ? -1 : (a.umbral > 0 ? a.valor_alcanzado / a.umbral : 0);
                      const pb = b.cumplido || b.ya_completado ? -1 : (b.umbral > 0 ? b.valor_alcanzado / b.umbral : 0);
                      return pb - pa;
                    })
                    .map((r, idx) => {
                      const pct = r.umbral > 0 ? Math.min(100, (r.valor_alcanzado / r.umbral) * 100) : 0;
                      const done = r.cumplido || r.ya_completado;
                      return (
                        <div key={idx} className="border rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={cn('text-[10px]', ventanaColor(r.ventana))}>{ventanaLabel(r.ventana)}</Badge>
                              <span className="font-medium text-sm">{r.reto}</span>
                              <span className="text-xs text-muted-foreground">{r.familia}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono">{fmtValor(r.kpi, r.valor_alcanzado, r.umbral)}</span>
                              {done ? <Badge className="bg-emerald-600">✅ Cumplido</Badge>
                                : pct >= 70 ? <Badge className="bg-amber-500">Falta poco</Badge>
                                : <Badge variant="outline">{pct.toFixed(0)}%</Badge>}
                            </div>
                          </div>
                          <Progress value={pct} className={cn('h-2', done && '[&>*]:bg-emerald-500')} />
                        </div>
                      );
                    })}
                  {g.rachas.map((r, idx) => {
                    const pct = Math.min(100, (r.dias_cumplidos / 3) * 100);
                    const done = r.cumple || r.ya_completado;
                    return (
                      <div key={`racha-${idx}`} className="border rounded-lg p-3 space-y-1.5 bg-orange-50/50 dark:bg-orange-950/10">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-orange-500 text-[10px]">🔥 Racha</Badge>
                            <span className="font-medium text-sm">{r.racha}</span>
                            <span className="text-xs text-muted-foreground">L-M-Mié · umbral ${(r.umbral / 1_000_000).toFixed(0)}M/día</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono">{r.dias_cumplidos}/3 días</span>
                            {done ? <Badge className="bg-emerald-600">✅ Cumplido (+{r.sp} SP)</Badge>
                              : pct >= 70 ? <Badge className="bg-amber-500">Falta poco</Badge>
                              : <Badge variant="outline">{pct.toFixed(0)}%</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {r.dias.map((d) => {
                            const ok = d.total >= r.umbral;
                            return (
                              <div key={d.fecha} className={cn(
                                'flex-1 text-[10px] rounded px-2 py-1 border text-center',
                                ok ? 'bg-emerald-500/10 border-emerald-300 text-emerald-700' : 'bg-muted border-border text-muted-foreground'
                              )}>
                                <div className="font-semibold">{d.fecha.slice(5)}</div>
                                <div>${(d.total / 1_000_000).toFixed(1)}M</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SeguimientoRetosVC;
