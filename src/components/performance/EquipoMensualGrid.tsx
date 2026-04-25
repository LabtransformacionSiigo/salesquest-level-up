import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const normalize = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

interface Props {
  gerenteNombre: string;
  celula: string | null;
  canalDireccion: string | null;
  pais: string | null;
}

interface MonthData {
  periodo: string;
  ventas_fe: number;
  ventas_nube: number;
  ventas_total: number;
  acv_total: number;
  meta_fe: number;
  meta_nube: number;
  meta_total: number;
  meta_acv: number;
  pct_fe: number;
  pct_nube: number;
  pct_total: number;
  pct_acv: number;
  sp_mes: number;
}

const fmtMoney = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
};

const colorByPct = (pct: number, hasMeta: boolean): string => {
  if (!hasMeta) return 'bg-muted';
  if (pct >= 100) return 'bg-accent';
  if (pct >= 70) return 'bg-primary';
  if (pct >= 40) return 'bg-orange';
  return 'bg-destructive';
};

const textColorByPct = (pct: number, hasMeta: boolean): string => {
  if (!hasMeta) return 'text-muted-foreground';
  if (pct >= 100) return 'text-accent';
  if (pct >= 70) return 'text-primary';
  if (pct >= 40) return 'text-orange';
  return 'text-destructive';
};

const badgeColorByPct = (pct: number): string => {
  if (pct >= 100) return 'bg-accent/15 text-accent border-accent/30';
  if (pct >= 70) return 'bg-primary/15 text-primary border-primary/30';
  return 'bg-destructive/15 text-destructive border-destructive/30';
};

const mesShortToPeriodo = (mesAbr: string): string | null => {
  const idx = MONTH_SHORT.findIndex((m) => normalize(m) === normalize(mesAbr));
  if (idx === -1) return null;
  return `2026${String(idx + 1).padStart(2, '0')}`;
};

const KpiCell = ({
  label,
  current,
  meta,
  isMoney = false,
}: {
  label: string;
  current: number;
  meta: number;
  isMoney?: boolean;
}) => {
  const hasMeta = meta > 0;
  const pct = hasMeta ? Math.min(300, Math.round((current / meta) * 100)) : 0;
  const fmtFn = isMoney ? fmtMoney : (v: number) => v.toLocaleString();

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-scoreboard font-bold text-foreground">
        {hasMeta ? `${fmtFn(current)} / ${fmtFn(meta)}` : current > 0 ? fmtFn(current) : '—'}
      </p>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-500', colorByPct(pct, hasMeta))}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className={cn('text-[11px] font-scoreboard font-bold', textColorByPct(pct, hasMeta))}>
        {hasMeta ? `${pct}%` : '—'}
      </p>
    </div>
  );
};

