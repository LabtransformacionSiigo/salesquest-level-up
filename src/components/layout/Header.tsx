import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import NotificationBell from './NotificationBell';
import ChangePasswordDialog from './ChangePasswordDialog';
import { useSpConvencionAnual } from '@/lib/sp-convencion-store';
import { useSpConvencionAnualSelf } from '@/hooks/useSpConvencionAnualSelf';

const REFERIDOS_LABEL: Record<string, string> = { VN_ALIADOS: 'Ref. Contador', VN_EMPRESARIOS: 'Referidos' };

interface HeaderProps {
  title: string;
}

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-round", className)}>{icon}</span>
);

const Header = ({ title }: HeaderProps) => {
  const { profile } = useSupabaseAuthContext();
  const [racha, setRacha] = useState<any>(null);
  const [vnMetrics, setVnMetrics] = useState<{ unidades: number; referidos: number } | null>(null);
  const isVN = profile?.canal === 'VN_ALIADOS' || profile?.canal === 'VN_EMPRESARIOS';
  const spAnual = useSpConvencionAnual();
  const spAnualSelf = useSpConvencionAnualSelf(profile);
  const spDisplay = spAnual ?? spAnualSelf ?? profile?.sp_totales ?? 0;

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('racha_activa')
      .select('*')
      .eq('gerente_id', profile.id)
      .maybeSingle()
      .then(({ data }) => setRacha(data));

    if (isVN) {
      supabase
        .from('kpis_mes_actual')
        .select('sc_creados, cant_recomendados')
        .eq('gerente_id', profile.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setVnMetrics({ unidades: Number(data.sc_creados) || 0, referidos: Number(data.cant_recomendados) || 0 });
        });
    }
  }, [profile?.id, isVN]);

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-8 flex-shrink-0">
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        key={title}
      >
        <MI icon="bolt" className="text-xl text-primary" />
        <h1 className="text-lg font-bold font-heading text-secondary">{title}</h1>
      </motion.div>

      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
      >
        {racha && racha.semanas_consecutivas > 0 && (
          <motion.div
            className="flex items-center gap-2 bg-orange rounded-full px-4 py-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.3 }}
          >
            <motion.span
              className="text-base"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >🔥</motion.span>
            <span className="text-sm font-bold font-scoreboard text-orange-foreground">×{racha.multiplicador}</span>
            <span className="text-xs text-orange-foreground/80 hidden md:inline font-medium">{racha.nombre_racha}</span>
          </motion.div>
        )}

        {profile?.role !== 'admin' && (
          <motion.div
            className="hidden md:flex items-center gap-3"
            whileHover={{ scale: 1.05 }}
          >
            <div className="flex items-center gap-1.5 bg-primary rounded-full px-3 py-1.5" title="SP Convención · Cumplimiento de meta">
              <MI icon="leaderboard" className="text-sm text-primary-foreground" />
              <span className="text-xs font-bold text-primary-foreground font-scoreboard">{spDisplay.toLocaleString()}</span>
              <span className="text-[10px] text-primary-foreground/70">SP Convención</span>
            </div>
            <div className="flex items-center gap-1.5 bg-accent rounded-full px-3 py-1.5" title="SP Canje · Medallas, retos y reconocimientos">
              <MI icon="redeem" className="text-sm text-accent-foreground" />
              <span className="text-xs font-bold text-accent-foreground font-scoreboard">{(profile?.sp_canje || 0).toLocaleString()}</span>
              <span className="text-[10px] text-accent-foreground/70">SP Canje</span>
            </div>
            {isVN && vnMetrics && (
              <>
                <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 border border-border" title="Unidades vendidas este mes">
                  <MI icon="inventory_2" className="text-sm text-foreground" />
                  <span className="text-xs font-bold text-foreground font-scoreboard">{vnMetrics.unidades}</span>
                  <span className="text-[10px] text-muted-foreground">Uds</span>
                </div>
                <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1.5 border border-border" title={REFERIDOS_LABEL[profile?.canal || ''] || 'Referidos'}>
                  <MI icon="group_add" className="text-sm text-foreground" />
                  <span className="text-xs font-bold text-foreground font-scoreboard">{vnMetrics.referidos}</span>
                  <span className="text-[10px] text-muted-foreground">{REFERIDOS_LABEL[profile?.canal || ''] || 'Ref.'}</span>
                </div>
              </>
            )}
          </motion.div>
        )}

        {profile?.role === 'admin' && (
          <motion.div
            className="hidden md:flex items-center gap-2 bg-primary rounded-full px-4 py-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
          >
            <MI icon="emoji_events" className="text-base text-primary-foreground" />
            <span className="text-xs font-bold text-primary-foreground font-heading">Siigo Arena</span>
          </motion.div>
        )}

        <NotificationBell />
        <ChangePasswordDialog />
      </motion.div>
    </header>
  );
};

export default Header;
