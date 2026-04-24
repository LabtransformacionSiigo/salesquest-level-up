import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn('material-icons-outlined', className)}>{icon}</span>
);

interface Row {
  pais: string;
  canal: string;
  director?: string | null;
  celula: string;
  esquema?: string | null;
  cuota?: number;
  meta_total_und?: number;
  meta_total_acv?: number;
  mes: string;
  archivo: string;
}

interface Summary {
  total: number;
  inserted: number;
  updated_inicio: number;
  upgraded_to_cierre: number;
  skipped_cierre_existente: number;
  invalid: number;
}

const REQUIRED_HEADERS = ['pais', 'canal', 'celula', 'mes', 'archivo'];

const normalizeKey = (k: string) =>
  k.trim().toLowerCase().replace(/\s+/g, '_').replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u');

const AdminMetasAcv = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorList, setErrorList] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [filterMes, setFilterMes] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const handleSyncDatabricks = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-metas-acv-databricks', {
        body: {},
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Sync fallida');
      setSummary(data.summary);
      setErrorList(data.errors || []);
      toast({
        title: '✅ Sync Databricks completada',
        description: `Insertadas: ${data.summary.inserted} · Cierres nuevos: ${data.summary.upgraded_to_cierre} · Bloqueadas: ${data.summary.skipped_cierre_existente}`,
      });
      fetchHistorial();
    } catch (e: any) {
      toast({ title: 'Error sync Databricks', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const fetchHistorial = async () => {
    let q = supabase
      .from('metas_acv_gerentes' as any)
      .select('*')
      .order('mes', { ascending: false })
      .order('celula', { ascending: true })
      .limit(500);
    if (filterMes) q = q.eq('mes', filterMes);
    const { data } = await q;
    setHistorial((data as any[]) || []);
  };

  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchHistorial();
  }, [isAuthenticated, isAdmin, filterMes]);

  const handleFile = async (file: File) => {
    setParsing(true);
    setSummary(null);
    setErrorList([]);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (raw.length === 0) {
        toast({ title: 'Archivo vacío', variant: 'destructive' });
        return;
      }

      // Normalizar llaves
      const normalized = raw.map((r) => {
        const out: any = {};
        Object.entries(r).forEach(([k, v]) => {
          out[normalizeKey(k)] = v;
        });
        return out;
      });

      const missing = REQUIRED_HEADERS.filter((h) => !(h in normalized[0]));
      if (missing.length) {
        toast({
          title: 'Faltan columnas requeridas',
          description: missing.join(', '),
          variant: 'destructive',
        });
        return;
      }

      const parsed: Row[] = normalized.map((r) => ({
        pais: String(r.pais || '').trim(),
        canal: String(r.canal || '').trim(),
        director: r.director ? String(r.director).trim() : null,
        celula: String(r.celula || '').trim(),
        esquema: r.esquema ? String(r.esquema).trim() : null,
        cuota: Number(r.cuota) || 0,
        meta_total_und: Number(r.meta_total_und ?? r.meta_total_unds ?? r.meta_und) || 0,
        meta_total_acv: Number(r.meta_total_acv ?? r.meta_acv) || 0,
        mes: String(r.mes || '').trim(),
        archivo: String(r.archivo || '').trim(),
      }));

      setRows(parsed);
      toast({ title: `${parsed.length} filas listas para cargar` });
    } catch (e: any) {
      toast({ title: 'Error al leer archivo', description: e.message, variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = async () => {
    if (rows.length === 0) return;
    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cargar-metas-acv', {
        body: { rows },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Carga fallida');
      setSummary(data.summary);
      setErrorList(data.errors || []);
      toast({
        title: '✅ Carga completada',
        description: `Insertadas: ${data.summary.inserted} · Cierres: ${data.summary.upgraded_to_cierre} · Bloqueadas: ${data.summary.skipped_cierre_existente}`,
      });
      setRows([]);
      if (fileRef.current) fileRef.current.value = '';
      fetchHistorial();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <Layout title="Admin · Metas ACV Gerentes">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-foreground">Metas ACV Gerentes (VN)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cargar metas ACV mensuales · Cierre es definitivo y bloquea futuras cargas para el mismo mes/célula
            </p>
          </div>
          <Button onClick={handleSyncDatabricks} disabled={syncing} variant="default" className="gap-2">
            <MI icon={syncing ? 'sync' : 'cloud_download'} className={cn('text-base', syncing && 'animate-spin')} />
            {syncing ? 'Sincronizando…' : 'Sincronizar desde Databricks'}
          </Button>
        </div>

        {/* Uploader */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MI icon="upload_file" className="text-primary text-base" />
            <h3 className="text-sm font-bold text-foreground">Subir archivo (CSV / XLSX)</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Columnas requeridas: <code className="bg-muted px-1 rounded">pais, canal, celula, mes, archivo</code>.
            Opcionales: <code className="bg-muted px-1 rounded">director, esquema, cuota, meta_total_und, meta_total_acv</code>.
            <br />Valores válidos para <b>archivo</b>: <code>Inicio</code> o <code>Cierre</code>. Formato de <b>mes</b>: <code>2026-01</code>.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />

          {parsing && <p className="text-xs text-muted-foreground">Procesando archivo...</p>}

          {rows.length > 0 && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {rows.length} filas listas para cargar
                </p>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Cargando...' : 'Confirmar carga'}
                </Button>
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left py-1 px-2">País</th>
                      <th className="text-left py-1 px-2">Canal</th>
                      <th className="text-left py-1 px-2">Célula</th>
                      <th className="text-left py-1 px-2">Mes</th>
                      <th className="text-left py-1 px-2">Archivo</th>
                      <th className="text-right py-1 px-2">Meta ACV</th>
                      <th className="text-right py-1 px-2">Meta Und</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="py-1 px-2">{r.pais}</td>
                        <td className="py-1 px-2">{r.canal}</td>
                        <td className="py-1 px-2">{r.celula}</td>
                        <td className="py-1 px-2">{r.mes}</td>
                        <td className="py-1 px-2">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                            r.archivo.toLowerCase().startsWith('cier') ? 'bg-secondary/10 text-secondary' : 'bg-muted text-muted-foreground')}>
                            {r.archivo}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right">{(r.meta_total_acv || 0).toLocaleString()}</td>
                        <td className="py-1 px-2 text-right">{r.meta_total_und || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && (
                  <p className="text-[10px] text-muted-foreground px-2 py-1">… y {rows.length - 20} más</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary post-upload */}
        {summary && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MI icon="task_alt" className="text-primary text-base" />
              Resultado de la última carga
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <Stat label="Total" value={summary.total} />
              <Stat label="Insertadas" value={summary.inserted} tone="ok" />
              <Stat label="Inicios actualizados" value={summary.updated_inicio} />
              <Stat label="Promovidas a Cierre" value={summary.upgraded_to_cierre} tone="ok" />
              <Stat label="Bloqueadas (Cierre existente)" value={summary.skipped_cierre_existente} tone="warn" />
            </div>
            {summary.invalid > 0 && (
              <p className="text-xs text-destructive">⚠ {summary.invalid} filas inválidas (campos requeridos faltantes).</p>
            )}
            {errorList.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Ver errores ({errorList.length})</summary>
                <pre className="mt-2 bg-muted p-2 rounded text-[10px] max-h-40 overflow-auto">
                  {JSON.stringify(errorList, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Historial */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
            <h3 className="text-sm font-bold text-foreground">Metas registradas</h3>
            <input
              type="text"
              value={filterMes}
              onChange={(e) => setFilterMes(e.target.value)}
              placeholder="Filtrar mes (ej: 2026-01)"
              className="h-8 text-xs rounded-lg border border-border bg-background px-2"
            />
          </div>
          {historial.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sin metas cargadas</div>
          ) : (
            <div className="overflow-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 sticky top-0">
                  <tr className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-3 py-2">Mes</th>
                    <th className="text-left px-3 py-2">País</th>
                    <th className="text-left px-3 py-2">Canal</th>
                    <th className="text-left px-3 py-2">Célula</th>
                    <th className="text-left px-3 py-2">Director</th>
                    <th className="text-right px-3 py-2">Meta ACV</th>
                    <th className="text-right px-3 py-2">Meta Und</th>
                    <th className="text-center px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{h.mes}</td>
                      <td className="px-3 py-2">{h.pais}</td>
                      <td className="px-3 py-2">{h.canal}</td>
                      <td className="px-3 py-2">{h.celula}</td>
                      <td className="px-3 py-2 text-muted-foreground">{h.director || '—'}</td>
                      <td className="px-3 py-2 text-right">{Number(h.meta_total_acv || 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{h.meta_total_und || 0}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          h.archivo === 'Cierre' ? 'bg-secondary/10 text-secondary' : 'bg-orange/10 text-orange')}>
                          {h.archivo}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) => (
  <div className="rounded-xl border border-border p-3 bg-background">
    <div className={cn('text-xl font-bold font-scoreboard',
      tone === 'ok' ? 'text-secondary' : tone === 'warn' ? 'text-orange' : 'text-foreground')}>
      {value}
    </div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
  </div>
);

export default AdminMetasAcv;
