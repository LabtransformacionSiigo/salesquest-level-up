import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const FUENTES = [
  { key: 'RETO_DIARIO', label: 'Reto diario', icon: '📅' },
  { key: 'RETO_SEMANAL', label: 'Reto semanal', icon: '📆' },
  { key: 'RETO_MENSUAL', label: 'Reto mensual', icon: '🗓️' },
  { key: 'MEDALLA', label: 'Medalla', icon: '🏅' },
  { key: 'RECONOCIMIENTO_RECIBIDO', label: 'Recon. recibido', icon: '💌' },
  { key: 'RECONOCIMIENTO_ENVIADO', label: 'Recon. enviado', icon: '✉️' },
];

type Gerente = { id: string; nombre: string; canal: string | null; pais: string | null; celula?: string | null };

interface Props {
  gerentes: Gerente[];
  isAdmin?: boolean;
}

/**
 * SP Canje mensual: tabla por gerente con columnas por mes (2026)
 * y desglose por fuente (medallas, retos, reconocimientos) al expandir.
 * El scope de gerentes se controla por el caller (admin = todos, especialista = filtrados).
 */
const SpCanjeMensual = ({ gerentes, isAdmin }: Props) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<{ gerente_id: string; periodo: string; fuente: string; sp: number }>>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filterTxt, setFilterTxt] = useState('');
  const [filterCanal, setFilterCanal] = useState<string>('');
  const [filterPais, setFilterPais] = useState<string>('');

  const gerenteIds = useMemo(() => gerentes.map(g => g.id), [gerentes]);
  const gerenteMap = useMemo(() => Object.fromEntries(gerentes.map(g => [g.id, g])), [gerentes]);

  useEffect(() => {
    let cancel = false;
    if (gerenteIds.length === 0) { setRows([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      // Lote para evitar URL gigantes
      const chunkSize = 200;
      const all: any[] = [];
      for (let i = 0; i < gerenteIds.length; i += chunkSize) {
        const chunk = gerenteIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('sp_acumulados')
          .select('gerente_id, fuente, sp, periodo')
          .eq('tipo_sp', 'canje')
          .in('gerente_id', chunk)
          .gte('periodo', '2026')
          .lt('periodo', '2027');
        if (error) { console.error(error); break; }
        all.push(...(data || []));
      }
      if (cancel) return;
      setRows(all);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [gerenteIds.join(',')]);

  // Normaliza periodo a número de mes 1-12
  const periodoToMonth = (p: string): number | null => {
    // Formatos posibles: 2026-05-24, 2026-05, 202605-S1, 202605
    const m1 = p.match(/^2026-(\d{2})/);
    if (m1) return parseInt(m1[1], 10);
    const m2 = p.match(/^2026(\d{2})/);
    if (m2) return parseInt(m2[1], 10);
    return null;
  };

  // Agrupado: { gid: { mes: { fuente: sp, total: sp } } }
  type MesData = { total: number; porFuente: Record<string, number> };
  const grouped = useMemo(() => {
    const map: Record<string, Record<number, MesData>> = {};
    for (const r of rows) {
      const mes = periodoToMonth(r.periodo);
      if (!mes) continue;
      const gid = r.gerente_id;
      if (!map[gid]) map[gid] = {};
      if (!map[gid][mes]) map[gid][mes] = { total: 0, porFuente: {} };
      map[gid][mes].total += Number(r.sp) || 0;
      map[gid][mes].porFuente[r.fuente] = (map[gid][mes].porFuente[r.fuente] || 0) + (Number(r.sp) || 0);
    }
    return map;
  }, [rows]);

  // Lista filtrada y ordenada por total SP desc
  const filtrados = useMemo(() => {
    const txt = filterTxt.trim().toLowerCase();
    return gerentes
      .filter(g => {
        if (filterCanal && g.canal !== filterCanal) return false;
        if (filterPais && g.pais !== filterPais) return false;
        if (txt && !(g.nombre || '').toLowerCase().includes(txt)) return false;
        return true;
      })
      .map(g => {
        const data = grouped[g.id] || {};
        const total = Object.values(data).reduce((s, m) => s + m.total, 0);
        return { ...g, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [gerentes, grouped, filterTxt, filterCanal, filterPais]);

  const canalesDisp = useMemo(() => Array.from(new Set(gerentes.map(g => g.canal).filter(Boolean))) as string[], [gerentes]);
  const paisesDisp = useMemo(() => Array.from(new Set(gerentes.map(g => g.pais).filter(Boolean))) as string[], [gerentes]);

  // Totales por mes (footer)
  const totalesMes = useMemo(() => {
    const t: Record<number, number> = {};
    for (const g of filtrados) {
      const data = grouped[g.id] || {};
      for (let m = 1; m <= 12; m++) t[m] = (t[m] || 0) + (data[m]?.total || 0);
    }
    return t;
  }, [filtrados, grouped]);

  const exportCsv = () => {
    const head = ['Gerente', 'Canal', 'País', ...MESES, 'Total'];
    const lines = [head.join(',')];
    for (const g of filtrados) {
      const data = grouped[g.id] || {};
      const row = [
        `"${(g.nombre || '').replace(/"/g, '""')}"`,
        g.canal || '',
        g.pais || '',
        ...MESES.map((_, i) => data[i + 1]?.total || 0),
        g.total,
      ];
      lines.push(row.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sp-canje-mensual-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Buscar gerente</label>
          <Input value={filterTxt} onChange={e => setFilterTxt(e.target.value)} placeholder="Nombre…" />
        </div>
        {canalesDisp.length > 1 && (
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Canal</label>
            <select
              value={filterCanal}
              onChange={e => setFilterCanal(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              {canalesDisp.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {paisesDisp.length > 1 && (
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase block">País</label>
            <select
              value={filterPais}
              onChange={e => setFilterPais(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              {paisesDisp.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
        <Button variant="outline" onClick={exportCsv}>📥 Exportar CSV</Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtrados.length} {isAdmin ? 'gerentes (todos)' : 'gerentes en tu alcance'}
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-xl bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left p-2 font-bold sticky left-0 bg-muted/50 z-10 min-w-[220px]">Gerente</th>
              <th className="text-left p-2 font-bold">Canal</th>
              <th className="text-left p-2 font-bold">País</th>
              {MESES.map(m => <th key={m} className="text-right p-2 font-bold">{m}</th>)}
              <th className="text-right p-2 font-bold bg-primary/10">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={16} className="p-6 text-center text-muted-foreground">Sin gerentes con datos en el alcance.</td></tr>
            )}
            {filtrados.map(g => {
              const data = grouped[g.id] || {};
              const open = !!expanded[g.id];
              return (
                <Fragment key={g.id}>
                  <tr
                    key={g.id}
                    className={cn('border-t border-border hover:bg-muted/30 cursor-pointer', g.total === 0 && 'opacity-60')}
                    onClick={() => setExpanded(e => ({ ...e, [g.id]: !open }))}
                  >
                    <td className="p-2 sticky left-0 bg-card font-medium">
                      <span className="inline-block w-4">{open ? '▾' : '▸'}</span> {g.nombre}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{g.canal || '—'}</td>
                    <td className="p-2 text-xs text-muted-foreground">{g.pais || '—'}</td>
                    {MESES.map((_, i) => {
                      const v = data[i + 1]?.total || 0;
                      return <td key={i} className={cn('p-2 text-right tabular-nums', v > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground/40')}>{v || '·'}</td>;
                    })}
                    <td className="p-2 text-right tabular-nums font-bold bg-primary/5">{g.total}</td>
                  </tr>
                  {open && FUENTES.map(f => {
                    const totalFuente = MESES.reduce((s, _, i) => s + (data[i + 1]?.porFuente[f.key] || 0), 0);
                    if (totalFuente === 0) return null;
                    return (
                      <tr key={g.id + f.key} className="bg-muted/10 border-t border-border/50 text-xs">
                        <td className="p-2 pl-10 sticky left-0 bg-muted/10 text-muted-foreground">{f.icon} {f.label}</td>
                        <td colSpan={2}></td>
                        {MESES.map((_, i) => {
                          const v = data[i + 1]?.porFuente[f.key] || 0;
                          return <td key={i} className={cn('p-2 text-right tabular-nums', v > 0 ? 'text-foreground' : 'text-muted-foreground/30')}>{v || '·'}</td>;
                        })}
                        <td className="p-2 text-right tabular-nums font-semibold bg-primary/5">{totalFuente}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-bold">
              <td className="p-2 sticky left-0 bg-muted/40" colSpan={3}>Total {filtrados.length} gerentes</td>
              {MESES.map((_, i) => (
                <td key={i} className="p-2 text-right tabular-nums">{totalesMes[i + 1] || 0}</td>
              ))}
              <td className="p-2 text-right tabular-nums bg-primary/10">
                {Object.values(totalesMes).reduce((s, v) => s + v, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        SP Canje acumulado desde <code>sp_acumulados</code> (tipo_sp = canje). Incluye medallas, retos diarios/semanales/mensuales y reconocimientos. Click en una fila para ver el desglose por fuente.
      </p>
    </div>
  );
};

export default SpCanjeMensual;
