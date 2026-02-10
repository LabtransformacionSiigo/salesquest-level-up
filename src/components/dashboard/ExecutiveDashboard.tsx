import { useState, useEffect } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig, Level } from '@/context/ConfigContext';
import { useSales } from '@/context/SalesContext';
import { Card } from '@/components/ui/card';
import LevelProgressRoad from './LevelProgressRoad';
import StatsCards from './StatsCards';
import MiniLeaderboard from './MiniLeaderboard';
import MedalsCarousel from './MedalsCarousel';
import RecognitionsGrid from './RecognitionsGrid';
import LevelUpModal from '@/components/sales/LevelUpModal';
const ExecutiveDashboard = () => {
  const { profile } = useSupabaseAuthContext();
  const { levels } = useConfig();
  const { sales, notifications } = useSales();

  const [showLevelUp, setShowLevelUp] = useState(false);
  const [oldLevel, setOldLevel] = useState<Level | null>(null);
  const [newLevel, setNewLevel] = useState<Level | null>(null);

  const currentXP = profile?.xp || 0;

  // Month stats
  const userSales = sales.filter(sale => String(sale.userId) === profile?.id);
  const now = new Date();
  const salesThisMonth = userSales.filter(sale => {
    const d = new Date(sale.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const xpThisMonth = salesThisMonth.reduce((sum, s) => sum + s.xpEarned, 0);

  // Detect level up
  useEffect(() => {
    const n = notifications.find(
      n => n.type === 'LEVEL_UP' && !n.read && String(n.userId) === profile?.id
    );
    if (n?.metadata) {
      const o = levels.find(l => l.level === n.metadata?.oldLevel);
      const nw = levels.find(l => l.level === n.metadata?.newLevel);
      if (o && nw) { setOldLevel(o); setNewLevel(nw); setShowLevelUp(true); }
    }
  }, [notifications, profile?.id, levels]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Level Progress */}
      <LevelProgressRoad currentXP={currentXP} />

      {/* Stats */}
      <StatsCards
        xp={currentXP}
        xpThisMonth={xpThisMonth}
        streak={profile?.streak || 0}
        topCount={7}
        topPercentile={80}
        medalsCount={31}
        lastMedalAgo="hace 3 sem."
        seatCategory="Premium Economy"
      />

      {/* Medals & Recognitions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MedalsCarousel
          earnedCount={24}
          totalCount={48}
          medals={[
            { icon: '🎯', name: 'Primer cierre', earned: true },
            { icon: '🏹', name: 'El cazador', earned: true },
            { icon: '🚀', name: 'Nubarrón de ventas', earned: true },
            { icon: '💯', name: '0 a 100', earned: true },
            { icon: '🤝', name: 'Cross Seller', earned: true },
            { icon: '⭐', name: 'Estrella del mes', earned: true },
            { icon: '⏱️', name: 'Tiempo perfecto', earned: false },
            { icon: '📢', name: 'Embajador', earned: false },
          ]}
        />
        <RecognitionsGrid
          total={8}
          recognitions={[
            { emoji: '🤝', name: 'Nos apasiona ayudar', count: 1, color: '#3B82F6' },
            { emoji: '🏆', name: 'Mentalidad ganadora', count: 2, color: '#F59E0B' },
            { emoji: '😊', name: '100% actitud y alegría', count: 0, color: '#EC4899' },
            { emoji: '💙', name: 'Humildes y amorosos', count: 3, color: '#06B6D4' },
            { emoji: '💡', name: 'Innovamos sin parar', count: 0, color: '#8B5CF6' },
            { emoji: '💬', name: 'Nos decimos todo', count: 2, color: '#10B981' },
          ]}
        />
      </div>

      {/* Leaderboard + Motivational */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MiniLeaderboard currentUserId={profile?.id} />

        <Card className="p-5 flex flex-col justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tu progreso</p>
            <p className="text-lg font-semibold text-foreground">
              Estás a solo <span className="text-primary font-bold">560 puntos</span> de subir de categoría y asegurar tu asiento en la convención.
            </p>
          </div>
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground text-center">
              "Impulsando el éxito comercial a través del reconocimiento, la competencia sana y el crecimiento continuo"
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
