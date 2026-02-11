import { useState, useMemo } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useSales } from '@/context/SalesContext';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, Package, DollarSign, Flame } from 'lucide-react';

const SalesHistory = () => {
  const { profile } = useSupabaseAuthContext();
  const { sales, getSalesByUser } = useSales();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  const userSales = profile?.role === 'EJECUTIVO' 
    ? getSalesByUser(profile.id) 
    : sales;

  const filteredSales = useMemo(() => {
    return userSales.filter(sale => {
      const matchesSearch = sale.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           sale.client?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProduct = filterProduct === 'all' || sale.productName === filterProduct;
      const matchesMonth = filterMonth === 'all' || 
                          format(sale.date, 'yyyy-MM') === filterMonth;
      return matchesSearch && matchesProduct && matchesMonth;
    });
  }, [userSales, searchTerm, filterProduct, filterMonth]);

  const totalSales = filteredSales.length;
  const totalXP = filteredSales.reduce((sum, sale) => sum + sale.xpEarned, 0);
  const topProduct = useMemo(() => {
    const productCounts = filteredSales.reduce((acc, sale) => {
      acc[sale.productName] = (acc[sale.productName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  }, [filteredSales]);

  const uniqueProducts = Array.from(new Set(userSales.map(s => s.productName)));

  return (
    <Layout title={profile?.role === 'EJECUTIVO' ? 'Mi Historial de Ventas' : 'Ventas de Mi Equipo'}>
    <div className="space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">
          {profile?.role === 'EJECUTIVO' ? '📊 Mi Historial de Ventas' : '📊 Ventas de Mi Equipo'}
        </h1>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Ventas</p>
              <p className="text-2xl font-bold">{totalSales}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-secondary rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total XP</p>
              <p className="text-2xl font-bold">{totalXP}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-accent rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Más Vendido</p>
              <p className="text-lg font-bold truncate">{topProduct}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-smooth-lg hover:shadow-smooth-xl transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Racha de Ventas</p>
              <p className="text-2xl font-bold">0 días</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6 shadow-smooth-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Buscar</Label>
            <Input
              placeholder="Producto o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <Label>Producto</Label>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueProducts.map(product => (
                  <SelectItem key={product} value={product}>{product}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mes</Label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value={format(new Date(), 'yyyy-MM')}>
                  {format(new Date(), 'MMMM yyyy', { locale: es })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="shadow-smooth-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              {profile?.role !== 'EJECUTIVO' && <TableHead>Ejecutivo</TableHead>}
              <TableHead>Producto</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>XP Ganados</TableHead>
              <TableHead>Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay ventas registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale) => (
                <TableRow key={sale.id} className="hover:bg-muted/50">
                  <TableCell>
                    {format(sale.date, 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  {profile?.role !== 'EJECUTIVO' && (
                    <TableCell className="font-semibold">{sale.userName}</TableCell>
                  )}
                  <TableCell>{sale.productName}</TableCell>
                  <TableCell>{sale.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={sale.multiplierApplied ? "default" : "secondary"}>
                      {sale.xpEarned} XP {sale.multiplierApplied && `⚡x${sale.multiplierApplied}`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sale.client || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filteredSales.length > 0 && (
          <div className="border-t p-4 bg-muted/20">
            <p className="text-right font-bold">
              Total: <span className="text-primary">{totalXP} XP</span>
            </p>
          </div>
        )}
      </Card>
    </div>
    </Layout>
  );
};

export default SalesHistory;
