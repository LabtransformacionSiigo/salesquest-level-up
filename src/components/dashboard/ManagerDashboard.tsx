import { useState } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Trophy, Flame, Target, Award, TrendingUp, Users, PlusCircle, Zap } from 'lucide-react';

const ManagerDashboard = () => {
  const { profile } = useSupabaseAuthContext();
  const [activeTab, setActiveTab] = useState('performance');
  
  const currentXP = profile?.xp || 0;
  const nextLevelXP = 500;
  const xpProgress = (currentXP / nextLevelXP) * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-12">
          <TabsTrigger value="performance" className="font-bold">
            Mi Desempeño
          </TabsTrigger>
          <TabsTrigger value="team" className="font-bold">
            Mi Equipo
          </TabsTrigger>
        </TabsList>

        {/* Tab: Mi Desempeño */}
        <TabsContent value="performance" className="space-y-6">
          {/* Profile Header */}
          <Card className="p-6 shadow-smooth-lg border-2 hover:shadow-smooth-xl transition-all">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-secondary rounded-full flex items-center justify-center text-5xl shadow-smooth-lg ring-4 ring-secondary/20">
                  {profile?.avatar}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-bold shadow-smooth-md">
                  {profile?.level || 'Junior'}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-bold text-foreground mb-2">{profile?.name}</h2>
                <p className="text-muted-foreground mb-4">
                  ¡{nextLevelXP - currentXP} XP para alcanzar Senior! 🎯
                </p>
                
                {/* XP Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">Experiencia</span>
                    <span className="font-bold text-secondary">{currentXP} / {nextLevelXP} XP</span>
                  </div>
                  <Progress value={xpProgress} className="h-3 bg-muted" />
                </div>
              </div>

              {/* Streak widget */}
              <Card className="p-4 bg-gradient-accent shadow-smooth-md hover:scale-105 transition-transform">
                <div className="text-center">
                  <Flame className="w-8 h-8 text-accent-foreground mx-auto mb-2" />
                  <p className="text-2xl font-bold text-accent-foreground">{profile?.streak || 0}</p>
                  <p className="text-xs text-accent-foreground/90 font-semibold">Semanas</p>
                  <div className="mt-2 flex items-center gap-1 justify-center">
                    <span className="text-lg">🛡️</span>
                    <span className="text-sm font-bold text-accent-foreground">{profile?.shields || 0}</span>
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
        </TabsContent>

        {/* Tab: Mi Equipo */}
        <TabsContent value="team" className="space-y-6">
          {/* Team metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2 hover:scale-105 duration-300">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-8 h-8 text-primary" />
                <h3 className="text-sm font-semibold text-muted-foreground">Total XP</h3>
              </div>
              <p className="text-3xl font-bold text-foreground">0</p>
            </Card>

            <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2 hover:scale-105 duration-300">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-8 h-8 text-secondary" />
                <h3 className="text-sm font-semibold text-muted-foreground">Misiones Completadas</h3>
              </div>
              <p className="text-3xl font-bold text-foreground">0</p>
            </Card>

            <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2 hover:scale-105 duration-300">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-8 h-8 text-accent" />
                <h3 className="text-sm font-semibold text-muted-foreground">Nivel Promedio</h3>
              </div>
              <p className="text-3xl font-bold text-foreground">--</p>
            </Card>
          </div>

          {/* Create Mission CTA */}
          <Card className="p-8 shadow-smooth-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-smooth-lg">
                <PlusCircle className="w-10 h-10 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Crea Misiones para tu Equipo</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Motiva a tu equipo con desafíos emocionantes y recompensas increíbles
              </p>
              <Button 
                size="lg" 
                className="bg-gradient-primary hover:opacity-90 shadow-smooth-lg hover:shadow-smooth-xl transition-all font-bold text-lg h-12 px-8"
              >
                <PlusCircle className="w-5 h-5 mr-2" />
                Crear Nueva Misión
              </Button>
            </div>
          </Card>

          {/* Team list */}
          <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-secondary rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground">👥 Mi Equipo</h3>
            </div>
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium">
                Aún no tienes ejecutivos en tu equipo.
              </p>
              <p className="text-secondary font-bold mt-2">
                Espera a que se asignen miembros 🎯
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ManagerDashboard;