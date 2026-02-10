import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';
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

  return (
    <header className="h-12 bg-header-dark flex items-center justify-between px-5 flex-shrink-0">
      {/* Left: title */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white">Siigo Hero</span>
        <span className="text-sm font-light text-white/60">Academy</span>
        {title !== 'Dashboard' && title !== 'Siigo Hero Academy' && (
          <span className="text-[10px] text-white/40 uppercase tracking-wider ml-2">{title}</span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <button className="text-white/50 hover:text-white transition-colors">
          <MI icon="dark_mode" className="text-lg" />
        </button>
        <NotificationBell />
        <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
          <MI icon="stars" className="text-accent text-sm" />
          <span className="text-xs font-bold text-white">{currentXP.toLocaleString()} XP</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
