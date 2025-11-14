import { User, Medal, Sale } from '@/types';

export interface EvaluationContext {
  sales?: Sale[];
  allUsers?: User[];
  currentMonth?: Date;
}

export function evaluateMedalCriteria(
  user: User,
  medal: Medal,
  context: EvaluationContext
): { meets: boolean; progress?: { current: number; required: number; percentage: number } } {
  const { sales = [], allUsers = [], currentMonth = new Date() } = context;

  // Check if user already has this medal (if not repeatable)
  if (!medal.repeatable && user.medals?.some(m => m.medalId === medal.id)) {
    return { meets: false };
  }

  const userSales = sales.filter(s => s.userId === user.id);
  const currentMonthSales = userSales.filter(s => {
    const saleDate = new Date(s.date);
    return saleDate.getMonth() === currentMonth.getMonth() && 
           saleDate.getFullYear() === currentMonth.getFullYear();
  });

  switch (medal.criteria) {
    case 'PRIMERA_VENTA':
      return { meets: userSales.length >= 1 };

    case 'VENTAS_MES_X': {
      const required = medal.criteriaParams?.count || 10;
      const current = currentMonthSales.length;
      return {
        meets: current >= required,
        progress: {
          current,
          required,
          percentage: Math.min(100, (current / required) * 100)
        }
      };
    }

    case 'PRODUCTO_ESPECIFICO_X': {
      const productName = medal.criteriaParams?.product;
      const required = medal.criteriaParams?.count || 5;
      const current = userSales.filter(s => s.productName === productName).length;
      return {
        meets: current >= required,
        progress: {
          current,
          required,
          percentage: Math.min(100, (current / required) * 100)
        }
      };
    }

    case 'VENTA_ALTA_VALOR':
      return { meets: userSales.some(s => s.xpEarned > 10) };

    case 'XP_TOTAL_X': {
      const required = medal.criteriaParams?.xp || 1000;
      const current = user.xp || 0;
      return {
        meets: current >= required,
        progress: {
          current,
          required,
          percentage: Math.min(100, (current / required) * 100)
        }
      };
    }

    case 'NIVEL_ALCANZADO': {
      const requiredLevel = medal.criteriaParams?.level;
      return { meets: user.level === requiredLevel };
    }

    case 'XP_MES_X': {
      const required = medal.criteriaParams?.xp || 500;
      const current = currentMonthSales.reduce((sum, s) => sum + s.xpEarned, 0);
      return {
        meets: current >= required,
        progress: {
          current,
          required,
          percentage: Math.min(100, (current / required) * 100)
        }
      };
    }

    case 'RACHA_SEMANAS_X': {
      const required = medal.criteriaParams?.weeks || 4;
      const current = user.streak || 0;
      return {
        meets: current >= required,
        progress: {
          current,
          required,
          percentage: Math.min(100, (current / required) * 100)
        }
      };
    }

    case 'TOP_VENDEDOR_MES': {
      if (!user.cellId) return { meets: false };
      
      const cellUsers = allUsers.filter(u => u.cellId === user.cellId);
      const rankings = cellUsers.map(u => ({
        userId: u.id,
        xp: sales
          .filter(s => s.userId === u.id)
          .filter(s => {
            const saleDate = new Date(s.date);
            return saleDate.getMonth() === currentMonth.getMonth() && 
                   saleDate.getFullYear() === currentMonth.getFullYear();
          })
          .reduce((sum, s) => sum + s.xpEarned, 0)
      })).sort((a, b) => b.xp - a.xp);

      const userRank = rankings.findIndex(r => r.userId === user.id) + 1;
      return { meets: userRank === 1 };
    }

    case 'TOP_3_VENDEDOR_MES': {
      if (!user.cellId) return { meets: false };
      
      const cellUsers = allUsers.filter(u => u.cellId === user.cellId);
      const rankings = cellUsers.map(u => ({
        userId: u.id,
        xp: sales
          .filter(s => s.userId === u.id)
          .filter(s => {
            const saleDate = new Date(s.date);
            return saleDate.getMonth() === currentMonth.getMonth() && 
                   saleDate.getFullYear() === currentMonth.getFullYear();
          })
          .reduce((sum, s) => sum + s.xpEarned, 0)
      })).sort((a, b) => b.xp - a.xp);

      const userRank = rankings.findIndex(r => r.userId === user.id) + 1;
      return { meets: userRank <= 3 && userRank > 0 };
    }

    default:
      return { meets: false };
  }
}

export function getMedalRarityColor(rarity?: string): string {
  switch (rarity) {
    case 'legendaria':
      return 'border-yellow-400 shadow-yellow-400/50';
    case 'épica':
      return 'border-purple-500 shadow-purple-500/50';
    case 'rara':
      return 'border-blue-500 shadow-blue-500/50';
    case 'poco común':
      return 'border-green-500 shadow-green-500/50';
    default:
      return 'border-border';
  }
}

export function getMedalRarityBadge(rarity?: string): string {
  switch (rarity) {
    case 'legendaria':
      return '✨ Legendaria';
    case 'épica':
      return '💎 Épica';
    case 'rara':
      return '🔷 Rara';
    case 'poco común':
      return '🟢 Poco Común';
    default:
      return '⚪ Común';
  }
}
