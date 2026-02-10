import { Card } from '@/components/ui/card';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecognitionItem {
  emoji: string;
  name: string;
  count: number;
  color: string;
}

interface RecognitionsGridProps {
  total: number;
  recognitions: RecognitionItem[];
}

const RecognitionsGrid = ({ total, recognitions }: RecognitionsGridProps) => {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">Mis Reconocimientos</h3>
          <span className="text-sm text-muted-foreground">Total: {total}</span>
        </div>
        <Heart className="w-5 h-5 text-destructive" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {recognitions.map((rec, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all",
              rec.count > 0
                ? "bg-card border-border hover:shadow-smooth-sm"
                : "bg-muted/30 border-border opacity-60"
            )}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
              style={{ backgroundColor: `${rec.color}15` }}
            >
              {rec.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{rec.name}</p>
              <p className="text-lg font-bold" style={{ color: rec.color }}>
                x{rec.count}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default RecognitionsGrid;
