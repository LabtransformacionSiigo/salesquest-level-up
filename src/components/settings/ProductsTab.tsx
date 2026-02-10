import { useState } from 'react';
import { useConfig } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ProductCategory = 'Facturación' | 'Nómina' | 'Nube' | 'Otros';

const ProductsTab = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useConfig();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    xp: '',
    category: 'Facturación' as ProductCategory
  });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Facturación': 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
      'Nómina': 'bg-green-500/20 text-green-700 dark:text-green-300',
      'Nube': 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
      'Otros': 'bg-gray-500/20 text-gray-700 dark:text-gray-300'
    };
    return colors[category] || colors['Otros'];
  };

  const handleOpenDialog = (id?: string) => {
    if (id) {
      const product = products.find(p => p.id === id);
      if (product) {
        setFormData({
          name: product.name,
          xp: product.xp.toString(),
          category: (product.category as ProductCategory) || 'Otros'
        });
        setEditingId(id);
      }
    } else {
      setFormData({ name: '', xp: '', category: 'Facturación' });
      setEditingId(null);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.xp || parseInt(formData.xp) <= 0) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos correctamente",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const { error } = await updateProduct(editingId, {
          name: formData.name,
          xp: parseInt(formData.xp),
          category: formData.category
        });
        if (error) throw error;
        toast({ title: "Producto actualizado", description: "Los cambios se guardaron correctamente" });
      } else {
        const { error } = await addProduct({
          name: formData.name,
          xp: parseInt(formData.xp),
          category: formData.category
        });
        if (error) throw error;
        toast({ title: "Producto agregado", description: "El producto se creó correctamente" });
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo guardar", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      try {
        const { error } = await deleteProduct(deleteId);
        if (error) throw error;
        toast({ title: "Producto eliminado", description: "El producto se eliminó correctamente" });
        setDeleteId(null);
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "No se pudo eliminar", variant: "destructive" });
      }
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-smooth-lg border-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              🎯 Productos y Puntos de Experiencia
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Configura los productos y sus valores en XP
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="bg-gradient-primary hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
                <DialogDescription>
                  {editingId ? 'Modifica los datos del producto' : 'Completa los datos del nuevo producto'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nombre del Producto</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Factura Electrónica"
                  />
                </div>
                <div>
                  <Label>Puntos XP</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.xp}
                    onChange={(e) => setFormData({ ...formData, xp: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value as ProductCategory })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Facturación">Facturación</SelectItem>
                      <SelectItem value="Nómina">Nómina</SelectItem>
                      <SelectItem value="Nube">Nube</SelectItem>
                      <SelectItem value="Otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Producto'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Buscar por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filtrar por categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value="Facturación">Facturación</SelectItem>
              <SelectItem value="Nómina">Nómina</SelectItem>
              <SelectItem value="Nube">Nube</SelectItem>
              <SelectItem value="Otros">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-foreground">Producto</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">XP</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Categoría</th>
                <th className="text-right py-3 px-4 font-semibold text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">
                    No hay productos. Crea el primero.
                  </td>
                </tr>
              ) : filteredProducts.map((product) => (
                <tr key={product.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{product.name}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={product.xp > 10 ? "default" : "secondary"}>
                        {product.xp} XP
                      </Badge>
                      {product.xp > 10 && (
                        <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">
                          ⚡ Alto Valor
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={getCategoryColor(product.category)}>
                      {product.category}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(product.id)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(product.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El producto será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductsTab;
