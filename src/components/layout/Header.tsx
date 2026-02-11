import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import { getCountryFlag } from '@/utils/countryFlags';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
}

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const Header = ({ title }: HeaderProps) => {
  const { profile } = useSupabaseAuthContext();

  const currentXP = profile?.xp || 0;
  const countryFlag = getCountryFlag(profile?.country);

  return (
    <header className="h-14 bg-gradient-to-r from-[hsl(200,100%,50%)] to-[hsl(210,100%,45%)] flex items-center justify-between px-5 flex-shrink-0 shadow-sm">
      {/* Left: brand */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <span className="text-white font-extrabold text-sm">S</span>
        </div>
        <span className="text-sm font-bold text-white">Siigo</span>
        <span className="text-sm font-light text-white/80">Hero</span>
        {title !== 'Dashboard' && title !== 'Siigo Hero Academy' && (
          <>
            <span className="text-white/40 mx-1">·</span>
            <span className="text-xs text-white/70 font-medium">{title}</span>
          </>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button className="text-white/60 hover:text-white transition-colors">
          <MI icon="dark_mode" className="text-lg" />
        </button>
        <NotificationBell />
        <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
          {countryFlag && <span className="text-sm">{countryFlag}</span>}
          <MI icon="stars" className="text-yellow-300 text-sm" />
          <span className="text-xs font-bold text-white">{currentXP.toLocaleString()} XP</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/80 font-medium hidden md:inline">
            {profile?.name}
          </span>
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
