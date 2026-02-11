import { useConfig } from '@/context/ConfigContext';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const levelMeta = [
  { icon: 'eco', iconBg: 'bg-sky-100', iconColor: 'text-sky-500', borderColor: 'border-sky-300', rangeBg: 'bg-sky-100 text-sky-700', accentColor: 'border-sky-400' },
  { icon: 'explore', iconBg: 'bg-orange-100', iconColor: 'text-orange-500', borderColor: 'border-orange-300', rangeBg: 'bg-orange-100 text-orange-700', accentColor: 'border-orange-400' },
  { icon: 'security', iconBg: 'bg-primary/10', iconColor: 'text-primary', borderColor: 'border-primary/40', rangeBg: 'bg-primary text-primary-foreground', accentColor: 'border-primary' },
  { icon: 'auto_awesome', iconBg: 'bg-purple-100', iconColor: 'text-purple-500', borderColor: 'border-purple-300', rangeBg: 'bg-purple-100 text-purple-700', accentColor: 'border-purple-400' },
  { icon: 'rocket_launch', iconBg: 'bg-red-100', iconColor: 'text-red-500', borderColor: 'border-red-300', rangeBg: 'bg-red-500 text-white', accentColor: 'border-red-500' },
];

const HeroLevelBar = () => {
  const { levels, getLevelByXP } = useConfig();
  const { profile } = useSupabaseAuthContext();

  const currentXP = profile?.xp || 0;
  const currentLevel = getLevelByXP(currentXP);
  const isExecutive = profile?.role === 'EJECUTIVO';

  if (!levels.length) return null;

  const totalMin = levels[0]?.minXP || 0;
  const totalMax = levels[levels.length - 1]?.maxXP || 1;
  const totalProgress = Math.min(100, Math.max(0, ((currentXP - totalMin) / (totalMax - totalMin)) * 100));

  return (
    <div className="px-6 pt-5 pb-3">
      {/* Level cards row */}
      <div className="flex items-stretch gap-3">
        {levels.map((level, i) => {
          const meta = levelMeta[i] || levelMeta[0];
          const isCurrent = currentLevel?.level === level.level;
          const isCompleted = currentXP >= level.maxXP;

          const rangeStr = i === levels.length - 1
            ? `> ${level.minXP.toLocaleString()} pts`
            : `${level.minXP.toLocaleString()} - ${level.maxXP.toLocaleString()} pts`;

          return (
            <div key={level.level} className={cn(
              "flex-1 rounded-xl border-2 p-4 flex flex-col items-center text-center gap-2 transition-all relative bg-card",
              isCurrent
                ? `${meta.accentColor} shadow-smooth-md ring-2 ring-primary/10`
                : isCompleted
                ? `${meta.borderColor} opacity-90`
                : "border-border"
            )}>
              {isCurrent && (
                <span className="absolute -top-3 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                  Tu Nivel
                </span>
              )}
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", meta.iconBg)}>
                <MI icon={meta.icon} className={cn("text-2xl", meta.iconColor)} />
              </div>
              <div>
                <p className={cn("text-sm font-bold", isCurrent ? "text-primary" : "text-foreground")}>{level.level}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Nivel {i + 1}</p>
              </div>
              <span className={cn("text-[10px] font-semibold px-3 py-1 rounded-full",
                isCurrent ? 'bg-primary text-primary-foreground' : meta.rangeBg
              )}>
                {rangeStr}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {isExecutive && (
        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full progress-gradient transition-all duration-700 ease-out"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default HeroLevelBar;
