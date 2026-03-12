import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import siigoLogo from '@/assets/siigo-logo-blue.png';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HeaderProps {
  title: string;
}

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
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
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-5 flex-shrink-0">
      <div className="flex items-center gap-3">
        <img src={siigoLogo} alt="Siigo" className="h-7" />
        <span className="text-sm font-light text-muted-foreground">Arena</span>
        {title && (
          <>
            <span className="text-border mx-1">|</span>
            <span className="text-xs text-muted-foreground font-medium">{title}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Racha */}
        {racha && racha.semanas_consecutivas > 0 && (
          <div className="flex items-center gap-1.5 bg-accent/10 border border-accent/20 rounded-full px-3 py-1.5">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-bold text-accent">×{racha.multiplicador}</span>
            <span className="text-[10px] text-muted-foreground hidden md:inline">{racha.nombre_racha}</span>
          </div>
        )}

        {/* SP */}
        <div className="flex items-center gap-2 border border-border rounded-full px-3 py-1.5">
          <MI icon="stars" className="text-accent text-sm" />
          <span className="text-xs font-bold text-foreground">{(profile?.sp_totales || 0).toLocaleString()} SP</span>
        </div>

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden md:block">
            <p className="text-xs font-semibold text-foreground leading-tight">{profile?.nombre}</p>
            <p className="text-[10px] text-primary font-medium leading-tight">{profile?.nivel}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-lg">
            {profile?.avatar_url || '👤'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
