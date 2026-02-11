import { useState } from 'react';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { useCells, Cell } from '@/hooks/useCells';
import { useProfiles } from '@/hooks/useProfiles';
import { useManagerCells } from '@/hooks/useManagerCells';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Users, Target, Globe, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const COUNTRIES = [
  { value: 'Colombia', flag: '🇨🇴' },
  { value: 'México', flag: '🇲🇽' },
  { value: 'Argentina', flag: '🇦🇷' },
  { value: 'Chile', flag: '🇨🇱' },
  { value: 'Perú', flag: '🇵🇪' },
];

const SEGMENTS = ['Empresarios', 'Aliados', 'B&M', 'Despachos'] as const;

const Cells = () => {
  const { isAuthenticated, profile } = useSupabaseAuthContext();
  const { cells, addCell, updateCell, deleteCell, loading } = useCells();
  const { profiles, getManagers } = useProfiles();
  const { assignments, assignCell, unassignCell, getCellManagers } = useManagerCells();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<Cell | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cellToDelete, setCellToDelete] = useState<Cell | null>(null);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);
  const [selectedCellForManager, setSelectedCellForManager] = useState<Cell | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    country: '',
    segment: '' as typeof SEGMENTS[number] | '',
    goal: '',
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role !== 'ADMINISTRADOR') {
    return <Navigate to="/dashboard" replace />;
  }

  const managers = getManagers();

  const handleOpenDialog = (cell?: Cell) => {
    if (cell) {
      setEditingCell(cell);
      setFormData({
        name: cell.name,
        country: cell.country,
        segment: cell.segment,
        goal: cell.goal || '',
      });
    } else {
      setEditingCell(null);
      setFormData({ name: '', country: '', segment: '', goal: '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.country || !formData.segment) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor completa todos los campos obligatorios',
      });
      return;
    }

    try {
      if (editingCell) {
        const { error } = await updateCell(editingCell.id, {
          name: formData.name,
          country: formData.country,
          segment: formData.segment as typeof SEGMENTS[number],
          goal: formData.goal || null,
        });
        if (error) throw error;
        toast({ title: '✅ Célula actualizada' });
      } else {
        const { error } = await addCell({
          name: formData.name,
          country: formData.country,
          segment: formData.segment as typeof SEGMENTS[number],
          goal: formData.goal || null,
        });
        if (error) throw error;
        toast({ title: '✅ Célula creada' });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (cellToDelete) {
      try {
        const { error } = await deleteCell(cellToDelete.id);
        if (error) throw error;
        toast({ title: '✅ Célula eliminada' });
        setDeleteDialogOpen(false);
        setCellToDelete(null);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        });
      }
    }
  };

  const handleAssignManager = async (managerId: string) => {
    if (selectedCellForManager) {
      try {
        const { error } = await assignCell(managerId, selectedCellForManager.id);
        if (error) throw error;
        toast({ title: '✅ Gerente asignado' });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message,
        });
      }
    }
  };

  const handleUnassignManager = async (assignmentId: string) => {
    try {
      const { error } = await unassignCell(assignmentId);
      if (error) throw error;
      toast({ title: '✅ Gerente removido' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const getCellManagersList = (cellId: string) => {
    const cellAssignments = getCellManagers(cellId);
    return cellAssignments.map(a => {
      const manager = managers.find(m => m.id === a.manager_id);
      return { ...a, manager };
    });
  };

  const getCountryFlag = (country: string) => {
    return COUNTRIES.find(c => c.value === country)?.flag || '🌍';
  };

  return (
    <Layout title="Gestión de Células">
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Células Comerciales
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Administra las células y asigna gerentes
            </p>
          </div>
          <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90" onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4" />
            Nueva Célula
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-foreground">{cells.length}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
          </div>
          {SEGMENTS.map(segment => (
            <div key={segment} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-lg font-extrabold text-foreground">
                  {cells.filter(c => c.segment === segment).length}
                </p>
                <p className="text-[10px] text-muted-foreground">{segment}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5">
            <h2 className="text-sm font-bold mb-4 text-foreground">Lista de Células</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Célula</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Gerentes Asignados</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cells.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay células registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  cells.map(cell => {
                    const cellManagers = getCellManagersList(cell.id);
                    return (
                      <TableRow key={cell.id}>
                        <TableCell className="font-medium">{cell.name}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            {getCountryFlag(cell.country)} {cell.country}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{cell.segment}</Badge>
                        </TableCell>
                        <TableCell>{cell.goal || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {cellManagers.map(({ id, manager }) => (
                              <Badge key={id} variant="outline" className="gap-1">
                                {manager?.avatar} {manager?.name?.split(' ')[0]}
                              </Badge>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCellForManager(cell);
                                setManagerDialogOpen(true);
                              }}
                            >
                              <Users className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(cell)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setCellToDelete(cell);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Cell Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCell ? 'Editar Célula' : 'Nueva Célula'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre de la Célula *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Empresarios Colombia 1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" /> País *
                  </Label>
                  <Select
                    value={formData.country}
                    onValueChange={v => setFormData({ ...formData, country: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.flag} {c.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Target className="w-4 h-4" /> Segmento *
                  </Label>
                  <Select
                    value={formData.segment}
                    onValueChange={v => setFormData({ ...formData, segment: v as typeof SEGMENTS[number] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEGMENTS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meta (opcional)</Label>
                <Input
                  value={formData.goal}
                  onChange={e => setFormData({ ...formData, goal: e.target.value })}
                  placeholder="Ej: 100 ventas mensuales"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  {editingCell ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manager Assignment Dialog */}
        <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar Gerentes a {selectedCellForManager?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Gerentes Asignados</Label>
                <div className="space-y-2">
                  {selectedCellForManager && getCellManagersList(selectedCellForManager.id).map(({ id, manager }) => (
                    <div key={id} className="flex items-center justify-between p-2 border rounded">
                      <span>{manager?.avatar} {manager?.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleUnassignManager(id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Agregar Gerente</Label>
                <Select onValueChange={handleAssignManager}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar gerente" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers
                      .filter(m => 
                        !getCellManagersList(selectedCellForManager?.id || '')
                          .some(a => a.manager?.id === m.id)
                      )
                      .map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.avatar} {m.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar célula?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La célula "{cellToDelete?.name}" será eliminada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Cells;
