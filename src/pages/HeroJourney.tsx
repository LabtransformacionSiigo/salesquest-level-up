import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Sprout, Compass, Shield, Sparkles, Rocket,
  Target, Users, Handshake, Diamond,
  Eye, Zap, Brain,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

const levelDetails = [
  {
    name: 'Novato',
    level: 1,
    icon: Sprout,
    range: '0 - 2,000 pts',
    focus: 'Aprendizaje, primeros registros y uso de herramientas básicas.',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-border',
  },
  {
    name: 'Explorador',
    level: 2,
    icon: Compass,
    range: '2,001 - 8,000 pts',
    focus: 'Consistencia en visitas y cierre de negocios pequeños.',
    color: 'text-primary',
    bgColor: 'bg-primary/5',
    borderColor: 'border-primary/20',
  },
  {
    name: 'Master',
    level: 3,
    icon: Shield,
    range: '8,001 - 20,000 pts',
    focus: 'Cumplimiento de cuota mensual y retención de clientes.',
    color: 'text-accent',
    bgColor: 'bg-accent/5',
    borderColor: 'border-accent/20',
  },
  {
    name: 'Legendario',
    level: 4,
    icon: Sparkles,
    range: '20,001 - 45,000 pts',
    focus: 'Superación de cuota (>120%) y mentoring a novatos.',
    color: 'text-orange',
    bgColor: 'bg-orange/5',
    borderColor: 'border-orange/20',
  },
  {
    name: 'Imparable',
    level: 5,
    icon: Rocket,
    range: '> 45,000 pts',
    focus: 'Liderazgo de mercado, innovación y ventas estratégicas.',
    color: 'text-destructive',
    bgColor: 'bg-destructive/5',
    borderColor: 'border-destructive/20',
  },
];

const badges = [
  {
    icon: Target,
    name: 'Francotirador',
    category: 'Efectividad',
    description: 'Lograr una tasa de conversión superior al 30% en un mes.',
    tags: ['Achiever'],
  },
  {
    icon: Users,
    name: 'Alpha Wolf',
    category: 'Volumen',
    description: 'Cerrar el mayor número de tratos (volumen) en el trimestre.',
    tags: ['Killer'],
  },
  {
    icon: Handshake,
    name: 'El Padrino',
    category: 'Colaboración',
    description: 'Recibir 5 reconocimientos de compañeros por ayuda o mentoring.',
    tags: ['Achiever'],
  },
  {
    icon: Diamond,
    name: 'Caza Ballenas',
    category: 'Valor (ACV)',
    description: 'Cerrar un solo negocio que represente >15% de la cuota mensual.',
    tags: ['Killer'],
  },
];

const pointsTable = [
  { action: 'Llamada/Contacto a prospecto nuevo', points: '+2 pts' },
  { action: 'Completar una reunión o demo', points: '+5 pts' },
  { action: 'Enviar propuesta formal', points: '+5 pts' },
  { action: 'Cerrar una venta (Contrato firmado)', points: '+10 pts' },
  { action: 'Cerrar venta de alto valor (>ACV)', points: '15-20 pts' },
  { action: 'Recibir reconocimiento de compañero', points: '+2 pts' },
];

const objectives = [
  {
    icon: Eye,
    title: 'Visibilidad en Tiempo Real',
    description: 'Feedback loop instantáneo para saber exactamente cuánto falta para ganar.',
  },
  {
    icon: Zap,
    title: 'Productividad Sostenible',
    description: 'Evitar picos de fin de mes ("Hockey Stick") mediante retos diarios y semanales.',
  },
  {
    icon: Brain,
    title: 'Maestría (Upskilling)',
    description: 'Los niveles representan conocimiento y habilidad de venta, no solo antigüedad.',
  },
];

const HeroJourney = () => {
  const { isAuthenticated, profile } = useSupabaseAuthContext();
  const { getLevelByXP } = useConfig();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const currentLevel = getLevelByXP(profile?.xp || 0);
  const currentLevelName = currentLevel?.level || 'Novato';

  return (
    <Layout title="La Ruta del Héroe">
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Hero Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-extrabold text-foreground">
            La Ruta del Héroe Comercial
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Sistema de niveles basado en acumulación trimestral de puntos y maestría. 
            Evoluciona tu carrera y conviértete en una leyenda de las ventas.
          </p>
        </div>

        {/* Levels */}
        <div className="space-y-3">
          {levelDetails.map((lvl) => {
            const isCurrentLevel = lvl.name === currentLevelName;
            const Icon = lvl.icon;

            return (
              <Card
                key={lvl.name}
                className={cn(
                  "p-5 border-2 transition-all",
                  isCurrentLevel
                    ? "border-primary ring-2 ring-primary/20 shadow-smooth-lg"
                    : lvl.borderColor
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                    lvl.bgColor
                  )}>
                    <Icon className={cn("w-6 h-6", lvl.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-foreground">{lvl.name}</h3>
                      <span className="text-xs text-muted-foreground">Nivel {lvl.level}</span>
                      {isCurrentLevel && (
                        <Badge className="bg-primary text-primary-foreground text-[10px]">
                          Tu Nivel
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">{lvl.range}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">Foco: </span>
                      {lvl.focus}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Badges */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold text-foreground">Insignias y Medallas</h2>
          </div>
          <p className="text-sm text-muted-foreground">Reconocimiento a tu estilo de juego</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {badges.map((badge) => {
              const Icon = badge.icon;
              return (
                <Card key={badge.name} className="p-4 hover:shadow-smooth-md transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-foreground">{badge.name}</h4>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {badge.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                      <div className="flex gap-1 mt-2">
                        {badge.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Points Table */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-foreground">Tabla de Puntos</h2>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acción</TableHead>
                <TableHead className="text-right w-28">Puntos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pointsTable.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{row.action}</TableCell>
                  <TableCell className="text-right font-bold text-primary text-sm">
                    {row.points}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Strategic Objectives */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Objetivos Estratégicos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {objectives.map((obj) => {
              const Icon = obj.icon;
              return (
                <Card key={obj.title} className="p-4 text-center">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1">{obj.title}</h4>
                  <p className="text-xs text-muted-foreground">{obj.description}</p>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground py-4">
          © 2024 Siigo Gamification Engine - Potenciando el talento comercial
        </p>
      </div>
    </Layout>
  );
};

export default HeroJourney;
