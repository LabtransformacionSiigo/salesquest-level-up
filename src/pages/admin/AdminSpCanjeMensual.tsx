import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import SpCanjeMensual from '@/components/admin/SpCanjeMensual';
import { isVnChannel, pickVnLeaderCandidate, normalizeVnLeaderText } from '@/lib/vn-leaders';

const opToCanal = (op: string): string | null =>
  op === 'Venta Cruzada' ? 'VC'
  : op === 'Venta Nueva (Aliados)' ? 'VN_ALIADOS'
  : op === 'Venta Nueva (Empresarios)' ? 'VN_EMPRESARIOS'
  : null;

/**
 * Página dedicada: SP Canje mensual.
 * Admin ve todos los gerentes; especialista ve sólo los de sus países + operaciones asignadas.
 */
const AdminSpCanjeMensual = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const isAdmin = profile?.role === 'admin';
  const isEspecialista = profile?.role === 'especialista';

  useEffect(() => {
    if (!isAuthenticated || !profile) return;
    if (!isAdmin && !isEspecialista) return;

    (async () => {
      setLoadingData(true);
      let paises: string[] = [];
      let canales: string[] = [];

      if (!isAdmin) {
        const { data: perm } = await supabase
          .from('especialista_permisos')
          .select('paises, operaciones')
          .eq('user_id', profile.user_id || (profile as any).id)
          .maybeSingle();
        paises = perm?.paises || [];
        canales = ((perm?.operaciones || []) as string[]).map(opToCanal).filter(Boolean) as string[];
      }

      let q = supabase
        .from('gerentes')
        .select('id, nombre, email, canal, pais, celula, user_id, sp_canje, sp_convencion')
        .eq('activo', true)
        .order('nombre');
      if (!isAdmin) {
        if (paises.length) q = q.in('pais', paises);
        if (canales.length) q = q.in('canal', canales);
      }
      const { data } = await q;
      const rows = data || [];
      const nonVn = rows.filter((g: any) => !isVnChannel(g.canal));
      const vnByCelula = new Map<string, any[]>();
      rows.filter((g: any) => isVnChannel(g.canal) && g.celula).forEach((g: any) => {
        const key = `${normalizeVnLeaderText(g.pais)}|${g.canal}|${normalizeVnLeaderText(g.celula)}`;
        vnByCelula.set(key, [...(vnByCelula.get(key) || []), g]);
      });
      const vnLeaders = [...vnByCelula.values()]
        .map((members) => pickVnLeaderCandidate(members, { celula: members[0]?.celula }))
        .filter(Boolean);
      setGerentes([...nonVn, ...vnLeaders]);
      setLoadingData(false);
    })();
  }, [isAuthenticated, profile?.id, isAdmin, isEspecialista]);

  if (loading) return <Layout title="SP Canje mensual"><Skeleton className="h-96" /></Layout>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin && !isEspecialista) return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="SP Canje mensual">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="border border-border rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 p-5">
          <h2 className="text-xl font-bold text-secondary flex items-center gap-2">
            💰 SP Canje · vista mensual
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tabla por gerente con desglose mes a mes y por fuente (medallas, retos, reconocimientos).
            {!isAdmin && ' Sólo verás gerentes dentro de tus países y operaciones asignadas.'}
          </p>
        </div>
        {loadingData ? <Skeleton className="h-96" /> : <SpCanjeMensual gerentes={gerentes} isAdmin={isAdmin} />}
      </div>
    </Layout>
  );
};

export default AdminSpCanjeMensual;
