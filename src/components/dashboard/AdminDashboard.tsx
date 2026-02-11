import { useConfig } from '@/context/ConfigContext';
import { useProfiles } from '@/hooks/useProfiles';
import { useCells } from '@/hooks/useCells';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const AdminDashboard = () => {
  const { products, levels, streakXP, recognitions } = useConfig();
  const { profiles } = useProfiles();
  const { cells } = useCells();

  const users = profiles.filter(p => p.role !== 'ADMINISTRADOR');
  const managers = profiles.filter(p => p.role === 'GERENTE');
  const executives = profiles.filter(p => p.role === 'EJECUTIVO');
  const totalXP = profiles.reduce((sum, p) => sum + (p.xp || 0), 0);

  const statCards = [
    { icon: 'groups', label: 'Usuarios', value: users.length, sub: 'Activos en plataforma', color: 'bg-primary/10 text-primary' },
    { icon: 'manage_accounts', label: 'Gerentes', value: managers.length, sub: 'Liderando equipos', color: 'bg-secondary/10 text-secondary' },
    { icon: 'person', label: 'Ejecutivos', value: executives.length, sub: 'Compitiendo', color: 'bg-accent/10 text-accent-foreground' },
    { icon: 'stars', label: 'XP Total', value: totalXP.toLocaleString(), sub: 'Generado globalmente', color: 'bg-primary/10 text-primary' },
  ];

  const configItems = [
    { icon: 'inventory_2', label: 'Productos', count: products.length, status: products.length > 0 },
    { icon: 'trending_up', label: 'Niveles', count: levels.length, status: levels.length > 0 },
    { icon: 'local_fire_department', label: 'Semanas Racha', count: streakXP.length, status: streakXP.length > 0 },
    { icon: 'volunteer_activism', label: 'Reconocimientos', count: recognitions.length, status: recognitions.length > 0 },
    { icon: 'cell_tower', label: 'Células', count: cells.length, status: cells.length > 0 },
  ];

  const quickLinks = [
    { icon: 'groups', label: 'Usuarios', desc: 'Crear y gestionar cuentas', path: '/users', color: 'text-primary' },
    { icon: 'cell_tower', label: 'Células', desc: 'Administrar equipos', path: '/cells', color: 'text-secondary' },
    { icon: 'leaderboard', label: 'Ranking', desc: 'Ver competencia global', path: '/ranking', color: 'text-accent-foreground' },
    { icon: 'tune', label: 'Configuración', desc: 'Parametrizar el sistema', path: '/settings', color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", s.color)}>
              <MI icon={s.icon} className="text-[22px]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground leading-none">{s.value}</p>
              <p className="text-xs font-semibold text-foreground mt-1">{s.label}</p>
              <p className="text-[10px] text-muted-foreground">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Config status */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <MI icon="check_circle" className="text-secondary text-lg" />
          <h3 className="text-sm font-bold text-foreground">Estado de Configuración</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {configItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2.5">
              <MI icon={item.icon} className="text-muted-foreground text-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{item.label}</p>
                <p className="text-lg font-extrabold text-foreground leading-tight">{item.count}</p>
              </div>
              <MI
                icon={item.status ? 'check_circle' : 'error_outline'}
                className={cn("text-lg", item.status ? 'text-secondary' : 'text-destructive')}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <MI icon="bolt" className="text-primary text-lg" />
          Accesos Rápidos
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <Link key={link.path} to={link.path}>
              <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer">
                <MI icon={link.icon} className={cn("text-2xl", link.color)} />
                <div>
                  <p className="text-sm font-bold text-foreground">{link.label}</p>
                  <p className="text-[10px] text-muted-foreground">{link.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
