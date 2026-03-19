import { motion } from 'framer-motion';
import { fadeUpItem } from '@/lib/animations';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiProgressBarsProps {
  kpis: any;
  acvMes: number;
  ventasSemana: number;
  isVcAdvisor: boolean;
  loading: boolean;
}

const KpiProgressBars = ({ kpis, acvMes, ventasSemana, isVcAdvisor, loading }: KpiProgressBarsProps) => {
  if (loading) {
    return (
      <motion.div className="bg-card border border-border rounded-2xl p-8 shadow-smooth-sm" variants={fadeUpItem}>
        <h3 className="text-base font-bold font-heading text-secondary mb-5 flex items-center gap-2">
          <span className="text-primary">📊</span> Resumen KPIs del Mes
        </h3>
        <div className="space-y-5">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      </motion.div>
    );
  }

  const bars = isVcAdvisor
    ? [
        { label: 'Ventas Mes', value: kpis?.ventas || 0, meta: (kpis?.ventas || 0) * 2 || 50_000_000 },
        { label: 'ACV+ Mes', value: kpis?.acv_f || 0, meta: (kpis?.acv_f || 0) * 2 || 50_000_000 },
        { label: 'Ventas Semana', value: ventasSemana, meta: ventasSemana * 2 || 50_000_000 },
      ]
    : kpis
    ? [
        { label: 'Ventas', value: kpis.ventas || 0, meta: kpis.meta || 1 },
        { label: 'ACV+ Mes', value: acvMes, meta: acvMes * 2 || 50_000_000 },
        { label: 'Productividad', value: kpis.productividad_por_asesor || 0, meta: (kpis.productividad_por_asesor || 0) * 2 || 50_000_000 },
      ]
    : [];

  const fmt = (v: number) => `$${(v / 1_000_000).toFixed(0)}M`;

  return (
    <motion.div className="bg-card border border-border rounded-2xl p-8 shadow-smooth-sm" variants={fadeUpItem}>
      <h3 className="text-base font-bold font-heading text-secondary mb-6 flex items-center gap-2">
        <span className="text-primary">📊</span> Resumen KPIs del Mes
      </h3>
      {bars.length > 0 ? (
        <div className="space-y-5">
          {bars.map((bar, i) => {
            const pct = Math.min(100, bar.meta > 0 ? (bar.value / bar.meta) * 100 : 0);
            return (
              <div key={i}>
                <div className="flex justify-between text-sm font-semibold text-muted-foreground mb-2">
                  <span>{bar.label}</span>
                  <span>{fmt(bar.value)} / {fmt(bar.meta)}</span>
                </div>
                <Progress value={pct} className="h-3" />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-base text-muted-foreground text-center py-6">Sin datos de KPI para este mes</p>
      )}
    </motion.div>
  );
};

export default KpiProgressBars;
