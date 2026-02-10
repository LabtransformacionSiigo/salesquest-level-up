import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MI = ({ icon, className, style }: { icon: string; className?: string; style?: React.CSSProperties }) => (
  <span className={cn("material-icons-outlined", className)} style={style}>{icon}</span>
);

interface RecognitionItem {
  icon: string;
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
        <MI icon="volunteer_activism" className="text-destructive text-xl" />
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
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${rec.color}15` }}
            >
              <MI icon={rec.icon} className="text-lg" style={{ color: rec.color }} />
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
