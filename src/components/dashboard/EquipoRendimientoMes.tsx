import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Info, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AsesorPerformance } from '@/hooks/useGamificationMetrics';

interface Props {
  asesores: AsesorPerformance[];
  periodoSeleccionado: string;
  canal?: string | null;
  pais?: string | null;
  lastUpdated?: Date | null;
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

const formatLastUpdated = (d: Date | null | undefined): string => {
  if (!d) return 'Actualizando...';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `Última actualización: hoy a las ${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `Última actualización: ${dd}/${mo} a las ${hh}:${mm}`;
};

const StatusBadge = ({
  className,
  emoji,
  count,
  label,
  tooltip,
}: {
  className: string;
  emoji: string;
  count: number;
  label: string;
  tooltip: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className={cn('flex items-center gap-1 cursor-help', className)}>
        {emoji} {count} {label}
        <Info className="w-3 h-3 opacity-60" />
      </span>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="max-w-xs whitespace-pre-line text-xs">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);

const EquipoRendimientoMes = ({ asesores, periodoSeleccionado, canal, pais, lastUpdated }: Props) => {
  const [sortBy, setSortBy] = useState<SortKey>('fe');

  // refLabel removed: indicators about referidos hidden in VN UI
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

  // Live counts: recomputed every render directly from `asesores` prop (no memoization)
  let enMeta = 0, riesgo = 0, bajo = 0, novedad = 0;
  for (const a of asesores) {
    if (a.tiene_novedad || a.meta_acv <= 0) { novedad++; continue; }
    if (a.pct_acv >= 90) enMeta++;
    else if (a.pct_acv >= 60) riesgo++;
    else bajo++;
  }

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'fe', label: 'FE%' },
    { key: 'nube', label: `${labelNube}%` },
    { key: 'total', label: 'Uds%' },
  ];

  const globalTooltip =
    '📊 El estado de cada asesor se calcula con base en el % de cumplimiento de su meta ACV mensual (Valor del Contrato Anualizado).\n\nSe actualiza automáticamente con cada venta nueva registrada.\n\nAplica para canales: Venta Nueva Aliados, Venta Nueva Empresarios y Venta Cruzada.\nPaíses: Colombia, México, Ecuador y Uruguay.';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Información sobre Rendimiento del Equipo">
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-sm whitespace-pre-line text-xs">
                  {globalTooltip}
                </TooltipContent>
              </Tooltip>
              {mesLabel && (
                <span className="inline-flex w-fit items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  📅 {mesLabel}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              {formatLastUpdated(lastUpdated)} <RefreshCw className="w-3 h-3" />
            </p>
          </div>
        </div>

        {/* Resumen */}
        <div className="flex items-center gap-3 flex-wrap text-[11px] font-bold rounded-xl border border-border bg-muted/30 p-2.5">
          <StatusBadge
            className="text-accent"
            emoji="🟢"
            count={enMeta}
            label="en meta"
            tooltip="✅ El asesor alcanzó el 90% o más de su meta ACV del mes.\nIncluye ventas FE, Nube/Campaña y Unidades."
          />
          <StatusBadge
            className="text-orange"
            emoji="🟡"
            count={riesgo}
            label="en riesgo"
            tooltip="⚠️ El asesor está entre el 60% y 89% de su meta ACV.\nNecesita acelerar ventas para cerrar el mes en meta."
          />
          <StatusBadge
            className="text-destructive"
            emoji="🔴"
            count={bajo}
            label="bajo meta"
            tooltip="🔴 El asesor está por debajo del 60% de su meta ACV.\nRequiere atención y acompañamiento urgente."
          />
          <StatusBadge
            className="text-muted-foreground"
            emoji="⚪"
            count={novedad}
            label="novedad"
            tooltip="ℹ️ El asesor tiene una novedad registrada este mes (licencia, incapacidad, vacaciones u otro) o no tiene meta asignada aún. No aplica para medición de cumplimiento."
          />
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
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <Bar label="FE" current={a.ventas_fe} meta={a.meta_fe} pct={a.pct_fe} />
                    <Bar label={labelNube} current={a.ventas_nube} meta={a.meta_nube} pct={a.pct_nube} />
                    <Bar label="Uds" current={a.ventas_total} meta={a.meta_total} pct={a.pct_total} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default EquipoRendimientoMes;
