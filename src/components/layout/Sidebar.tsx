import { useNavigate, useLocation } from 'react-router-dom';
import siigoLogo from '@/assets/siigo-logo-white.png';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, slideInLeft } from '@/lib/animations';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-round", className)}>{icon}</span>
);

const menuItems = [
  { path: '/dashboard', icon: 'home', label: 'Inicio' },
  { path: '/ranking', icon: 'leaderboard', label: 'Ranking' },
  { path: '/mi-performance', icon: 'insights', label: 'KPIs' },
  { path: '/medallas', icon: 'emoji_events', label: 'Medallas' },
  { path: '/retos', icon: 'flag', label: 'Retos' },
  { path: '/reconocimientos', icon: 'favorite', label: 'Reconocer' },
  { path: '/mi-equipo', icon: 'groups', label: 'Mi Equipo' },
];

const adminItems = [
  { path: '/admin/gerentes', icon: 'manage_accounts', label: 'Gerentes' },
  { path: '/admin/asesores', icon: 'people', label: 'Asesores' },
  { path: '/admin/medallas', icon: 'workspace_premium', label: 'Medallas' },
  { path: '/admin/rachas', icon: 'local_fire_department', label: 'Rachas' },
  { path: '/admin/calculos', icon: 'calculate', label: 'Motor SP' },
  { path: '/admin/databricks', icon: 'cloud_sync', label: 'Databricks' },
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

  return (
    <aside className="w-[220px] bg-sidebar flex flex-col flex-shrink-0 border-r border-sidebar-border">
      {/* Logo */}
      <motion.div 
        className="h-16 flex items-center px-6 border-b border-sidebar-border"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <img src={siigoLogo} alt="Siigo" className="h-7" />
      </motion.div>

      {/* Profile summary */}
      <motion.div 
        className="px-4 py-5 border-b border-sidebar-border"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-lg text-sidebar-foreground">
            {profile?.avatar_url || '👤'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate">{profile?.nombre || 'Usuario'}</p>
            <p className="text-xs text-sidebar-primary font-semibold">{profile?.nivel || 'Prospecto'}</p>
          </div>
        </div>
        <motion.div 
          className="mt-3 flex items-center gap-2 bg-sidebar-accent/60 rounded-lg px-3 py-2"
          whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
        >
          <MI icon="stars" className="text-accent text-base" />
          <span className="text-sm font-bold text-sidebar-foreground">{(profile?.sp_totales || 0).toLocaleString()}</span>
          <span className="text-xs text-sidebar-muted font-medium">SP</span>
        </motion.div>
      </motion.div>

      {/* Navigation */}
      <motion.nav 
        className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {menuItems.map((item) => (
          <motion.button
            key={item.path}
            onClick={() => navigate(item.path)}
            variants={slideInLeft}
            whileHover={{ x: 3, transition: { duration: 0.1 } }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors duration-150",
              isActive(item.path)
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <MI icon={item.icon} className="text-[20px]" />
            <span className="text-[13px] font-semibold">{item.label}</span>
          </motion.button>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <motion.div className="pt-4 pb-2 px-3" variants={slideInLeft}>
              <p className="text-[10px] font-bold text-sidebar-muted uppercase tracking-widest">Administración</p>
            </motion.div>
            {adminItems.map((item) => (
              <motion.button
                key={item.path}
                onClick={() => navigate(item.path)}
                variants={slideInLeft}
                whileHover={{ x: 3, transition: { duration: 0.1 } }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors duration-150",
                  isActive(item.path)
                    ? "bg-accent/20 text-accent"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <MI icon={item.icon} className="text-[18px]" />
                <span className="text-[13px] font-semibold">{item.label}</span>
              </motion.button>
            ))}
          </>
        )}
      </motion.nav>

      {/* Bottom logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <motion.button
          onClick={handleLogout}
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
        >
          <MI icon="logout" className="text-[20px]" />
          <span className="text-[13px] font-semibold">Cerrar sesión</span>
        </motion.button>
      </div>
    </aside>
  );
};

export default Sidebar;
