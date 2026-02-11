import { useConfig, Level } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: {icon: string;className?: string;}) =>
<span className={cn("material-icons-outlined", className)}>{icon}</span>;


interface LevelProgressRoadProps {
  currentXP: number;
}

const LevelProgressRoad = ({ currentXP }: LevelProgressRoadProps) => {
  const { levels } = useConfig();

  const getLevelProgress = (level: Level) => {
    if (currentXP >= level.maxXP) return 100;
    if (currentXP < level.minXP) return 0;
    return Math.round((currentXP - level.minXP) / (level.maxXP - level.minXP) * 100);
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
  const totalProgress = Math.min(100, Math.max(0, (currentXP - totalMin) / (totalMax - totalMin) * 100));

  return null;


































































};

export default LevelProgressRoad;