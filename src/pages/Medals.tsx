import { useState } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useMedals } from '@/hooks/useMedals';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Trophy, Lock, Calendar, Award } from 'lucide-react';

const Medals = () => {
  const { profile } = useSupabaseAuthContext();
  const { medals: allMedals, loading } = useMedals();
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  // For now, use empty medals since we're migrating to Supabase
  const userMedals: { medalId: string; obtainedAt: Date }[] = [];
  const unlockedMedalIds = new Set(userMedals.map(m => m.medalId));

  const activeMedals = allMedals.filter(m => m.active !== false);

  const stats = {
    unlockedCount: unlockedMedalIds.size,
    totalCount: activeMedals.length,
    percentage: activeMedals.length > 0 ? Math.round((unlockedMedalIds.size / activeMedals.length) * 100) : 0,
    totalXP: allMedals
      .filter(m => unlockedMedalIds.has(m.id))
      .reduce((sum, m) => sum + (m.xp_reward || 0), 0),
  };

  const medalsWithProgress = activeMedals.map(medal => {
    const unlocked = unlockedMedalIds.has(medal.id);
    const userMedal = userMedals.find(m => m.medalId === medal.id);
    return {
      ...medal,
      unlocked,
      obtainedAt: userMedal?.obtainedAt,
    };
  }).sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return 0;
  });

  const filteredMedals = medalsWithProgress.filter(medal => {
    if (filter === 'unlocked') return medal.unlocked;
    if (filter === 'locked') return !medal.unlocked;
    return true;
  });

  if (loading) {
    return (
      <Layout title="Mis Medallas">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Cargando medallas...</p>
        </Card>
      </Layout>
    );
  }

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
              className={`${medal.unlocked ? 'shadow-lg' : 'opacity-75'} transition-all hover:scale-105`}
            >
              <CardContent className="p-6 text-center space-y-3">
                <div className={`text-6xl ${medal.unlocked ? '' : 'grayscale'}`}>
                  {medal.unlocked ? medal.icon : '🔒'}
                </div>

                <h3 className="font-bold text-lg">{medal.name}</h3>
                <p className="text-sm text-muted-foreground">{medal.description}</p>

                <Badge variant="outline" className="text-xs">
                  {medal.category}
                </Badge>

                {medal.unlocked ? (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <Award className="w-4 h-4" />
                      <span className="font-semibold">DESBLOQUEADA</span>
                    </div>
                    <Badge className="bg-gradient-to-r from-primary to-secondary">
                      💎 +{medal.xp_reward || 0} XP
                    </Badge>
                  </div>
                ) : (
                  <div className="space-y-2 pt-3 border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Lock className="w-4 h-4" />
                      <span className="font-semibold">AÚN NO DESBLOQUEADA</span>
                    </div>
                    <Badge variant="outline">💎 +{medal.xp_reward || 0} XP</Badge>
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
