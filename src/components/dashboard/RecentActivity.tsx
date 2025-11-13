import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sale } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

interface RecentActivityProps {
  sales: Sale[];
}

const RecentActivity = ({ sales }: RecentActivityProps) => {
  if (sales.length === 0) {
    return (
      <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-primary-foreground" />
          </div>
          <h3 className="text-xl font-bold">📈 Actividad Reciente</h3>
        </div>
        <p className="text-center text-muted-foreground py-8">
          No hay ventas registradas aún
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all border-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-primary-foreground" />
        </div>
        <h3 className="text-xl font-bold">📈 Actividad Reciente</h3>
      </div>
      
      <div className="space-y-3">
        {sales.map((sale) => (
          <div
            key={sale.id}
            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors animate-fade-in"
          >
            <div className="flex-1">
              <p className="font-semibold text-sm">{sale.productName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(sale.createdAt, { addSuffix: true, locale: es })}
              </p>
            </div>
            <Badge variant={sale.multiplierApplied ? "default" : "secondary"}>
              +{sale.xpEarned} XP {sale.multiplierApplied && '⚡'}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default RecentActivity;