import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SpRow {
  id?: string;
  fuente: string;
  sp: number;
  periodo: string;
  detalle: string | null;
  created_at?: string;
}

interface CanjeRow {
  id: string;
  premio_nombre: string | null;
  puntos_gastados: number;
  fecha_canje: string;
  estado: string;
}

interface RetoAsignado {
  id: string;
  nombre: string;
  tipo: string; // DIARIO | SEMANAL | MENSUAL
  sp_total: number;
  fuente: 'VC' | 'VN';
  ganados: number; // veces que aparece en retos_completados este mes
  sp_ganado: number;
  emoji?: string;
  familia?: string | null;
  kpi?: string | null;
}


const FUENTE_META: Record<string, { label: string; icon: string; color: string }> = {
  RETO_DIARIO: { label: 'Reto diario', icon: '📅', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  RETO_SEMANAL: { label: 'Reto semanal', icon: '📆', color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  RETO_MENSUAL: { label: 'Reto mensual', icon: '🗓️', color: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  MEDALLA: { label: 'Medalla', icon: '🏅', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  RECONOCIMIENTO_RECIBIDO: { label: 'Reconocimiento recibido', icon: '💌', color: 'bg-pink-500/10 text-pink-700 dark:text-pink-300' },
  RECONOCIMIENTO_ENVIADO: { label: 'Reconocimiento enviado', icon: '✉️', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
};

const parseNombre = (fuente: string, detalle: string | null) => {
  if (!detalle) return FUENTE_META[fuente]?.label || fuente;
  // Retos VN: "Nombre — Rango X · ..." ó "Nombre - ..."
  const splitter = detalle.includes(' — ') ? ' — ' : (detalle.includes(' - ') ? ' - ' : null);
  if (splitter) return detalle.split(splitter)[0].trim();
  return detalle;
};

const fmtFecha = (s?: string) => s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MisLogros = () => {
  const { profile } = useSupabaseAuthContext();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SpRow[]>([]);
  const [canjes, setCanjes] = useState<CanjeRow[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      setLoading(true);
      const [spRes, canjesRes] = await Promise.all([
        supabase
          .from('sp_acumulados')
          .select('fuente, sp, periodo, detalle, created_at')
          .eq('gerente_id', profile.id)
          .eq('tipo_sp', 'canje')
          .order('created_at', { ascending: false }),
        supabase
          .from('canjes')
          .select('id, puntos_gastados, fecha_canje, estado, premios(nombre)')
          .eq('gerente_id', profile.id)
          .order('fecha_canje', { ascending: false }),
      ]);
      setRows((spRes.data || []) as SpRow[]);
      setCanjes(((canjesRes.data || []) as any[]).map(c => ({
        id: c.id,
        puntos_gastados: c.puntos_gastados,
        fecha_canje: c.fecha_canje,
        estado: c.estado,
        premio_nombre: c.premios?.nombre || null,
      })));
      setLoading(false);
    })();
  }, [profile?.id]);

  const totales = useMemo(() => {
    const porFuente: Record<string, number> = {};
    let ganado = 0;
    for (const r of rows) {
      porFuente[r.fuente] = (porFuente[r.fuente] || 0) + (Number(r.sp) || 0);
      ganado += Number(r.sp) || 0;
    }
    const gastado = canjes
      .filter(c => c.estado !== 'rechazado')
      .reduce((s, c) => s + Number(c.puntos_gastados || 0), 0);
    return { porFuente, ganado, gastado, saldo: Math.max(ganado - gastado, 0) };
  }, [rows, canjes]);

  const renderTabla = (filtro: (r: SpRow) => boolean, emptyMsg: string) => {
    const list = rows.filter(filtro);
    if (list.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          {emptyMsg}
        </div>
      );
    }
    return (
      <div className="overflow-x-auto border border-border rounded-xl bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3 font-bold">Logro</th>
              <th className="text-left p-3 font-bold w-32">Tipo</th>
              <th className="text-left p-3 font-bold w-28">Periodo</th>
              <th className="text-left p-3 font-bold w-32">Fecha</th>
              <th className="text-right p-3 font-bold w-24">SP Canje</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => {
              const meta = FUENTE_META[r.fuente];
              return (
                <tr key={i} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-medium">{parseNombre(r.fuente, r.detalle)}</td>
                  <td className="p-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold', meta?.color)}>
                      {meta?.icon} {meta?.label || r.fuente}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground tabular-nums">{r.periodo}</td>
                  <td className="p-3 text-xs text-muted-foreground">{fmtFecha(r.created_at)}</td>
                  <td className="p-3 text-right tabular-nums font-bold text-accent">+{r.sp}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-bold">
              <td colSpan={4} className="p-3 text-right">Subtotal</td>
              <td className="p-3 text-right tabular-nums text-accent">
                +{list.reduce((s, r) => s + Number(r.sp || 0), 0)} SP
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  if (loading) return <Layout title="Mis Logros"><Skeleton className="h-96" /></Layout>;

  return (
    <Layout title="Mis Logros">
      <div className="max-w-[1200px] mx-auto space-y-6">
        {/* Header */}
        <div className="border border-border rounded-2xl bg-gradient-to-br from-accent/10 via-primary/5 to-transparent p-6">
          <h2 className="text-2xl font-bold text-secondary flex items-center gap-2">
            🏆 Mis Logros
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Aquí ves todos los retos, medallas y reconocimientos que has desbloqueado, y cómo se acumulan en tu saldo de <b>SP Canje</b>.
          </p>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-border rounded-xl bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase font-bold">SP ganado</div>
            <div className="text-3xl font-extrabold text-accent tabular-nums mt-1">+{totales.ganado}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Retos + Medallas + Reconocimientos</div>
          </div>
          <div className="border border-border rounded-xl bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase font-bold">SP canjeado</div>
            <div className="text-3xl font-extrabold text-destructive tabular-nums mt-1">−{totales.gastado}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Premios y beneficios canjeados</div>
          </div>
          <div className="border-2 border-accent rounded-xl bg-accent/5 p-4">
            <div className="text-xs text-accent uppercase font-bold">Saldo disponible</div>
            <div className="text-3xl font-extrabold text-accent tabular-nums mt-1">{totales.saldo}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Ganado − Canjeado</div>
          </div>
          <div className="border border-border rounded-xl bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase font-bold">Logros desbloqueados</div>
            <div className="text-3xl font-extrabold text-primary tabular-nums mt-1">{rows.length}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Total histórico</div>
          </div>
        </div>

        {/* Desglose por fuente */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.entries(FUENTE_META).map(([key, meta]) => (
            <div key={key} className="border border-border rounded-lg p-3 bg-card text-center">
              <div className="text-xl">{meta.icon}</div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1">{meta.label}</div>
              <div className="text-lg font-bold text-foreground tabular-nums">{totales.porFuente[key] || 0} SP</div>
            </div>
          ))}
        </div>

        {/* Tabs por categoría */}
        <Tabs defaultValue="todos" className="w-full">
          <TabsList className="grid grid-cols-5 w-full bg-card border border-border">
            <TabsTrigger value="todos">Todos ({rows.length})</TabsTrigger>
            <TabsTrigger value="retos">🎯 Retos</TabsTrigger>
            <TabsTrigger value="medallas">🏅 Medallas</TabsTrigger>
            <TabsTrigger value="reconocimientos">💌 Reconocimientos</TabsTrigger>
            <TabsTrigger value="canjes">🎁 Canjes ({canjes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="todos" className="mt-4">
            {renderTabla(() => true, 'Aún no has desbloqueado logros. ¡Sigue jugando!')}
          </TabsContent>
          <TabsContent value="retos" className="mt-4">
            {renderTabla(r => r.fuente.startsWith('RETO_'), 'Aún no has ganado retos.')}
          </TabsContent>
          <TabsContent value="medallas" className="mt-4">
            {renderTabla(r => r.fuente === 'MEDALLA', 'Aún no has desbloqueado medallas.')}
          </TabsContent>
          <TabsContent value="reconocimientos" className="mt-4">
            {renderTabla(r => r.fuente.startsWith('RECONOCIMIENTO_'), 'Aún no tienes reconocimientos.')}
          </TabsContent>
          <TabsContent value="canjes" className="mt-4">
            {canjes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                Aún no has canjeado premios.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border rounded-xl bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-3 font-bold">Premio</th>
                      <th className="text-left p-3 font-bold w-32">Fecha</th>
                      <th className="text-left p-3 font-bold w-32">Estado</th>
                      <th className="text-right p-3 font-bold w-28">SP gastados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {canjes.map(c => (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                        <td className="p-3 font-medium">{c.premio_nombre || '—'}</td>
                        <td className="p-3 text-xs text-muted-foreground">{fmtFecha(c.fecha_canje)}</td>
                        <td className="p-3">
                          <Badge variant={c.estado === 'rechazado' ? 'destructive' : c.estado === 'aprobado' || c.estado === 'entregado' ? 'default' : 'secondary'}>
                            {c.estado}
                          </Badge>
                        </td>
                        <td className={cn('p-3 text-right tabular-nums font-bold', c.estado === 'rechazado' ? 'line-through text-muted-foreground' : 'text-destructive')}>
                          −{c.puntos_gastados}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center">
          Fuente: <code>sp_acumulados</code> (tipo canje) y <code>canjes</code>. Tu saldo en la cabecera se calcula con esta misma información.
        </p>
      </div>
    </Layout>
  );
};

export default MisLogros;
