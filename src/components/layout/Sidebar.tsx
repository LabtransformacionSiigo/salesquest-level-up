import { useNavigate, useLocation } from 'react-router-dom';
import siigoLogo from '@/assets/siigo-logo-white.png';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const menuItems = [
  { path: '/dashboard', icon: 'stadium', label: 'Mi Arena' },
  { path: '/ranking', icon: 'leaderboard', label: 'Ranking' },
  { path: '/mi-performance', icon: 'analytics', label: 'KPIs' },
  { path: '/medallas', icon: 'emoji_events', label: 'Medallas' },
  { path: '/retos', icon: 'flag', label: 'Retos' },
  { path: '/reconocimientos', icon: 'diversity_3', label: 'Reconocer' },
  { path: '/mi-equipo', icon: 'groups', label: 'Mi Equipo' },
];

const adminItems = [
  { path: '/admin/gerentes', icon: 'manage_accounts', label: 'Gerentes' },
  { path: '/admin/asesores', icon: 'people', label: 'Asesores' },
  { path: '/admin/medallas', icon: 'workspace_premium', label: 'Medallas' },
  { path: '/admin/rachas', icon: 'local_fire_department', label: 'Rachas' },
];

const Sidebar = () => {
  const { profile, signOut } = useSupabaseAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;
  const isAdmin = profile?.role === 'admin';

  const canalBadge = profile?.canal === 'VN_EMPRESARIOS' ? 'EMP'
    : profile?.canal === 'VN_ALIADOS' ? 'ALI'
    : profile?.canal === 'VC' ? 'VC' : '';

  return (
    <aside className="w-[72px] bg-sidebar-dark flex flex-col items-center py-4 flex-shrink-0">
      {/* Logo */}
      <div className="mb-4">
        <img src={siigoLogo} alt="Siigo" className="w-12" />
      </div>

      {/* Avatar + canal badge */}
      <div className="relative mb-1">
        <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-xl">
          {profile?.avatar_url || '👤'}
        </div>
        {canalBadge && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-bold bg-primary text-primary-foreground px-1.5 py-0 rounded-full leading-relaxed">
            {canalBadge}
          </span>
        )}
      </div>

      {/* SP badge */}
      <div className="text-center mb-4">
        <p className="text-[9px] font-bold text-primary">{(profile?.sp_totales || 0).toLocaleString()}</p>
        <p className="text-[7px] text-sidebar-muted-text uppercase tracking-wider">SP</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col items-center gap-0.5 w-full px-1.5 overflow-y-auto">
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

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="w-8 border-t border-sidebar-border my-1" />
            <span className="text-[7px] text-sidebar-muted-text uppercase tracking-widest mb-0.5">Admin</span>
            {adminItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 w-full py-2 rounded-lg transition-all text-center",
                  isActive(item.path)
                    ? "text-accent bg-accent/15"
                    : "text-sidebar-muted-text hover:text-white hover:bg-white/5"
                )}
              >
                <MI icon={item.icon} className="text-[18px]" />
                <span className="text-[8px] font-medium leading-tight">{item.label}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-1 w-full px-1.5">
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
