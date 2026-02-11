import { useConfig } from '@/context/ConfigContext';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
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
            ? `+${level.minXP.toLocaleString()} pts`
            : `${level.minXP.toLocaleString()} – ${level.maxXP.toLocaleString()} pts`;

          return (
            <div key={level.level} className={cn(
              "flex-1 rounded-xl border bg-card p-4 flex flex-col items-center text-center gap-2 transition-all relative",
              isCurrent
                ? "border-primary shadow-smooth-md ring-1 ring-primary/20"
                : isCompleted
                ? "border-border opacity-80"
                : "border-border"
            )}>
              {isCurrent && (
                <span className="absolute -top-2.5 bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full">
                  Tu Nivel
                </span>
              )}
              <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", meta.iconBg)}>
                <MI icon={meta.icon} className={cn("text-2xl", meta.iconColor)} />
              </div>
              <div>
                <p className={cn("text-sm font-bold", isCurrent ? "text-primary" : "text-foreground")}>{level.level}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Nivel {i + 1}</p>
              </div>
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
