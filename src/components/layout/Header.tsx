import { useAuth } from '@/context/AuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';

interface HeaderProps {
  title: string;
}

const Header = ({ title }: HeaderProps) => {
  const { user } = useAuth();

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <NotificationBell />

          {/* User avatar */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-secondary rounded-full flex items-center justify-center text-2xl shadow-smooth-md">
              {user?.avatar}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
