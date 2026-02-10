import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  LayoutDashboard,
  Target,
  Users,
  Settings,
  User,
  BarChart3,
  PlusCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Award,
  Heart,
  Crosshair
} from 'lucide-react';

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, signOut } = useSupabaseAuthContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getMenuItems = () => {
    switch (profile?.role) {
      case 'EJECUTIVO':
        return [
          { path: '/dashboard', icon: User, label: 'Mi perfil' },
          { path: '/ranking', icon: Award, label: 'Tabla de clasificación' },
          { path: '/medals', icon: Trophy, label: 'Mis Medallas' },
          { path: '/sales-history', icon: BarChart3, label: 'Mis Ventas' },
          { path: '/profile', icon: Settings, label: 'Ajustes' },
        ];
      case 'GERENTE':
        return [
          { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { path: '/register-sale', icon: PlusCircle, label: 'Cargar Ventas' },
          { path: '/upload-history', icon: BarChart3, label: 'Historial Cargas' },
          { path: '/team', icon: Users, label: 'Mi Equipo' },
          { path: '/ranking', icon: Award, label: 'Ranking' },
          { path: '/medals', icon: Trophy, label: 'Medallas' },
        ];
      case 'ADMINISTRADOR':
        return [
          { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard Global' },
          { path: '/users', icon: Users, label: 'Usuarios' },
          { path: '/cells', icon: Target, label: 'Células' },
          { path: '/ranking', icon: Award, label: 'Ranking' },
          { path: '/settings', icon: Settings, label: 'Configuración' },
        ];
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  return (
    <aside
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } bg-sidebar flex flex-col transition-all duration-300 relative`}
    >
      {/* Logo */}
      <div className="p-5 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center shadow-smooth-md flex-shrink-0">
            <span className="text-sidebar-primary-foreground font-extrabold text-lg">S</span>
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-sidebar-primary-foreground tracking-tight">Siigo</span>
          )}
        </div>
      </div>

      {/* Toggle button */}
      <Button
        onClick={() => setCollapsed(!collapsed)}
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border shadow-smooth-md hover:shadow-smooth-lg z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </Button>

      {/* Menu items */}
      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all text-sm"
            activeClassName="bg-sidebar-primary/10 text-sidebar-primary border-r-4 border-sidebar-primary font-semibold"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span>{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={`${collapsed ? 'flex flex-col items-center' : 'flex items-center gap-3'} mb-3`}>
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-xl flex-shrink-0">
            {profile?.avatar || '👤'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-sidebar-foreground truncate">
                {profile?.name || 'Usuario'}
              </p>
              <p className="text-xs text-sidebar-muted truncate">
                {profile?.role || 'USUARIO'}
              </p>
            </div>
          )}
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className={`${
            collapsed ? 'w-full justify-center' : 'w-full justify-start'
          } text-sidebar-muted hover:text-destructive hover:bg-destructive/10 text-sm`}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
