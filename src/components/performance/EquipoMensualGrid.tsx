import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const normalize = (v: unknown) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

interface Props {
  gerenteNombre: string;
  celula: string | null;
  canalDireccion: string | null; // 'Aliados' | 'Empresarios' | etc.
  pais: string | null;
}

interface AsesorMes {
  ventas_fe: number;
  ventas_nube: number;
  ventas_total: number;
  meta_fe: number;
  meta_nube: number;
  meta_total: number;
  novedad: string;
}

type AsesorRow = {
  documento: string;
  nombre: string;
  meses: Record<string, AsesorMes>; // key = YYYYMM
};

const EMPTY_MES: AsesorMes = {
  ventas_fe: 0, ventas_nube: 0, ventas_total: 0,
  meta_fe: 0, meta_nube: 0, meta_total: 0, novedad: '',
};

const pctClass = (pct: number, hasMeta: boolean) => {
  if (!hasMeta) return 'text-muted-foreground';
  if (pct >= 90) return 'text-accent';
  if (pct >= 60) return 'text-orange-600';
  return 'text-destructive';
};

const fmt = (m: AsesorMes, kind: 'fe' | 'nube' | 'total') => {
  const v = kind === 'fe' ? m.ventas_fe : kind === 'nube' ? m.ventas_nube : m.ventas_total;
  const meta = kind === 'fe' ? m.meta_fe : kind === 'nube' ? m.meta_nube : m.meta_total;
  if (meta <= 0 && v <= 0) return { text: '—', pct: 0, hasMeta: false };
  if (meta <= 0) return { text: `${v}`, pct: 0, hasMeta: false };
  const pct = Math.round((v / meta) * 100);
  return { text: `${v}/${meta}`, pct, hasMeta: true };
};

