import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import siigoLogoBlue from '@/assets/siigo-logo-blue.png';

// ─── Material Icon helper ────────────────────────────────────────────
const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

// ─── Data ────────────────────────────────────────────────────────────

const strategicPillars = [
  { icon: 'visibility', label: 'Visibilidad', sub: 'Feedback en tiempo real.' },
  { icon: 'bolt', label: 'Productividad', sub: 'Esfuerzo sostenible.' },
  { icon: 'psychology', label: 'Maestría', sub: 'Upskilling constante.' },
  { icon: 'radar', label: 'Radar de Impacto', sub: '' },
];

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
  { icon: 'verified', label: 'Cerrar Venta (Contrato)', pts: '10 pts' },
  { icon: 'trending_up', label: 'Venta de Alto Valor', pts: '15-20 pts' },
  { icon: 'volunteer_activism', label: 'Reconocimiento a compañero', pts: '1-2 pts' },
];

const bonusPoints = [
  { label: 'Alcanzar Meta Mensual (100%)', pts: '+10 pts' },
  { label: 'Meta Colectiva de Equipo', pts: '+X pts' },
  { label: 'Obtener nueva Medalla/Insignia', pts: '+5 pts' },
];

const levels = [
  { name: 'Novato', level: 1, range: '0 - 2,000 pts', icon: 'eco', color: 'text-muted-foreground', bg: 'bg-muted/50' },
  { name: 'Explorador', level: 2, range: '2k - 8,000 pts', icon: 'explore', color: 'text-primary', bg: 'bg-primary/10' },
  { name: 'Master', level: 3, range: '8k - 20,000 pts', icon: 'military_tech', color: 'text-accent', bg: 'bg-accent/10' },
  { name: 'Legendario', level: 4, range: '20k - 45,000 pts', icon: 'auto_fix_high', color: 'text-orange', bg: 'bg-orange/10' },
  { name: 'Imparable', level: 5, range: '+45,000 pts', icon: 'rocket_launch', color: 'text-destructive', bg: 'bg-destructive/10' },
];

const badges = [
  { icon: 'track_changes', name: 'Francotirador', desc: 'Conversión superior al 30% en un mes.' },
  { icon: 'catching_pokemon', name: 'Alpha Wolf', desc: 'Cerrar el mayor número de tratos trimestrales.' },
  { icon: 'handshake', name: 'El Padrino', desc: 'Recibir 5 reconocimientos de ayuda/mentoring.' },
  { icon: 'diamond', name: 'Caza Ballenas', desc: 'Cerrar negocio que represente >15% de la cuota.' },
];

// ─── Challenge Table Component ───────────────────────────────────────

const ChallengeTable = ({
  icon,
  title,
  items,
  colorClass,
}: {
  icon: string;
  title: string;
  items: { name: string; desc: string; pts: string }[];
  colorClass: string;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorClass)}>
        <MI icon={icon} className="text-lg !text-inherit" />
      </div>
      <h4 className="text-sm font-bold text-foreground">{title}</h4>
    </div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Desafío</TableHead>
          <TableHead className="text-xs">Explicación</TableHead>
          <TableHead className="text-xs text-right w-20">Puntos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-xs font-semibold">{item.name}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{item.desc}</TableCell>
            <TableCell className="text-xs text-right font-bold text-primary">{item.pts}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

// ─── Section Number ──────────────────────────────────────────────────

