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
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <MI icon="bolt" className="text-lg text-primary" />
        <h1 className="text-base font-bold font-heading text-secondary">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Racha */}
        {racha && racha.semanas_consecutivas > 0 && (
          <div className="flex items-center gap-1.5 bg-siigo-orange rounded-full px-3 py-1.5">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-bold font-scoreboard text-white">×{racha.multiplicador}</span>
            <span className="text-[11px] text-white/80 hidden md:inline">{racha.nombre_racha}</span>
          </div>
        )}

        {/* Siigo Arena badge */}
        <div className="hidden md:flex items-center gap-1.5 bg-primary rounded-full px-3 py-1.5">
          <MI icon="emoji_events" className="text-sm text-white" />
          <span className="text-[10px] font-bold text-white font-heading">Siigo Arena</span>
        </div>

        {/* Notifications */}
        <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
          <MI icon="notifications_none" className="text-xl" />
        </button>
      </div>
    </header>
  );
};

export default Header;
