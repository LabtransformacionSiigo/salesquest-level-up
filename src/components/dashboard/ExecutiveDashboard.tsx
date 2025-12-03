import { useState, useEffect } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig, Level } from '@/context/ConfigContext';
import { useSales } from '@/context/SalesContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import RecentActivity from './RecentActivity';
import LevelUpModal from '@/components/sales/LevelUpModal';
import { Trophy, Flame, Target, Award, TrendingUp, Zap, Plus, Calendar } from 'lucide-react';

const ExecutiveDashboard = () => {
  const { profile } = useSupabaseAuthContext();
  const { getLevelByXP, levels } = useConfig();
  const { sales, notifications } = useSales();
  
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [oldLevel, setOldLevel] = useState<Level | null>(null);
  const [newLevel, setNewLevel] = useState<Level | null>(null);

  // Calculate XP progress
  const currentXP = profile?.xp || 0;
  const currentLevel = getLevelByXP(currentXP);
  const nextLevel = levels.find(l => l.minXP > currentXP);
  const progress = currentLevel 
    ? ((currentXP - currentLevel.minXP) / (currentLevel.maxXP - currentLevel.minXP)) * 100 
    : 0;
  const xpToNextLevel = nextLevel ? nextLevel.minXP - currentXP : 0;

  // Get user's recent sales
  const userSales = sales.filter(sale => String(sale.userId) === profile?.id);
  const recentSales = userSales.slice(-5).reverse();

  // Get sales from current month
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const salesThisMonth = userSales.filter(sale => {
    const saleDate = new Date(sale.createdAt);
    return saleDate.getMonth() === currentMonth && 
           saleDate.getFullYear() === currentYear;
  });

  // Calculate month statistics
  const totalSalesThisMonth = salesThisMonth.length;
  const totalXPThisMonth = salesThisMonth.reduce((sum, sale) => sum + sale.xpEarned, 0);
  const avgXPPerSale = totalSalesThisMonth > 0 ? Math.round(totalXPThisMonth / totalSalesThisMonth) : 0;
  
  // Get most sold product this month
  const productCounts = salesThisMonth.reduce((acc, sale) => {
    acc[sale.productName] = (acc[sale.productName] || 0) + sale.quantity;
    return acc;
  }, {} as Record<string, number>);
  const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Detect level up from notifications
  useEffect(() => {
    const levelUpNotification = notifications.find(
      n => n.type === 'LEVEL_UP' && !n.read && String(n.userId) === profile?.id
    );
    if (levelUpNotification && levelUpNotification.metadata) {
      const oldLevelObj = levels.find(l => l.level === levelUpNotification.metadata?.oldLevel);
      const newLevelObj = levels.find(l => l.level === levelUpNotification.metadata?.newLevel);
      if (oldLevelObj && newLevelObj) {
        setOldLevel(oldLevelObj);
        setNewLevel(newLevelObj);
        setShowLevelUp(true);
      }
    }
  }, [notifications, profile?.id, levels]);

  // Check if close to next level (>80% progress)
  const isCloseToLevelUp = progress > 80;

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Profile Header with Enhanced XP Bar */}
      <Card className="p-6 bg-gradient-subtle shadow-smooth-lg">
        <div className="flex items-start gap-6">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-smooth-md ${
            isCloseToLevelUp ? 'ring-4 ring-primary/50 animate-pulse' : ''
          }`} style={{ background: 'var(--gradient-secondary)' }}>
            {profile?.avatar}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold text-foreground">{profile?.name}</h2>
              <Badge variant="default" className="text-lg px-4 py-1">
                {currentLevel?.icon} {profile?.level}
              </Badge>
            </div>
            
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-muted-foreground">
                  {currentXP} / {currentLevel?.maxXP} XP ({Math.round(progress)}%)
                </span>
                <span className="text-primary font-bold">
                  🎯 {xpToNextLevel.toLocaleString()} XP para {nextLevel?.level}
                </span>
              </div>
              
              <Progress 
                value={progress} 
                className={`h-6 bg-secondary shadow-inner ${isCloseToLevelUp ? 'ring-4 ring-primary/50 animate-pulse' : ''}`}
              />
              
              {isCloseToLevelUp && (
                <p className="text-center text-primary font-bold animate-pulse">
                  ¡Casi llegas! 🔥
                </p>
              )}
              
              {recentSales.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  +{recentSales[0].xpEarned} XP hace {Math.round((Date.now() - recentSales[0].createdAt.getTime()) / (1000 * 60 * 60))} horas 🔥
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Streak Widget */}
        <Card className="p-6 bg-gradient-to-br from-accent to-secondary shadow-smooth-lg hover:shadow-smooth-xl transition-all hover:scale-105">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Flame className="w-7 h-7 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold">🔥 Racha</h3>
          </div>
          <div className="space-y-2">
            <p className="text-4xl font-bold text-foreground">{profile?.streak || 0} semanas</p>
            <p className="text-sm text-muted-foreground">
              Recuperadores: {profile?.shields || 0} 🛡️
            </p>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Plus className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold">⚡ Acciones Rápidas</h3>
          </div>
          <div className="space-y-2">
            <Link to="/register-sale">
              <Button className="w-full" size="lg">
                <Plus className="mr-2" />
                Registrar Venta
              </Button>
            </Link>
            <Link to="/sales-history">
              <Button variant="outline" className="w-full" size="lg">
                <Calendar className="mr-2" />
                Ver Historial
              </Button>
            </Link>
          </div>
        </Card>

        {/* Month Statistics */}
        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold">📊 Este Mes</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total ventas</span>
              <span className="font-bold text-lg">{totalSalesThisMonth}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">XP ganado</span>
              <span className="font-bold text-lg text-primary">{totalXPThisMonth.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Promedio XP</span>
              <span className="font-bold text-lg">{avgXPPerSale}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Top producto</span>
              <span className="font-semibold text-sm truncate max-w-[120px]">{topProduct}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <RecentActivity sales={recentSales} />

      {/* Missions Widget */}
      <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-primary-foreground" />
          </div>
          <h3 className="text-xl font-bold">📋 Mis Misiones</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            No tienes misiones activas. ¡Prepárate para los desafíos! 💪
          </p>
        </div>
      </Card>

      {/* Medals and Ranking Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Medals Widget */}
        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold">🏆 Mis Medallas</h3>
          </div>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Aún no tienes medallas. ¡Comienza a ganarlas!
            </p>
          </div>
        </Card>

        {/* Ranking Widget */}
        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold">📊 Mi Posición</h3>
          </div>
          <div className="text-center py-8">
            <p className="text-4xl font-bold mb-2">#--</p>
            <p className="text-muted-foreground">
              En tu célula
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              ¡Sigue vendiendo para subir en el ranking! 🚀
            </p>
          </div>
        </Card>
      </div>

      {/* Level Up Modal */}
      {oldLevel && newLevel && (
        <LevelUpModal
          open={showLevelUp}
          onClose={() => setShowLevelUp(false)}
          oldLevel={oldLevel}
          newLevel={newLevel}
        />
      )}
    </div>
  );
};

export default ExecutiveDashboard;