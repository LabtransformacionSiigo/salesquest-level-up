import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const CANALES = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'VN_EMPRESARIOS', label: 'Empresarios' },
  { value: 'VN_ALIADOS', label: 'Aliados' },
  { value: 'VC', label: 'Venta Cruzada' },
];

const PAISES = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'COL', label: '🇨🇴 COL' },
  { value: 'MEX', label: '🇲🇽 MEX' },
  { value: 'ECU', label: '🇪🇨 ECU' },
];

const Rankings = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [ranking, setRanking] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [canal, setCanal] = useState('TODOS');
  const [pais, setPais] = useState('TODOS');

  const fetchRanking = async () => {
    if (!profile?.canal) return;
    let query = supabase.from('ranking_general').select('*').eq('canal', profile.canal);
    if (pais !== 'TODOS') query = query.eq('pais', pais);
    const { data } = await query;
    setRanking(data || []);
    setDataLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated || !profile?.canal) return;
    fetchRanking();
    const channel = supabase
      .channel('ranking-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sp_acumulados' }, () => fetchRanking())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, profile?.canal, pais]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const sorted = [...ranking].sort((a, b) => (b.sp_totales || 0) - (a.sp_totales || 0));
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const podiumColors = ['bg-accent/20 border-accent', 'bg-muted border-muted-foreground/20', 'bg-orange/10 border-orange/30'];
  const podiumIcons = ['👑', '🥈', '🥉'];

  return (
    <Layout title="Ranking">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {CANALES.map(c => (
            <button key={c.value} onClick={() => setCanal(c.value)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                canal === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
              {c.label}
            </button>
          ))}
          <div className="w-px bg-border mx-1" />
          {PAISES.map(p => (
            <button key={p.value} onClick={() => setPais(p.value)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                pais === p.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
              {p.label}
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}</div>
          </div>
        ) : (
          <>
            {top3.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3.map((g, i) => (
                  <div key={g.id} className={cn("rounded-2xl border p-6 text-center", podiumColors[i],
                    g.user_id === profile?.user_id && "ring-2 ring-primary")}>
                    <p className="text-3xl mb-2">{podiumIcons[i]}</p>
                    <div className="w-14 h-14 rounded-full bg-muted mx-auto flex items-center justify-center text-2xl mb-2">{g.avatar_url || '👤'}</div>
                    <p className="font-bold text-foreground">{g.nombre}</p>
                    <p className="text-xs text-muted-foreground">{g.canal?.replace(/_/g, ' ')} · {g.pais}</p>
                    <p className="text-2xl font-bold text-primary mt-2">{(g.sp_totales || 0).toLocaleString()} SP</p>
                    <span className="inline-block mt-1 text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{g.nivel}</span>
                  </div>
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Gerente</th>
                      <th className="text-left px-4 py-3">Canal</th>
                      <th className="text-right px-4 py-3">SP</th>
                      <th className="text-left px-4 py-3">Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((g, i) => (
                      <tr key={g.id} className={cn("border-b border-border/50 hover:bg-muted/30",
                        g.user_id === profile?.user_id && "bg-primary/5 font-semibold")}>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{i + 4}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{g.avatar_url || '👤'}</span>
                            <span className="text-sm text-foreground">{g.nombre}</span>
                            {g.user_id === profile?.user_id && <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Tú</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{g.canal?.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-sm font-bold text-foreground text-right">{(g.sp_totales || 0).toLocaleString()}</td>
                        <td className="px-4 py-3"><span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{g.nivel}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {sorted.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <MI icon="leaderboard" className="text-5xl mb-3" />
                <p>No hay datos de ranking aún</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Rankings;
