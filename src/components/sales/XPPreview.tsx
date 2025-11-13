import { Card } from '@/components/ui/card';
import { useConfig } from '@/context/ConfigContext';
import { User } from '@/types';

interface XPPreviewProps {
  productId: number | null;
  quantity: number;
  currentUser: User;
  activeMultiplier?: number | null;
}

const XPPreview = ({ productId, quantity, currentUser, activeMultiplier }: XPPreviewProps) => {
  const { products, getLevelByXP, levels } = useConfig();
  
  const product = products.find(p => p.id === productId);
  
  if (!product || quantity <= 0) {
    return (
      <Card className="p-6 bg-muted/20">
        <p className="text-center text-muted-foreground">
          Selecciona un producto y cantidad para ver el XP
        </p>
      </Card>
    );
  }

  const baseXP = product.xp * quantity;
  const multiplier = activeMultiplier || 1;
  const finalXP = baseXP * multiplier;
  
  const currentXP = currentUser.xp || 0;
  const newTotalXP = currentXP + finalXP;
  const currentLevel = getLevelByXP(currentXP);
  const newLevel = getLevelByXP(newTotalXP);
  const nextLevel = levels.find(l => l.minXP > newTotalXP);
  
  const progress = currentLevel ? ((newTotalXP - currentLevel.minXP) / (currentLevel.maxXP - currentLevel.minXP)) * 100 : 0;
  const xpToNextLevel = nextLevel ? nextLevel.minXP - newTotalXP : 0;

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border-2 border-primary/20 shadow-smooth-lg">
      <div className="text-center space-y-4">
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-2">🎯 ESTA VENTA OTORGARÁ:</p>
          <div className="border-t-2 border-b-2 border-primary/30 py-4 my-2">
            <p className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              +{finalXP} XP
            </p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-left bg-card/50 p-4 rounded-lg">
          <p className="font-semibold text-foreground">💡 Cálculo:</p>
          <p className="text-muted-foreground">
            {product.name} ({product.xp} XP) × {quantity} unidades = {baseXP} XP
          </p>
          {multiplier > 1 && (
            <p className="text-accent font-semibold">
              ⚡ Multiplicador x{multiplier} aplicado: {baseXP} × {multiplier} = {finalXP} XP
            </p>
          )}
        </div>

        <div className="space-y-2 text-sm text-left bg-card/50 p-4 rounded-lg">
          <p className="font-semibold text-foreground">📊 Progreso después de esta venta:</p>
          <p className="text-muted-foreground">
            Nivel actual: {currentLevel?.level} ({currentXP} XP)
          </p>
          <p className="text-foreground font-semibold">
            → Nuevo total: {newTotalXP} XP
          </p>
          <p className="text-muted-foreground">
            → Progreso: {newTotalXP}/{currentLevel?.maxXP} ({Math.round(progress)}%)
          </p>
          {xpToNextLevel > 0 && nextLevel && (
            <p className="text-primary font-semibold">
              → Faltan {xpToNextLevel} XP para {nextLevel.level}
            </p>
          )}
          {newLevel && newLevel.level !== currentLevel?.level && (
            <p className="text-accent font-bold text-lg mt-2 animate-pulse">
              🎉 ¡SUBIRÁS DE NIVEL! → {newLevel.level} {newLevel.icon}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default XPPreview;