import { useState, useEffect } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, FileText, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SalesUpload {
  id: string;
  file_name: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: any;
  created_at: string;
  uploaded_by: string;
}

const UploadHistory = () => {
  const { isAuthenticated, profile } = useSupabaseAuthContext();
  const [uploads, setUploads] = useState<SalesUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState<SalesUpload | null>(null);
  const [errorsDialogOpen, setErrorsDialogOpen] = useState(false);

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_uploads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUploads(data || []);
    } catch (error) {
      console.error('Error fetching uploads:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role !== 'ADMINISTRADOR' && profile?.role !== 'GERENTE') {
    return <Navigate to="/dashboard" replace />;
  }

  const getStatusBadge = (upload: SalesUpload) => {
    if (upload.failed_rows === 0) {
      return <Badge className="bg-green-500">Completado</Badge>;
    }
    if (upload.successful_rows === 0) {
      return <Badge variant="destructive">Fallido</Badge>;
    }
    return <Badge className="bg-yellow-500">Parcial</Badge>;
  };

  const downloadErrorsReport = (upload: SalesUpload) => {
    const errors = Array.isArray(upload.errors) ? upload.errors : [];
    const csvContent = [
      'Fila,Error',
      ...errors.map((e: any) => `${e.row || '-'},"${e.error || e.message || 'Error desconocido'}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `errores_${upload.file_name}_${format(new Date(upload.created_at), 'yyyyMMdd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout title="Historial de Cargas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <History className="w-8 h-8 text-primary" />
              Historial de Cargas
            </h1>
            <p className="text-muted-foreground mt-2">
              Revisa el historial de archivos cargados
            </p>
          </div>
          <Button variant="outline" onClick={fetchUploads} disabled={loading}>
            Actualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cargas</p>
                <p className="text-2xl font-bold">{uploads.length}</p>
              </div>
              <FileText className="w-8 h-8 text-primary opacity-50" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Registros Exitosos</p>
                <p className="text-2xl font-bold text-green-600">
                  {uploads.reduce((sum, u) => sum + u.successful_rows, 0)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Registros Fallidos</p>
                <p className="text-2xl font-bold text-destructive">
                  {uploads.reduce((sum, u) => sum + u.failed_rows, 0)}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-destructive opacity-50" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasa de Éxito</p>
                <p className="text-2xl font-bold">
                  {uploads.length > 0
                    ? Math.round(
                        (uploads.reduce((sum, u) => sum + u.successful_rows, 0) /
                          uploads.reduce((sum, u) => sum + u.total_rows, 0)) *
                          100
                      )
                    : 0}%
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500 opacity-50" />
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <div className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Total Filas</TableHead>
                  <TableHead>Exitosas</TableHead>
                  <TableHead>Fallidas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Cargando historial...
                    </TableCell>
                  </TableRow>
                ) : uploads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay cargas registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  uploads.map(upload => (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          {upload.file_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(upload.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>{upload.total_rows}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {upload.successful_rows}
                      </TableCell>
                      <TableCell className="text-destructive font-medium">
                        {upload.failed_rows}
                      </TableCell>
                      <TableCell>{getStatusBadge(upload)}</TableCell>
                      <TableCell className="text-right">
                        {upload.failed_rows > 0 && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUpload(upload);
                                setErrorsDialogOpen(true);
                              }}
                            >
                              Ver Errores
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadErrorsReport(upload)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Errors Dialog */}
        <Dialog open={errorsDialogOpen} onOpenChange={setErrorsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Errores de {selectedUpload?.file_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {selectedUpload?.errors && Array.isArray(selectedUpload.errors) && selectedUpload.errors.length > 0 ? (
                selectedUpload.errors.map((error: any, index: number) => (
                  <div key={index} className="p-3 border rounded bg-destructive/10">
                    <p className="text-sm font-medium">Fila {error.row || index + 1}</p>
                    <p className="text-sm text-muted-foreground">{error.error || error.message || 'Error desconocido'}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No hay errores para mostrar</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default UploadHistory;
