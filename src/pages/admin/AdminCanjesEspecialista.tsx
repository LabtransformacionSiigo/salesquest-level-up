import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const PAISES_LABEL: Record<string, string> = { COL: 'Colombia', ECU: 'Ecuador', URU: 'Uruguay', MEX: 'México' };
const OPERACIONES_ALL = ['Venta Cruzada', 'Venta Nueva (Empresarios)', 'Venta Nueva (Aliados)'];

const CANAL_TO_OP: Record<string, string> = {
  VC: 'Venta Cruzada',
  VN_ALIADOS: 'Venta Nueva (Aliados)',
  VN_EMPRESARIOS: 'Venta Nueva (Empresarios)',
};

interface Row {
  id: string;
  fecha_canje: string;
  puntos_gastados: number;
  estado: string;
  premio: { nombre: string | null; pais: string | null; operacion: string | null } | null;
  gerente: { id: string; nombre: string | null; email: string | null; canal: string | null; pais: string | null; sp_canje: number | null } | null;
}

const AdminCanjesEspecialista = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [rows, setRows] = useState<Row[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [scopePaises, setScopePaises] = useState<string[]>([]);
  const [scopeOps, setScopeOps] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const isAdmin = profile?.role === 'admin';
  const isEspecialista = profile?.role === 'especialista';

  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isEspecialista)) return;
    (async () => {
      setDataLoading(true);

      // Cargar scope
      let paises: string[] = ['COL', 'ECU', 'URU', 'MEX'];
      let ops: string[] = OPERACIONES_ALL;
      if (isEspecialista && profile?.user_id) {
        const { data } = await supabase
          .from('especialista_permisos')
          .select('paises, operaciones')
          .eq('user_id', profile.user_id)
          .maybeSingle();
        paises = (data as any)?.paises || [];
        ops = (data as any)?.operaciones || [];
      }
      setScopePaises(paises);
      setScopeOps(ops);

      // Traer canjes con joins
      const { data: canjes } = await supabase
        .from('canjes')
        .select('id, fecha_canje, puntos_gastados, estado, premio:premio_id(nombre, pais, operacion)')
        .order('fecha_canje', { ascending: false })
        .limit(500);

      // Resolver gerente/asesor por separado (canjes.gerente_id puede apuntar a cualquiera)
      const ids = Array.from(new Set((canjes || []).map((c: any) => c.gerente_id || c.id))).filter(Boolean);
      // Necesitamos gerente_id real; re-fetch incluyéndolo
      const { data: canjesFull } = await supabase
        .from('canjes')
        .select('id, gerente_id, fecha_canje, puntos_gastados, estado, premio:premio_id(nombre, pais, operacion)')
        .order('fecha_canje', { ascending: false })
        .limit(500);

      const personIds = Array.from(new Set((canjesFull || []).map((c: any) => c.gerente_id))).filter(Boolean);
      const [{ data: gers }, { data: ases }] = await Promise.all([
        supabase.from('gerentes').select('id, nombre, email, canal, pais, sp_canje').in('id', personIds.length ? personIds : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('asesores').select('id, nombre, email, canal, pais, sp_canje').in('id', personIds.length ? personIds : ['00000000-0000-0000-0000-000000000000']),
      ]);
      const personMap = new Map<string, any>();
      (gers || []).forEach((g: any) => personMap.set(g.id, g));
      (ases || []).forEach((a: any) => { if (!personMap.has(a.id)) personMap.set(a.id, a); });

      const mapped: Row[] = (canjesFull || []).map((c: any) => ({
        id: c.id,
        fecha_canje: c.fecha_canje,
        puntos_gastados: c.puntos_gastados,
        estado: c.estado,
        premio: c.premio,
        gerente: personMap.get(c.gerente_id) || null,
      }));
      setRows(mapped);
      setDataLoading(false);
    })();
  }, [isAuthenticated, isAdmin, isEspecialista, profile?.user_id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const g = r.gerente;
      if (!g) return false;
      if (!isAdmin) {
        const opGer = CANAL_TO_OP[g.canal || ''] || '';
        if (!scopePaises.includes(g.pais || '')) return false;
        if (opGer && !scopeOps.includes(opGer)) return false;
      }
      if (!q) return true;
      return (
        (g.nombre || '').toLowerCase().includes(q) ||
        (g.email || '').toLowerCase().includes(q) ||
        (r.premio?.nombre || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, scopePaises, scopeOps, isAdmin]);

  // Resumen por gerente
  const resumen = useMemo(() => {
    const map = new Map<string, { gerente: any; total_canjes: number; total_sp_gastado: number; saldo: number }>();
    filtered.forEach((r) => {
      if (!r.gerente) return;
      const cur = map.get(r.gerente.id) || { gerente: r.gerente, total_canjes: 0, total_sp_gastado: 0, saldo: r.gerente.sp_canje || 0 };
      cur.total_canjes += 1;
      cur.total_sp_gastado += r.puntos_gastados;
      cur.saldo = r.gerente.sp_canje || 0;
      map.set(r.gerente.id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total_sp_gastado - a.total_sp_gastado);
  }, [filtered]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin && !isEspecialista) return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="🎁 Canjes en tu alcance">
      <div className="space-y-6">
        {/* Scope banner */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-border rounded-2xl p-5">
          <h2 className="text-lg font-bold text-foreground mb-1">Canjes de gerentes</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {isAdmin
              ? 'Acceso total: verás todos los canjes de todos los gerentes.'
              : 'Solo ves canjes de gerentes dentro de tu alcance (país + operación).'}
          </p>
          {!isAdmin && (
            <div className="flex flex-wrap gap-2">
              {scopePaises.map((p) => (
                <span key={p} className="text-xs font-semibold bg-primary/15 text-primary px-2.5 py-1 rounded-full">
                  {PAISES_LABEL[p] || p}
                </span>
              ))}
              {scopeOps.map((o) => (
                <span key={o} className="text-xs font-semibold bg-accent/15 text-accent px-2.5 py-1 rounded-full">
                  {o}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Resumen por gerente */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">Resumen por gerente</h3>
          {dataLoading ? (
            <Skeleton className="h-32" />
          ) : resumen.length === 0 ? (
            <div className="text-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
              Aún no hay canjes en tu alcance.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {resumen.map((r) => (
                <div key={r.gerente.id} className="bg-card border border-border rounded-xl p-4">
                  <p className="text-sm font-bold text-foreground truncate">{r.gerente.nombre}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.gerente.email}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {r.gerente.canal?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-semibold bg-muted text-foreground/70 px-2 py-0.5 rounded-full">
                      {PAISES_LABEL[r.gerente.pais || ''] || r.gerente.pais}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Canjes</p>
                      <p className="text-base font-bold text-foreground">{r.total_canjes}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">SP gastado</p>
                      <p className="text-base font-bold text-orange">{r.total_sp_gastado}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Saldo</p>
                      <p className="text-base font-bold text-accent">{r.saldo}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detalle */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Detalle de canjes</h3>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por gerente o premio…"
              className="max-w-xs h-9 text-xs"
            />
          </div>
          {dataLoading ? (
            <Skeleton className="h-64" />
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
              Sin resultados.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1.5fr_1.5fr_1fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-3 bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>Gerente</span>
                <span>Premio</span>
                <span>Alcance</span>
                <span className="text-right">SP gastado</span>
                <span className="text-right">Saldo</span>
                <span>Fecha</span>
              </div>
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    'grid grid-cols-[1.5fr_1.5fr_1fr_0.8fr_0.8fr_1fr] gap-3 px-4 py-3 border-t border-border text-xs items-center',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{r.gerente?.nombre || '—'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.gerente?.email}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{r.premio?.nombre || '—'}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{r.estado}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                      {PAISES_LABEL[r.gerente?.pais || ''] || r.gerente?.pais}
                    </span>
                    <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                      {r.gerente?.canal?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-right font-bold text-orange">{r.puntos_gastados}</p>
                  <p className="text-right font-bold text-accent">{r.gerente?.sp_canje ?? '—'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(r.fecha_canje), { addSuffix: true, locale: es })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminCanjesEspecialista;
