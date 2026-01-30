import { useState } from 'react';
import { useMedals, DbMedal } from '@/hooks/useMedals';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const EMOJI_OPTIONS = ['🎯', '🌟', '👑', '🏆', '💎', '⚡', '🔥', '💪', '🎖️', '🥇', '🥈', '🥉', '⭐', '✨', '🌈', '🎨'];

const CONDITION_TYPES = [
  { value: 'PRIMERA_VENTA', label: 'Primera venta', description: 'Se otorga con la primera venta' },
  { value: 'X_VENTAS_MES', label: 'X ventas en el mes', description: 'Cantidad de ventas mensuales' },
  { value: 'VENTAS_TOTAL', label: 'X ventas totales', description: 'Cantidad total de ventas' },
  { value: 'XP_TOTAL', label: 'XP total acumulado', description: 'Puntos totales acumulados' },
];

const CATEGORIES = [
  { value: 'ventas', label: 'Ventas' },
  { value: 'logros', label: 'Logros' },
  { value: 'racha', label: 'Rachas' },
  { value: 'especial', label: 'Especial' },
];

const MedalsTab = () => {
  const { medals, loading, addMedal, updateMedal, deleteMedal, toggleMedalActive } = useMedals();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMedal, setEditingMedal] = useState<DbMedal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    icon: '🎯',
    description: '',
    xp_reward: '',
    condition_type: 'PRIMERA_VENTA',
    condition_value: '1',
    category: 'ventas',
    active: true
  });

  const handleOpenDialog = (medal?: DbMedal) => {
    if (medal) {
      setFormData({
        name: medal.name,
        icon: medal.icon || '🎯',
        description: medal.description || '',
        xp_reward: (medal.xp_reward || 0).toString(),
        condition_type: medal.condition_type,
        condition_value: medal.condition_value.toString(),
        category: medal.category,
        active: medal.active
      });
      setEditingMedal(medal);
    } else {
      setFormData({
        name: '',
        icon: '🎯',
        description: '',
        xp_reward: '',
        condition_type: 'PRIMERA_VENTA',
        condition_value: '1',
        category: 'ventas',
        active: true
      });
      setEditingMedal(null);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.xp_reward) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor completa todos los campos obligatorios"
      });
      return;
    }

    const medalData = {
      name: formData.name,
      icon: formData.icon,
      description: formData.description || null,
      xp_reward: parseInt(formData.xp_reward),
      condition_type: formData.condition_type,
      condition_value: parseInt(formData.condition_value) || 1,
      category: formData.category,
      active: formData.active
    };

    try {
      if (editingMedal) {
        const { error } = await updateMedal(editingMedal.id, medalData);
        if (error) throw error;
        toast({
          title: "Medalla actualizada",
          description: `La medalla "${formData.name}" ha sido actualizada`
        });
      } else {
        const { error } = await addMedal(medalData);
        if (error) throw error;
        toast({
          title: "Medalla creada",
          description: `La medalla "${formData.name}" ha sido creada`
        });
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al guardar la medalla"
      });
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      try {
        const { error } = await deleteMedal(deleteId);
        if (error) throw error;
        toast({
          title: "Medalla eliminada",
          description: "La medalla ha sido eliminada"
        });
        setDeleteId(null);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Error al eliminar la medalla"
        });
      }
    }
  };

  const handleToggleActive = async (medal: DbMedal) => {
    try {
      const { error } = await toggleMedalActive(medal.id, !medal.active);
      if (error) throw error;
      toast({
        title: medal.active ? "Medalla desactivada" : "Medalla activada",
        description: `"${medal.name}" ${medal.active ? 'ya no se puede obtener' : 'ahora se puede obtener'}`
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  };

  const getConditionLabel = (type: string) => {
    return CONDITION_TYPES.find(c => c.value === type)?.label || type;
  };

  const getCategoryLabel = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat)?.label || cat;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Cargando medallas...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-smooth-lg border-2">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              🏅 Catálogo de Medallas
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Crea y gestiona medallas automáticas (persistidas en base de datos)
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => handleOpenDialog()}
                className="bg-gradient-accent hover:opacity-90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Medalla
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingMedal ? 'Editar Medalla' : 'Nueva Medalla'}</DialogTitle>
                <DialogDescription>
                  {editingMedal ? 'Modifica los datos de la medalla' : 'Completa los datos de la nueva medalla'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Icono</Label>
                  <div className="grid grid-cols-8 gap-2 mt-2">
                    {EMOJI_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: emoji })}
                        className={`text-3xl p-3 rounded-lg border-2 transition-all hover:scale-110 ${
                          formData.icon === emoji 
                            ? 'border-primary bg-primary/10 scale-110' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Nombre de la Medalla *</Label>
                  <Input
                    maxLength={50}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Primera Venta"
                  />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe cómo se obtiene esta medalla"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>XP a Otorgar *</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.xp_reward}
                      onChange={(e) => setFormData({ ...formData, xp_reward: e.target.value })}
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <Label>Categoría</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Condición</Label>
                    <Select value={formData.condition_type} onValueChange={(value) => setFormData({ ...formData, condition_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_TYPES.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor de Condición</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.condition_value}
                      onChange={(e) => setFormData({ ...formData, condition_value: e.target.value })}
                      placeholder="1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {CONDITION_TYPES.find(c => c.value === formData.condition_type)?.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Medalla Activa</Label>
                    <p className="text-xs text-muted-foreground">Las medallas inactivas no se otorgan</p>
                  </div>
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit}>
                  {editingMedal ? 'Guardar Cambios' : 'Crear Medalla'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {medals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No hay medallas creadas. Crea la primera medalla para empezar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {medals.map((medal) => (
              <Card 
                key={medal.id} 
                className={`p-6 shadow-smooth-md hover:shadow-smooth-lg transition-all border-2 ${
                  !medal.active ? 'opacity-60 bg-muted/50' : 'hover:scale-105'
                }`}
              >
                <div className="text-center mb-4">
                  <div className="text-6xl mb-3">{medal.icon}</div>
                  <h3 className="text-lg font-bold text-foreground mb-1">{medal.name}</h3>
                  <p className="text-sm text-muted-foreground">{medal.description}</p>
                </div>

                <div className="space-y-2 mb-4">
                  <Badge className="w-full justify-center bg-primary/20 text-primary">
                    {medal.xp_reward || 0} XP
                  </Badge>
                  <Badge variant="outline" className="w-full justify-center text-xs">
                    {getConditionLabel(medal.condition_type)}: {medal.condition_value}
                  </Badge>
                  <Badge variant="secondary" className="w-full justify-center text-xs">
                    {getCategoryLabel(medal.category)}
                  </Badge>
                  <Badge 
                    className={`w-full justify-center ${medal.active ? 'bg-green-500/20 text-green-700' : 'bg-destructive/20 text-destructive'}`}
                  >
                    {medal.active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(medal)}
                    className="flex-1"
                  >
                    {medal.active ? <PowerOff className="w-4 h-4 mr-1" /> : <Power className="w-4 h-4 mr-1" />}
                    {medal.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(medal)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(medal.id)}
                    className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La medalla será eliminada permanentemente.
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

export default MedalsTab;
