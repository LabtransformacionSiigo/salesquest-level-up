import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const getISOWeek = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

const AdminCalculoSP = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(true);

  const semana = getISOWeek(new Date());
  const anio = new Date().getFullYear();

  const fetchHistorial = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('sp_acumulados')
      .select('*')
      .gte('created_at', todayStr)
      .order('created_at', { ascending: false })
      .limit(10);
    setHistorial(data || []);
    setHistLoading(false);
  };

  useEffect(() => {
    fetchHistorial();
  }, []);

  const handleExecute = async () => {
    setExecuting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('calcular-sp-semanal');
      if (error) {
        setResult({ error: error.message });
      } else {
        setResult(data);
        fetchHistorial();
      }
    } catch (err) {
      setResult({ error: String(err) });
    }
    setExecuting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="Motor de SP">
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <MI icon="calculate" className="text-primary" />
              Motor de SP · Cálculo Manual
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ejecuta el cálculo de Siigo Points para la semana actual. Normalmente esto ocurre automáticamente cada viernes a las 6PM.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-muted/50 rounded-xl px-5 py-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Semana ISO</p>
              <p className="text-xl font-bold text-foreground">{anio}-W{String(semana).padStart(2, '0')}</p>
            </div>

            <Button onClick={handleExecute} disabled={executing} size="lg" className="flex-1 h-14 text-base">
              {executing ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground" />
                  Procesando gerentes...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MI icon="play_arrow" className="text-xl" />
                  Ejecutar Cálculo Semanal
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={cn(
            "border rounded-2xl p-6",
            result.error ? "bg-destructive/5 border-destructive/30" : "bg-secondary/5 border-secondary/30"
          )}>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              {result.error ? (
                <><MI icon="error_outline" className="text-destructive" /> Error en el procesamiento</>
              ) : (
                <><MI icon="check_circle" className="text-secondary" /> Cálculo completado</>
              )}
            </h3>
            <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto text-foreground font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {/* Historial */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <MI icon="history" className="text-primary text-lg" />
            SP Otorgados Hoy
          </h3>

          {histLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>
          ) : historial.length > 0 ? (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left bg-muted/30">
                    <th className="pb-2 pr-4 py-2 px-3">Gerente ID</th>
                    <th className="pb-2 pr-4 py-2">SP</th>
                    <th className="pb-2 pr-4 py-2">Periodo</th>
                    <th className="pb-2 pr-4 py-2">Detalle</th>
                    <th className="pb-2 py-2">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2.5 pr-4 px-3 font-mono text-[10px]">{row.gerente_id?.slice(0, 8)}...</td>
                      <td className="py-2.5 pr-4 font-bold text-primary">+{row.sp}</td>
                      <td className="py-2.5 pr-4">{row.periodo}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{row.detalle}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {row.created_at ? new Date(row.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MI icon="history" className="text-3xl mb-2 opacity-30" />
              <p className="text-sm">No hay registros de SP hoy</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminCalculoSP;
