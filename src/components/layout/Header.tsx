import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig } from '@/context/ConfigContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import { getCountryFlag } from '@/utils/countryFlags';
import siigoLogo from '@/assets/siigo-logo-blue.png';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
}

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const Header = ({ title }: HeaderProps) => {
  const { profile } = useSupabaseAuthContext();
  const { getLevelByXP } = useConfig();

  const currentXP = profile?.xp || 0;
  const countryFlag = getCountryFlag(profile?.country);
  const currentLevel = getLevelByXP(currentXP);

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-5 flex-shrink-0">
      {/* Left: Siigo logo */}
      <div className="flex items-center gap-3">
        <img src={siigoLogo} alt="Siigo" className="h-7" />
        <span className="text-sm font-light text-muted-foreground">Hero</span>
        {title !== 'Dashboard' && title !== 'Siigo Hero Academy' && (
          <>
            <span className="text-border mx-1">|</span>
            <span className="text-xs text-muted-foreground font-medium">{title}</span>
          </>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <MI icon="dark_mode" className="text-lg" />
        </button>
        <NotificationBell />
        <div className="flex items-center gap-2 border border-border rounded-full px-3 py-1.5">
          {countryFlag && <span className="text-sm">{countryFlag}</span>}
          <MI icon="stars" className="text-accent text-sm" />
          <span className="text-xs font-bold text-foreground">{currentXP.toLocaleString()} XP</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden md:block">
            <p className="text-xs font-semibold text-foreground leading-tight">{profile?.name}</p>
            {currentLevel && (
              <p className="text-[10px] text-primary font-medium leading-tight">{currentLevel.level}</p>
            )}
          </div>
          <div className="relative">
            <span className="text-2xl">{profile?.avatar || '👤'}</span>
            {countryFlag && (
              <span className="absolute -bottom-0.5 -right-0.5 text-xs">{countryFlag}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
