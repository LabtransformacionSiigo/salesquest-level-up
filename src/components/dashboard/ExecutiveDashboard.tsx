import { useState, useEffect } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig, Level } from '@/context/ConfigContext';
import { useSales } from '@/context/SalesContext';
import { Card } from '@/components/ui/card';
import LevelProgressRoad from './LevelProgressRoad';
import StatsCards from './StatsCards';
import MiniLeaderboard from './MiniLeaderboard';
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

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Leaderboard */}
        <MiniLeaderboard currentUserId={profile?.id} />

        {/* Motivational card */}
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
