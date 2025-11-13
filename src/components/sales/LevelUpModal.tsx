import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Level } from '@/context/ConfigContext';

interface LevelUpModalProps {
  open: boolean;
  onClose: () => void;
  oldLevel: Level;
  newLevel: Level;
}

const LevelUpModal = ({ open, onClose, oldLevel, newLevel }: LevelUpModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <div className="relative overflow-hidden">
          {/* Confetti effect with CSS */}
          <div className="confetti-container absolute inset-0 pointer-events-none">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  backgroundColor: ['#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#10B981'][Math.floor(Math.random() * 5)]
                }}
              />
            ))}
          </div>

          <div className="relative z-10 text-center space-y-6 py-8">
            <DialogTitle className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent animate-pulse">
              🎉 ¡SUBISTE DE NIVEL! 🎉
            </DialogTitle>

            {/* Level transition */}
            <div className="flex items-center justify-center gap-6">
              <div className="text-center space-y-2">
                <div className="text-6xl">{oldLevel.icon}</div>
                <p className="font-semibold text-muted-foreground">{oldLevel.level}</p>
              </div>
              
              <div className="text-4xl text-primary animate-bounce">→</div>
              
              <div className="text-center space-y-2">
                <div className="text-8xl animate-scale-in">{newLevel.icon}</div>
                <p className="font-bold text-2xl text-foreground">{newLevel.level}</p>
              </div>
            </div>

            {/* Motivational message */}
            <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 p-6 rounded-xl">
              <p className="text-lg font-semibold text-foreground mb-2">
                ¡Increíble progreso!
              </p>
              <p className="text-muted-foreground">
                Has alcanzado el nivel <span className="text-foreground font-bold">{newLevel.level}</span>.
                Sigue así y llegarás aún más lejos. 🚀
              </p>
            </div>

            <Button
              onClick={onClose}
              size="lg"
              className="w-full font-bold text-lg"
            >
              ¡Genial! 🎊
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LevelUpModal;