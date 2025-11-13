import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
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
  Shield,
  Award
} from 'lucide-react';

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  const getMenuItems = () => {
    switch (user?.role) {
      case 'EJECUTIVO':
        return [
          { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { path: '/register-sale', icon: PlusCircle, label: 'Registrar Venta' },
          { path: '/sales-history', icon: BarChart3, label: 'Mis Ventas' },
          { path: '/missions', icon: Target, label: 'Misiones' },
          { path: '/ranking', icon: Award, label: 'Ranking' },
          { path: '/profile', icon: User, label: 'Perfil' },
        ];
      case 'GERENTE':
        return [
          { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { path: '/register-sale', icon: PlusCircle, label: 'Registrar Venta' },
          { path: '/sales-history', icon: BarChart3, label: 'Ventas del Equipo' },
          { path: '/team', icon: Users, label: 'Mi Equipo' },
          { path: '/create-mission', icon: Target, label: 'Crear Misión' },
          { path: '/ranking', icon: Award, label: 'Ranking' },
          { path: '/profile', icon: User, label: 'Perfil' },
        ];
      case 'ADMINISTRADOR':
        return [
          { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard Global' },
          { path: '/users', icon: Users, label: 'Usuarios' },
          { path: '/analytics', icon: BarChart3, label: 'Analytics' },
          { path: '/settings', icon: Settings, label: 'Configuración' },
        ];
      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case 'EJECUTIVO':
        return 'bg-gradient-primary';
      case 'GERENTE':
        return 'bg-gradient-secondary';
      case 'ADMINISTRADOR':
        return 'bg-gradient-accent';
      default:
        return 'bg-muted';
    }
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 relative`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-smooth-md flex-shrink-0">
            <Trophy className="w-6 h-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-sidebar-foreground">SalesQuest</span>
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
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent transition-all group"
            activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-smooth-md"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="font-semibold">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={`${collapsed ? 'flex flex-col items-center' : 'flex items-center gap-3'} mb-3`}>
          <div className="w-10 h-10 bg-gradient-secondary rounded-full flex items-center justify-center text-2xl flex-shrink-0 shadow-smooth-md">
            {user?.avatar}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-sidebar-foreground truncate">
                {user?.name}
              </p>
              <div className={`${getRoleBadgeColor()} text-white text-xs px-2 py-0.5 rounded-full inline-block mt-1`}>
                {user?.role}
              </div>
            </div>
          )}
        </div>
        <Button
          onClick={logout}
          variant="ghost"
          className={`${
            collapsed ? 'w-full justify-center' : 'w-full justify-start'
          } text-destructive hover:text-destructive hover:bg-destructive/10`}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
