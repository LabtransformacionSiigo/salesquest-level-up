import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

// ─── Data ────────────────────────────────────────────────────────────

const dailyChallenges = [
  { name: 'Lunes de Prospección', desc: 'Quien logre más clientes potenciales nuevos hoy.', pts: '+3 pts' },
  { name: 'Velocidad Telefónica', desc: 'Llamadas exitosas antes de las 5pm.', pts: '+3 pts' },
  { name: 'Primer Venta del Día', desc: 'Primer asesor en cerrar una venta cada día.', pts: '+3 pts' },
];

const weeklyChallenges = [
  { name: 'Agenda Llena', desc: 'Asesor que consiga agendar más demos/reuniones.', pts: '+5 pts' },
  { name: 'Desafío Colaborativo', desc: 'Equipos compiten en % de cuota semanal.', pts: '+5 pts' },
  { name: 'Maratón Seguimiento', desc: 'Quien contacte a más clientes rezagados.', pts: '+5 pts' },
];

const monthlyChallenges = [
  { name: 'Mes del Cierre Perfecto', desc: 'Superar la cuota mensual de ventas.', pts: '+10 pts' },
  { name: 'Campeón del Mes en CRM', desc: 'Mejor calidad de datos (completeness).', pts: '+10 pts' },
];

const pointActions = [
  { icon: 'person_add', label: 'Registrar prospecto', pts: '1 pt' },
  { icon: 'phone_in_talk', label: 'Llamada/Contacto', pts: '2 pts' },
  { icon: 'groups', label: 'Completar Reunión/Demo', pts: '5 pts' },
  { icon: 'description', label: 'Enviar Propuesta Formal', pts: '5 pts' },
];

const bonusPoints = [
  { label: 'Alcanzar Meta Mensual (100%)', pts: '+10 pts' },
  { label: 'Meta Colectiva de Equipo', pts: '+X pts' },
  { label: 'Obtener nueva Medalla/Insignia', pts: '+5 pts' },
];

const levelCards = [
  { icon: 'eco', name: 'Novato', levelNum: 1, range: '0 - 2,000 pts', iconBg: 'bg-sky-100', iconColor: 'text-sky-500' },
  { icon: 'explore', name: 'Explorador', levelNum: 2, range: '2k - 8,000 pts', iconBg: 'bg-orange-100', iconColor: 'text-orange-500' },
  { icon: 'security', name: 'Master', levelNum: 3, range: '8k - 20,000 pts', iconBg: 'bg-sky-100', iconColor: 'text-sky-600' },
  { icon: 'auto_awesome', name: 'Legendario', levelNum: 4, range: '20k - 45,000 pts', iconBg: 'bg-purple-100', iconColor: 'text-purple-500' },
  { icon: 'rocket_launch', name: 'Imparable', levelNum: 5, range: '+45,000 pts', iconBg: 'bg-slate-800', iconColor: 'text-white', dark: true },
];

const badges = [
  { icon: 'track_changes', name: 'Francotirador', desc: 'Conversión superior al 30% en un mes.' },
  { icon: 'catching_pokemon', name: 'Alpha Wolf', desc: 'Cerrar el mayor número de tratos trimestrales.' },
  { icon: 'handshake', name: 'El Padrino', desc: 'Recibir 5 reconocimientos de ayuda/mentoring.' },
  { icon: 'diamond', name: 'Caza Ballenas', desc: 'Cerrar negocio que represente >15% de la cuota.' },
];

// ─── Challenge Table ─────────────────────────────────────────────────

const ChallengeSection = ({
  icon, title, items,
}: {
  icon: string; title: string;
  items: { name: string; desc: string; pts: string }[];
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <MI icon={icon} className="text-foreground text-lg" />
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
    </div>
    <div className="divide-y divide-border">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-4 py-3 text-sm">
          <span className="font-semibold text-foreground">{item.name}</span>
          <span className="text-muted-foreground">{item.desc}</span>
          <span className="font-bold text-primary">{item.pts}</span>
        </div>
      ))}
    </div>
  </div>
);

const SectionNumber = ({ num }: { num: number }) => (
  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
    {num}
  </div>
);

// ─── Page ────────────────────────────────────────────────────────────

