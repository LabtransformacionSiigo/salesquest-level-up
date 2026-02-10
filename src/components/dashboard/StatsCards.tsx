import { Card } from '@/components/ui/card';
import { Star, Flame, Trophy, Award, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  xp: number;
  xpThisMonth: number;
  streak: number;
  topCount: number;
  topPercentile: number;
  medalsCount: number;
  lastMedalAgo: string;
  seatCategory: string;
}

const StatsCards = ({
  xp,
  xpThisMonth,
  streak,
  topCount,
  topPercentile,
  medalsCount,
  lastMedalAgo,
  seatCategory,
}: StatsCardsProps) => {
  const stats = [
    {
      icon: Star,
      label: 'XP Totales',
      value: xp.toLocaleString(),
      sub: `+${xpThisMonth} este mes`,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      icon: Flame,
      label: 'De racha',
      value: `${streak} días`,
      sub: (
        <div className="flex gap-1 mt-1">
          {['L', 'M', 'M', 'J'].map((d, i) => (
            <span
              key={i}
              className={cn(
                "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center",
                i < streak ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {d}
            </span>
          ))}
        </div>
      ),
      color: 'text-orange',
      bgColor: 'bg-orange/10',
    },
    {
      icon: Trophy,
      label: 'En el top 3',
      value: `${topCount} veces`,
      sub: `${topPercentile}% mejor desempeño`,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      icon: Award,
      label: 'Medallas ganadas',
      value: String(medalsCount),
      sub: lastMedalAgo ? `última ganada ${lastMedalAgo}` : 'Sin medallas aún',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: Plane,
      label: 'Convención 2025',
      value: seatCategory,
      sub: 'Asiento asegurado',
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {stats.map((stat, i) => (
        <Card
          key={i}
          className="p-4 hover:shadow-smooth-md transition-all"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-sm text-muted-foreground font-medium">{stat.label}</span>
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", stat.bgColor)}>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground">{stat.value}</p>
          <div className="text-xs text-muted-foreground mt-1">
            {typeof stat.sub === 'string' ? stat.sub : stat.sub}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
