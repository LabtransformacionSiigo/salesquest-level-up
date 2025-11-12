import { useState } from 'react';
import { useConfig } from '@/context/ConfigContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Flame } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const StreaksTab = () => {
  const { streakXP, streakSaverSettings, updateStreakXP, addStreakWeek, deleteStreakWeek, updateStreakSaverSettings } = useConfig();
  const { toast } = useToast();
  const [simulatedWeeks, setSimulatedWeeks] = useState(8);

  const handleXPChange = (week: number | string, value: string) => {
    const numericValue = parseInt(value);
    if (!isNaN(numericValue) && numericValue >= 0) {
      updateStreakXP(week, numericValue);
    }
  };

  const calculateTotalXP = (weeks: number) => {
    let total = 0;
    for (let i = 1; i <= weeks; i++) {
      const streak = streakXP.find(s => {
        if (typeof s.week === 'number') {
          return s.week === i;
        } else {
          return i >= parseInt(s.week);
        }
      });
      
      if (streak) {
        total += streak.xp;
      } else {
        const lastStreak = streakXP[streakXP.length - 1];
        total += lastStreak.xp;
      }
    }
    return total;
  };

  const handleSaveSettings = () => {
    toast({
      title: "Configuración guardada",
      description: "Los cambios del sistema de rachas se guardaron correctamente"
    });
  };

  return (
    <div className="space-y-6">
      {/* Tabla de XP por Semana */}
      <Card className="p-6 shadow-smooth-lg border-2">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            🔥 Sistema de Rachas de Login
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configura cuántos XP ganan los ejecutivos por mantener su racha
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">XP por Semana de Racha</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Semana</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">XP Otorgados</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {streakXP.map((streak) => (
                  <tr key={streak.week} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">
                      {typeof streak.week === 'number' ? `Semana ${streak.week}` : `Semana ${streak.week}`}
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        type="number"
                        min="0"
                        value={streak.xp}
                        onChange={(e) => handleXPChange(streak.week, e.target.value)}
                        className="w-32"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteStreakWeek(streak.week)}
                          disabled={streakXP.length <= 1}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addStreakWeek}
            className="mt-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Semana
          </Button>
        </div>
      </Card>

      {/* Recuperadores de Racha */}
      <Card className="p-6 shadow-smooth-lg border-2">
        <h3 className="text-lg font-semibold text-foreground mb-4">Recuperadores de Racha 🛡️</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label>¿Permitir recuperadores de racha?</Label>
              <p className="text-xs text-muted-foreground">Los ejecutivos pueden proteger su racha un día</p>
            </div>
            <Switch
              checked={streakSaverSettings.enabled}
              onCheckedChange={(checked) => updateStreakSaverSettings({ enabled: checked })}
            />
          </div>

          {streakSaverSettings.enabled && (
            <>
              <div>
                <Label>Máximo de recuperadores por ejecutivo</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={streakSaverSettings.maxPerExecutive}
                  onChange={(e) => updateStreakSaverSettings({ maxPerExecutive: parseInt(e.target.value) })}
                  className="w-32 mt-2"
                />
              </div>

              <div className="border rounded-lg p-4">
                <Label className="mb-3 block">Formas de obtener recuperadores</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="medals"
                      checked={streakSaverSettings.sources.medals}
                      onCheckedChange={(checked) => 
                        updateStreakSaverSettings({ 
                          sources: { ...streakSaverSettings.sources, medals: checked as boolean }
                        })
                      }
                    />
                    <label htmlFor="medals" className="text-sm font-medium">
                      Por medallas específicas
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="missions"
                      checked={streakSaverSettings.sources.missions}
                      onCheckedChange={(checked) => 
                        updateStreakSaverSettings({ 
                          sources: { ...streakSaverSettings.sources, missions: checked as boolean }
                        })
                      }
                    />
                    <label htmlFor="missions" className="text-sm font-medium">
                      Por completar X misiones
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="masterLevel"
                      checked={streakSaverSettings.sources.masterLevel}
                      onCheckedChange={(checked) => 
                        updateStreakSaverSettings({ 
                          sources: { ...streakSaverSettings.sources, masterLevel: checked as boolean }
                        })
                      }
                    />
                    <label htmlFor="masterLevel" className="text-sm font-medium">
                      Por alcanzar nivel Master o superior
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="monthlyGoal"
                      checked={streakSaverSettings.sources.monthlyGoal}
                      onCheckedChange={(checked) => 
                        updateStreakSaverSettings({ 
                          sources: { ...streakSaverSettings.sources, monthlyGoal: checked as boolean }
                        })
                      }
                    />
                    <label htmlFor="monthlyGoal" className="text-sm font-medium">
                      Al cumplir meta del mes
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveSettings} className="bg-gradient-primary">
            Guardar Configuración
          </Button>
        </div>
      </Card>

      {/* Preview Visual */}
      <Card className="p-6 shadow-smooth-lg border-2 bg-gradient-to-br from-orange-500/10 to-red-500/10">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Simulador de Rachas
        </h3>
        
        <div className="mb-4">
          <Label>Simular racha de semanas:</Label>
          <Input
            type="number"
            min="1"
            max="52"
            value={simulatedWeeks}
            onChange={(e) => setSimulatedWeeks(parseInt(e.target.value) || 1)}
            className="w-32 mt-2"
          />
        </div>

        <Card className="p-6 bg-background/50">
          <div className="text-center">
            <div className="text-6xl mb-4">🔥</div>
            <p className="text-3xl font-bold text-foreground mb-2">{simulatedWeeks} Semanas</p>
            <p className="text-muted-foreground mb-4">de racha consecutiva</p>
            <div className="inline-block bg-primary/20 text-primary px-6 py-3 rounded-lg">
              <p className="text-sm font-semibold mb-1">XP Total Acumulado</p>
              <p className="text-4xl font-bold">{calculateTotalXP(simulatedWeeks)} XP</p>
            </div>
          </div>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          💡 Mantener una racha largo plazo es una gran fuente de XP
        </p>
      </Card>
    </div>
  );
};

export default StreaksTab;
