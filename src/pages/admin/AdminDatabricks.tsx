import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

type SyncJob = {
  id: string;
  table_name: string;
  status: string;
  mode: string;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
  result: any;
};

const TABLE_LABELS: Record<string, { label: string; icon: string }> = {
  productividad: { label: 'Productividad Progresiva', icon: 'trending_up' },
  ventas_vc_completo: { label: 'Ventas VC Completo', icon: 'storefront' },
  metas_gerentes: { label: 'Metas Gerentes', icon: 'assignment' },
  metas_asesores_sync: { label: 'Metas Asesores', icon: 'person_search' },
  ventas_empresarios: { label: 'Ventas Empresarios', icon: 'business' },
  ventas_aliados: { label: 'Ventas Aliados', icon: 'handshake' },
  productividad_asesores: { label: 'Productividad Asesores', icon: 'emoji_events' },
  ventas_vn_completo: { label: 'Ventas VN Completo', icon: 'sync_alt' },
  ventas_vn_aliados: { label: 'Ventas VN Aliados (→ventas)', icon: 'people' },
  ventas_vn_empresarios: { label: 'Ventas VN Empresarios (→ventas)', icon: 'business_center' },
  all_new: { label: 'Sync Completo (Nuevos)', icon: 'sync_alt' },
};

