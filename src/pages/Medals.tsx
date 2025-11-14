import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useSales } from '@/context/SalesContext';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { evaluateMedalCriteria, getMedalRarityColor, getMedalRarityBadge } from '@/utils/medalEvaluator';
import { Trophy, Lock, Calendar, Award } from 'lucide-react';

const Medals = () => {
  const { user } = useAuth();
  const { medals: allMedals } = useConfig();
  const { sales } = useSales();
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const userMedals = user?.medals || [];
  const unlockedMedalIds = new Set(userMedals.map(m => m.medalId));

  const stats = useMemo(() => {
    const unlockedCount = unlockedMedalIds.size;
    const totalCount = allMedals.filter(m => m.active !== false).length;
    const totalXP = allMedals
      .filter(m => unlockedMedalIds.has(m.id))
      .reduce((sum, m) => sum + m.xp, 0);
    
    return {
      unlockedCount,
      totalCount,
      percentage: totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0,
      totalXP
    };
  }, [allMedals, unlockedMedalIds]);

  const medalsWithProgress = useMemo(() => {
    return allMedals
      .filter(m => m.active !== false)
      .map(medal => {
        const unlocked = unlockedMedalIds.has(medal.id);
        const userMedal = userMedals.find(m => m.medalId === medal.id);
        
      let evaluation: { meets: boolean; progress?: { current: number; required: number; percentage: number } } = { meets: false };
      if (!unlocked && user) {
        evaluation = evaluateMedalCriteria(user, medal, { sales });
      }

        return {
          ...medal,
          unlocked,
          obtainedAt: userMedal?.obtainedAt,
          progress: evaluation.progress
        };
      })
      .sort((a, b) => {
        // Sort: unlocked first, then by progress
        if (a.unlocked && !b.unlocked) return -1;
        if (!a.unlocked && b.unlocked) return 1;
        if (a.unlocked && b.unlocked) {
          return new Date(b.obtainedAt!).getTime() - new Date(a.obtainedAt!).getTime();
        }
        const aProgress = a.progress?.percentage || 0;
        const bProgress = b.progress?.percentage || 0;
        return bProgress - aProgress;
      });
  }, [allMedals, unlockedMedalIds, userMedals, user, sales]);

  const filteredMedals = medalsWithProgress.filter(medal => {
    if (filter === 'unlocked') return medal.unlocked;
    if (filter === 'locked') return !medal.unlocked;
    return true;
  });

  const nearbyMedals = medalsWithProgress
    .filter(m => !m.unlocked && m.progress && m.progress.percentage >= 50)
    .slice(0, 3);

  return (
    <Layout title="Mis Medallas">
      <div className="space-y-6">
        {/* Stats Overview */}
        <Card className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              Tu Progreso de Medallas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {stats.unlockedCount} / {stats.totalCount}
                </p>
                <p className="text-sm text-muted-foreground">Medallas desbloqueadas</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">+{stats.totalXP} XP</p>
                <p className="text-sm text-muted-foreground">Total de medallas</p>
              </div>
            </div>

            <div>
              <Progress value={stats.percentage} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">{stats.percentage}% completado</p>
            </div>

            {nearbyMedals.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-semibold mb-3">🎯 Próximas medallas cercanas:</p>
                <div className="space-y-2">
                  {nearbyMedals.map(medal => (
                    <div key={medal.id} className="flex items-center gap-3">
                      <span className="text-2xl">{medal.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{medal.name}</p>
                        <Progress value={medal.progress!.percentage} className="h-2 mt-1" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {medal.progress!.percentage.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">Todas ({medalsWithProgress.length})</TabsTrigger>
            <TabsTrigger value="unlocked">Desbloqueadas ({stats.unlockedCount})</TabsTrigger>
            <TabsTrigger value="locked">Bloqueadas ({stats.totalCount - stats.unlockedCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Medals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMedals.map(medal => (
            <Card
              key={medal.id}
              className={`${medal.unlocked 
                ? `${getMedalRarityColor(medal.rarity)} shadow-lg` 
                : 'opacity-75'
              } transition-all hover:scale-105`}
            >
              <CardContent className="p-6 text-center space-y-3">
                <div className={`text-6xl ${medal.unlocked ? 'animate-bounce-slow' : 'grayscale'}`}>
                  {medal.unlocked ? medal.icon : '🔒'}
                </div>

                <h3 className="font-bold text-lg">{medal.name}</h3>
                <p className="text-sm text-muted-foreground">{medal.description}</p>

                {medal.rarity && (
                  <Badge variant="outline" className="text-xs">
                    {getMedalRarityBadge(medal.rarity)}
                  </Badge>
                )}

                {medal.unlocked ? (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <Award className="w-4 h-4" />
                      <span className="font-semibold">DESBLOQUEADA</span>
                    </div>
                    
                    {medal.obtainedAt && (
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(medal.obtainedAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                    )}

                    <div className="flex gap-2 justify-center pt-2">
                      <Badge className="bg-gradient-to-r from-primary to-secondary">
                        💎 +{medal.xp} XP
                      </Badge>
                      {medal.givesStreakSaver && (
                        <Badge className="bg-gradient-to-r from-accent to-primary">
                          🛡️ +1
                        </Badge>
                      )}
                    </div>

                    {medal.repeatable && (
                      <p className="text-xs text-muted-foreground">
                        🎖️ Obtenida {userMedals.filter(m => m.medalId === medal.id).length} vez(ces)
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Lock className="w-4 h-4" />
                      <span className="font-semibold">AÚN NO DESBLOQUEADA</span>
                    </div>

                    {medal.progress && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Progreso:</p>
                        <Progress value={medal.progress.percentage} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {medal.progress.current} / {medal.progress.required} ({medal.progress.percentage.toFixed(0)}%)
                        </p>
                        {medal.progress.percentage >= 80 && (
                          <p className="text-xs font-semibold text-primary">
                            ¡Solo faltan {medal.progress.required - medal.progress.current}! 🔥
                          </p>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-1">Recompensa:</p>
                      <div className="flex gap-2 justify-center">
                        <Badge variant="outline">💎 +{medal.xp} XP</Badge>
                        {medal.givesStreakSaver && (
                          <Badge variant="outline">🛡️ +1</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMedals.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No hay medallas en esta categoría</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Medals;
