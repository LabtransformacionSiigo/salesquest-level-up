import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import siigoLogoBlue from '@/assets/siigo-logo-blue.png';

// ─── Material Icon helper ────────────────────────────────────────────
const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

// ─── Level Data ──────────────────────────────────────────────────────
const levelCards = [
  {
    icon: 'eco',
    name: 'Novato',
    levelNum: 1,
    range: '0 - 2,000 pts',
    focus: 'Aprendizaje, primeros registros y uso de herramientas básicas.',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-500',
    rangeBg: 'bg-sky-100 text-sky-600',
    borderColor: 'border-border',
  },
  {
    icon: 'explore',
    name: 'Explorador',
    levelNum: 2,
    range: '2,001 - 8,000 pts',
    focus: 'Consistencia en visitas y cierre de negocios pequeños.',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-500',
    rangeBg: 'bg-orange-100 text-orange-600',
    borderColor: 'border-green-400',
  },
  {
    icon: 'security',
    name: 'Master',
    levelNum: 3,
    range: '8,001 - 20,000 pts',
    focus: 'Cumplimiento de cuota mensual y retención de clientes.',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    rangeBg: 'bg-sky-500 text-white',
    borderColor: 'border-sky-400',
    isHighlighted: true,
  },
  {
    icon: 'auto_awesome',
    name: 'Legendario',
    levelNum: 4,
    range: '20,001 - 45,000 pts',
    focus: 'Superación de cuota (>120%) y mentoring a novatos.',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-500',
    rangeBg: 'bg-purple-100 text-purple-600',
    borderColor: 'border-border',
  },
  {
    icon: 'rocket_launch',
    name: 'Imparable',
    levelNum: 5,
    range: '> 45,000 pts',
    focus: 'Liderazgo de mercado, innovación y ventas estratégicas.',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
    rangeBg: 'bg-red-500 text-white',
    borderColor: 'border-red-400',
  },
];

// ─── Badges ──────────────────────────────────────────────────────────
const badges = [
  { icon: 'ads_click', name: 'Francotirador', category: 'EFECTIVIDAD', categoryColor: 'text-red-500', desc: 'Lograr una tasa de conversión superior al 30% en un mes.', iconBg: 'bg-sky-50', iconColor: 'text-sky-400' },
  { icon: 'pets', name: 'Alpha Wolf', category: 'VOLUMEN', categoryColor: 'text-orange-500', desc: 'Cerrar el mayor número de tratos (volumen) en el trimestre.', iconBg: 'bg-orange-50', iconColor: 'text-orange-400' },
  { icon: 'handshake', name: 'El Padrino', category: 'COLABORACIÓN', categoryColor: 'text-sky-500', desc: 'Recibir 5 reconocimientos de compañeros por ayuda o mentoring.', iconBg: 'bg-sky-50', iconColor: 'text-sky-400' },
  { icon: 'diamond', name: 'Caza Ballenas', category: 'VALOR (ACV)', categoryColor: 'text-purple-500', desc: 'Cerrar un solo negocio que represente >15% de la cuota mensual.', iconBg: 'bg-purple-50', iconColor: 'text-purple-400' },
];

// ─── Points Table ────────────────────────────────────────────────────
const pointsTable = [
  { action: 'Llamada/Contacto a prospecto nuevo', pts: '+2 pts' },
  { action: 'Completar una reunión o demo', pts: '+5 pts' },
  { action: 'Enviar propuesta formal', pts: '+5 pts' },
  { action: 'Cerrar una venta (Contrato firmado)', pts: '+10 pts' },
  { action: 'Cerrar venta de alto valor (>ACV)', pts: '15-20 pts' },
  { action: 'Recibir reconocimiento de compañero', pts: '+2 pts' },
];

// ─── Strategic Objectives ───────────────────────────────────────────
const objectives = [
  { icon: 'insights', title: 'Visibilidad en Tiempo Real', desc: 'Feedback loop instantáneo para saber exactamente cuánto falta para ganar.' },
  { icon: 'bolt', title: 'Productividad Sostenible', desc: 'Evitar picos de fin de mes ("Hockey Stick") mediante retos diarios y semanales.' },
  { icon: 'psychology', title: 'Maestría (Upskilling)', desc: 'Los niveles representan conocimiento y habilidad de venta, no solo antigüedad.' },
];