const STATUS_META: Record<string, { icon: string; color: string; bg: string }> = {
  completed: { icon: 'check_circle', color: 'text-secondary', bg: 'bg-secondary/10' },
  running: { icon: 'sync', color: 'text-primary', bg: 'bg-primary/10' },
  pending: { icon: 'schedule', color: 'text-primary', bg: 'bg-primary/10' },
  failed: { icon: 'error_outline', color: 'text-destructive', bg: 'bg-destructive/10' },
};

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { timeZone: 'America/Bogota', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

const getDuration = (start: string, end: string | null) => {
  if (!end) return '…';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

const getResultSummary = (job: SyncJob) => {
  const r = job.result;
  if (!r) return null;
  const parts: string[] = [];
  if (r.kpis_sincronizados) parts.push(`${r.kpis_sincronizados} KPIs`);
  if (r.ventas_sincronizadas) parts.push(`${r.ventas_sincronizadas} ventas`);
  if (r.filas_unicas) parts.push(`${r.filas_unicas} filas`);
  if (r.ventas_vc?.ventas_sincronizadas) parts.push(`${r.ventas_vc.ventas_sincronizadas} VC`);
  if (r.ventas_vc_producto?.ventas_producto_sincronizadas) parts.push(`${r.ventas_vc_producto.ventas_producto_sincronizadas} productos`);
  if (r.total_rows && parts.length === 0) parts.push(`${r.total_rows} filas`);
  return parts.length > 0 ? parts.join(' · ') : null;
};

const AdminDatabricks = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [forceRunning, setForceRunning] = useState(false);
  const [recalcRunning, setRecalcRunning] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from('sync_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setJobs(data as SyncJob[]);
    setLoadingJobs(false);
  }, []);

  // Auto-load + auto-refresh every 30s
  useEffect(() => {
    fetchJobs();
    const iv = setInterval(fetchJobs, 30000);
    return () => clearInterval(iv);
  }, [fetchJobs]);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('sync_jobs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_jobs' }, () => {
        fetchJobs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchJobs]);

  const handleForceSync = async () => {
    setForceRunning(true);
    try {
      await supabase.functions.invoke('sync-databricks', {
        body: { mode: 'sync', table: 'all_new' },
      });
    } catch { /* ignore */ }
    setTimeout(() => setForceRunning(false), 3000);
  };

  const handleCleanStuck = async () => {
    try {
      await supabase.functions.invoke('sync-databricks', {
        body: { mode: 'clean_stuck' },
      });
      fetchJobs();
    } catch { /* ignore */ }
  };

  const handleRecalcConvencionVN = async () => {
    if (!confirm('Esto borrará y recalculará TODOS los SP Convención (gerentes y asesores VN). Úsalo cuando hayas actualizado las metas FE/NUBE en metas_asesores. ¿Continuar?')) return;
    setRecalcRunning(true);
    setRecalcMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('calcular-sp-semanal', {
        body: { only_convencion: true, reset_existing_convencion: true },
      });
      if (error) throw error;
      const sp = (data as any)?.sp_otorgados ?? 0;
      const proc = (data as any)?.procesados ?? 0;
      setRecalcMsg(`✓ Recalculado: ${proc} gerentes, ${sp.toLocaleString()} SP otorgados`);
    } catch (err: any) {
      setRecalcMsg(`✗ Error: ${err?.message || 'desconocido'}`);
    }
    setRecalcRunning(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  // Group latest job per table
  const latestByTable = new Map<string, SyncJob>();
  jobs.forEach(j => {
    if (!latestByTable.has(j.table_name)) latestByTable.set(j.table_name, j);
  });

  const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending');

  return (
    <Layout title="Databricks Sync">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <MI icon="cloud_sync" className="text-primary" />
                Monitor de Sincronización
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Las sincronizaciones corren automáticamente. Esta página se actualiza en tiempo real.
              </p>
              <p className="text-xs text-primary font-semibold mt-2 flex items-center gap-1.5">
                <MI icon="schedule" className="text-sm" />
                Automático: 8:30 AM · 12:30 PM · 6:00 PM (Bogotá)
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasRunning && (
                <>
                  <Button
                    onClick={handleCleanStuck}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive"
                  >
                    <MI icon="cleaning_services" className="text-sm" />
                    Limpiar atascados
                  </Button>
                  <span className="flex items-center gap-1.5 text-xs text-primary font-semibold bg-primary/10 px-3 py-1.5 rounded-full">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                    Sync en curso
                  </span>
                </>
              )}
              <Button
                onClick={handleForceSync}
                disabled={forceRunning || hasRunning}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                {forceRunning ? (
                  <span className="flex items-center gap-1.5">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                    Iniciando...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <MI icon="sync" className="text-sm" />
                    Forzar Sync
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Recalcular SP Convención VN */}
        <div className="bg-gradient-to-br from-accent/10 to-primary/5 border border-accent/30 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <MI icon="calculate" className="text-accent" />
                Recalcular SP Convención VN
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                <strong className="text-foreground">⚠️ Úsalo cuando se actualicen metas FE/NUBE</strong> en <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">metas_asesores</code>.
                Borra y recalcula todos los SP Convención (gerentes y asesores VN) usando la fórmula oficial:
              </p>
              <p className="text-[11px] text-muted-foreground font-mono mt-2 bg-muted/50 rounded-lg px-3 py-2">
                SP_mes = round(ACV/meta × 100) <span className="text-accent">[1%=1SP]</span> + round(FE/metaFE × 100) <span className="text-accent">[1%=1SP]</span> + round(Nube/metaNube × 100) × 2 <span className="text-accent">[1%=2SP]</span>
              </p>
              {recalcMsg && (
                <p className={cn("text-xs font-semibold mt-2", recalcMsg.startsWith('✓') ? 'text-secondary' : 'text-destructive')}>
                  {recalcMsg}
                </p>
              )}
            </div>
            <Button
              onClick={handleRecalcConvencionVN}
              disabled={recalcRunning}
              variant="default"
              size="sm"
              className="text-xs whitespace-nowrap"
            >
              {recalcRunning ? (
                <span className="flex items-center gap-1.5">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground" />
                  Recalculando...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <MI icon="refresh" className="text-sm" />
                  Recalcular SP VN
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Status cards per table */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from(latestByTable.entries()).map(([tableName, job]) => {
            const meta = STATUS_META[job.status] || STATUS_META.pending;
            const label = TABLE_LABELS[tableName] || { label: tableName, icon: 'table_chart' };
            return (
              <div key={tableName} className={cn("rounded-xl border border-border p-4 space-y-2", meta.bg)}>
                <div className="flex items-center gap-2">
                  <MI icon={label.icon} className={cn("text-lg", meta.color)} />
                  <p className="text-xs font-bold text-foreground truncate">{label.label}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <MI icon={meta.icon} className={cn("text-sm", meta.color, job.status === 'running' && 'animate-spin')} />
                  <span className={cn("text-[11px] font-semibold capitalize", meta.color)}>{job.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{formatTime(job.created_at)}</p>
                {getResultSummary(job) && (
                  <p className="text-[10px] text-foreground font-mono">{getResultSummary(job)}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* History timeline */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <MI icon="history" className="text-primary" />
            Historial de Sincronizaciones
          </h3>

          {loadingJobs ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay sincronizaciones registradas</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const meta = STATUS_META[job.status] || STATUS_META.pending;
                const label = TABLE_LABELS[job.table_name] || { label: job.table_name, icon: 'table_chart' };
                const summary = getResultSummary(job);
                const isExpanded = expandedJob === job.id;

                return (
                  <button
                    key={job.id}
                    onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                    className="w-full text-left rounded-xl border border-border hover:bg-muted/30 transition-all px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <MI icon={meta.icon} className={cn("text-lg", meta.color, job.status === 'running' && 'animate-spin')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{label.label}</span>
                          <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", meta.bg, meta.color)}>
                            {job.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{formatTime(job.created_at)}</span>
                          <span className="text-[11px] text-muted-foreground">⏱ {getDuration(job.created_at, job.finished_at)}</span>
                          {summary && <span className="text-[11px] text-foreground font-mono">{summary}</span>}
                        </div>
                      </div>
                      <MI icon={isExpanded ? 'expand_less' : 'expand_more'} className="text-muted-foreground" />
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        {job.error_message && (
                          <p className="text-xs text-destructive mb-2">⚠ {job.error_message}</p>
                        )}
                        <pre className="text-[10px] bg-muted rounded-lg p-3 overflow-auto max-h-48 text-foreground font-mono">
                          {JSON.stringify(job.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminDatabricks;
