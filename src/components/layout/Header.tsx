import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

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
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-xs rounded-full flex items-center justify-center font-bold shadow-smooth-md">
              3
            </span>
          </Button>

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
