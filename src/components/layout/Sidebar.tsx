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
  { path: '/dashboard', icon: 'dashboard', label: 'Panel General' },
  { path: '/ranking', icon: 'leaderboard', label: 'Ranking' },
  { path: '/mi-performance', icon: 'insights', label: 'Mi Performance' },
  { path: '/medallas', icon: 'workspace_premium', label: 'Medallas' },
  { path: '/retos', icon: 'flag', label: 'Retos' },
  { path: '/reconocimientos', icon: 'stars', label: 'Reconocimientos' },
  { path: '/premios', icon: 'redeem', label: 'Premios' },
  { path: '/mi-equipo', icon: 'groups', label: 'Mi Equipo' },
];

const adminItems = [
  { path: '/admin/gerentes', icon: 'manage_accounts', label: 'Gerentes' },
  { path: '/admin/asesores', icon: 'people', label: 'Asesores' },
  { path: '/admin/especialista', icon: 'shield_person', label: 'Gamificación' },
  { path: '/admin/medallas', icon: 'emoji_events', label: 'Medallas (legacy)' },
  { path: '/admin/rachas', icon: 'local_fire_department', label: 'Rachas (legacy)' },
  { path: '/admin/calculos', icon: 'calculate', label: 'Motor SP' },
  { path: '/admin/simulacion', icon: 'science', label: 'Simulación VC' },
  { path: '/admin/premios', icon: 'storefront', label: 'Premios' },
  { path: '/admin/databricks', icon: 'cloud_sync', label: 'Databricks' },
];

const especialistaItems = [
  { path: '/admin/especialista', icon: 'shield_person', label: 'Gamificación' },
  { path: '/admin/especialista/premios', icon: 'storefront', label: 'Premios' },
];

const Sidebar = () => {
  const { profile, signOut } = useSupabaseAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try { await signOut(); } catch {}
    navigate('/login', { replace: true });
    // Forzar reset del estado en memoria
    setTimeout(() => { window.location.href = '/login'; }, 50);
  };

  const isActive = (path: string) => location.pathname === path;
  const isAdmin = profile?.role === 'admin';
  const isEspecialista = profile?.role === 'especialista';
  const isVN = profile?.canal === 'VN_ALIADOS' || profile?.canal === 'VN_EMPRESARIOS';
  const spDisplay = isVN ? (profile?.sp_periodo_actual ?? profile?.sp_totales ?? 0) : (profile?.sp_totales ?? 0);

  return (
    <aside className="w-[240px] bg-sidebar flex flex-col flex-shrink-0 border-r border-sidebar-border relative">
      {/* Logo */}
      <motion.div 
        className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
      >
        <img src={logoIncentivos} alt="Siigo Arena" className="h-8" />
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
            <MI icon={isAdmin ? 'admin_panel_settings' : isEspecialista ? 'shield_person' : 'person'} className="text-sidebar-primary text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate">{profile?.nombre || 'Usuario'}</p>
            <p className="text-xs text-sidebar-primary font-semibold">{isAdmin ? 'Administrador' : isEspecialista ? 'Especialista' : (profile?.nivel || 'Nivel 1')}</p>
          </div>
        </div>
        {!isAdmin && !isEspecialista && (
          <>
            <motion.div 
              className="mt-3 flex items-center gap-2 bg-sidebar-accent rounded-lg px-4 py-2.5"
              whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
              title="SP Convención · Cumplimiento de meta"
            >
              <MI icon="leaderboard" className="text-sidebar-primary text-lg" />
              <span className="text-base font-bold font-scoreboard text-sidebar-primary">{spDisplay.toLocaleString()}</span>
              <span className="text-xs text-sidebar-muted font-medium">SP Convención</span>
            </motion.div>
            <motion.div 
              className="mt-2 flex items-center gap-2 bg-sidebar-accent rounded-lg px-4 py-2"
              whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
              title="SP Canje · Medallas, retos y reconocimientos"
            >
              <MI icon="redeem" className="text-accent text-lg" />
              <span className="text-sm font-bold font-scoreboard text-accent">{(profile?.sp_canje || 0).toLocaleString()}</span>
              <span className="text-xs text-sidebar-muted font-medium">SP Canje</span>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Navigation */}
      <motion.nav 
        className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {!isAdmin && !isEspecialista && menuItems.map((item) => (
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

        {(isAdmin || isEspecialista) && (
          <>
            <motion.div className="pb-2 px-4" variants={slideInLeft}>
              <p className="text-xs font-bold text-sidebar-muted uppercase tracking-widest">{isAdmin ? '⚙️ Administración' : '🛡️ Especialista'}</p>
            </motion.div>
            {(isAdmin ? adminItems : especialistaItems).map((item) => (
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
          <img src={logoIncentivos} alt="Siigo Arena" className="h-5 mx-auto opacity-50" />
          <p className="text-[10px] text-sidebar-muted mt-1">Siigo · Arena</p>
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
