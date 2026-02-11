import { useConfig } from '@/context/ConfigContext';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const levelMeta = [
  { icon: 'eco', iconBg: 'bg-sky-50', iconColor: 'text-sky-500', badgeBg: 'bg-sky-100 text-sky-700', focus: 'Aprendizaje' },
  { icon: 'explore', iconBg: 'bg-orange-50', iconColor: 'text-orange-500', badgeBg: 'bg-orange-100 text-orange-700', focus: 'Consistencia' },
  { icon: 'security', iconBg: 'bg-primary/10', iconColor: 'text-primary', badgeBg: 'bg-primary/10 text-primary', focus: 'Cumplimiento' },
  { icon: 'auto_awesome', iconBg: 'bg-purple-50', iconColor: 'text-purple-500', badgeBg: 'bg-purple-100 text-purple-700', focus: 'Mentoring' },
  { icon: 'rocket_launch', iconBg: 'bg-red-50', iconColor: 'text-red-500', badgeBg: 'bg-red-100 text-red-600', focus: 'Liderazgo' },
];

interface Props {
  currentLevel: { level: string } | null | undefined;
}

const HeroJourneyLevels = ({ currentLevel }: Props) => {
  const { levels } = useConfig();

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {levels.map((level, i) => {
        const meta = levelMeta[i] || levelMeta[0];
        const isCurrent = currentLevel?.level === level.level;
        const rangeStr = i === levels.length - 1
          ? `+${level.minXP.toLocaleString()} pts`
          : `${level.minXP.toLocaleString()} – ${level.maxXP.toLocaleString()} pts`;

        return (
          <div key={level.level} className={cn(
            "rounded-xl border bg-card p-5 flex flex-col items-center text-center gap-2 relative transition-all",
            isCurrent ? "border-primary shadow-smooth-md ring-1 ring-primary/20" : "border-border"
          )}>
            {isCurrent && (
              <span className="absolute -top-2.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full">
                Tu Nivel
              </span>
            )}
            <div className={cn("w-14 h-14 rounded-full flex items-center justify-center", meta.iconBg)}>
              <MI icon={meta.icon} className={cn("text-3xl", meta.iconColor)} />
            </div>
            <h3 className={cn("text-sm font-bold", isCurrent ? "text-primary" : "text-foreground")}>{level.level}</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Nivel {i + 1}</p>
            <span className={cn("text-[10px] font-semibold px-3 py-0.5 rounded-full", meta.badgeBg)}>
              {rangeStr}
            </span>
            <p className="text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">Foco:</span> {meta.focus}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default HeroJourneyLevels;
