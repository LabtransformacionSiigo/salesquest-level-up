import { useNavigate, useLocation } from 'react-router-dom';
import siigoLogoWhite from '@/assets/siigo-logo-white.png';
import logoIncentivos from '@/assets/logo-incentivos.png';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, slideInLeft } from '@/lib/animations';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-round", className)}>{icon}</span>
);

const menuItems = [
  { path: '/dashboard', icon: 'dashboard', label: 'Inicio' },
  { path: '/ranking', icon: 'leaderboard', label: 'Ranking' },
  { path: '/mi-performance', icon: 'insights', label: 'Mi Performance' },
  { path: '/medallas', icon: 'workspace_premium', label: 'Medallas' },
  { path: '/retos', icon: 'flag', label: 'Retos' },
  { path: '/reconocimientos', icon: 'stars', label: 'Reconocimientos' },
  { path: '/mi-equipo', icon: 'groups', label: 'Mi Equipo' },
];

const adminItems = [
  { path: '/admin/gerentes', icon: 'manage_accounts', label: 'Gerentes' },
  { path: '/admin/asesores', icon: 'people', label: 'Asesores' },
  { path: '/admin/medallas', icon: 'emoji_events', label: 'Medallas' },
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
    <aside className="w-[240px] bg-sidebar flex flex-col flex-shrink-0 border-r border-sidebar-border relative">
      {/* Logo */}
      <motion.div 
        className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <img src={logoIncentivos} alt="Siigo Incentivos" className="h-8" />
      </motion.div>

      {/* Profile */}
      <motion.div 
        className="px-5 py-5 border-b border-sidebar-border"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-sidebar-primary/20 border-2 border-sidebar-primary/40 flex items-center justify-center text-lg">
            <MI icon={isAdmin ? 'admin_panel_settings' : 'person'} className="text-sidebar-primary text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate">{profile?.nombre || 'Usuario'}</p>
            <p className="text-xs text-sidebar-primary font-semibold">{isAdmin ? 'Administrador' : (profile?.nivel || 'Nivel 1')}</p>
          </div>
        </div>
        {!isAdmin && (
          <motion.div 
            className="mt-3 flex items-center gap-2 bg-sidebar-accent rounded-lg px-4 py-2.5"
            whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
          >
            <MI icon="bolt" className="text-sidebar-primary text-lg" />
            <span className="text-base font-bold font-scoreboard text-sidebar-primary">{(profile?.sp_totales || 0).toLocaleString()}</span>
            <span className="text-sm text-sidebar-muted font-medium">SP</span>
          </motion.div>
        )}
      </motion.div>

      {/* Navigation */}
      <motion.nav 
        className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {!isAdmin && menuItems.map((item) => (
          <motion.button
            key={item.path}
            onClick={() => navigate(item.path)}
            variants={slideInLeft}
            whileHover={{ x: 3, transition: { duration: 0.1 } }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-colors duration-150",
              isActive(item.path)
                ? "bg-sidebar-primary text-white"
                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <MI icon={item.icon} className="text-[22px]" />
            <span className="text-sm font-semibold">{item.label}</span>
          </motion.button>
        ))}

        {isAdmin && (
          <>
            <motion.div className="pb-2 px-4" variants={slideInLeft}>
              <p className="text-xs font-bold text-sidebar-muted uppercase tracking-widest">⚙️ Administración</p>
            </motion.div>
            {adminItems.map((item) => (
              <motion.button
                key={item.path}
                onClick={() => navigate(item.path)}
                variants={slideInLeft}
                whileHover={{ x: 3, transition: { duration: 0.1 } }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-colors duration-150",
                  isActive(item.path)
                    ? "bg-sidebar-primary text-white"
                    : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <MI icon={item.icon} className="text-[20px]" />
                <span className="text-sm font-semibold">{item.label}</span>
              </motion.button>
            ))}
          </>
        )}
      </motion.nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <div className="text-center">
          <img src={logoIncentivos} alt="Siigo Incentivos" className="h-5 mx-auto opacity-50" />
          <p className="text-[10px] text-sidebar-muted mt-1">Siigo · Incentivos</p>
        </div>
      </div>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <motion.button
          onClick={handleLogout}
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sidebar-muted hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
        >
          <MI icon="logout" className="text-[22px]" />
          <span className="text-sm font-semibold">Cerrar sesión</span>
        </motion.button>
      </div>
    </aside>
  );
};

export default Sidebar;
