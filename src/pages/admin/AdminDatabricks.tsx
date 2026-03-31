import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const TABLE_OPTIONS = [
  { value: "productividad", label: "Productividad Progresiva", desc: "KPIs mensuales (VN_EMPRESARIOS / VN_ALIADOS)", icon: "trending_up" },
  { value: "ventas_vc_completo", label: "Ventas VC Completo", desc: "Totales, metas y desglose por producto (todo junto)", icon: "storefront" },
];

const AdminDatabricks = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [executing, setExecuting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState("productividad");

  const handlePreview = async () => {
    setExecuting(true);
    setPreview(null);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('sync-databricks', {
        body: { mode: 'preview', table: selectedTable },
      });
      if (error) setPreview({ error: error.message });
      else setPreview(data);
    } catch (err) {
      setPreview({ error: String(err) });
    }
    setExecuting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('sync-databricks', {
        body: { mode: 'sync', table: selectedTable },
      });
      if (error) setSyncResult({ error: error.message });
      else setSyncResult(data);
    } catch (err) {
      setSyncResult({ error: String(err) });
    }
    setSyncing(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="Databricks Sync">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <MI icon="cloud_sync" className="text-primary" />
              Sincronización Databricks
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Conecta a Databricks y sincroniza datos del año 2026.
            </p>
          </div>

          {/* Table selector */}
          <div className="grid grid-cols-2 gap-3">
            {TABLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSelectedTable(opt.value); setPreview(null); setSyncResult(null); }}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                  selectedTable === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-muted-foreground/30"
                )}
              >
                <MI icon={opt.icon} className={cn("text-2xl mt-0.5", selectedTable === opt.value ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <p className={cn("font-semibold text-sm", selectedTable === opt.value ? "text-primary" : "text-foreground")}>{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Button onClick={handlePreview} disabled={executing || syncing} variant="outline" className="flex-1 h-12">
              {executing ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  Consultando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MI icon="visibility" className="text-lg" />
                  Preview (Ver Datos)
                </span>
              )}
            </Button>

            <Button onClick={handleSync} disabled={executing || syncing} className="flex-1 h-12">
              {syncing ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                  Sincronizando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MI icon="sync" className="text-lg" />
                  Sincronizar a BD
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Preview Result */}
        {preview && (
          <div className={cn(
            "border rounded-2xl p-6",
            preview.error ? "bg-destructive/5 border-destructive/30" : "bg-card border-border"
          )}>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              {preview.error ? (
                <><MI icon="error_outline" className="text-destructive" /> Error</>
              ) : (
                <><MI icon="table_chart" className="text-primary" /> Preview: {preview.table || selectedTable}</>
              )}
            </h3>

            {preview.error ? (
              <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto text-foreground font-mono">
                {JSON.stringify(preview, null, 2)}
              </pre>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">
                    {preview.total_rows} filas totales
                  </span>
                  <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full">
                    {preview.columns?.length} columnas
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Columnas detectadas:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(preview.columns || []).map((col: string) => (
                      <span key={col} className="text-[10px] bg-muted px-2 py-1 rounded-md font-mono text-foreground">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>

                {preview.sample?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Primeras {preview.sample.length} filas:</p>
                    <div className="overflow-auto max-h-80 rounded-lg border border-border">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="bg-muted/50 sticky top-0">
                            {(preview.columns || []).map((col: string) => (
                              <th key={col} className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.sample.map((row: any, i: number) => (
                            <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                              {(preview.columns || []).map((col: string) => (
                                <td key={col} className="px-2 py-1.5 whitespace-nowrap text-foreground">{String(row[col] ?? '—')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sync Result */}
        {syncResult && (
          <div className={cn(
            "border rounded-2xl p-6",
            syncResult.error ? "bg-destructive/5 border-destructive/30" : "bg-secondary/5 border-secondary/30"
          )}>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              {syncResult.error ? (
                <><MI icon="error_outline" className="text-destructive" /> Error en sincronización</>
              ) : (
                <><MI icon="check_circle" className="text-secondary" /> Sincronización completada</>
              )}
            </h3>

            {syncResult.error ? (
              <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto text-foreground font-mono">
                {JSON.stringify(syncResult, null, 2)}
              </pre>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  {syncResult.total_rows !== undefined && (
                    <div className="bg-muted/50 rounded-xl px-4 py-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Filas Databricks</p>
                      <p className="text-xl font-bold text-foreground">{syncResult.total_rows}</p>
                    </div>
                  )}
                  {syncResult.kpis_sincronizados !== undefined && (
                    <div className="bg-primary/10 rounded-xl px-4 py-3 text-center">
                      <p className="text-[10px] text-primary uppercase font-semibold">KPIs Sync</p>
                      <p className="text-xl font-bold text-primary">{syncResult.kpis_sincronizados}</p>
                    </div>
                  )}
                  {syncResult.ventas_sincronizadas !== undefined && (
                    <div className="bg-secondary/10 rounded-xl px-4 py-3 text-center">
                      <p className="text-[10px] text-secondary uppercase font-semibold">Ventas Sync</p>
                      <p className="text-xl font-bold text-secondary">{syncResult.ventas_sincronizadas}</p>
                    </div>
                  )}
                  {/* Combined VC results */}
                  {syncResult.ventas_vc && (
                    <div className="bg-primary/10 rounded-xl px-4 py-3 text-center">
                      <p className="text-[10px] text-primary uppercase font-semibold">VC Totales</p>
                      <p className="text-xl font-bold text-primary">{syncResult.ventas_vc.ventas_sincronizadas ?? syncResult.ventas_vc.total_rows}</p>
                    </div>
                  )}
                  {syncResult.ventas_vc_producto && (
                    <div className="bg-secondary/10 rounded-xl px-4 py-3 text-center">
                      <p className="text-[10px] text-secondary uppercase font-semibold">VC Productos</p>
                      <p className="text-xl font-bold text-secondary">{syncResult.ventas_vc_producto.ventas_sincronizadas ?? syncResult.ventas_vc_producto.total_rows}</p>
                    </div>
                  )}
                  {(syncResult.sp_recalculo && !syncResult.sp_recalculo.error) && (
                    <div className="bg-accent/10 rounded-xl px-4 py-3 text-center">
                      <p className="text-[10px] text-accent-foreground uppercase font-semibold">SP Otorgados</p>
                      <p className="text-xl font-bold text-accent-foreground">{syncResult.sp_recalculo.sp_otorgados ?? 0}</p>
                    </div>
                  )}
                </div>

                {/* Show errors from single or combined results */}
                {(() => {
                  const allErrors = [
                    ...(syncResult.errores || []),
                    ...(syncResult.ventas_vc?.errores || []),
                    ...(syncResult.ventas_vc_producto?.errores || []),
                  ];
                  return allErrors.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-destructive mb-1">Errores ({allErrors.length}):</p>
                      <ul className="text-[10px] text-muted-foreground space-y-0.5 max-h-32 overflow-auto">
                        {allErrors.map((e: string, i: number) => (
                          <li key={i} className="bg-muted px-2 py-1 rounded">⚠ {e}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminDatabricks;