const SectionNumber = ({ num }: { num: number }) => (
  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
    {num}
  </div>
);

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
      <div className="space-y-8 max-w-5xl mx-auto">

        {/* ── Hero Banner ── */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 via-card to-accent/5 border-primary/20 overflow-hidden relative">
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <MI icon="insights" className="text-primary text-xl" />
                <span className="text-xs font-bold text-primary tracking-wider uppercase">
                  Siigo Hero Academy
                </span>
              </div>
              <Badge className="bg-foreground/10 text-foreground border-0 text-[10px] font-bold uppercase tracking-wider">
                Guía de Desafíos y Sistema de Puntos
              </Badge>
              <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Cultura de Alto Desempeño
              </h1>
              <h2 className="text-lg font-semibold text-foreground/80" style={{ fontFamily: 'Outfit, sans-serif' }}>
                La Gamificación es nuestra Estrategia
              </h2>
              <p className="text-sm text-muted-foreground max-w-lg">
                Basado en el análisis de transformación, pasamos de un estado reactivo a un ecosistema proactivo 
                donde cada acción cuenta para tu crecimiento profesional.
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-accent/20 px-3 py-1.5 rounded-full flex-shrink-0">
              <MI icon="stars" className="text-accent text-base" />
              <span className="text-sm font-bold text-foreground">{currentXP.toLocaleString()} XP</span>
            </div>
          </div>

          {/* Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 relative z-10">
            {strategicPillars.map((p) => (
              <div key={p.label} className="flex items-center gap-2.5 p-3 rounded-xl bg-card/70 backdrop-blur-sm border border-border/50">
                <MI icon={p.icon} className="text-primary text-xl" />
                <div>
                  <p className="text-xs font-bold text-foreground">{p.label}</p>
                  {p.sub && <p className="text-[10px] text-muted-foreground">{p.sub}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── 1. Challenges Timeline ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SectionNumber num={1} />
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Cronograma de Desafíos
            </h2>
          </div>

          <Card className="p-5 space-y-6">
            <ChallengeTable icon="flash_on" title='Retos Diarios ("Flash Challenges")' items={dailyChallenges} colorClass="bg-accent/10 text-accent" />
            <ChallengeTable icon="calendar_view_week" title="Retos Semanales" items={weeklyChallenges} colorClass="bg-primary/10 text-primary" />
            <ChallengeTable icon="workspace_premium" title="Retos Mensuales" items={monthlyChallenges} colorClass="bg-secondary/10 text-secondary" />
          </Card>
        </div>

        {/* ── 2. Points System ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SectionNumber num={2} />
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Sistema de Puntuación
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Action points */}
            <Card className="p-5">
              <div className="space-y-1">
                {pointActions.map((action, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MI icon={action.icon} className="text-primary text-lg" />
                    </div>
                    <span className="text-sm text-foreground flex-1">{action.label}</span>
                    <span className="text-sm font-bold text-primary">{action.pts}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Bonus */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <MI icon="stars" className="text-accent text-xl" />
                <h3 className="text-base font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Bonus de Logros
                </h3>
              </div>
              <div className="space-y-3">
                {bonusPoints.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-accent/10">
                    <span className="text-sm text-foreground">{b.label}</span>
                    <span className="text-sm font-bold text-primary">{b.pts}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* ── 3. Mastery Path ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SectionNumber num={3} />
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Camino a la Maestría
            </h2>
          </div>

          {/* Levels horizontal */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              {levels.map((lvl, i) => {
                const isCurrent = currentLevel?.level === lvl.name;
                return (
                  <div key={lvl.name} className="flex items-center gap-1">
                    <div className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl min-w-[100px] transition-all border-2",
                      isCurrent
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-smooth-md"
                        : "border-border bg-muted/30"
                    )}>
                      <MI icon={lvl.icon} className={cn("text-3xl", lvl.color)} />
                      <p className="text-xs font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        {lvl.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Nivel {lvl.level}</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">{lvl.range}</p>
                      {isCurrent && (
                        <MI icon="stars" className="text-primary text-base" />
                      )}
                    </div>
                    {i < levels.length - 1 && (
                      <MI icon="chevron_right" className="text-muted-foreground text-lg flex-shrink-0 mx-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Badges */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Insignias y Medallas
              </h3>
              <Button variant="outline" size="sm" className="text-xs">
                Ver Galería Completa
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Las insignias apelan al tipo de jugador "Achiever" y "Killer". 
              Coleccionables y visibles en tu perfil público para demostrar tu valor comercial.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {badges.map((badge) => (
                <Card key={badge.name} className="p-4 text-center hover:shadow-smooth-md transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                    <MI icon={badge.icon} className="text-primary text-2xl" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {badge.name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{badge.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t border-border space-y-3">
          <img src={siigoLogoBlue} alt="Siigo" className="h-8 mx-auto opacity-60" />
          <p className="text-xs text-muted-foreground">
            <MI icon="emoji_events" className="text-accent text-sm align-middle mr-1" />
            Siigo Sales Gamification Engine © 2025
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
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
