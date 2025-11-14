import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Medal } from '@/types';
import { getMedalRarityBadge } from '@/utils/medalEvaluator';
import { Sparkles } from 'lucide-react';

interface MedalUnlockedModalProps {
  open: boolean;
  onClose: () => void;
  medal: Medal;
  xpEarned: number;
  xpBefore: number;
  xpAfter: number;
  levelBefore?: string;
  levelAfter?: string;
}

const MedalUnlockedModal = ({
  open,
  onClose,
  medal,
  xpEarned,
  xpBefore,
  xpAfter,
  levelBefore,
  levelAfter
}: MedalUnlockedModalProps) => {
  const leveledUp = levelBefore !== levelAfter;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className="relative overflow-hidden">
          {/* Confetti animation */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="confetti-container">
              {[...Array(30)].map((_, i) => (
                <div
                  key={i}
                  className="confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    backgroundColor: ['#FFD700', '#FFA500', '#FF6347', '#87CEEB'][Math.floor(Math.random() * 4)]
                  }}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 text-center py-6">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-yellow-500 animate-pulse" />
            
            <div className="medal-showcase mb-6">
              <div className="text-8xl animate-bounce-slow">
                {medal.icon}
              </div>
            </div>

            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-2">
              ¡MEDALLA DESBLOQUEADA!
            </h1>

            <h2 className="text-2xl font-bold text-foreground mt-4 mb-2">
              {medal.name}
            </h2>

            <p className="text-muted-foreground mb-2">
              {medal.description}
            </p>

            {medal.rarity && (
              <Badge variant="outline" className="mb-6">
                {getMedalRarityBadge(medal.rarity)}
              </Badge>
            )}

            <div className="flex gap-4 justify-center my-6">
              <Badge className="px-6 py-3 text-lg bg-gradient-to-r from-primary to-secondary">
                💎 +{xpEarned} XP
              </Badge>
              
              {medal.givesStreakSaver && (
                <Badge className="px-6 py-3 text-lg bg-gradient-to-r from-accent to-primary">
                  🛡️ +1 Recuperador
                </Badge>
              )}
            </div>

            {/* Progress Impact */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-2">Impacto en tu progreso</p>
              <div className="flex items-center justify-center gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{xpBefore}</p>
                  <p className="text-xs text-muted-foreground">XP antes</p>
                </div>
                <span className="text-2xl">→</span>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{xpAfter}</p>
                  <p className="text-xs text-muted-foreground">XP ahora</p>
                </div>
              </div>
              
              {leveledUp && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-sm font-semibold text-primary">
                    ¡También subiste de nivel: {levelBefore} → {levelAfter}! 🎉
                  </p>
                </div>
              )}
            </div>

            <Button size="lg" onClick={onClose} className="w-full">
              ¡Genial! 🎉
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MedalUnlockedModal;