export const EquipoMensualGrid = ({ gerenteNombre, celula, canalDireccion, pais }: Props) => {
  const [meses, setMeses] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const year = '2026';
      const gName = normalize(gerenteNombre);
      const cName = normalize(celula);

      // 1) ventas_gerente_mensual del año
      let vgmQ = supabase
        .from('ventas_gerente_mensual')
        .select('periodo, gerente_normalizado, celula, familia, unidades, acv, canal_direccion, pais')
        .gte('periodo', `${year}01`)
        .lte('periodo', `${year}12`);
      if (canalDireccion) vgmQ = vgmQ.eq('canal_direccion', canalDireccion);
      const { data: vgmAll } = await vgmQ;

      const vgmRows = (vgmAll || []).filter((r: any) => {
        const cOk = cName && normalize(r.celula) === cName;
        const gOk = gName && normalize(r.gerente_normalizado) === gName;
        return cOk || gOk;
      });

      // 2) metas_asesores agrupadas por anio_mes
      let metasQ = supabase
        .from('metas_asesores')
        .select('anio_mes, gerente, celula, meta_fe, meta_nube, meta_total, novedad, canal_direccion')
        .gte('anio_mes', `${year}01`)
        .lte('anio_mes', `${year}12`);
      if (canalDireccion) metasQ = metasQ.eq('canal_direccion', canalDireccion);
      const { data: metasAll } = await metasQ;

      const metasRows = (metasAll || []).filter((r: any) => {
        const nov = String(r.novedad || '').trim();
        if (nov && nov !== 'Sin novedad') return false;
        const cOk = cName && normalize(r.celula) === cName;
        const gOk = gName && normalize(r.gerente) === gName;
        return cOk || gOk;
      });

      // 3) metas_acv_gerentes
      let acvQ = supabase
        .from('metas_acv_gerentes')
        .select('celula, mes, meta_total_acv, canal');
      if (cName) acvQ = acvQ.ilike('celula', String(celula || ''));
      const { data: acvAll } = await acvQ;
      const acvRows = (acvAll || []).filter((r: any) => normalize(r.celula) === cName);

      // Aggregate per period
      const map = new Map<string, MonthData>();
      const ensure = (p: string): MonthData => {
        if (!map.has(p)) {
          map.set(p, {
            periodo: p,
            ventas_fe: 0, ventas_nube: 0, ventas_total: 0, acv_total: 0,
            meta_fe: 0, meta_nube: 0, meta_total: 0, meta_acv: 0,
            pct_fe: 0, pct_nube: 0, pct_total: 0, pct_acv: 0, sp_mes: 0,
          });
        }
        return map.get(p)!;
      };

      vgmRows.forEach((r: any) => {
        const p = String(r.periodo || '');
        if (!/^\d{6}$/.test(p)) return;
        const m = ensure(p);
        const u = Math.round(Number(r.unidades) || 0);
        const acv = Number(r.acv) || 0;
        const fam = String(r.familia || '').toUpperCase();
        if (fam === 'FE') m.ventas_fe += u;
        else if (fam === 'NUBE') m.ventas_nube += u;
        if (fam === 'FE' || fam === 'NUBE' || fam === 'CONTADOR') m.ventas_total += u;
        m.acv_total += acv;
      });

      metasRows.forEach((r: any) => {
        const p = String(r.anio_mes || '');
        if (!/^\d{6}$/.test(p)) return;
        const m = ensure(p);
        m.meta_fe += Number(r.meta_fe) || 0;
        m.meta_nube += Number(r.meta_nube) || 0;
        m.meta_total += Number(r.meta_total) || 0;
      });

      acvRows.forEach((r: any) => {
        const p = mesShortToPeriodo(r.mes);
        if (!p) return;
        const m = ensure(p);
        m.meta_acv += Number(r.meta_total_acv) || 0;
      });

      // Calculate percentages and SP
      const arr = [...map.values()].map((m) => {
        m.pct_fe = m.meta_fe > 0 ? Math.min(300, Math.round((m.ventas_fe / m.meta_fe) * 100)) : 0;
        m.pct_nube = m.meta_nube > 0 ? Math.min(300, Math.round((m.ventas_nube / m.meta_nube) * 100)) : 0;
        m.pct_total = m.meta_total > 0 ? Math.min(300, Math.round((m.ventas_total / m.meta_total) * 100)) : 0;
        m.pct_acv = m.meta_acv > 0 ? Math.min(300, Math.round((m.acv_total / m.meta_acv) * 100)) : 0;
        m.sp_mes = m.pct_fe + m.pct_nube * 2 + m.pct_acv;
        return m;
      });

      // Filter: must have any data
      const filtered = arr.filter((m) =>
        m.ventas_fe > 0 || m.ventas_nube > 0 || m.ventas_total > 0 || m.acv_total > 0 ||
        m.meta_fe > 0 || m.meta_nube > 0 || m.meta_total > 0 || m.meta_acv > 0
      );

      filtered.sort((a, b) => b.periodo.localeCompare(a.periodo));

      if (!cancelled) {
        setMeses(filtered);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gerenteNombre, celula, canalDireccion, pais]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold font-heading text-secondary">📅 Historial Mensual del Equipo</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (meses.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground shadow-smooth-sm">
        Sin datos mensuales disponibles.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold font-heading text-secondary flex items-center gap-2">
            <span className="text-primary">📅</span> Historial Mensual del Equipo
          </h3>
          <p className="text-xs text-muted-foreground">
            Cumplimiento por mes · {meses.length} mes{meses.length !== 1 ? 'es' : ''} con datos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {meses.map((m, idx) => {
          const mesIdx = parseInt(m.periodo.slice(4), 10) - 1;
          const monthLabel = `${MONTH_LABELS[mesIdx]} ${m.periodo.slice(0, 4)}`;
          const hasAcvMeta = m.meta_acv > 0;

          return (
            <motion.div
              key={m.periodo}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card border border-border rounded-2xl p-5 shadow-smooth-sm hover:border-primary/40 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-base font-black font-heading text-foreground">{monthLabel}</span>
                  {hasAcvMeta && (
                    <span className={cn(
                      'text-[11px] font-bold font-scoreboard px-2.5 py-1 rounded-full border',
                      badgeColorByPct(m.pct_acv)
                    )}>
                      {m.pct_acv}% ACV+
                    </span>
                  )}
                </div>
                {m.sp_mes > 0 && (
                  <span className="text-xs font-bold font-scoreboard text-primary flex items-center gap-1">
                    ⚡ +{m.sp_mes.toLocaleString()} SP
                  </span>
                )}
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCell label="FE" current={m.ventas_fe} meta={m.meta_fe} />
                <KpiCell label="Nube" current={m.ventas_nube} meta={m.meta_nube} />
                <KpiCell label="Total" current={m.ventas_total} meta={m.meta_total} />
                <KpiCell label="ACV+" current={m.acv_total} meta={m.meta_acv} isMoney />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default EquipoMensualGrid;