// ─── Page ────────────────────────────────────────────────────────────
const HeroJourney = () => {
  const { isAuthenticated, profile } = useSupabaseAuthContext();
  const { getLevelByXP } = useConfig();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const currentXP = profile?.xp || 0;
  const currentLevel = getLevelByXP(currentXP);

  return (
    <Layout title="Siigo Hero Academy">
      <div className="max-w-5xl mx-auto space-y-10 pb-10">

        {/* ── Hero Title ── */}
        <div className="text-center space-y-3 pt-4">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-sky-500 via-blue-500 to-purple-500 bg-clip-text text-transparent"
              style={{ fontFamily: 'Inter, Plus Jakarta Sans, sans-serif' }}>
            La Ruta del Héroe Comercial
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Sistema de niveles basado en acumulación trimestral de puntos y maestría.
            Evoluciona tu carrera y conviértete en una leyenda de las ventas.
          </p>
        </div>

        {/* ── Level Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {levelCards.map((lvl) => {
            const isCurrent = currentLevel?.level === lvl.name;
            const highlighted = isCurrent || lvl.isHighlighted;
            return (
              <div key={lvl.name} className="relative flex flex-col items-center">
                {highlighted && (
                  <span className="absolute -top-3 bg-sky-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full z-10">
                    Tu Nivel
                  </span>
                )}
                <div className={cn(
                  "w-full rounded-2xl border-2 p-5 flex flex-col items-center text-center gap-2 bg-card transition-all",
                  highlighted ? 'border-sky-400 shadow-lg shadow-sky-100' : lvl.borderColor
                )}>
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", lvl.iconBg)}>
                    <MI icon={lvl.icon} className={cn("text-3xl", lvl.iconColor)} />
                  </div>
                  <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {lvl.name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Nivel {lvl.levelNum}
                  </p>
                  <span className={cn("text-[11px] font-semibold px-3 py-1 rounded-full", lvl.rangeBg)}>
                    {lvl.range}
                  </span>
                  <div className="mt-1">
                    <p className="text-[10px] font-bold text-muted-foreground">Foco:</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{lvl.focus}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Insignias y Medallas ── */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <MI icon="military_tech" className="text-amber-500 text-xl" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Insignias y Medallas
                </h2>
                <p className="text-xs text-muted-foreground">Reconocimiento a tu estilo de juego</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-full border border-border text-foreground">Achiever</span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full border border-red-200 text-red-500">Killer</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {badges.map((badge) => (
              <div key={badge.name} className="flex flex-col items-center text-center gap-2">
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", badge.iconBg)}>
                  <MI icon={badge.icon} className={cn("text-3xl", badge.iconColor)} />
                </div>
                <h4 className="text-sm font-bold text-foreground">{badge.name}</h4>
                <p className={cn("text-[10px] font-bold uppercase tracking-wider", badge.categoryColor)}>
                  {badge.category}
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom Two Columns ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Points Table */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
                Tabla de Puntos
              </h2>
              <MI icon="info_outline" className="text-muted-foreground text-lg" />
            </div>
            <div className="space-y-0">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                <span>Acción</span>
                <span>Puntos</span>
              </div>
              {pointsTable.map((row, i) => (
                <div key={i} className="flex justify-between items-center py-3 border-b border-border/50 last:border-0">
                  <span className="text-sm text-foreground">{row.action}</span>
                  <span className="text-sm font-bold text-sky-500">{row.pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Objectives */}
          <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-6 text-white space-y-5">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Inter, sans-serif' }}>
              Objetivos Estratégicos
            </h2>
            <div className="space-y-4">
              {objectives.map((obj) => (
                <div key={obj.title} className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <MI icon={obj.icon} className="text-white/90 text-xl flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold">{obj.title}</h3>
                    <p className="text-xs text-white/80 leading-relaxed mt-0.5">{obj.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Impacto Proyectado</p>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex-1 h-12 rounded-lg bg-white/10" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-6 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <div className="w-2 h-2 rounded-full bg-purple-500" />
          </div>
          <p className="text-xs text-muted-foreground">
            © 2024 Siigo Gamification Engine - Potenciando el talento comercial
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default HeroJourney;
