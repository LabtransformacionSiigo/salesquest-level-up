import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useConfig } from '@/context/ConfigContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import HeroJourneyLevels from '@/components/hero-journey/HeroJourneyLevels';
import HeroJourneyBadges from '@/components/hero-journey/HeroJourneyBadges';
import HeroJourneyPoints from '@/components/hero-journey/HeroJourneyPoints';
import HeroJourneyObjectives from '@/components/hero-journey/HeroJourneyObjectives';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const HeroJourney = () => {
  const { isAuthenticated, profile } = useSupabaseAuthContext();
  const { getLevelByXP } = useConfig();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const currentXP = profile?.xp || 0;
  const currentLevel = getLevelByXP(currentXP);

  return (
    <Layout title="Siigo Hero Academy">
      <div className="max-w-5xl mx-auto space-y-8 pb-10">

        {/* Hero Title */}
        <div className="text-center space-y-2 pt-2">
          <h1 className="text-3xl md:text-4xl font-extrabold">
            <span className="text-gradient-siigo">La Ruta del Héroe Comercial</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Tu camino de crecimiento profesional con gamificación. Cada acción suma puntos, desbloquea niveles y te acerca a la maestría comercial.
          </p>
        </div>

        {/* Levels */}
        <HeroJourneyLevels currentLevel={currentLevel} />

        {/* Badges */}
        <HeroJourneyBadges />

        {/* Points + Objectives side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HeroJourneyPoints />
          <HeroJourneyObjectives />
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn(
                "w-2 h-2 rounded-full",
                i === 0 ? "bg-primary" : "bg-border"
              )} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <MI icon="emoji_events" className="text-accent text-sm align-middle mr-1" />
            Siigo Sales Gamification Engine © 2025
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default HeroJourney;
