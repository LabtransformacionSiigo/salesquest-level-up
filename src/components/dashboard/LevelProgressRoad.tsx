import { useConfig, Level } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

interface LevelProgressRoadProps {
  currentXP: number;
}

const levelIcons: Record<string, string> = {
  'Novato': 'eco',
  'Junior': 'explore',
  'Senior': 'military_tech',
  'Master': 'auto_fix_high',
  'Imparable': 'rocket_launch',
};

const LevelProgressRoad = ({ currentXP }: LevelProgressRoadProps) => {
  const { levels } = useConfig();

  const getLevelProgress = (level: Level) => {
    if (currentXP >= level.maxXP) return 100;
    if (currentXP < level.minXP) return 0;
    return Math.round(((currentXP - level.minXP) / (level.maxXP - level.minXP)) * 100);
  };

  const getMultiplier = (index: number) => {
    const multipliers = ['', '', '1.0x', '1.5x', '2.5x'];
    return multipliers[index] || '';
  };

  const isCompleted = (level: Level) => currentXP >= level.maxXP;
  const isActive = (level: Level) => currentXP >= level.minXP && currentXP < level.maxXP;

  return (
    <Card className="p-5">
      {/* Level cards */}
      <div className="grid grid-cols-5 gap-2">
        {levels.map((level, index) => {
          const completed = isCompleted(level);
          const active = isActive(level);
          const progress = getLevelProgress(level);
          const icon = levelIcons[level.level] || 'stars';

          return (
            <div
              key={level.level}
              className={cn(
                "relative rounded-xl p-3 text-center transition-all border-2",
                completed && "bg-primary/5 border-primary/20",
                active && "bg-primary/10 border-primary ring-2 ring-primary/20",
                !completed && !active && "bg-muted/30 border-border opacity-60"
              )}
            >
              {completed && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <MI icon="check" className="text-primary-foreground text-xs" />
                </div>
              )}

              <p className="text-xs font-bold text-foreground mb-1">{level.level}</p>
              <MI icon={icon} className={cn(
                "text-2xl mb-1",
                completed ? "text-primary" : active ? "text-primary" : "text-muted-foreground"
              )} />
              <p className={cn(
                "text-lg font-bold",
                completed ? "text-primary" : active ? "text-primary" : "text-muted-foreground"
              )}>
                {completed ? '100%' : active ? `${progress}%` : '0%'}
              </p>

              {getMultiplier(index) && (
                <span className={cn(
                  "inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {getMultiplier(index)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default LevelProgressRoad;
