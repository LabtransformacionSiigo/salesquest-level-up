import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  title: string;
}

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-round", className)}>{icon}</span>
);

const Header = ({ title }: HeaderProps) => {
  const { profile } = useSupabaseAuthContext();
  const [racha, setRacha] = useState<any>(null);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('racha_activa')
      .select('*')
      .eq('gerente_id', profile.id)
      .maybeSingle()
      .then(({ data }) => setRacha(data));
  }, [profile?.id]);

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

        <motion.div
          className="hidden md:flex items-center gap-2 bg-primary rounded-full px-4 py-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          <MI icon="emoji_events" className="text-base text-primary-foreground" />
          <span className="text-xs font-bold text-primary-foreground font-heading">Siigo Arena</span>
        </motion.div>

        <NotificationBell />
      </motion.div>
    </header>
  );
};

export default Header;
