import { useState } from 'react';
import { useConfig } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const LevelsTab = () => {
  const { levels, updateLevelRange } = useConfig();
  const { toast } = useToast();
  const [editingLevels, setEditingLevels] = useState<{ [key: string]: string }>({});

  const handleMaxXPChange = (level: string, value: string) => {
    setEditingLevels({ ...editingLevels, [level]: value });
  };

  const handleSave = () => {
    Object.entries(editingLevels).forEach(([level, maxXP]) => {
      const numericMaxXP = parseInt(maxXP);
      if (!isNaN(numericMaxXP) && numericMaxXP > 0) {
        updateLevelRange(level, numericMaxXP);
      }
    });
    setEditingLevels({});
    toast({
      title: "Niveles actualizados",
      description: "Los rangos de XP se guardaron correctamente"
    });
  };

  const getExampleXP = (level: string) => {
    const examples: { [key: string]: number } = {
      'Novato': 250,
      'Junior': 1000,
      'Senior': 2500,
      'Master': 5000,
      'Imparable': 10000
    };
    return examples[level] || 0;
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-smooth-lg border-2">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            ⭐ Niveles y Rangos de Experiencia
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configura cuántos XP se necesitan para cada nivel
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {levels.map((level, index) => {
            const currentMax = editingLevels[level.level] || level.maxXP.toString();
            const exampleXP = getExampleXP(level.level);
            const isInLevel = exampleXP >= level.minXP && exampleXP <= level.maxXP;

            return (
              <Card 
                key={level.level} 
                className="p-6 shadow-smooth-md hover:shadow-smooth-lg transition-all border-2"
                style={{ 
                  borderColor: level.color.includes('gradient') ? '#8B5CF6' : level.color,
                  background: level.color.includes('gradient') 
                    ? `linear-gradient(135deg, ${level.color.split(',').slice(1).join(',')})` 
                    : undefined
                }}
              >
                <div className="text-center mb-4">
                  <div className="text-5xl mb-3">{level.icon}</div>
                  <h3 className="text-xl font-bold text-foreground">{level.level}</h3>
                </div>

                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Rango Actual</p>
                    <p className="text-foreground font-bold">
                      {level.minXP.toLocaleString()} - {level.maxXP.toLocaleString()} XP
                    </p>
                  </div>

                  {index < levels.length - 1 && (
                    <div>
                      <Label className="text-xs">XP Máximo</Label>
                      <Input
                        type="number"
                        min={level.minXP}
                        value={currentMax}
                        onChange={(e) => handleMaxXPChange(level.level, e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div className={`p-3 rounded-lg ${isInLevel ? 'bg-primary/10 border-2 border-primary' : 'bg-muted/30'}`}>
                    <p className="text-xs text-muted-foreground mb-1">Preview</p>
                    <p className="text-sm font-semibold text-foreground">
                      {isInLevel ? '✅' : '⚪'} Con {exampleXP.toLocaleString()} XP
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {Object.keys(editingLevels).length > 0 && (
          <div className="flex justify-end">
            <Button 
              onClick={handleSave}
              className="bg-gradient-primary hover:opacity-90"
            >
              Guardar Cambios
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6 shadow-smooth-lg border-2 bg-muted/30">
        <h3 className="text-lg font-bold text-foreground mb-3">Vista Previa del Sistema</h3>
        <div className="space-y-2">
          {levels.map((level, index) => (
            <div key={level.level} className="flex items-center gap-3">
              <div className="text-2xl">{level.icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-foreground">{level.level}</span>
                  <span className="text-sm text-muted-foreground">
                    {level.minXP.toLocaleString()} - {level.maxXP.toLocaleString()} XP
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-300"
                    style={{ 
                      width: `${((index + 1) / levels.length) * 100}%`,
                      background: level.color.includes('gradient') ? level.color : level.color
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default LevelsTab;
