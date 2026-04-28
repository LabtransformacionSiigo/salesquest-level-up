import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AsesorPerformance } from '@/hooks/useGamificationMetrics';

interface Props {
  asesores: AsesorPerformance[];
  periodoSeleccionado: string;
  canal?: string | null;
  pais?: string | null;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type SortKey = 'acv' | 'fe' | 'nube' | 'total';

const colorBg = (pct: number, hasMeta: boolean) => {
  if (!hasMeta) return 'bg-muted';
  if (pct >= 100) return 'bg-accent';
  if (pct >= 70) return 'bg-primary';
  if (pct >= 40) return 'bg-orange';
  return 'bg-destructive';
};

const colorText = (pct: number, hasMeta: boolean) => {
  if (!hasMeta) return 'text-muted-foreground';
  if (pct >= 100) return 'text-accent';
  if (pct >= 70) return 'text-primary';
  if (pct >= 40) return 'text-orange';
  return 'text-destructive';
};

const stateOf = (a: AsesorPerformance): { emoji: string; label: string; border: string } => {
  if (a.tiene_novedad) return { emoji: '⚪', label: 'Con novedad', border: 'border-l-muted-foreground/40' };
  if (a.meta_acv <= 0) return { emoji: '⚪', label: 'Sin meta', border: 'border-l-muted-foreground/40' };
  if (a.pct_acv >= 90) return { emoji: '🟢', label: 'En meta', border: 'border-l-accent' };
  if (a.pct_acv >= 60) return { emoji: '🟡', label: 'En riesgo', border: 'border-l-orange' };
  return { emoji: '🔴', label: 'Bajo meta', border: 'border-l-destructive' };
};

const Bar = ({ label, current, meta, pct }: { label: string; current: number; meta: number; pct: number }) => {
  const hasMeta = meta > 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-semibold">
        <span className="text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={cn('font-scoreboard font-bold', colorText(pct, hasMeta))}>
          {hasMeta ? `${pct}%` : '—'}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-500', colorBg(pct, hasMeta))}
          style={{ width: hasMeta ? `${Math.min(100, pct)}%` : '0%' }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground font-scoreboard text-right">
        {hasMeta ? `${current}/${meta}` : '—'}
      </p>
    </div>
  );
};

const EquipoRendimientoMes = ({ asesores, periodoSeleccionado, canal, pais }: Props) => {
  const [sortBy, setSortBy] = useState<SortKey>('acv');

  const refLabel = canal === 'VN_ALIADOS' ? 'Ref. Contador' : 'Referidos';
  const esMexico = ['MEX','MX','MEXICO','MÉXICO'].includes(String(pais ?? '').toUpperCase());
  const labelNube = esMexico ? 'Campaña' : 'Nube';

  const mesLabel = useMemo(() => {
    if (!/^\d{6}$/.test(periodoSeleccionado || '')) return '';
    const y = periodoSeleccionado.slice(0, 4);
    const m = parseInt(periodoSeleccionado.slice(4), 10);
    return `${MESES[m - 1]} ${y}`;
  }, [periodoSeleccionado]);

  const sorted = useMemo(() => {
    const withNov = asesores.filter((a) => a.tiene_novedad);
    const sinNov = asesores.filter((a) => !a.tiene_novedad);
    const key = sortBy === 'acv' ? 'pct_acv' : sortBy === 'fe' ? 'pct_fe' : sortBy === 'nube' ? 'pct_nube' : 'pct_total';
    sinNov.sort((a, b) => (b[key] as number) - (a[key] as number));
    withNov.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return [...sinNov, ...withNov];
  }, [asesores, sortBy]);

  const resumen = useMemo(() => {
    let enMeta = 0, riesgo = 0, bajo = 0, novedad = 0;
    asesores.forEach((a) => {
      if (a.tiene_novedad) { novedad++; return; }
      if (a.meta_acv <= 0) { novedad++; return; }
      if (a.pct_acv >= 90) enMeta++;
      else if (a.pct_acv >= 60) riesgo++;
      else bajo++;
    });
    return { enMeta, riesgo, bajo, novedad };
  }, [asesores]);

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'fe', label: 'FE%' },
    { key: 'nube', label: `${labelNube}%` },
    { key: 'total', label: 'Uds%' },
  ];

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          {mesLabel && (
            <span className="inline-flex w-fit items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              📅 {mesLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all',
                sortBy === opt.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className="flex items-center gap-3 flex-wrap text-[11px] font-bold rounded-xl border border-border bg-muted/30 p-2.5">
        <span className="flex items-center gap-1 text-accent">🟢 {resumen.enMeta} en meta</span>
        <span className="flex items-center gap-1 text-orange">🟡 {resumen.riesgo} en riesgo</span>
        <span className="flex items-center gap-1 text-destructive">🔴 {resumen.bajo} bajo meta</span>
        <span className="flex items-center gap-1 text-muted-foreground">⚪ {resumen.novedad} novedad</span>
      </div>

      {/* Lista scrolleable */}
      <div className="flex flex-col gap-2.5 overflow-y-auto pr-1" style={{ maxHeight: 400 }}>
        {sorted.map((a, idx) => {
          const st = stateOf(a);
          const showBars = !a.tiene_novedad;
          return (
            <motion.div
              key={`${a.documento || a.nombre}-${idx}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={cn(
                'rounded-xl border border-border border-l-4 bg-card hover:bg-muted/30 transition-colors p-3',
                st.border
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{st.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{a.nombre}</p>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{st.label}</p>
                  </div>
                </div>
              </div>

              {showBars && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <Bar label="FE" current={a.ventas_fe} meta={a.meta_fe} pct={a.pct_fe} />
                  <Bar label={labelNube} current={a.ventas_nube} meta={a.meta_nube} pct={a.pct_nube} />
                  <Bar label="Uds" current={a.ventas_total} meta={a.meta_total} pct={a.pct_total} />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="text-muted-foreground uppercase tracking-wide truncate">{refLabel}</span>
                    </div>
                    <p className="text-base font-black font-scoreboard text-primary text-center">
                      {a.recomendados ?? 0}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default EquipoRendimientoMes;
