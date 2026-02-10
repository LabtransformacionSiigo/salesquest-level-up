import { useConfig, Level } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

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

  const getMultiplier = (index: number) => {
    const multipliers = ['', '', '1.0x', '1.5x', '2.5x'];
    return multipliers[index] || '';
  };

  const isCompleted = (level: Level) => currentXP >= level.maxXP;
  const isActive = (level: Level) => currentXP >= level.minXP && currentXP < level.maxXP;

  // Total progress across all levels
  const totalMin = levels[0]?.minXP || 0;
  const totalMax = levels[levels.length - 1]?.maxXP || 1;
  const overallProgress = Math.min(100, Math.round(((currentXP - totalMin) / (totalMax - totalMin)) * 100));

  return (
    <Card className="p-5">
      {/* Overall progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground font-medium">
            {overallProgress}% para el siguiente nivel
          </span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full progress-gradient transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Level cards */}
      <div className="grid grid-cols-5 gap-2">
        {levels.map((level, index) => {
          const completed = isCompleted(level);
          const active = isActive(level);
          const progress = getLevelProgress(level);

          return (
            <div
              key={level.level}
              className={cn(
                "relative rounded-lg p-3 text-center transition-all border",
                completed && "bg-primary/5 border-primary/20",
                active && "bg-primary/10 border-primary ring-1 ring-primary/30",
                !completed && !active && "bg-muted/50 border-border opacity-60"
              )}
            >
              {completed && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}

              <p className="text-xs font-semibold text-foreground mb-1">{level.level}</p>
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
