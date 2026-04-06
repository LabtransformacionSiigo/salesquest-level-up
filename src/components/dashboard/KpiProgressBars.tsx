import { motion } from 'framer-motion';
import { fadeUpItem, popIn } from '@/lib/animations';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import DonutChart from './DonutChart';

const NIVELES = [
  { nombre: 'Cuarzo', emoji: '🪨', min: 0, max: 1500 },
  { nombre: 'Rubí', emoji: '❤️‍🔥', min: 1501, max: 3000 },
  { nombre: 'Zafiro', emoji: '💎', min: 3001, max: 4500 },
  { nombre: 'Esmeralda', emoji: '🟢', min: 4501, max: 6000 },
  { nombre: 'Diamante', emoji: '💠', min: 6001, max: 999999 },
];

interface KpiProgressBarsProps {
  kpis: any;
  acvMes: number;
  ventasSemana: number;
  isVcAdvisor: boolean;
  loading: boolean;
  pctCumplimiento?: number;
  sp?: number;
}

const fmt = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;

const KpiProgressBars = ({ kpis, acvMes, ventasSemana, isVcAdvisor, loading, pctCumplimiento, sp = 0 }: KpiProgressBarsProps) => {
  const nivelActual = NIVELES.find((n) => sp >= n.min && sp <= n.max) || NIVELES[0];
  const nivelIdx = NIVELES.indexOf(nivelActual);
  const nivelSiguiente = NIVELES[nivelIdx + 1];
  const spParaSiguiente = nivelSiguiente ? nivelSiguiente.min : sp;
  const pctNivel = nivelSiguiente ? Math.min(100, ((sp - nivelActual.min) / (spParaSiguiente - nivelActual.min)) * 100) : 100;

  const pct = pctCumplimiento ?? (kpis?.pct_cumplimiento ? Number(kpis.pct_cumplimiento) : 0);
  const metaValue = kpis?.meta ? Number(kpis.meta) : 0;
  const ventasValue = kpis?.ventas ? Number(kpis.ventas) : acvMes;

  if (loading) {
    return (
      <motion.div className="grid grid-cols-1 lg:grid-cols-5 gap-5" variants={fadeUpItem}>
        <Skeleton className="lg:col-span-2 h-72 rounded-2xl" />
        <Skeleton className="lg:col-span-3 h-72 rounded-2xl" />
      </motion.div>
    );
  }

  return (
    <motion.div className="grid grid-cols-1 lg:grid-cols-5 gap-5" variants={fadeUpItem}>

      {/* ── LEFT: Nivel Actual (2/5 width) ── */}
      <motion.div
        className="lg:col-span-2 bg-card border border-border rounded-2xl p-7 shadow-smooth-sm flex flex-col"
        variants={popIn}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
      >
        <h3 className="text-base font-bold font-heading text-secondary mb-1 flex items-center gap-2">
          <span className="text-primary">⚡</span> Nivel Actual
        </h3>
        <p className="text-xs text-muted-foreground mb-5">Progresión de gemas por Siigo Points</p>

        {/* Current level badge - larger */}
        <div className="flex items-center gap-4 mb-6">
          <motion.div
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {nivelActual.emoji}
          </motion.div>
          <div>
            <p className="text-2xl font-black font-heading text-foreground">{nivelActual.nombre}</p>
            <p className="text-sm text-muted-foreground font-semibold">
              <span className="font-scoreboard text-primary text-lg">{sp.toLocaleString()}</span> SP totales
            </p>
          </div>
        </div>

        {/* Progress to next level */}
        {nivelSiguiente ? (
          <div className="mt-auto">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span className="font-semibold">{nivelActual.nombre}</span>
              <span className="font-bold text-foreground">{Math.round(pctNivel)}%</span>
              <span className="font-semibold">{nivelSiguiente.nombre} {nivelSiguiente.emoji}</span>
            </div>
            <Progress value={pctNivel} className="h-3.5" />
            <p className="text-xs text-muted-foreground mt-2.5 text-center">
              Faltan <span className="font-bold font-scoreboard text-primary">{(spParaSiguiente - sp).toLocaleString()}</span> SP para {nivelSiguiente.nombre}
            </p>
          </div>
        ) : (
          <div className="mt-auto text-center py-3">
            <p className="text-base font-bold text-accent">🏆 ¡Nivel máximo alcanzado!</p>
          </div>
        )}

        {/* Level dots */}
        <div className="flex justify-center gap-2.5 mt-5">
          {NIVELES.slice(0, 5).map((n, i) => (
            <div
              key={n.nombre}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                i <= nivelIdx ? 'bg-primary text-primary-foreground scale-100' : 'bg-muted text-muted-foreground scale-90'
              } ${i === nivelIdx ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}
              title={n.nombre}
            >
              {n.emoji}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── RIGHT: Meta Mensual + KPIs unificados (3/5 width) ── */}
      <motion.div
        className="lg:col-span-3 bg-card border border-border rounded-2xl p-7 shadow-smooth-sm flex flex-col"
        variants={popIn}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
      >
        <h3 className="text-base font-bold font-heading text-secondary mb-1 flex items-center gap-2">
          <span className="text-primary">🎯</span> Rendimiento del Mes
        </h3>
        <p className="text-xs text-muted-foreground mb-5">
          {isVcAdvisor ? 'ACV+ vs Meta asignada e indicadores clave' : 'Ventas vs Meta del mes e indicadores clave'}
        </p>

        <div className="flex flex-col md:flex-row gap-6 flex-1">
          {/* Donut section */}
          <div className="flex flex-col items-center justify-center md:w-[200px] flex-shrink-0">
            <DonutChart
              value={pct}
              max={100}
              size={160}
              strokeWidth={15}
              color={pct >= 100 ? 'hsl(var(--accent))' : pct >= 70 ? 'hsl(var(--primary))' : 'hsl(var(--orange))'}
              bgColor="hsl(var(--muted))"
            >
              <span className="text-3xl font-black font-scoreboard text-foreground">{Math.round(pct)}%</span>
              <span className="text-[10px] text-muted-foreground font-bold uppercase">cumplimiento</span>
            </DonutChart>
            <div className="mt-3 w-full space-y-1 text-xs text-muted-foreground">
              {metaValue > 0 && (
                <div className="flex justify-between">
                  <span>Meta</span>
                  <span className="font-bold text-foreground">{fmt(metaValue)}</span>
                </div>
              )}
              {ventasValue > 0 && (
                <div className="flex justify-between">
                  <span>{isVcAdvisor ? 'ACV+' : 'Ventas'}</span>
                  <span className="font-bold text-primary">{fmt(ventasValue)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px bg-border" />

          {/* KPIs section */}
          <div className="flex-1 flex flex-col justify-between gap-4">
            {/* ACV+ */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                <span>ACV+ del Mes</span>
                <span className="text-foreground font-scoreboard">{fmt(acvMes)}</span>
              </div>
              <Progress value={metaValue > 0 ? Math.min(100, (acvMes / metaValue) * 100) : (acvMes > 0 ? 50 : 0)} className="h-2.5" />
            </div>

            {/* Unidades */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                <span>Unidades Vendidas</span>
                <span className="text-foreground font-scoreboard">{kpis?.sc_creados || 0}</span>
              </div>
              <Progress value={Math.min(100, ((kpis?.sc_creados || 0) / 20) * 100)} className="h-2.5" />
            </div>

            {/* Referidos (VN only) */}
            {!isVcAdvisor && kpis?.cant_recomendados != null && (
              <div>
                <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                  <span>Referidos</span>
                  <span className="text-foreground font-scoreboard">{kpis.cant_recomendados}</span>
                </div>
                <Progress value={Math.min(100, (kpis.cant_recomendados / 10) * 100)} className="h-2.5" />
              </div>
            )}

            {/* Status indicator */}
            <div className={`rounded-xl px-4 py-2.5 text-center text-xs font-bold mt-auto ${
              pct >= 100 ? 'bg-accent/10 text-accent' : pct >= 70 ? 'bg-primary/10 text-primary' : pct >= 40 ? 'bg-orange/10 text-orange' : 'bg-muted text-muted-foreground'
            }`}>
              {pct >= 100 ? '🏆 ¡Meta superada!' : pct >= 70 ? '🔥 ¡Buen ritmo!' : pct >= 40 ? '⚡ Sigue avanzando' : '💪 ¡A por la meta!'}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default KpiProgressBars;
