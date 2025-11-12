import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, Flame, Target, Award, TrendingUp } from 'lucide-react';

const ExecutiveDashboard = () => {
  const { user } = useAuth();
  const { getLevelByXP, levels } = useConfig();
  
  const currentXP = user?.xp || 0;
  const currentLevel = getLevelByXP(currentXP);
  
  // Find next level
  const currentLevelIndex = levels.findIndex(l => l.level === currentLevel?.level);
  const nextLevel = currentLevelIndex < levels.length - 1 ? levels[currentLevelIndex + 1] : null;
  const nextLevelXP = nextLevel?.minXP || currentLevel?.maxXP || 100;
  const currentLevelMinXP = currentLevel?.minXP || 0;
  
  // Calculate progress within current level
  const xpInCurrentLevel = currentXP - currentLevelMinXP;
  const xpNeededForLevel = nextLevelXP - currentLevelMinXP;
  const xpProgress = (xpInCurrentLevel / xpNeededForLevel) * 100;
  const xpToNextLevel = nextLevelXP - currentXP;
  const progressPercentage = Math.min(Math.round(xpProgress), 100);
  
  const isNearLevelUp = xpProgress > 80;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Header */}
      <Card className="p-6 shadow-smooth-lg border-2 hover:shadow-smooth-xl transition-all">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center text-5xl shadow-smooth-lg ring-4 ring-primary/20">
              {user?.avatar}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-bold shadow-smooth-md">
              {user?.level || 'Novato'}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <span className="text-3xl">{currentLevel?.icon || '🌱'}</span>
              <h2 className="text-3xl font-bold text-foreground">{user?.name}</h2>
            </div>
            <p className="text-lg font-semibold text-primary mb-1">
              {currentLevel?.level || 'Novato'}
            </p>
            {nextLevel && (
              <p className="text-muted-foreground mb-4">
                🎯 {xpToNextLevel} XP para alcanzar {nextLevel.level}!
              </p>
            )}
            
            {/* XP Progress - MEJORADO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-foreground">Experiencia</span>
                <span className="font-bold text-primary">
                  {currentXP} / {nextLevelXP} XP ({progressPercentage}%)
                </span>
              </div>
              <div className="relative">
                <Progress 
                  value={xpProgress} 
                  className={`h-6 bg-muted shadow-inner ${isNearLevelUp ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}`}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-accent opacity-80 rounded-full" 
                     style={{ 
                       width: `${xpProgress}%`,
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 2s infinite linear'
                     }} 
                />
                {isNearLevelUp && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-foreground drop-shadow-lg">
                      ¡Casi llegas! 🔥
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Streak widget */}
          <Card className="p-4 bg-gradient-accent shadow-smooth-md hover:scale-105 transition-transform">
            <div className="text-center">
              <Flame className="w-8 h-8 text-accent-foreground mx-auto mb-2" />
              <p className="text-2xl font-bold text-accent-foreground">{user?.streak || 0}</p>
              <p className="text-xs text-accent-foreground/90 font-semibold">Semanas</p>
              <div className="mt-2 flex items-center gap-1 justify-center">
                <span className="text-lg">🛡️</span>
                <span className="text-sm font-bold text-accent-foreground">{user?.shields || 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </Card>

      {/* Grid of sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Missions */}
        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">📋 Mis Misiones</h3>
          </div>
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground font-medium">
              No tienes misiones activas.
            </p>
            <p className="text-primary font-bold mt-2">
              ¡Prepárate para los desafíos! 💪
            </p>
          </div>
        </Card>

        {/* Medals */}
        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-secondary rounded-xl flex items-center justify-center">
              <Award className="w-6 h-6 text-secondary-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">🏆 Mis Medallas</h3>
          </div>
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground font-medium">
              Aún no tienes medallas.
            </p>
            <p className="text-secondary font-bold mt-2">
              ¡Comienza a ganarlas!
            </p>
          </div>
        </Card>
      </div>

      {/* Ranking widget */}
      <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-accent rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-accent-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground">📊 Mi Posición</h3>
        </div>
        <div className="text-center py-8">
          <div className="inline-block bg-muted rounded-2xl px-8 py-4">
            <p className="text-4xl font-bold text-foreground mb-2">#--</p>
            <p className="text-sm text-muted-foreground font-semibold">en tu célula</p>
          </div>
          <p className="text-primary font-bold mt-4">
            ¡Completa misiones para escalar posiciones! 🚀
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ExecutiveDashboard;
