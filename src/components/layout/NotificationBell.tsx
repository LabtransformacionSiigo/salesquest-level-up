import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  created_at: string;
}

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-round", className)}>{icon}</span>
);

const NotificationBell = () => {
  const { profile } = useSupabaseAuthContext();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  useEffect(() => {
    if (!profile?.id) return;

    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('gerente_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setNotificaciones(data as unknown as Notificacion[]);
    };

    fetchNotifs();

    // Realtime subscription
    const channel = supabase
      .channel('notificaciones-' + profile.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `gerente_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotificaciones(prev => [payload.new as unknown as Notificacion, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    if (!profile?.id || unreadCount === 0) return;
    const unreadIds = notificaciones.filter(n => !n.leida).map(n => n.id);
    await supabase
      .from('notificaciones')
      .update({ leida: true } as any)
      .in('id', unreadIds);
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
  };

  const iconForTipo = (tipo: string) => {
    switch (tipo) {
      case 'medalla': return '🏅';
      case 'nivel_up': return '🚀';
      default: return '🔔';
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open && unreadCount > 0) markAllRead(); }}
        className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors relative"
      >
        <MI icon="notifications_none" className="text-2xl" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-bold text-sm text-foreground">Notificaciones</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Marcar todo como leído
              </button>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {notificaciones.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                No tienes notificaciones
              </div>
            ) : (
              notificaciones.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-border/50 last:border-0 flex gap-3 items-start transition-colors",
                    !n.leida && "bg-primary/5"
                  )}
                >
                  <span className="text-xl mt-0.5">{iconForTipo(n.tipo)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{n.titulo}</p>
                    {n.mensaje && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensaje}</p>}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  {!n.leida && <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
