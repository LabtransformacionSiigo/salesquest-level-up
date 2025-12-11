import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SaleRow {
  email_ejecutivo: string;
  producto: string;
  cantidad: number;
  cliente: string;
  fecha?: string;
  notas?: string;
}

interface SalesUploadPreviewProps {
  data: SaleRow[];
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRemoveRow: (index: number) => void;
}

export function SalesUploadPreview({ 
  data, 
  fileName, 
  onConfirm, 
  onCancel,
  onRemoveRow 
}: SalesUploadPreviewProps) {
  const validateRow = (row: SaleRow): string[] => {
    const errors: string[] = [];
    if (!row.email_ejecutivo) errors.push('Email requerido');
    if (!row.producto) errors.push('Producto requerido');
    if (!row.cantidad || row.cantidad < 1) errors.push('Cantidad inválida');
    if (!row.cliente) errors.push('Cliente requerido');
    if (row.fecha) {
      const date = new Date(row.fecha);
      if (isNaN(date.getTime())) errors.push('Fecha inválida');
      else if (date > new Date()) errors.push('Fecha futura');
    }
    return errors;
  };

  const rowsWithErrors = data.map((row, index) => ({
    row,
    index,
    errors: validateRow(row)
  }));

  const validRows = rowsWithErrors.filter(r => r.errors.length === 0);
  const invalidRows = rowsWithErrors.filter(r => r.errors.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Vista Previa de Datos
        </CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span>{fileName} - {data.length} filas</span>
          <div className="flex gap-2">
            <Badge variant="default" className="bg-green-500/20 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              {validRows.length} válidas
            </Badge>
            {invalidRows.length > 0 && (
              <Badge variant="destructive" className="bg-red-500/20 text-red-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {invalidRows.length} con errores
              </Badge>
            )}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Email Ejecutivo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center">Cantidad</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsWithErrors.map(({ row, index, errors }) => (
                <TableRow 
                  key={index}
                  className={errors.length > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.email_ejecutivo || '-'}
                  </TableCell>
                  <TableCell>{row.producto || '-'}</TableCell>
                  <TableCell className="text-center">{row.cantidad}</TableCell>
                  <TableCell>{row.cliente || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.fecha || 'Hoy'}
                  </TableCell>
                  <TableCell>
                    {errors.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {errors.map((error, i) => (
                          <Badge key={i} variant="destructive" className="text-xs">
                            {error}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                        Válido
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveRow(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <div className="flex items-center gap-4">
          {invalidRows.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Las filas con errores serán omitidas
            </p>
          )}
          <Button 
            onClick={onConfirm}
            disabled={validRows.length === 0}
          >
            Procesar {validRows.length} ventas
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
