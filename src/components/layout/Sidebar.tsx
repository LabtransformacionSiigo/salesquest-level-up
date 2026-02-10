import { useNavigate, useLocation } from 'react-router-dom';
import siigoLogo from '@/assets/siigo-logo-blue.png';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { getCountryFlag } from '@/utils/countryFlags';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const Sidebar = () => {
  const { profile, signOut } = useSupabaseAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getMenuItems = () => {
    switch (profile?.role) {
      case 'EJECUTIVO':
        return [
          { path: '/dashboard', icon: 'person', label: 'Mi perfil' },
          { path: '/ranking', icon: 'leaderboard', label: 'Tabla de clasificación' },
          { path: '/medals', icon: 'favorite_border', label: 'Reconocer' },
          { path: '/sales-history', icon: 'track_changes', label: 'Misiones' },
        ];
      case 'GERENTE':
        return [
          { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
          { path: '/register-sale', icon: 'add_circle_outline', label: 'Cargar Ventas' },
          { path: '/upload-history', icon: 'bar_chart', label: 'Historial' },
          { path: '/team', icon: 'groups', label: 'Mi Equipo' },
          { path: '/ranking', icon: 'leaderboard', label: 'Ranking' },
          { path: '/medals', icon: 'emoji_events', label: 'Medallas' },
        ];
      case 'ADMINISTRADOR':
        return [
          { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
          { path: '/users', icon: 'groups', label: 'Usuarios' },
          { path: '/cells', icon: 'target', label: 'Células' },
          { path: '/ranking', icon: 'leaderboard', label: 'Ranking' },
        ];
      default:
        return [];
    }
  };

  const settingsItem = profile?.role === 'EJECUTIVO'
    ? { path: '/profile', icon: 'settings', label: 'Ajustes' }
    : profile?.role === 'ADMINISTRADOR'
    ? { path: '/settings', icon: 'settings', label: 'Configuración' }
    : null;

  const menuItems = getMenuItems();
  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-[88px] bg-card border-r border-border flex flex-col items-center py-5 flex-shrink-0">
      {/* Avatar */}
      <div className="relative mb-6">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl">
          {profile?.avatar || '👤'}
        </div>
        {getCountryFlag(profile?.country) && (
          <span className="absolute -bottom-0.5 -right-0.5 text-sm leading-none">
            {getCountryFlag(profile?.country)}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 w-full py-2.5 rounded-xl transition-all text-center",
              isActive(item.path)
                ? "text-primary bg-primary/8"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <MI icon={item.icon} className="text-[22px]" />
            <span className="text-[10px] font-medium leading-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        {settingsItem && (
          <button
            onClick={() => navigate(settingsItem.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 w-full py-2.5 rounded-xl transition-all",
              isActive(settingsItem.path)
                ? "text-primary bg-primary/8"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <MI icon={settingsItem.icon} className="text-[22px]" />
            <span className="text-[10px] font-medium">{settingsItem.label}</span>
          </button>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 w-full py-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <MI icon="logout" className="text-[22px]" />
          <span className="text-[10px] font-medium">Salir</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