export const EquipoMensualGrid = ({ gerenteNombre, celula, canalDireccion, pais }: Props) => {
  const [rows, setRows] = useState<AsesorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<string[]>([]);
  const [kpi, setKpi] = useState<'fe' | 'nube' | 'total'>('fe');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Año en curso: 2026
      const year = '2026';
      const allPeriods = MONTH_LABELS.map((_, i) => `${year}${String(i + 1).padStart(2, '0')}`);

      // 1) Fetch metas_asesores del gerente / celula
      let metasQ = supabase
        .from('metas_asesores' as any)
        .select('anio_mes, documento_asesor, nombre_asesor, meta_fe, meta_nube, meta_total, novedad, celula, gerente, canal_direccion')
        .gte('anio_mes', `${year}01`)
        .lte('anio_mes', `${year}12`);

      if (canalDireccion) metasQ = metasQ.eq('canal_direccion', canalDireccion);
      const { data: metasAll } = await metasQ;

      const gName = normalize(gerenteNombre);
      const cName = normalize(celula);
      const metasFiltradas = (metasAll || []).filter((r: any) => {
        if (cName && normalize(r.celula) === cName) return true;
        if (gName && normalize(r.gerente) === gName) return true;
        return false;
      });

      // 2) Fetch ventas_diarias del periodo año, mismo canal/celula → reagrupar por asesor + mes
      let vdQ = supabase
        .from('ventas_diarias')
        .select('fecha, asesor, celula, unidades, acv, tipo_producto, producto, pais, canal_direccion')
        .gte('fecha', `${year}-01-01`)
        .lte('fecha', `${year}-12-31`)
        .limit(20000);
      if (canalDireccion) vdQ = vdQ.eq('canal_direccion', canalDireccion);
      const { data: vdAll } = await vdQ;

      // Restringimos al equipo: por celula del gerente; si no hay, por nombres en metas
      const teamNames = new Set<string>(
        metasFiltradas.map((r: any) => normalize(r.nombre_asesor)).filter(Boolean)
      );

      const vdTeam = (vdAll || []).filter((r: any) => {
        const celOk = cName ? normalize(r.celula) === cName : true;
        const nameOk = teamNames.size > 0 ? teamNames.has(normalize(r.asesor)) : true;
        return celOk || nameOk;
      });

      // Index productos a familia básica usando tipo_producto (FE/NUBE/CONTADOR)
      const famOf = (row: any): 'FE' | 'NUBE' | 'OTRO' => {
        const tp = String(row.tipo_producto || '').toUpperCase();
        if (tp === 'FE' || tp === 'NUBE') return tp;
        return 'OTRO';
      };

      const periodOf = (fecha: string) => {
        if (!fecha) return '';
        const d = new Date(fecha);
        if (Number.isNaN(d.getTime())) return '';
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
      };

      // 3) Agregar por asesor x periodo
      const byAsesor = new Map<string, AsesorRow>();

      // First pass: metas
      metasFiltradas.forEach((m: any) => {
        const key = normalize(m.nombre_asesor);
        if (!key) return;
        const cur = byAsesor.get(key) || {
          documento: m.documento_asesor || '',
          nombre: m.nombre_asesor || key,
          meses: {} as Record<string, AsesorMes>,
        };
        const period = String(m.anio_mes || '');
        if (!/^\d{6}$/.test(period)) return;
        const mes = cur.meses[period] || { ...EMPTY_MES };
        mes.meta_fe += Number(m.meta_fe) || 0;
        mes.meta_nube += Number(m.meta_nube) || 0;
        mes.meta_total += Number(m.meta_total) || 0;
        const nov = String(m.novedad || '').trim();
        if (nov && nov !== 'Sin novedad') mes.novedad = nov;
        cur.meses[period] = mes;
        byAsesor.set(key, cur);
      });

      // Second pass: ventas_diarias
      vdTeam.forEach((row: any) => {
        const key = normalize(row.asesor);
        if (!key) return;
        const period = periodOf(row.fecha);
        if (!period) return;
        const cur = byAsesor.get(key) || {
          documento: '',
          nombre: row.asesor || key,
          meses: {} as Record<string, AsesorMes>,
        };
        const mes = cur.meses[period] || { ...EMPTY_MES };
        const u = Math.round(Number(row.unidades) || 0);
        mes.ventas_total += u;
        const f = famOf(row);
        if (f === 'FE') mes.ventas_fe += u;
        else if (f === 'NUBE') mes.ventas_nube += u;
        cur.meses[period] = mes;
        byAsesor.set(key, cur);
      });

      // Periodos visibles: solo los que tienen alguna data
      const periodsWithData = allPeriods.filter((p) =>
        [...byAsesor.values()].some((r) => {
          const m = r.meses[p];
          if (!m) return false;
          return m.meta_fe > 0 || m.meta_nube > 0 || m.meta_total > 0 || m.ventas_fe > 0 || m.ventas_nube > 0 || m.ventas_total > 0;
        })
      );

      const finalRows = [...byAsesor.values()]
        .filter((r) => Object.keys(r.meses).length > 0)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      if (!cancelled) {
        setRows(finalRows);
        setPeriods(periodsWithData);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gerenteNombre, celula, canalDireccion, pais]);

  const kpiLabel = useMemo(
    () => (kpi === 'fe' ? 'FE' : kpi === 'nube' ? 'Nube' : 'Unidades'),
    [kpi]
  );

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-sm text-muted-foreground">
        Cargando rendimiento mensual del equipo…
      </div>
    );
  }

  if (rows.length === 0 || periods.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-sm text-muted-foreground text-center">
        Sin datos mensuales disponibles para tu equipo.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-4 md:p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-foreground">Rendimiento mensual del equipo</h3>
          <p className="text-[11px] text-muted-foreground">
            Cumplimiento por asesor y mes — {kpiLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(['fe', 'nube', 'total'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKpi(k)}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-semibold border transition-all',
                kpi === k
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              {k === 'fe' ? 'FE' : k === 'nube' ? 'Nube' : 'Uds'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-3 font-semibold text-muted-foreground sticky left-0 bg-card">Asesor</th>
              {periods.map((p) => {
                const m = parseInt(p.slice(4), 10);
                return (
                  <th key={p} className="text-center py-2 px-2 font-semibold text-muted-foreground whitespace-nowrap">
                    {MONTH_LABELS[m - 1]}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.documento || r.nombre} className="border-b border-border/60 hover:bg-muted/30">
                <td className="py-2 pr-3 font-semibold text-foreground sticky left-0 bg-card max-w-[200px] truncate">
                  {r.nombre}
                </td>
                {periods.map((p) => {
                  const mes = r.meses[p] || EMPTY_MES;
                  if (mes.novedad) {
                    return (
                      <td key={p} className="text-center py-2 px-2 text-muted-foreground">
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">N/A</span>
                      </td>
                    );
                  }
                  const cell = fmt(mes, kpi);
                  return (
                    <td key={p} className="text-center py-2 px-2">
                      <div className={cn('font-scoreboard text-[11px] font-bold', pctClass(cell.pct, cell.hasMeta))}>
                        {cell.hasMeta ? `${cell.pct}%` : '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-scoreboard">{cell.text}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default EquipoMensualGrid;