const HeroJourney = () => {
  const { isAuthenticated, profile } = useSupabaseAuthContext();
  const { getLevelByXP } = useConfig();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const currentXP = profile?.xp || 0;
  const currentLevel = getLevelByXP(currentXP);

  return (
    <Layout title="Siigo Hero Academy">
      <div className="max-w-5xl mx-auto space-y-8 pb-10">

        {/* ── Hero Banner ── */}
        <div className="rounded-2xl bg-muted/50 p-8">
          <div className="flex items-start justify-between">
            <div className="space-y-3 max-w-md">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Cultura de Alto Desempeño
              </p>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight">
                La Gamificación es nuestra{' '}
                <span className="text-primary">Estrategia</span>
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Basado en el análisis de transformación, pasamos de un estado reactivo a un ecosistema proactivo donde cada acción cuenta para tu crecimiento profesional.
              </p>
              <div className="flex gap-4 pt-2">
                {[
                  { icon: 'visibility', label: 'Visibilidad', sub: 'Feedback en tiempo real.' },
                  { icon: 'bolt', label: 'Productividad', sub: 'Esfuerzo sostenible.' },
                  { icon: 'psychology', label: 'Maestría', sub: 'Upskilling constante.' },
                ].map((p) => (
                  <div key={p.label} className="flex items-center gap-2 bg-card rounded-xl px-3 py-2 border border-border/50">
                    <MI icon={p.icon} className="text-primary text-base" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{p.label}</p>
                      <p className="text-[10px] text-muted-foreground">{p.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Radar placeholder */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="w-44 h-44 rounded-full border-4 border-muted flex items-center justify-center relative">
                <div className="w-32 h-32 rounded-full border-2 border-muted/60 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border border-muted/40 flex items-center justify-center">
                    <MI icon="radar" className="text-primary text-3xl" />
                  </div>
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">Radar de Impacto</p>
            </div>
          </div>
        </div>

        {/* ── 1. Challenges + 2. Points (side by side) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          {/* Challenges */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <SectionNumber num={1} />
              <h2 className="text-lg font-bold text-foreground">Cronograma de Desafíos</h2>
            </div>
            <ChallengeSection icon="flash_on" title='Retos Diarios ("Flash Challenges")' items={dailyChallenges} />
            <ChallengeSection icon="calendar_view_week" title="Retos Semanales" items={weeklyChallenges} />
            <ChallengeSection icon="workspace_premium" title="Retos Mensuales" items={monthlyChallenges} />
          </div>

          {/* Points */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SectionNumber num={2} />
              <h2 className="text-lg font-bold text-foreground">Sistema de Puntuación</h2>
            </div>
            <div className="space-y-1">
              {pointActions.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <MI icon={a.icon} className="text-muted-foreground text-lg" />
                  <span className="text-sm text-foreground flex-1">{a.label}</span>
                  <span className="text-sm font-bold text-primary">{a.pts}</span>
                </div>
              ))}
            </div>
            {/* Highlighted action */}
            <div className="flex items-center justify-between bg-slate-800 text-white rounded-full px-4 py-2.5">
              <div className="flex items-center gap-2">
                <MI icon="verified" className="text-secondary text-lg" />
                <span className="text-sm font-bold">Cerrar Venta (Contrato)</span>
              </div>
              <span className="text-sm font-bold">10 pts</span>
            </div>
            <div className="flex items-center gap-3 py-2">
              <MI icon="trending_up" className="text-muted-foreground text-lg" />
              <span className="text-sm text-foreground flex-1">Venta de Alto Valor</span>
              <span className="text-sm font-bold text-destructive">15-20 pts</span>
            </div>
            <div className="flex items-center gap-3 py-2">
              <MI icon="volunteer_activism" className="text-muted-foreground text-lg" />
              <span className="text-sm text-foreground flex-1">Reconocimiento a compañero</span>
              <span className="text-sm font-bold text-primary">1-2 pts</span>
            </div>

            {/* Bonus */}
            <div className="pt-3">
              <div className="flex items-center gap-2 mb-2">
                <MI icon="stars" className="text-accent text-lg" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bonus de Logros</h4>
              </div>
              <div className="space-y-1">
                {bonusPoints.map((b, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="font-bold text-primary">{b.pts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Camino a la Maestría ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SectionNumber num={3} />
            <h2 className="text-lg font-bold text-foreground">Camino a la Maestría</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {levelCards.map((lvl) => {
              const isCurrent = currentLevel?.level === lvl.name;
              return (
                <div key={lvl.name} className={cn(
                  "rounded-2xl border p-5 flex flex-col items-center text-center gap-2 relative transition-all",
                  lvl.dark
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-card border-border"
                )}>
                  {isCurrent && (
                    <MI icon="stars" className="absolute top-2 right-2 text-accent text-sm" />
                  )}
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", lvl.iconBg)}>
                    <MI icon={lvl.icon} className={cn("text-3xl", lvl.iconColor)} />
                  </div>
                  <h3 className={cn("text-sm font-bold", lvl.dark ? "text-white" : "text-foreground")}>
                    {lvl.name}
                  </h3>
                  <p className={cn("text-[10px] uppercase tracking-wider font-semibold", lvl.dark ? "text-slate-400" : "text-muted-foreground")}>
                    Nivel {lvl.levelNum}
                  </p>
                  <span className={cn(
                    "text-[11px] font-semibold px-3 py-1 rounded-full",
                    lvl.dark ? "bg-amber-500/20 text-amber-400" : "bg-primary/10 text-primary"
                  )}>
                    {lvl.range}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Insignias y Medallas ── */}
        <div className="rounded-2xl bg-slate-800 p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Insignias y Medallas</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Las insignias apelan al tipo de jugador "Achiever" y "Killer". Coleccionables y visibles en tu perfil público para demostrar tu valor comercial.
              </p>
            </div>
            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex-shrink-0">
              Ver Galería Completa
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {badges.map((badge) => (
              <div key={badge.name} className="rounded-xl bg-slate-700/60 p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-600/50 flex items-center justify-center flex-shrink-0">
                  <MI icon={badge.icon} className="text-primary text-xl" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{badge.name}</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <MI icon="emoji_events" className="text-accent text-sm align-middle mr-1" />
            Siigo Sales Gamification Engine © 2025
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer transition-colors">Reglamento</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Soporte</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Privacidad</span>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HeroJourney;
