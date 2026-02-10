import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Sprout, Compass, Shield, Sparkles, Rocket,
  Target, Users, Handshake, Diamond,
  Eye, Zap, Brain, Radar,
  CalendarDays, Trophy, Star,
  UserPlus, Phone, FileText, BadgeCheck, TrendingUp, Heart,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Data ────────────────────────────────────────────────────────────

const strategicPillars = [
  { icon: Eye, label: 'Visibilidad', sub: 'Feedback en tiempo real.' },
  { icon: Zap, label: 'Productividad', sub: 'Esfuerzo sostenible.' },
  { icon: Brain, label: 'Maestría', sub: 'Upskilling constante.' },
  { icon: Radar, label: 'Radar de Impacto', sub: '' },
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
  { icon: UserPlus, label: 'Registrar prospecto', pts: '1 pt' },
  { icon: Phone, label: 'Llamada/Contacto', pts: '2 pts' },
  { icon: Users, label: 'Completar Reunión/Demo', pts: '5 pts' },
  { icon: FileText, label: 'Enviar Propuesta Formal', pts: '5 pts' },
  { icon: BadgeCheck, label: 'Cerrar Venta (Contrato)', pts: '10 pts' },
  { icon: TrendingUp, label: 'Venta de Alto Valor', pts: '15-20 pts' },
  { icon: Heart, label: 'Reconocimiento a compañero', pts: '1-2 pts' },
];

const bonusPoints = [
  { label: 'Alcanzar Meta Mensual (100%)', pts: '+10 pts' },
  { label: 'Meta Colectiva de Equipo', pts: '+X pts' },
  { label: 'Obtener nueva Medalla/Insignia', pts: '+5 pts' },
];

const levels = [
  { name: 'Novato', level: 1, range: '0 - 2,000 pts', icon: Sprout, color: 'text-muted-foreground' },
  { name: 'Explorador', level: 2, range: '2k - 8,000 pts', icon: Compass, color: 'text-primary' },
  { name: 'Master', level: 3, range: '8k - 20,000 pts', icon: Shield, color: 'text-accent' },
  { name: 'Legendario', level: 4, range: '20k - 45,000 pts', icon: Sparkles, color: 'text-orange' },
  { name: 'Imparable', level: 5, range: '+45,000 pts', icon: Rocket, color: 'text-destructive' },
];

const badges = [
  { icon: Target, name: 'Francotirador', desc: 'Conversión superior al 30% en un mes.' },
  { icon: Users, name: 'Alpha Wolf', desc: 'Cerrar el mayor número de tratos trimestrales.' },
  { icon: Handshake, name: 'El Padrino', desc: 'Recibir 5 reconocimientos de ayuda/mentoring.' },
  { icon: Diamond, name: 'Caza Ballenas', desc: 'Cerrar negocio que represente >15% de la cuota.' },
];

// ─── Section Header ──────────────────────────────────────────────────

const SectionNumber = ({ num }: { num: number }) => (
  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
    {num}
  </div>
);

// ─── Challenge Table ─────────────────────────────────────────────────

const ChallengeTable = ({
  icon: Icon,
  title,
  items,
  variant,
}: {
  icon: React.ElementType;
  title: string;
  items: { name: string; desc: string; pts: string }[];
  variant: 'daily' | 'weekly' | 'monthly';
}) => {
  const colors = {
    daily: 'bg-accent/10 text-accent',
    weekly: 'bg-primary/10 text-primary',
    monthly: 'bg-secondary/10 text-secondary',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colors[variant])}>
          <Icon className="w-4 h-4" />
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
};

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
        <Card className="p-6 bg-gradient-to-br from-primary/10 via-card to-accent/5 border-primary/20">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Badge className="bg-primary/20 text-primary border-0 text-[10px] font-bold uppercase tracking-wider">
                Guía de Desafíos y Sistema de Puntos
              </Badge>
              <h1 className="text-2xl font-extrabold text-foreground">Cultura de Alto Desempeño</h1>
              <p className="text-sm text-muted-foreground max-w-lg">
                La Gamificación es nuestra Estrategia. Basado en el análisis de transformación, 
                pasamos de un estado reactivo a un ecosistema proactivo donde cada acción cuenta 
                para tu crecimiento profesional.
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-accent/20 text-accent-foreground px-3 py-1.5 rounded-full">
              <Star className="w-4 h-4 text-accent" />
              <span className="text-sm font-bold">{currentXP.toLocaleString()} XP</span>
            </div>
          </div>

          {/* Pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {strategicPillars.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.label} className="flex items-center gap-2 p-2.5 rounded-lg bg-card/60 border border-border">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground">{p.label}</p>
                    {p.sub && <p className="text-[10px] text-muted-foreground">{p.sub}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── 1. Challenges Timeline ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SectionNumber num={1} />
            <h2 className="text-xl font-bold text-foreground">Cronograma de Desafíos</h2>
          </div>

          <Card className="p-5 space-y-6">
            <ChallengeTable icon={Zap} title='Retos Diarios ("Flash Challenges")' items={dailyChallenges} variant="daily" />
            <ChallengeTable icon={CalendarDays} title="Retos Semanales" items={weeklyChallenges} variant="weekly" />
            <ChallengeTable icon={Trophy} title="Retos Mensuales" items={monthlyChallenges} variant="monthly" />
          </Card>
        </div>

        {/* ── 2. Points System ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SectionNumber num={2} />
            <h2 className="text-xl font-bold text-foreground">Sistema de Puntuación</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Action points */}
            <Card className="p-5">
              <div className="grid grid-cols-1 gap-2">
                {pointActions.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm text-foreground flex-1">{action.label}</span>
                      <span className="text-sm font-bold text-primary">{action.pts}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Bonus */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-accent" />
                <h3 className="text-base font-bold text-foreground">Bonus de Logros</h3>
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
            <h2 className="text-xl font-bold text-foreground">Camino a la Maestría</h2>
          </div>

          {/* Levels horizontal */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              {levels.map((lvl, i) => {
                const Icon = lvl.icon;
                const isCurrent = currentLevel?.level === lvl.name;
                return (
                  <div key={lvl.name} className="flex items-center gap-2">
                    <div className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl min-w-[100px] transition-all border",
                      isCurrent
                        ? "bg-primary/10 border-primary ring-1 ring-primary/30"
                        : "bg-muted/30 border-border"
                    )}>
                      <Icon className={cn("w-6 h-6", lvl.color)} />
                      <p className="text-xs font-bold text-foreground">{lvl.name}</p>
                      <p className="text-[10px] text-muted-foreground">Nivel {lvl.level}</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">{lvl.range}</p>
                      {isCurrent && (
                        <Badge className="bg-primary text-primary-foreground text-[9px] mt-1">Actual</Badge>
                      )}
                    </div>
                    {i < levels.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Badges */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Insignias y Medallas</h3>
              <Button variant="outline" size="sm" className="text-xs">
                Ver Galería Completa
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Las insignias apelan al tipo de jugador "Achiever" y "Killer". 
              Coleccionables y visibles en tu perfil público para demostrar tu valor comercial.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {badges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <Card key={badge.name} className="p-4 text-center hover:shadow-smooth-md transition-all">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground mb-1">{badge.name}</h4>
                    <p className="text-[10px] text-muted-foreground">{badge.desc}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            🏆 Siigo Sales Gamification Engine © 2025
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default HeroJourney;
