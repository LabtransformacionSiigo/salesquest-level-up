import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

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
  const stats: {
    icon: string;
    label: string;
    value: string;
    sub: ReactNode;
    color: string;
  }[] = [
    {
      icon: 'grade',
      label: 'XP Totales',
      value: xp.toLocaleString(),
      sub: <span className="text-secondary font-medium">+{xpThisMonth} este mes</span>,
      color: 'text-accent',
    },
    {
      icon: 'local_fire_department',
      label: 'De racha',
      value: `${streak} días`,
      sub: (
        <div className="flex gap-1 mt-1">
          {['L', 'M', 'M', 'J', 'V'].map((d, i) => (
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
    },
    {
      icon: 'emoji_events',
      label: 'En el Top 3',
      value: `${topCount} veces`,
      sub: <span className="text-muted-foreground">{topPercentile}% por mejor desempeño</span>,
      color: 'text-accent',
    },
    {
      icon: 'stars',
      label: 'Medallas ganadas',
      value: String(medalsCount),
      sub: <span className="text-muted-foreground">{lastMedalAgo ? `Última ${lastMedalAgo}` : 'Sin medallas aún'}</span>,
      color: 'text-primary',
    },
    {
      icon: 'flight',
      label: 'Asiento asegurado',
      value: seatCategory,
      sub: (
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-muted-foreground tracking-wide">CONVENCIÓN 2025</span>
          <span className="text-secondary font-semibold text-xs">{seatCategory}</span>
        </div>
      ),
      color: 'text-primary',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {stats.map((stat, i) => (
        <Card key={i} className="p-4 border border-border shadow-none hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <MI icon={stat.icon} className={cn("text-lg", stat.color)} />
          </div>
          <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
          <div className="text-xs mt-1">{stat.sub}</div>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
