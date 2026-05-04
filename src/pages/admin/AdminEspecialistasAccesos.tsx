import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Copy, KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';

const DEFAULT_PASSWORD = 'Siigo2026!';

type Esp = {
  id: string;
  user_id: string;
  nombre: string;
  email: string;
  paises: string[];
  operaciones: string[];
};

const AdminEspecialistasAccesos = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Esp[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [resetTarget, setResetTarget] = useState<Esp | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [issuedPwd, setIssuedPwd] = useState<{ email: string; pwd: string } | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('especialista_permisos')
      .select('id,user_id,nombre,email,paises,operaciones')
      .order('nombre');
    if (error) toast({ title: 'Error cargando especialistas', description: error.message, variant: 'destructive' });
    setItems((data || []) as Esp[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const copy = (text: string, label = 'Copiado') => {
    navigator.clipboard.writeText(text);
    toast({ title: label, description: text });
  };

  const genPwd = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p + '!';
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    if (!newPwd || newPwd.length < 8) {
      toast({ title: 'Contraseña inválida', description: 'Mínimo 8 caracteres', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('admin-reset-especialista-password', {
      body: { target_user_id: resetTarget.user_id, new_password: newPwd },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: error?.message || (data as any)?.error, variant: 'destructive' });
      return;
    }
    setIssuedPwd({ email: resetTarget.email, pwd: newPwd });
    setResetTarget(null);
    setNewPwd('');
    toast({ title: 'Contraseña actualizada' });
  };

  return (
    <Layout title="Accesos de Especialistas">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Accesos de Especialistas</h1>
            <p className="text-muted-foreground mt-1">Gestiona credenciales y restablece contraseñas.</p>
          </div>
        </div>

        <Card className="p-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex gap-3">
            <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Sobre las contraseñas</p>
              <p className="text-amber-800/90 dark:text-amber-200/90">
                Por seguridad, las contraseñas se almacenan cifradas y <b>no se pueden recuperar</b>. La contraseña por defecto
                de los especialistas (al ser creados con el seed) es <code className="font-mono bg-background px-1.5 py-0.5 rounded">{DEFAULT_PASSWORD}</code>.
                Si fue cambiada, usa <b>Restablecer</b> para asignar una nueva — solo se mostrará una vez.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Especialista</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Países</TableHead>
                <TableHead>Operaciones</TableHead>
                <TableHead>Contraseña por defecto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay especialistas registrados.</TableCell></TableRow>
              ) : items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nombre}</TableCell>
                  <TableCell>
                    <button onClick={() => copy(e.email, 'Email copiado')} className="hover:underline inline-flex items-center gap-1.5">
                      {e.email} <Copy className="w-3 h-3 opacity-60" />
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(e.paises || []).map(p => <Badge key={p} variant="secondary">{p}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(e.operaciones || []).map(o => <Badge key={o} variant="outline">{o}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {revealed[e.id] ? DEFAULT_PASSWORD : '•'.repeat(DEFAULT_PASSWORD.length)}
                      </code>
                      <Button size="sm" variant="ghost" onClick={() => setRevealed(r => ({ ...r, [e.id]: !r[e.id] }))}>
                        {revealed[e.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => copy(DEFAULT_PASSWORD, 'Contraseña copiada')}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => { setResetTarget(e); setNewPwd(genPwd()); }}>
                      <KeyRound className="w-4 h-4 mr-1.5" /> Restablecer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Dialog Reset */}
      <Dialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              {resetTarget && <>Se asignará una nueva contraseña a <b>{resetTarget.nombre}</b> ({resetTarget.email}). Comparte la contraseña por un canal seguro.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Nueva contraseña</label>
            <div className="flex gap-2">
              <Input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="font-mono" />
              <Button type="button" variant="outline" onClick={() => setNewPwd(genPwd())}>Generar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetTarget(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={submitReset} disabled={busy}>{busy ? 'Aplicando…' : 'Aplicar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog mostrar pwd nueva */}
      <Dialog open={!!issuedPwd} onOpenChange={(o) => !o && setIssuedPwd(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraseña asignada</DialogTitle>
            <DialogDescription>
              Cópiala ahora. Por seguridad no podrás verla nuevamente.
            </DialogDescription>
          </DialogHeader>
          {issuedPwd && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <code className="font-mono text-sm">{issuedPwd.email}</code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contraseña</p>
                <div className="flex gap-2 items-center">
                  <code className="font-mono text-base bg-muted px-3 py-2 rounded flex-1">{issuedPwd.pwd}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(issuedPwd.pwd, 'Contraseña copiada')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIssuedPwd(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminEspecialistasAccesos;
