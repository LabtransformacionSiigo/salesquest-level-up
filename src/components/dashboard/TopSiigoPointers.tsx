import { motion } from 'framer-motion';
import { fadeUpItem } from '@/lib/animations';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TopSiigoPointersProps {
  canal: string | null;
  loading: boolean;
}

const BADGE_COLORS = ['bg-primary', 'bg-muted-foreground', 'bg-orange'];

const TopSiigoPointers = ({ canal, loading }: TopSiigoPointersProps) => {
  const [top3, setTop3] = useState<any[]>([]);

  useEffect(() => {
    if (!canal) return;
    supabase
      .from('ranking_general')
      .select('*')
      .eq('canal', canal)
      .order('sp_totales', { ascending: false })
      .limit(3)
      .then(({ data }) => setTop3(data || []));
  }, [canal]);

  return (
    <motion.div className="bg-card border border-border rounded-2xl p-8 shadow-smooth-sm" variants={fadeUpItem}>
      <h3 className="text-base font-bold font-heading text-secondary mb-5 flex items-center gap-2">
        <span className="text-primary">🏆</span> Top Siigo Pointers
      </h3>
      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : top3.length > 0 ? (
        <div className="space-y-4">
          {top3.map((user, i) => (
            <div key={user.id || i} className="flex items-center gap-4">
              <span className={`w-10 h-10 rounded-lg ${BADGE_COLORS[i] || 'bg-muted'} text-primary-foreground flex items-center justify-center text-sm font-black font-heading`}>
                #{i + 1}
              </span>
              <span className="flex-1 text-sm font-semibold text-foreground truncate">{user.nombre}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold border border-border rounded-full px-4 py-1.5 text-primary">
                🏆 {(user.sp_totales || 0).toLocaleString()} SP
              </span>
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
