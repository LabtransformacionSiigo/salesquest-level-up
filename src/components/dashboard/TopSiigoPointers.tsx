import { motion } from 'framer-motion';
import { fadeUpItem } from '@/lib/animations';
import { Skeleton } from '@/components/ui/skeleton';

interface TopSiigoPointersProps {
  canal: string | null;
  loading: boolean;
  isVC?: boolean;
  topRanking?: any[];
}

const BADGE_COLORS = ['bg-primary', 'bg-muted-foreground', 'bg-orange'];

const TopSiigoPointers = ({ loading, topRanking = [] }: TopSiigoPointersProps) => {
  return (
    <motion.div className="bg-card border border-border rounded-2xl p-8 shadow-smooth-sm" variants={fadeUpItem}>
      <h3 className="text-base font-bold font-heading text-secondary mb-1 flex items-center gap-2">
        <span className="text-primary">🏆</span> Top Siigo Points
      </h3>
      <p className="text-xs text-muted-foreground mb-5">Clasificación por cumplimiento de meta con saldo canjeable visible</p>
      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : topRanking.length > 0 ? (
        <div className="space-y-4">
          {topRanking.map((user, i) => (
            <div key={user.id || i} className="flex items-center gap-4">
              <span className={`w-10 h-10 rounded-lg ${BADGE_COLORS[i] || 'bg-muted'} text-primary-foreground flex items-center justify-center text-sm font-black font-heading`}>
                #{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-foreground truncate block">{user.nombre}</span>
                {user.nivel && <span className="text-[11px] text-muted-foreground">{user.nivel}</span>}
              </div>
              <div className="ml-auto flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold border border-border rounded-full px-4 py-1.5 text-primary font-scoreboard">
                  ⚡ {(user.sp_totales || 0).toLocaleString()} <span className="text-[10px] text-primary/60">Siigo Points</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold border border-border rounded-full px-3 py-1 text-accent font-scoreboard">
                  🎁 {(user.sp_canje || 0).toLocaleString()} <span className="text-[10px] text-accent/70">SP Canje</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-base text-muted-foreground text-center py-6">Sin datos</p>
      )}
    </motion.div>
  );
};

export default TopSiigoPointers;
