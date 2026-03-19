import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      <div className="flex items-center gap-3">
        <MI icon="bolt" className="text-xl text-primary" />
        <h1 className="text-lg font-bold font-heading text-secondary">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Racha */}
        {racha && racha.semanas_consecutivas > 0 && (
          <div className="flex items-center gap-2 bg-orange rounded-full px-4 py-2">
            <span className="text-base">🔥</span>
            <span className="text-sm font-bold font-scoreboard text-orange-foreground">×{racha.multiplicador}</span>
            <span className="text-xs text-orange-foreground/80 hidden md:inline font-medium">{racha.nombre_racha}</span>
          </div>
        )}

        {/* Siigo Arena badge */}
        <div className="hidden md:flex items-center gap-2 bg-primary rounded-full px-4 py-2">
          <MI icon="emoji_events" className="text-base text-primary-foreground" />
          <span className="text-xs font-bold text-primary-foreground font-heading">Siigo Arena</span>
        </div>

        {/* Notifications */}
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
          <MI icon="notifications_none" className="text-2xl" />
        </button>
      </div>
    </header>
  );
};

export default Header;
