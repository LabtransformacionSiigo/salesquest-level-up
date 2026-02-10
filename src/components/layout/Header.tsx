import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';

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

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).getFullYear() 
    : new Date().getFullYear();

  return (
    <header className="px-6 pt-6 pb-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{dateStr}</p>
          <h1 className="text-2xl font-bold text-foreground mt-1">
            ¡Hola {profile?.name?.split(' ')[0] || 'Usuario'}! 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Miembro desde {memberSince}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
};

export default Header;
