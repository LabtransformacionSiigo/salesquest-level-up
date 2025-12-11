import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SalesUploadPreview } from './SalesUploadPreview';
import { UploadResultsSummary } from './UploadResultsSummary';

interface SaleRow {
  email_ejecutivo: string;
  producto: string;
  cantidad: number;
  cliente: string;
  fecha?: string;
  notas?: string;
}

interface ProcessingResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    data: Record<string, unknown>;
  }>;
  salesInserted: number;
  totalXpAwarded: number;
}

type UploadStep = 'upload' | 'preview' | 'processing' | 'results';

export function BulkSalesUpload() {
  const [step, setStep] = useState<UploadStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<SaleRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const parseCSV = (text: string): SaleRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    // Map common variations of column names
    const columnMap: Record<string, string> = {
      'email_ejecutivo': 'email_ejecutivo',
      'email ejecutivo': 'email_ejecutivo',
      'email': 'email_ejecutivo',
      'ejecutivo': 'email_ejecutivo',
      'producto': 'producto',
      'product': 'producto',
      'cantidad': 'cantidad',
      'quantity': 'cantidad',
      'qty': 'cantidad',
      'cliente': 'cliente',
      'client': 'cliente',
      'client_name': 'cliente',
      'fecha': 'fecha',
      'date': 'fecha',
      'notas': 'notas',
      'notes': 'notas',
      'nota': 'notas',
    };

    const normalizedHeaders = headers.map(h => columnMap[h] || h);

    return lines.slice(1).filter(line => line.trim()).map(line => {
      // Handle CSV with quoted values
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: Record<string, string | number> = {};
      normalizedHeaders.forEach((header, index) => {
        row[header] = values[index]?.replace(/"/g, '') || '';
      });

      return {
        email_ejecutivo: String(row.email_ejecutivo || ''),
        producto: String(row.producto || ''),
        cantidad: parseInt(String(row.cantidad)) || 0,
        cliente: String(row.cliente || ''),
        fecha: row.fecha ? String(row.fecha) : undefined,
        notas: row.notas ? String(row.notas) : undefined,
      };
    });
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile) return;

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    // Check by extension if MIME type is not recognized
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    const isValidExtension = ['csv', 'xlsx', 'xls'].includes(extension || '');
    
    if (!validTypes.includes(selectedFile.type) && !isValidExtension) {
      toast({
        title: 'Formato no válido',
        description: 'Por favor sube un archivo CSV o Excel (.csv, .xlsx, .xls)',
        variant: 'destructive'
      });
      return;
    }

    setFile(selectedFile);

    // For CSV files, parse directly
    if (selectedFile.type === 'text/csv' || extension === 'csv') {
      const text = await selectedFile.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        toast({
          title: 'Archivo vacío',
          description: 'El archivo no contiene datos para procesar',
          variant: 'destructive'
        });
        return;
      }

      setParsedData(data);
      setStep('preview');
    } else {
      // For Excel files, we'll need to use a library
      toast({
        title: 'Excel detectado',
        description: 'Por favor convierte tu archivo a CSV para procesarlo. Próximamente soporte nativo de Excel.',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const downloadTemplate = () => {
    const headers = 'email_ejecutivo,producto,cantidad,cliente,fecha,notas';
    const example = 'ejecutivo@empresa.com,Crédito Simple,1,Cliente Ejemplo,2024-01-15,Notas opcionales';
    const csvContent = `${headers}\n${example}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_ventas.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const processUpload = async () => {
    if (!file || parsedData.length === 0) return;

    setStep('processing');
    setProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Sesión expirada',
          description: 'Por favor inicia sesión nuevamente',
          variant: 'destructive'
        });
        setStep('upload');
        return;
      }

      setProgress(30);

      const response = await supabase.functions.invoke('process-sales-upload', {
        body: {
          rows: parsedData,
          fileName: file.name
        }
      });

      setProgress(80);

      if (response.error) {
        throw new Error(response.error.message);
      }

      setProgress(100);
      setResult(response.data as ProcessingResult);
      setStep('results');

      if (response.data.successfulRows > 0) {
        toast({
          title: '¡Ventas procesadas!',
          description: `${response.data.successfulRows} ventas registradas exitosamente`,
        });
      }

    } catch (error) {
      console.error('Error processing upload:', error);
      toast({
        title: 'Error al procesar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive'
      });
      setStep('preview');
    }
  };

  const reset = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setProgress(0);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Carga Masiva de Ventas
            </CardTitle>
            <CardDescription>
              Sube un archivo CSV con las ventas de tu equipo para registrarlas automáticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Download Template */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Plantilla de ejemplo</p>
                <p className="text-sm text-muted-foreground">
                  Descarga la plantilla CSV con el formato correcto
                </p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>

            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Arrastra tu archivo aquí
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                o haz clic para seleccionar
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <Button asChild variant="secondary">
                <label htmlFor="file-upload" className="cursor-pointer">
                  Seleccionar archivo
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Formatos soportados: CSV
              </p>
            </div>

            {/* Format Guide */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Formato del archivo</AlertTitle>
              <AlertDescription>
                <p className="mb-2">El archivo debe contener las siguientes columnas:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>email_ejecutivo</strong> - Email del ejecutivo (requerido)</li>
                  <li><strong>producto</strong> - Nombre del producto (requerido)</li>
                  <li><strong>cantidad</strong> - Cantidad vendida (requerido)</li>
                  <li><strong>cliente</strong> - Nombre del cliente (requerido)</li>
                  <li><strong>fecha</strong> - Fecha de venta YYYY-MM-DD (opcional)</li>
                  <li><strong>notas</strong> - Notas adicionales (opcional)</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <SalesUploadPreview
          data={parsedData}
          fileName={file?.name || ''}
          onConfirm={processUpload}
          onCancel={reset}
          onRemoveRow={(index) => {
            setParsedData(prev => prev.filter((_, i) => i !== index));
          }}
        />
      )}

      {step === 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle>Procesando ventas...</CardTitle>
            <CardDescription>
              Por favor espera mientras procesamos tu archivo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {progress < 30 && 'Preparando datos...'}
              {progress >= 30 && progress < 80 && 'Validando y registrando ventas...'}
              {progress >= 80 && 'Finalizando...'}
            </p>
          </CardContent>
        </Card>
      )}

      {step === 'results' && result && (
        <UploadResultsSummary result={result} onNewUpload={reset} />
      )}
    </div>
  );
}
