import { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, FlaskConical, Sparkles } from 'lucide-react';

type DetalleRow = {
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
};

type SimResponse = {
  ok: boolean;
  dry_run?: boolean;
  totalRetos?: number;
  totalSp?: number;
  retosInsert?: number;
  spInsert?: number;
  rachasInsert?: number;
  detalle?: DetalleRow[];
  retosInsertados?: number;
  spInsertados?: number;
  rachasInsertadas?: number;
  errores?: string[];
};

const KPI_LABEL: Record<string, string> = {
  acv_plus: 'ACV+',
  upgrades: 'Upgrades',
  conversiones: 'Conversiones',
  cumplimiento_pct: '% Cumplimiento',
};

const VENTANA_LABEL: Record<string, string> = {
  diario: 'Día',
  semanal: 'Semana',
  mensual: 'Mes',
};

const formatValor = (kpi: string, valor: number): string => {
  if (kpi === 'acv_plus') return `$${valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
  if (kpi === 'cumplimiento_pct' || kpi === 'conversiones') return `${valor.toFixed(1)}%`;
  return valor.toLocaleString('es-CO');
};

export default function AdminSimulacion() {
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [data, setData] = useState<SimResponse | null>(null);
  const [filterGerente, setFilterGerente] = useState('');
  const [filterReto, setFilterReto] = useState('');
  const [onlyCumplidos, setOnlyCumplidos] = useState(false);
  const { toast } = useToast();

  const ejecutar = async (dryRun: boolean) => {
    if (dryRun) setLoading(true);
    else setRunning(true);
    setData(null);
    try {
      const { data: result, error } = await supabase.functions.invoke('evaluar-retos-vc', {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      setData(result as SimResponse);
      toast({
        title: dryRun ? '🧪 Simulación completada' : '✅ Evaluación ejecutada',
        description: dryRun
          ? `${result.detalle?.length || 0} evaluaciones · ${result.totalRetos || 0} retos cumplidos`
          : `${result.retosInsertados || 0} retos · ${result.spInsertados || 0} SP otorgados`,
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
      setRunning(false);
    }
  };

  const detalle = data?.detalle || [];
  const filtered = detalle.filter((d) => {
    if (onlyCumplidos && !d.cumplido) return false;
    if (filterGerente && !d.gerente_nombre?.toLowerCase().includes(filterGerente.toLowerCase())) return false;
    if (filterReto && !d.reto?.toLowerCase().includes(filterReto.toLowerCase())) return false;
    return true;
  });

  // Agrupación por gerente para resumen
  const resumenGerente = new Map<string, { nombre: string; cumplidos: number; sp: number; total: number }>();
  for (const d of detalle) {
    const cur = resumenGerente.get(d.gerente_id) || { nombre: d.gerente_nombre, cumplidos: 0, sp: 0, total: 0 };
    cur.total++;
    if (d.cumplido && !d.ya_completado) {
      cur.cumplidos++;
      cur.sp += d.sp_otorgables;
    }
    resumenGerente.set(d.gerente_id, cur);
  }

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="h-8 w-8 text-primary" />
              Simulación Motor VC
            </h1>
            <p className="text-muted-foreground mt-1">
              Ejecuta el motor de evaluación en modo dry-run para inspeccionar cómo se calculan ACV+, Upgrades,
              Conversiones y % Cumplimiento por gerente y reto.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => ejecutar(true)} disabled={loading || running} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Simular (dry-run)
            </Button>
            <Button onClick={() => ejecutar(false)} disabled={loading || running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Ejecutar real
            </Button>
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase">Evaluaciones</p>
                <p className="text-2xl font-bold">{detalle.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase">Retos cumplidos</p>
                <p className="text-2xl font-bold text-primary">{data.totalRetos || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase">SP a otorgar</p>
                <p className="text-2xl font-bold text-accent flex items-center gap-1">
                  <Sparkles className="h-5 w-5" /> {data.totalSp || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase">Rachas activas</p>
                <p className="text-2xl font-bold">{data.rachasInsert ?? data.rachasInsertadas ?? 0}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {resumenGerente.size > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resumen por gerente</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gerente</TableHead>
                    <TableHead className="text-right">Evaluaciones</TableHead>
                    <TableHead className="text-right">Cumplidos</TableHead>
                    <TableHead className="text-right">SP a otorgar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(resumenGerente.values())
                    .sort((a, b) => b.sp - a.sp)
                    .map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.nombre}</TableCell>
                        <TableCell className="text-right">{r.total}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={r.cumplidos > 0 ? 'default' : 'secondary'}>{r.cumplidos}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-accent">{r.sp}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {detalle.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Detalle de evaluación</CardTitle>
              <div className="flex flex-wrap gap-2 mt-3">
                <Input
                  placeholder="Filtrar por gerente..."
                  value={filterGerente}
                  onChange={(e) => setFilterGerente(e.target.value)}
                  className="max-w-xs"
                />
                <Input
                  placeholder="Filtrar por reto..."
                  value={filterReto}
                  onChange={(e) => setFilterReto(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  variant={onlyCumplidos ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOnlyCumplidos((v) => !v)}
                >
                  Solo cumplidos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gerente</TableHead>
                      <TableHead>Reto</TableHead>
                      <TableHead>Ventana</TableHead>
                      <TableHead>KPI</TableHead>
                      <TableHead>Familia</TableHead>
                      <TableHead className="text-right">Umbral</TableHead>
                      <TableHead className="text-right">Alcanzado</TableHead>
                      <TableHead className="text-right">Progreso</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">SP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d, i) => {
                      const pct = d.umbral > 0 ? Math.min(999, (d.valor_alcanzado / d.umbral) * 100) : 0;
                      return (
                        <TableRow key={i} className={d.cumplido ? 'bg-primary/5' : ''}>
                          <TableCell className="font-medium">{d.gerente_nombre}</TableCell>
                          <TableCell>{d.reto}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{VENTANA_LABEL[d.ventana] || d.ventana}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{KPI_LABEL[d.kpi] || d.kpi}</Badge>
                          </TableCell>
                          <TableCell>{d.familia}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatValor(d.kpi, d.umbral)}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatValor(d.kpi, d.valor_alcanzado)}</TableCell>
                          <TableCell className="text-right font-bold">
                            <span className={pct >= 100 ? 'text-primary' : 'text-muted-foreground'}>
                              {pct.toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            {d.ya_completado ? (
                              <Badge variant="outline">Ya otorgado</Badge>
                            ) : d.cumplido ? (
                              <Badge className="bg-primary">✅ Cumple</Badge>
                            ) : (
                              <Badge variant="secondary">Pendiente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-accent">
                            {d.cumplido && !d.ya_completado ? `+${d.sp_otorgables}` : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filtered.length === 0 && (
                  <p className="text-center py-6 text-muted-foreground">Sin resultados con los filtros aplicados.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!data && !loading && !running && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Pulsa <strong>Simular (dry-run)</strong> para ver cómo se calcula cada KPI sin escribir en la base de datos.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
