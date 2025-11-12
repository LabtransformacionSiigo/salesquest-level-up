import { useState } from 'react';
import { useConfig } from '@/context/ConfigContext';
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
import { Plus, Edit, Trash2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const EMOJI_OPTIONS = ['🎯', '🌟', '👑', '🏆', '💎', '⚡', '🔥', '💪', '🎖️', '🥇', '🥈', '🥉', '⭐', '✨', '🌈', '🎨'];

const CRITERIA_OPTIONS = [
  { value: 'PRIMERA_VENTA', label: 'Primera venta' },
  { value: 'X_VENTAS_MES', label: 'X ventas en el mes' },
  { value: 'PRIMERA_META', label: 'Primera meta cumplida' },
  { value: 'X_MESES_CONSECUTIVOS', label: 'X meses consecutivos cumpliendo' },
  { value: 'TOP_VENDEDOR_MES', label: 'Top vendedor del mes' },
  { value: 'RACHA_X_SEMANAS', label: 'Racha de X semanas' },
  { value: 'X_PRODUCTOS_ESPECIFICOS', label: 'X productos específicos vendidos' },
  { value: 'CUSTOM', label: 'Custom (definido manualmente)' }
];

const MedalsTab = () => {
  const { medals, addMedal, updateMedal, deleteMedal } = useConfig();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    icon: '🎯',
    description: '',
    xp: '',
    criteria: 'PRIMERA_VENTA',
    givesStreakSaver: false,
    canBeAwardedMultipleTimes: false
  });

  const handleOpenDialog = (id?: number) => {
    if (id) {
      const medal = medals.find(m => m.id === id);
      if (medal) {
        setFormData({
          name: medal.name,
          icon: medal.icon,
          description: medal.description,
          xp: medal.xp.toString(),
          criteria: medal.criteria,
          givesStreakSaver: medal.givesStreakSaver,
          canBeAwardedMultipleTimes: medal.canBeAwardedMultipleTimes
        });
        setEditingId(id);
      }
    } else {
      setFormData({
        name: '',
        icon: '🎯',
        description: '',
        xp: '',
        criteria: 'PRIMERA_VENTA',
        givesStreakSaver: false,
        canBeAwardedMultipleTimes: false
      });
      setEditingId(null);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.description.trim() || !formData.xp || parseInt(formData.xp) <= 0) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos correctamente",
        variant: "destructive"
      });
      return;
    }

    if (formData.name.length > 30) {
      toast({
        title: "Error",
        description: "El nombre no puede tener más de 30 caracteres",
        variant: "destructive"
      });
      return;
    }

    const medalData = {
      name: formData.name,
      icon: formData.icon,
      description: formData.description,
      xp: parseInt(formData.xp),
      criteria: formData.criteria,
      givesStreakSaver: formData.givesStreakSaver,
      canBeAwardedMultipleTimes: formData.canBeAwardedMultipleTimes
    };

    if (editingId) {
      updateMedal(editingId, medalData);
      toast({
        title: "Medalla actualizada",
        description: "Los cambios se guardaron correctamente"
      });
    } else {
      addMedal(medalData);
      toast({
        title: "Medalla creada",
        description: "La medalla se creó correctamente"
      });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMedal(deleteId);
      toast({
        title: "Medalla eliminada",
        description: "La medalla se eliminó correctamente"
      });
      setDeleteId(null);
    }
  };

  const getCriteriaLabel = (criteria: string) => {
    return CRITERIA_OPTIONS.find(c => c.value === criteria)?.label || criteria;
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-smooth-lg border-2">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              🏅 Medallas y Reconocimientos
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Crea y gestiona medallas automáticas
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
                <DialogTitle>{editingId ? 'Editar Medalla' : 'Nueva Medalla'}</DialogTitle>
                <DialogDescription>
                  {editingId ? 'Modifica los datos de la medalla' : 'Completa los datos de la nueva medalla'}
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
                  <Label>Nombre de la Medalla (máx 30 caracteres)</Label>
                  <Input
                    maxLength={30}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Primera Venta"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{formData.name.length}/30 caracteres</p>
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe cómo se obtiene esta medalla"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>XP a Otorgar</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.xp}
                    onChange={(e) => setFormData({ ...formData, xp: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Criterio de Obtención</Label>
                  <Select value={formData.criteria} onValueChange={(value) => setFormData({ ...formData, criteria: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRITERIA_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>¿Otorga recuperador de racha?</Label>
                    <p className="text-xs text-muted-foreground">El usuario recibirá un escudo protector 🛡️</p>
                  </div>
                  <Switch
                    checked={formData.givesStreakSaver}
                    onCheckedChange={(checked) => setFormData({ ...formData, givesStreakSaver: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>¿Se puede obtener múltiples veces?</Label>
                    <p className="text-xs text-muted-foreground">Permitir que un usuario la gane varias veces</p>
                  </div>
                  <Switch
                    checked={formData.canBeAwardedMultipleTimes}
                    onCheckedChange={(checked) => setFormData({ ...formData, canBeAwardedMultipleTimes: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit}>
                  {editingId ? 'Guardar Cambios' : 'Crear Medalla'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {medals.map((medal) => (
            <Card key={medal.id} className="p-6 shadow-smooth-md hover:shadow-smooth-lg transition-all border-2 hover:scale-105">
              <div className="text-center mb-4">
                <div className="text-6xl mb-3">{medal.icon}</div>
                <h3 className="text-lg font-bold text-foreground mb-1">{medal.name}</h3>
                <p className="text-sm text-muted-foreground">{medal.description}</p>
              </div>

              <div className="space-y-2 mb-4">
                <Badge className="w-full justify-center bg-primary/20 text-primary">
                  {medal.xp} XP
                </Badge>
                <Badge variant="outline" className="w-full justify-center text-xs">
                  {getCriteriaLabel(medal.criteria)}
                </Badge>
                {medal.givesStreakSaver && (
                  <Badge className="w-full justify-center bg-accent/20 text-accent">
                    <Shield className="w-3 h-3 mr-1" />
                    Otorga Recuperador
                  </Badge>
                )}
                {medal.canBeAwardedMultipleTimes && (
                  <Badge variant="secondary" className="w-full justify-center text-xs">
                    Múltiples veces
                  </Badge>
                )}
              </div>

              <div className="text-center text-sm text-muted-foreground mb-4">
                Otorgada {medal.timesAwarded} {medal.timesAwarded === 1 ? 'vez' : 'veces'}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDialog(medal.id)}
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
