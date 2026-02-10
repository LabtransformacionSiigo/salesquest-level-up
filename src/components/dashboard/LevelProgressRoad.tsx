import { useConfig, Level } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

interface LevelProgressRoadProps {
  currentXP: number;
}

const LevelProgressRoad = ({ currentXP }: LevelProgressRoadProps) => {
  const { levels } = useConfig();

  const getLevelProgress = (level: Level) => {
    if (currentXP >= level.maxXP) return 100;
    if (currentXP < level.minXP) return 0;
    return Math.round(((currentXP - level.minXP) / (level.maxXP - level.minXP)) * 100);
  };

  const isCompleted = (level: Level) => currentXP >= level.maxXP;
  const isActive = (level: Level) => currentXP >= level.minXP && currentXP < level.maxXP;

  const getMultiplier = (index: number) => {
    const multipliers = ['', '', '1.0x', '1.5x', '2.5x'];
    return multipliers[index] || '';
  };

  // Calculate total progress across all levels
  const totalMin = levels[0]?.minXP || 0;
  const totalMax = levels[levels.length - 1]?.maxXP || 1;
  const totalProgress = Math.min(100, Math.max(0, ((currentXP - totalMin) / (totalMax - totalMin)) * 100));

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        {levels.map((level, index) => {
          const completed = isCompleted(level);
          const active = isActive(level);
          const progress = getLevelProgress(level);
          const multiplier = getMultiplier(index);

          return (
            <div key={level.level} className="flex flex-col items-center flex-1 relative">
              {/* Multiplier badge */}
              {multiplier && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full mb-1",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {multiplier}
                </span>
              )}
              {!multiplier && <div className="h-5 mb-1" />}

              {/* Checkpoint circle */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center z-10 border-2",
                completed
                  ? "bg-secondary border-secondary text-secondary-foreground"
                  : active
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-muted border-border text-muted-foreground"
              )}>
                {completed ? (
                  <MI icon="check" className="text-sm" />
                ) : (
                  <span className="text-xs font-bold">{progress}%</span>
                )}
              </div>

              {/* Level name */}
              <p className={cn(
                "text-xs font-semibold mt-1.5",
                completed || active ? "text-foreground" : "text-muted-foreground"
              )}>
                {level.level}
              </p>

              {/* Percentage */}
              <p className={cn(
                "text-[11px]",
                completed ? "text-secondary font-bold" : active ? "text-primary font-bold" : "text-muted-foreground"
              )}>
                {completed ? '100%' : active ? `${progress}%` : '0%'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full progress-gradient transition-all duration-500"
          style={{ width: `${totalProgress}%` }}
        />
      </div>
    </Card>
  );
};

export default LevelProgressRoad;
