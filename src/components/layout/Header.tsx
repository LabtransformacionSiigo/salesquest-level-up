import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import { getCountryFlag } from '@/utils/countryFlags';

interface HeaderProps {
  title: string;
}

const Header = ({ title }: HeaderProps) => {
  const { profile } = useSupabaseAuthContext();

  const today = new Date();
  const dateStr = today.toLocaleDateString('es-ES', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground capitalize">{dateStr}</p>
          </div>
          <h1 className="text-xl font-bold text-foreground mt-0.5">
            Hola {profile?.name?.split(' ')[0] || 'Usuario'}! 👋
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl shadow-smooth-sm">
              {profile?.avatar || '👤'}
            </div>
            {getCountryFlag(profile?.country) && (
              <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none" title={profile?.country || ''}>
                {getCountryFlag(profile?.country)}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
