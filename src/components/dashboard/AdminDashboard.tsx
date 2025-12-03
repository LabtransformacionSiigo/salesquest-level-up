import { useConfig } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Zap, Award, Target, Settings, Package, Medal, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const { products, levels, medals, streakXP, recognitions } = useConfig();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome message */}
      <Card className="p-8 shadow-smooth-xl border-2 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-smooth-lg">
            <Settings className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Bienvenido al Panel de Administración
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Gestiona todos los aspectos de SalesQuest desde aquí
          </p>
          <Link to="/settings">
            <Button 
              size="lg" 
              className="bg-gradient-primary hover:opacity-90 shadow-smooth-lg hover:shadow-smooth-xl transition-all font-bold"
            >
              <Settings className="w-5 h-5 mr-2" />
              Ir a Configuración
            </Button>
          </Link>
        </div>
      </Card>

      {/* Configuration Status */}
      <Card className="p-6 shadow-smooth-lg border-2 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Estado de Configuración
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="flex flex-col items-center p-4 bg-background rounded-lg">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{products.length}</p>
            <p className="text-xs text-muted-foreground text-center">Productos</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-background rounded-lg">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{levels.length}</p>
            <p className="text-xs text-muted-foreground text-center">Niveles</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-background rounded-lg">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{medals.length}</p>
            <p className="text-xs text-muted-foreground text-center">Medallas</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-background rounded-lg">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{streakXP.length}</p>
            <p className="text-xs text-muted-foreground text-center">Semanas Racha</p>
          </div>
          <div className="flex flex-col items-center p-4 bg-background rounded-lg">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{recognitions.length}</p>
            <p className="text-xs text-muted-foreground text-center">Reconocimientos</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-sm text-center font-semibold text-green-700 dark:text-green-400">
            ✅ Sistema completamente configurado
          </p>
        </div>
      </Card>

      {/* Global metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2 hover:scale-105 duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground">Usuarios Activos</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">0</p>
          <p className="text-sm text-muted-foreground mt-1">Total en plataforma</p>
        </Card>

        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2 hover:scale-105 duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-secondary rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-secondary-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground">XP Total</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">0</p>
          <p className="text-sm text-muted-foreground mt-1">Generado en total</p>
        </Card>

        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2 hover:scale-105 duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-accent rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-accent-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground">Medallas</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">0</p>
          <p className="text-sm text-muted-foreground mt-1">Otorgadas en total</p>
        </Card>

        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2 hover:scale-105 duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground">Misiones</h3>
          </div>
          <p className="text-4xl font-bold text-foreground">0</p>
          <p className="text-sm text-muted-foreground mt-1">Completadas</p>
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
        <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          Accesos Rápidos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/settings">
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/5 transition-all w-full"
            >
              <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="text-center">
                <p className="font-bold text-foreground">Configurar Productos</p>
                <p className="text-xs text-muted-foreground mt-1">Gestiona el catálogo</p>
              </div>
            </Button>
          </Link>

          <Link to="/settings">
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-center gap-3 hover:border-secondary hover:bg-secondary/5 transition-all w-full"
            >
              <div className="w-12 h-12 bg-gradient-secondary rounded-xl flex items-center justify-center">
                <Medal className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div className="text-center">
                <p className="font-bold text-foreground">Crear Medallas</p>
                <p className="text-xs text-muted-foreground mt-1">Diseña recompensas</p>
              </div>
            </Button>
          </Link>

          <Link to="/settings">
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-center gap-3 hover:border-accent hover:bg-accent/5 transition-all w-full"
            >
              <div className="w-12 h-12 bg-gradient-accent rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent-foreground" />
              </div>
              <div className="text-center">
                <p className="font-bold text-foreground">Gestionar Niveles</p>
                <p className="text-xs text-muted-foreground mt-1">Configura rangos</p>
              </div>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;