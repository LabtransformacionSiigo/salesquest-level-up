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
  { path: '/dashboard', icon: 'stadium', label: 'Estadio' },
  { path: '/ranking', icon: 'emoji_events', label: 'Tabla' },
  { path: '/mi-performance', icon: 'scoreboard', label: 'KPIs' },
  { path: '/medallas', icon: 'military_tech', label: 'Trofeos' },
  { path: '/retos', icon: 'sports_soccer', label: 'Partidos' },
  { path: '/reconocimientos', icon: 'workspace_premium', label: 'Premios' },
  { path: '/mi-equipo', icon: 'sports', label: 'Plantilla' },
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
    <aside className="w-[220px] bg-sidebar flex flex-col flex-shrink-0 border-r border-sidebar-border turf-pattern net-texture relative">
      {/* Subtle goal net overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30h60M30 0v60' stroke='%23ffffff' stroke-width='0.3' fill='none' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: '30px 30px'
        }}
      />

      {/* Logo */}
      <motion.div 
        className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border relative z-10"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <img src={siigoLogo} alt="Siigo" className="h-8" />
        <span className="text-lg">⚽</span>
      </motion.div>

      {/* Profile */}
      <motion.div 
        className="px-4 py-5 border-b border-sidebar-border relative z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-lg text-sidebar-foreground shadow-glow-green">
            {profile?.avatar_url || '⚽'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate">{profile?.nombre || 'Jugador'}</p>
            <p className="text-xs text-primary font-semibold">{profile?.nivel || 'Debutante'}</p>
          </div>
        </div>
        <motion.div 
          className="mt-3 flex items-center gap-2 glass-card rounded-lg px-3 py-2"
          whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
        >
          <span className="text-accent text-base">🏆</span>
          <span className="text-sm font-bold font-scoreboard text-neon-green">{(profile?.sp_totales || 0).toLocaleString()}</span>
          <span className="text-xs text-sidebar-muted font-medium">SP</span>
        </motion.div>
      </motion.div>

      {/* Navigation */}
      <motion.nav 
        className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto relative z-10"
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
                ? "glass-card text-primary border-primary/30 shadow-glow-green"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <MI icon={item.icon} className="text-[20px]" />
            <span className="text-[13px] font-semibold">{item.label}</span>
          </motion.button>
        ))}

        {isAdmin && (
          <>
            <motion.div className="pt-4 pb-2 px-3" variants={slideInLeft}>
              <p className="text-[10px] font-bold text-sidebar-muted uppercase tracking-widest">⚙️ Admin</p>
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
                    ? "bg-purple/20 text-purple"
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

      {/* FIFA badge */}
      <div className="px-4 py-3 border-t border-sidebar-border relative z-10">
        <div className="text-center text-[10px] text-sidebar-muted">
          <span className="text-neon-green font-bold">SalesQuest</span> · Mundial 2026 🌎
        </div>
      </div>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-sidebar-border relative z-10">
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
