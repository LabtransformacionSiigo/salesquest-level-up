import { useState } from 'react';
import { useConfig } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

const RecognitionsTab = () => {
  const { recognitions, updateRecognition } = useConfig();
  const { toast } = useToast();
  const [weeklyLimit, setWeeklyLimit] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const handleRecognitionChange = (id: number, field: string, value: any) => {
    updateRecognition(id, { [field]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    toast({
      title: "Configuración guardada",
      description: "Los cambios en reconocimientos se guardaron correctamente"
    });
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-smooth-lg border-2">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            💌 Sistema de Reconocimientos
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configura los valores culturales y sus multiplicadores
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {recognitions.map((recognition) => (
            <Card 
              key={recognition.id} 
              className="p-6 shadow-smooth-md hover:shadow-smooth-lg transition-all border-2"
              style={{ borderColor: recognition.color }}
            >
              <div className="text-center mb-4">
                <div 
                  className="text-5xl mb-3 inline-block p-4 rounded-full"
                  style={{ backgroundColor: `${recognition.color}20` }}
                >
                  {recognition.emoji}
                </div>
                <h3 className="text-sm font-bold text-foreground leading-tight">
                  {recognition.name}
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs">XP por reconocimiento</Label>
                  <Input
                    type="number"
                    min="1"
                    value={recognition.xpPerRecognition}
                    onChange={(e) => handleRecognitionChange(recognition.id, 'xpPerRecognition', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Cantidad para multiplicador</Label>
                  <Input
                    type="number"
                    min="1"
                    value={recognition.multiplierThreshold}
                    onChange={(e) => handleRecognitionChange(recognition.id, 'multiplierThreshold', parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Tipo de multiplicador</Label>
                  <Select 
                    value={recognition.multiplierType} 
                    onValueChange={(value) => handleRecognitionChange(recognition.id, 'multiplierType', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="x2">x2 (Doble)</SelectItem>
                      <SelectItem value="x3">x3 (Triple)</SelectItem>
                      <SelectItem value="x4">x4 (Cuádruple)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Duración</Label>
                    <Input
                      type="number"
                      min="1"
                      value={recognition.multiplierDuration}
                      onChange={(e) => handleRecognitionChange(recognition.id, 'multiplierDuration', parseInt(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unidad</Label>
                    <Select 
                      value={recognition.multiplierDurationUnit} 
                      onValueChange={(value) => handleRecognitionChange(recognition.id, 'multiplierDurationUnit', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="días">Días</SelectItem>
                        <SelectItem value="semanas">Semanas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Con {recognition.multiplierThreshold} reconocimientos → {recognition.multiplierType} por {recognition.multiplierDuration} {recognition.multiplierDurationUnit}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {hasChanges && (
          <div className="flex justify-end">
            <Button onClick={handleSave} className="bg-gradient-primary">
              Guardar Cambios
            </Button>
          </div>
        )}
      </Card>

      {/* Reglas del Sistema */}
      <Card className="p-6 shadow-smooth-lg border-2">
        <h3 className="text-lg font-semibold text-foreground mb-4">Reglas del Sistema</h3>
        
        <div className="flex items-center justify-between p-3 border rounded-lg mb-4">
          <div>
            <Label>Límite de envío semanal</Label>
            <p className="text-xs text-muted-foreground">Los usuarios pueden enviar 1 reconocimiento por semana</p>
          </div>
          <Switch
            checked={weeklyLimit}
            onCheckedChange={setWeeklyLimit}
          />
        </div>

        <Card className="p-4 bg-muted/30">
          <h4 className="font-semibold text-foreground mb-2">ℹ️ Información Importante</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Los reconocimientos fortalecen la cultura organizacional</li>
            <li>• Los multiplicadores incentivan el reconocimiento constante</li>
            <li>• Los 6 valores son fijos y representan pilares culturales</li>
            {weeklyLimit && <li>• Cada ejecutivo puede enviar máximo 1 reconocimiento por semana</li>}
          </ul>
        </Card>
      </Card>

      {/* Preview de Multiplicador */}
      <Card className="p-6 shadow-smooth-lg border-2 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
        <h3 className="text-lg font-semibold text-foreground mb-4">Vista Previa de Multiplicador</h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-4 bg-background/50">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Sin multiplicador</p>
            <p className="text-2xl font-bold text-foreground mb-1">15 XP</p>
            <p className="text-xs text-muted-foreground">Venta normal</p>
          </Card>
          
          <Card className="p-4 bg-primary/10 border-2 border-primary">
            <p className="text-sm font-semibold text-primary mb-2">✨ Con multiplicador x2 activo</p>
            <p className="text-2xl font-bold text-primary mb-1">30 XP</p>
            <p className="text-xs text-muted-foreground">¡Ganancia doble!</p>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          💡 Los multiplicadores activos duplican, triplican o cuadruplican todo el XP ganado
        </p>
      </Card>
    </div>
  );
};

export default RecognitionsTab;
