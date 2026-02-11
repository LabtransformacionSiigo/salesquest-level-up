import { useNavigate, useLocation } from 'react-router-dom';
import siigoLogo from '@/assets/siigo-logo-white.png';
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
          { path: '/ranking', icon: 'leaderboard', label: 'Ranking' },
          { path: '/medals', icon: 'favorite_border', label: 'Reconocer' },
          { path: '/sales-history', icon: 'track_changes', label: 'Misiones' },
          { path: '/profile', icon: 'military_tech', label: 'Hero Academy' },
        ];
      case 'GERENTE':
        return [
          { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
          { path: '/register-sale', icon: 'add_circle_outline', label: 'Cargar' },
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
    ? { path: '/settings', icon: 'settings', label: 'Config' }
    : null;

  const menuItems = getMenuItems();
  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-[72px] bg-sidebar-dark flex flex-col items-center py-4 flex-shrink-0">
      {/* Logo */}
      <div className="mb-4">
        <img src={siigoLogo} alt="Siigo" className="w-12" />
      </div>

      {/* Avatar */}
      <div className="relative mb-5">
        <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-xl">
          {profile?.avatar || '👤'}
        </div>
        {getCountryFlag(profile?.country) && (
          <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none">
            {getCountryFlag(profile?.country)}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col items-center gap-0.5 w-full px-1.5">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 w-full py-2 rounded-lg transition-all text-center",
              isActive(item.path)
                ? "text-primary bg-primary/15"
                : "text-sidebar-muted-text hover:text-white hover:bg-white/5"
            )}
          >
            <MI icon={item.icon} className="text-[20px]" />
            <span className="text-[9px] font-medium leading-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-1 w-full px-1.5">
        {settingsItem && (
          <button
            onClick={() => navigate(settingsItem.path)}
            className={cn(
              "flex flex-col items-center gap-0.5 w-full py-2 rounded-lg transition-all",
              isActive(settingsItem.path)
                ? "text-primary bg-primary/15"
                : "text-sidebar-muted-text hover:text-white hover:bg-white/5"
            )}
          >
            <MI icon={settingsItem.icon} className="text-[20px]" />
            <span className="text-[9px] font-medium">{settingsItem.label}</span>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 w-full py-2 rounded-lg text-sidebar-muted-text hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <MI icon="logout" className="text-[20px]" />
          <span className="text-[9px] font-medium">Salir</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
