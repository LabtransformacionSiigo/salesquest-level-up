import { useConfig } from '@/context/ConfigContext';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const levelMeta = [
  { icon: 'eco', iconBg: 'bg-sky-100', iconColor: 'text-sky-500', rangeBg: 'bg-sky-100 text-sky-600' },
  { icon: 'explore', iconBg: 'bg-orange-100', iconColor: 'text-orange-500', rangeBg: 'bg-orange-100 text-orange-600' },
  { icon: 'security', iconBg: 'bg-sky-100', iconColor: 'text-sky-600', rangeBg: 'bg-sky-500 text-white' },
  { icon: 'auto_awesome', iconBg: 'bg-purple-100', iconColor: 'text-purple-500', rangeBg: 'bg-purple-100 text-purple-600' },
  { icon: 'rocket_launch', iconBg: 'bg-red-100', iconColor: 'text-red-500', rangeBg: 'bg-red-500 text-white' },
];

const HeroLevelBar = () => {
  const { levels, getLevelByXP } = useConfig();
  const { profile } = useSupabaseAuthContext();

  const currentXP = profile?.xp || 0;
  const currentLevel = getLevelByXP(currentXP);
  const isExecutive = profile?.role === 'EJECUTIVO';

  if (!levels.length) return null;

  // Total progress for the bar
  const totalMin = levels[0]?.minXP || 0;
  const totalMax = levels[levels.length - 1]?.maxXP || 1;
  const totalProgress = Math.min(100, Math.max(0, ((currentXP - totalMin) / (totalMax - totalMin)) * 100));

  return (
    <div className="px-6 pt-4 pb-2">
      {/* Level cards row */}
      <div className="flex items-end gap-2">
        {levels.map((level, i) => {
          const meta = levelMeta[i] || levelMeta[0];
          const isCurrent = currentLevel?.level === level.level;
          const isCompleted = currentXP >= level.maxXP;

          const rangeStr = i === levels.length - 1
            ? `+${(level.minXP / 1000).toFixed(0)},000 pts`
            : `${level.minXP.toLocaleString()} - ${level.maxXP.toLocaleString()} pts`;

          return (
            <div key={level.level} className={cn(
              "flex-1 rounded-xl border p-3 flex flex-col items-center text-center gap-1 transition-all relative",
              isCurrent
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                : isCompleted
                ? "border-secondary/30 bg-secondary/5"
                : "border-border bg-card"
            )}>
              {isCurrent && (
                <span className="absolute -top-2.5 bg-primary text-primary-foreground text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                  Tu Nivel
                </span>
              )}
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", meta.iconBg)}>
                <MI icon={meta.icon} className={cn("text-xl", meta.iconColor)} />
              </div>
              <p className="text-xs font-bold text-foreground">{level.level}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Nivel {i + 1}</p>
              <span className={cn("text-[9px] font-semibold px-2 py-0.5 rounded-full", 
                isCurrent ? 'bg-primary text-primary-foreground' : meta.rangeBg
              )}>
                {rangeStr}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar - only for executives */}
      {isExecutive && (
        <div className="mt-2.5 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full progress-gradient transition-all duration-500"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default HeroLevelBar;
