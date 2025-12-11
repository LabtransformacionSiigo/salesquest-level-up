import { CheckCircle, XCircle, Upload, Trophy, Download, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface ProcessingError {
  row: number;
  field: string;
  message: string;
  data: Record<string, unknown>;
}

interface ProcessingResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: ProcessingError[];
  salesInserted: number;
  totalXpAwarded: number;
}

interface UploadResultsSummaryProps {
  result: ProcessingResult;
  onNewUpload: () => void;
}

export function UploadResultsSummary({ result, onNewUpload }: UploadResultsSummaryProps) {
  const navigate = useNavigate();

  const downloadErrorReport = () => {
    if (result.errors.length === 0) return;

    const headers = 'Fila,Campo,Error,Datos';
    const rows = result.errors.map(e => 
      `${e.row},"${e.field}","${e.message}","${JSON.stringify(e.data).replace(/"/g, '""')}"`
    );
    const csvContent = `${headers}\n${rows.join('\n')}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `errores_carga_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const successRate = result.totalRows > 0 
    ? Math.round((result.successfulRows / result.totalRows) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <XCircle className="h-6 w-6 text-amber-500" />
            )}
            Resultados del Procesamiento
          </CardTitle>
          <CardDescription>
            Se procesaron {result.totalRows} filas del archivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Processed */}
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-3xl font-bold">{result.totalRows}</p>
              <p className="text-sm text-muted-foreground">Total filas</p>
            </div>

            {/* Successful */}
            <div className="p-4 rounded-lg bg-green-500/10 text-center">
              <p className="text-3xl font-bold text-green-600">{result.successfulRows}</p>
              <p className="text-sm text-muted-foreground">Exitosas</p>
            </div>

            {/* Failed */}
            <div className="p-4 rounded-lg bg-red-500/10 text-center">
              <p className="text-3xl font-bold text-red-600">{result.failedRows}</p>
              <p className="text-sm text-muted-foreground">Con errores</p>
            </div>

            {/* XP Awarded */}
            <div className="p-4 rounded-lg bg-primary/10 text-center">
              <div className="flex items-center justify-center gap-1">
                <Trophy className="h-5 w-5 text-primary" />
                <p className="text-3xl font-bold text-primary">{result.totalXpAwarded}</p>
              </div>
              <p className="text-sm text-muted-foreground">XP otorgado</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Tasa de éxito</span>
              <span className="font-medium">{successRate}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
          <Button variant="outline" onClick={onNewUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Nueva carga
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            Ir al Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>

      {/* Errors Table */}
      {result.errors.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Errores Encontrados</CardTitle>
                <CardDescription>
                  {result.errors.length} filas no pudieron ser procesadas
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                <Download className="h-4 w-4 mr-2" />
                Descargar reporte
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">Fila</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Datos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.errors.map((error, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{error.row}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{error.field}</Badge>
                      </TableCell>
                      <TableCell className="text-red-600">{error.message}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {JSON.stringify(error.data)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
