import { motion } from 'framer-motion';
import { fadeUpItem, popIn } from '@/lib/animations';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import DonutChart from './DonutChart';
import type { EjecucionAsesor, MetaAsesor, AsesorPerformance } from '@/hooks/useGamificationMetrics';
import { getNivelesByCanal } from '@/lib/niveles';

interface KpiProgressBarsProps {
  kpis: any;
  acvMes: number;
  ventasSemana: number;
  isVcAdvisor: boolean;
  loading: boolean;
  pctCumplimiento?: number;
  sp?: number;
  canal?: string | null;
  ejecucion?: EjecucionAsesor | null;
  metaAsesor?: MetaAsesor | null;
  isVCGerente?: boolean;
  teamAsesorPerformance?: AsesorPerformance[];
  vcCumplimiento?: { acv: number; meta: number; pct: number } | null;
}

const fmt = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;

const getSafePercentage = (current: number, goal: number) => {
  if (goal <= 0) return 0;
  return Math.round((current / goal) * 100);
};

const VnProgressRow = ({
  label,
  current,
  goal,
  icon,
  formatter,
}: {
  label: string;
  current: number;
  goal: number;
  icon: string;
  formatter?: (value: number) => string;
}) => {
  const pct = getSafePercentage(current, goal);
  const formatValue = formatter ?? ((value: number) => value.toLocaleString());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-2 text-foreground">
          <span className="material-icons-round text-primary !text-base">{icon}</span>
          <span>{label}</span>
        </span>
        <span className="text-primary font-scoreboard text-sm">{pct}%</span>
      </div>
      <Progress value={Math.min(100, Math.max(0, pct))} className="h-3" />
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-foreground font-scoreboard">{formatValue(current || 0)}</span>
        <span className="text-muted-foreground">Meta: <span className="font-scoreboard text-foreground">{formatValue(goal || 0)}</span></span>
      </div>
    </div>
  );
};

