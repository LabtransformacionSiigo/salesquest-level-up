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
      <motion.div className="bg-card border border-border rounded-2xl p-8 shadow-smooth-sm" variants={fadeUpItem}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-5" variants={fadeUpItem}>
      {/* Card 1: Meta Mensual */}
      <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm flex flex-col items-center" variants={popIn}>
        <h3 className="text-sm font-bold font-heading text-secondary mb-1 self-start flex items-center gap-2">
          <span className="text-primary">🎯</span> Meta Mensual
        </h3>
        <p className="text-xs text-muted-foreground mb-4 self-start">
          {isVcAdvisor ? 'ACV+ vs Meta asignada' : 'Ventas vs Meta del mes'}
        </p>
        <DonutChart
          value={pct}
          max={100}
          size={150}
          strokeWidth={14}
          color={pct >= 100 ? 'hsl(var(--accent))' : pct >= 70 ? 'hsl(var(--primary))' : 'hsl(var(--orange))'}
          bgColor="hsl(var(--muted))"
        >
          <span className="text-2xl font-black font-scoreboard text-foreground">{Math.round(pct)}%</span>
          <span className="text-[10px] text-muted-foreground font-bold uppercase">cumplimiento</span>
        </DonutChart>
        <div className="mt-4 w-full space-y-1 text-xs text-muted-foreground">
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
      </motion.div>

      {/* Card 2: Nivel & Progresión */}
      <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm flex flex-col" variants={popIn}>
        <h3 className="text-sm font-bold font-heading text-secondary mb-1 flex items-center gap-2">
          <span className="text-primary">⚡</span> Nivel Actual
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Progresión de gemas por Siigo Points</p>

        {/* Current level badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
            {nivelActual.emoji}
          </div>
          <div>
            <p className="text-lg font-black font-heading text-foreground">{nivelActual.nombre}</p>
            <p className="text-xs text-muted-foreground font-semibold">
              <span className="font-scoreboard text-primary">{sp.toLocaleString()}</span> SP totales
            </p>
          </div>
        </div>

        {/* Progress to next level */}
        {nivelSiguiente ? (
          <div className="mt-auto">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>{nivelActual.nombre}</span>
              <span className="font-bold text-foreground">{Math.round(pctNivel)}%</span>
              <span>{nivelSiguiente.nombre} {nivelSiguiente.emoji}</span>
            </div>
            <Progress value={pctNivel} className="h-3" />
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              Faltan <span className="font-bold font-scoreboard text-primary">{(spParaSiguiente - sp).toLocaleString()}</span> SP para {nivelSiguiente.nombre}
            </p>
          </div>
        ) : (
          <div className="mt-auto text-center py-2">
            <p className="text-sm font-bold text-accent">🏆 ¡Nivel máximo alcanzado!</p>
          </div>
        )}

        {/* Level dots */}
        <div className="flex justify-center gap-2 mt-4">
          {NIVELES.slice(0, 5).map((n, i) => (
            <div
              key={n.nombre}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                i <= nivelIdx ? 'bg-primary text-primary-foreground scale-100' : 'bg-muted text-muted-foreground scale-90'
              } ${i === nivelIdx ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}
              title={n.nombre}
            >
              {n.emoji}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Card 3: KPIs Clave */}
      <motion.div className="bg-card border border-border rounded-2xl p-6 shadow-smooth-sm flex flex-col" variants={popIn}>
        <h3 className="text-sm font-bold font-heading text-secondary mb-1 flex items-center gap-2">
          <span className="text-primary">📊</span> KPIs del Mes
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Indicadores clave de rendimiento</p>

        <div className="space-y-4 flex-1">
          {/* ACV+ */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
              <span>ACV+ del Mes</span>
              <span className="text-foreground">{fmt(acvMes)}</span>
            </div>
            <Progress value={metaValue > 0 ? Math.min(100, (acvMes / metaValue) * 100) : (acvMes > 0 ? 50 : 0)} className="h-2.5" />
          </div>

          {/* Ventas Semana */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
              <span>Ventas esta Semana</span>
              <span className="text-foreground">{fmt(ventasSemana)}</span>
            </div>
            <Progress value={ventasSemana > 0 ? Math.min(100, (ventasSemana / 50_000_000) * 100) : 0} className="h-2.5" />
          </div>

          {/* Unidades del mes */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
              <span>Unidades Vendidas</span>
              <span className="text-foreground font-scoreboard">{kpis?.sc_creados || 0}</span>
            </div>
            <Progress value={Math.min(100, ((kpis?.sc_creados || 0) / 20) * 100)} className="h-2.5" />
          </div>
        </div>

        {/* Status indicator */}
        <div className={`mt-4 rounded-lg px-3 py-2 text-center text-xs font-bold ${
          pct >= 100 ? 'bg-accent/10 text-accent' : pct >= 70 ? 'bg-primary/10 text-primary' : pct >= 40 ? 'bg-orange/10 text-orange' : 'bg-muted text-muted-foreground'
        }`}>
          {pct >= 100 ? '🏆 ¡Meta superada!' : pct >= 70 ? '🔥 ¡Buen ritmo!' : pct >= 40 ? '⚡ Sigue avanzando' : '💪 ¡A por la meta!'}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default KpiProgressBars;
