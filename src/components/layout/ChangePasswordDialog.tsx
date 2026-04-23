import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn('material-icons-round', className)}>{icon}</span>
);

const ChangePasswordDialog = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (pwd.length < 8) {
      toast({ title: 'Contraseña muy corta', description: 'Mínimo 8 caracteres.', variant: 'destructive' });
      return;
    }
    if (pwd !== pwd2) {
      toast({ title: 'No coinciden', description: 'Las contraseñas no son iguales.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Contraseña actualizada', description: 'Tu nueva contraseña está activa.' });
    setPwd(''); setPwd2(''); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="h-9 w-9 rounded-full bg-muted hover:bg-muted/70 border border-border flex items-center justify-center transition-colors"
          title="Cambiar contraseña"
          aria-label="Cambiar contraseña"
        >
          <MI icon="lock_reset" className="text-base text-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MI icon="lock_reset" className="text-primary" /> Cambiar contraseña
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">Nueva contraseña</Label>
            <Input id="new-pwd" type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pwd">Confirmar contraseña</Label>
            <Input id="confirm-pwd" type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} placeholder="Repite la contraseña" />
          </div>
          <p className="text-xs text-muted-foreground">
            Tu sesión seguirá activa después del cambio.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