const KpiProgressBars = ({ kpis, acvMes, ventasSemana, isVcAdvisor, loading, pctCumplimiento, sp = 0, canal, ejecucion, metaAsesor, isVCGerente, teamAsesorPerformance, vcCumplimiento }: KpiProgressBarsProps) => {
  const NIVELES = getNivelesByCanal(canal);
  const nivelActual = NIVELES.find((n) => sp >= n.min && sp <= n.max) || NIVELES[0];
  const nivelIdx = NIVELES.indexOf(nivelActual);
  const nivelSiguiente = NIVELES[nivelIdx + 1];
  const spParaSiguiente = nivelSiguiente ? nivelSiguiente.min : sp;
  const pctNivel = nivelSiguiente ? Math.min(100, ((sp - nivelActual.min) / (spParaSiguiente - nivelActual.min)) * 100) : 100;

  const pct = pctCumplimiento ?? (kpis?.pct_cumplimiento ? Number(kpis.pct_cumplimiento) : 0);
  const metaValue = vcCumplimiento?.meta ?? (kpis?.meta ? Number(kpis.meta) : 0);
  const ventasValue = vcCumplimiento?.acv ?? (kpis?.ventas ? Number(kpis.ventas) : acvMes);
  const metaAcvValue = Number(metaAsesor?.meta_acv) || 0;

  const isVN = canal === 'VN_ALIADOS' || canal === 'VN_EMPRESARIOS';
  const showVCTeam = !!isVCGerente && Array.isArray(teamAsesorPerformance) && teamAsesorPerformance.length > 0;

  // For VN: always show FE / Nube / Total / ACV+ progress bars even if data is
  // partially missing — fall back to zeros so the user sees the meta and the
  // progress (or lack of it) instead of an empty card.
  const vnEjecucion = isVN
    ? (ejecucion ?? { ventas_fe: 0, ventas_nube: 0, ventas_total: 0, acv_total: 0, cant_recomendados: 0, productividad: 0 })
    : null;
  const vnMeta = isVN
    ? (metaAsesor ?? { meta_fe: 0, meta_nube: 0, meta_total: 0, meta_acv: metaAcvValue })
    : null;

  if (loading) {
    return (
      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-5" variants={fadeUpItem}>
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </motion.div>
    );
  }

  return (
    <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-5" variants={fadeUpItem}>

      {/* ── LEFT: Nivel Actual ── */}
      <motion.div
        className="bg-card border border-border rounded-2xl p-8 shadow-smooth-sm flex flex-col"
        variants={popIn}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
      >
        <h3 className="text-base font-bold font-heading text-secondary mb-1 flex items-center gap-2">
          <span className="text-primary">⚡</span> Nivel Actual
        </h3>
        <p className="text-xs text-muted-foreground mb-6">Progresión de gemas por Siigo Points de cumplimiento</p>

        {/* Current level badge */}
        <div className="flex items-center gap-5 mb-8">
          <motion.div
            className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {nivelActual.emoji}
          </motion.div>
          <div>
            <p className="text-3xl font-black font-heading text-foreground">{nivelActual.nombre}</p>
            <p className="text-sm text-muted-foreground font-semibold">
                <span className="font-scoreboard text-primary text-xl">{sp.toLocaleString()}</span> Siigo Points
            </p>
          </div>
        </div>

        {/* Progress to next level */}
        {nivelSiguiente ? (
          <div className="mt-auto">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span className="font-semibold">{nivelActual.nombre}</span>
              <span className="font-bold text-foreground text-sm">{Math.round(pctNivel)}%</span>
              <span className="font-semibold">{nivelSiguiente.nombre} {nivelSiguiente.emoji}</span>
            </div>
            <Progress value={pctNivel} className="h-4" />
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Faltan <span className="font-bold font-scoreboard text-primary">{(spParaSiguiente - sp).toLocaleString()}</span> SP para {nivelSiguiente.nombre}
            </p>
          </div>
        ) : (
          <div className="mt-auto text-center py-3">
            <p className="text-lg font-bold text-accent">🏆 ¡Nivel máximo alcanzado!</p>
          </div>
        )}

        {/* Level dots */}
        <div className="flex justify-center gap-3 mt-6">
          {NIVELES.slice(0, 5).map((n, i) => (
            <div
              key={n.nombre}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all ${
                i <= nivelIdx ? 'bg-primary text-primary-foreground scale-100' : 'bg-muted text-muted-foreground scale-90'
              } ${i === nivelIdx ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}
              title={n.nombre}
            >
              {n.emoji}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── RIGHT: Rendimiento del Mes / Equipo ── */}
      <motion.div
        className="bg-card border border-border rounded-2xl p-8 shadow-smooth-sm flex flex-col"
        variants={popIn}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
      >
        <h3 className="text-base font-bold font-heading text-secondary mb-1 flex items-center gap-2">
          <span className="text-primary">🎯</span> {showVCTeam ? 'Rendimiento del Equipo' : 'Rendimiento del Mes'}
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          {showVCTeam ? 'ACV+ por comercial vs Meta del mes' : isVN ? 'Unidades vendidas vs Meta del equipo' : isVcAdvisor ? 'ACV+ vs Meta asignada' : 'Ventas vs Meta del mes'}
        </p>

        {showVCTeam ? (
          /* ── VC Gerente: ACV+ por comercial ── */
          <div className="flex flex-col gap-4 flex-1">
            {/* Resumen total del equipo */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-heading text-muted-foreground">Total equipo</p>
                <p className="text-xl font-black font-scoreboard text-foreground">{fmt(ventasValue)}</p>
                <p className="text-[11px] text-muted-foreground">Meta: <span className="font-scoreboard text-foreground">{fmt(metaValue)}</span></p>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-black font-scoreboard ${pct >= 100 ? 'text-accent' : pct >= 70 ? 'text-primary' : 'text-orange'}`}>{Math.round(pct)}%</p>
                <p className="text-[10px] uppercase font-heading text-muted-foreground">Cumplimiento</p>
              </div>
            </div>

            {/* Lista de comerciales con barras */}
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1 max-h-[360px]">
              {teamAsesorPerformance!.map((a) => (
                <VnProgressRow
                  key={a.nombre}
                  label={a.nombre}
                  current={a.acv}
                  goal={a.meta_acv}
                  icon="trending_up"
                  formatter={fmt}
                />
              ))}
            </div>
          </div>
        ) : isVN && vnEjecucion && vnMeta ? (
          /* ── VN: 4 barras fijas ── */
          <div className="flex flex-col gap-5 flex-1">
            <VnProgressRow label="Total Unidades" current={ejecucion.ventas_total} goal={metaAsesor.meta_total} icon="inventory_2" formatter={(v) => `${v.toLocaleString()} uds`} />
            <VnProgressRow label="FE" current={ejecucion.ventas_fe} goal={metaAsesor.meta_fe} icon="receipt_long" formatter={(v) => `${v.toLocaleString()} uds`} />
            <VnProgressRow label="Nube" current={ejecucion.ventas_nube} goal={metaAsesor.meta_nube} icon="cloud" formatter={(v) => `${v.toLocaleString()} uds`} />
            <VnProgressRow label="ACV+" current={ejecucion.acv_total} goal={metaAcvValue} icon="trending_up" formatter={fmt} />

            {/* Extras: Productividad + Recomendados */}
            <div className="grid grid-cols-2 gap-4 mt-auto pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-black font-scoreboard text-primary">{Math.round(ejecucion.productividad)}</p>
                <p className="text-[10px] text-muted-foreground font-heading uppercase">Productividad</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black font-scoreboard text-accent">{ejecucion.cant_recomendados}</p>
                <p className="text-[10px] text-muted-foreground font-heading uppercase">{canal === 'VN_ALIADOS' ? 'Ref. Contador' : 'Referidos'}</p>
              </div>
            </div>

            {/* Status based on unit compliance */}
            {(() => {
              const pctAcv = getSafePercentage(ejecucion.acv_total, metaAcvValue);
              return (
                <div className={`rounded-xl px-4 py-2.5 text-center text-xs font-bold ${
                  pctAcv >= 100 ? 'bg-accent/10 text-accent' : pctAcv >= 70 ? 'bg-primary/10 text-primary' : pctAcv >= 40 ? 'bg-orange/10 text-orange' : 'bg-muted text-muted-foreground'
                }`}>
                  {pctAcv >= 100 ? '🏆 ¡Meta ACV superada!' : pctAcv >= 70 ? '🔥 ¡Buen ritmo en ACV!' : pctAcv >= 40 ? '⚡ Sigue avanzando en ACV' : '💪 ¡A por la meta ACV!'}
                </div>
              );
            })()}
          </div>
        ) : (
          /* ── VC / default: Donut chart ── */
          <div className="flex flex-col md:flex-row gap-6 flex-1 items-center">
            {/* Donut */}
            <div className="flex flex-col items-center justify-center flex-shrink-0">
              <DonutChart
                value={pct}
                max={100}
                size={170}
                strokeWidth={16}
                color={pct >= 100 ? 'hsl(var(--accent))' : pct >= 70 ? 'hsl(var(--primary))' : 'hsl(var(--orange))'}
                bgColor="hsl(var(--muted))"
              >
                <span className="text-3xl font-black font-scoreboard text-foreground">{Math.round(pct)}%</span>
                <span className="text-[10px] text-muted-foreground font-bold uppercase">cumplimiento</span>
              </DonutChart>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px bg-border self-stretch" />

            {/* KPIs */}
            <div className="flex-1 flex flex-col justify-between gap-5 w-full">
              <div className="space-y-1">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">{isVcAdvisor ? 'ACV+' : 'Ventas'}</span>
                  <span className="text-primary font-scoreboard">{fmt(ventasValue)}</span>
                </div>
                {metaValue > 0 && (
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Meta</span>
                    <span className="text-foreground font-scoreboard">{fmt(metaValue)}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                  <span>Unidades Vendidas</span>
                  <span className="text-foreground font-scoreboard">{kpis?.sc_creados || 0}</span>
                </div>
                <Progress value={Math.min(100, ((kpis?.sc_creados || 0) / 20) * 100)} className="h-2.5" />
              </div>

              {!isVcAdvisor && kpis?.cant_recomendados != null && (
                <div>
                  <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                    <span>{isVN && canal === 'VN_ALIADOS' ? 'Referidos del Contador' : 'Referidos'}</span>
                    <span className="text-foreground font-scoreboard">{kpis.cant_recomendados}</span>
                  </div>
                  <Progress value={Math.min(100, (kpis.cant_recomendados / 10) * 100)} className="h-2.5" />
                </div>
              )}

              <div className={`rounded-xl px-4 py-2.5 text-center text-xs font-bold mt-auto ${
                pct >= 100 ? 'bg-accent/10 text-accent' : pct >= 70 ? 'bg-primary/10 text-primary' : pct >= 40 ? 'bg-orange/10 text-orange' : 'bg-muted text-muted-foreground'
              }`}>
                {pct >= 100 ? '🏆 ¡Meta superada!' : pct >= 70 ? '🔥 ¡Buen ritmo!' : pct >= 40 ? '⚡ Sigue avanzando' : '💪 ¡A por la meta!'}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default KpiProgressBars;
