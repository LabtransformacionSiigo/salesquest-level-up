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
import { Copy, KeyRound, Eye, EyeOff, ShieldAlert, Pencil, CheckCircle2, XCircle, Loader2, Users } from 'lucide-react';

const DEFAULT_PASSWORD = 'Siigo2026!';

type Esp = {
  id: string;
  user_id: string;
  nombre: string;
  email: string;
  paises: string[];
  operaciones: string[];
};

type Apr = {
  id: string;
  nombre: string | null;
  email: string | null;
  paises: string[];
  operaciones: string[];
};

const AdminEspecialistasAccesos = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Esp[]>([]);
  const [aprobadores, setAprobadores] = useState<Apr[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [resetTarget, setResetTarget] = useState<Esp | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [issuedPwd, setIssuedPwd] = useState<{ email: string; pwd: string } | null>(null);

  // Edit email
  const [editTarget, setEditTarget] = useState<Esp | null>(null);
  const [newEmail, setNewEmail] = useState('');

  // Login verification
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, 'ok' | 'fail'>>({});

  const fetchItems = async () => {
    setLoading(true);
    const [esp, apr] = await Promise.all([
      supabase.from('especialista_permisos').select('id,user_id,nombre,email,paises,operaciones').order('nombre'),
      supabase.from('aprobador_permisos').select('id,nombre,email,paises,operaciones').order('nombre'),
    ]);
    if (esp.error) toast({ title: 'Error cargando especialistas', description: esp.error.message, variant: 'destructive' });
    if (apr.error) toast({ title: 'Error cargando aprobadores', description: apr.error.message, variant: 'destructive' });
    setItems((esp.data || []) as Esp[]);
    setAprobadores((apr.data || []) as Apr[]);
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

  const submitEditEmail = async () => {
    if (!editTarget) return;
    const next = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast({ title: 'Email inválido', variant: 'destructive' });
      return;
    }
    if (next === editTarget.email.toLowerCase()) {
      setEditTarget(null);
      return;
    }
    setBusy(true);
    // 1. Update auth + gerentes via existing function (updates auth.users by old email)
    const { data, error } = await supabase.functions.invoke('update-user-email', {
      body: { updates: [{ old_email: editTarget.email, new_email: next }] },
    });
    if (error) {
      setBusy(false);
      toast({ title: 'Error actualizando auth', description: error.message, variant: 'destructive' });
      return;
    }
    const result = (data as any)?.results?.[0];
    if (result?.status !== 'ok') {
      setBusy(false);
      toast({ title: 'Error', description: result?.error || result?.status || 'No se pudo actualizar', variant: 'destructive' });
      return;
    }
    // 2. Update especialista_permisos.email
    const { error: epErr } = await supabase
      .from('especialista_permisos')
      .update({ email: next })
      .eq('id', editTarget.id);
    setBusy(false);
    if (epErr) {
      toast({ title: 'Auth actualizado pero falló especialista_permisos', description: epErr.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Email actualizado', description: `${editTarget.email} → ${next}` });
    setEditTarget(null);
    setNewEmail('');
    // Clear cached verification for this row
    setVerifyResult(prev => { const cp = { ...prev }; delete cp[editTarget.id]; return cp; });
    fetchItems();
  };

  const verifyLogin = async (e: Esp) => {
    setVerifying(e.id);
    try {
      // Try login with default password using a separate ephemeral client by signing out current admin? NO — that would log the admin out.
      // Instead: call signInWithPassword via fetch using a fresh anon flow against /auth/v1/token.
      const url = (import.meta as any).env.VITE_SUPABASE_URL;
      const key = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify({ email: e.email, password: DEFAULT_PASSWORD }),
      });
      const ok = res.ok;
      setVerifyResult(prev => ({ ...prev, [e.id]: ok ? 'ok' : 'fail' }));
      toast({
        title: ok ? '✅ Login válido' : '❌ Login falló',
        description: ok ? `${e.email} puede entrar con la contraseña por defecto.` : `La contraseña por defecto NO funciona para ${e.email}. Restablécela.`,
        variant: ok ? 'default' : 'destructive',
      });
    } catch (err: any) {
      setVerifyResult(prev => ({ ...prev, [e.id]: 'fail' }));
      toast({ title: 'Error verificando', description: err.message, variant: 'destructive' });
    } finally {
      setVerifying(null);
    }
  };

  // Match aprobadores by país (any overlap) + operación (any overlap)
  const aprobadoresFor = (e: Esp): Apr[] => {
    return aprobadores.filter(a => {
      const paisOverlap = (a.paises || []).some(p => e.paises.includes(p));
      const opOverlap = (a.operaciones || []).some(o => e.operaciones.includes(o));
      return paisOverlap && opOverlap;
    });
  };

  return (
    <Layout title="Accesos de Especialistas">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Accesos de Especialistas</h1>
            <p className="text-muted-foreground mt-1">Gestiona credenciales, edita correos y revisa aprobadores asignados.</p>
          </div>
        </div>

        <Card className="p-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex gap-3">
            <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Sobre las contraseñas</p>
              <p className="text-amber-800/90 dark:text-amber-200/90">
                Por seguridad, las contraseñas se almacenan cifradas y <b>no se pueden recuperar</b>. La contraseña por defecto
                (al ser creados con el seed) es <code className="font-mono bg-background px-1.5 py-0.5 rounded">{DEFAULT_PASSWORD}</code>.
                Usa <b>Verificar</b> para comprobar si funciona y <b>Restablecer</b> si necesitas asignar una nueva.
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
                <TableHead>Países / Frente</TableHead>
                <TableHead>Aprobadores asignados</TableHead>
                <TableHead>Login por defecto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay especialistas registrados.</TableCell></TableRow>
              ) : items.map((e) => {
                const aprs = aprobadoresFor(e);
                const status = verifyResult[e.id];
                return (
                  <TableRow key={e.id} className="align-top">
                    <TableCell className="font-medium">{e.nombre}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => copy(e.email, 'Email copiado')} className="hover:underline inline-flex items-center gap-1.5">
                          {e.email} <Copy className="w-3 h-3 opacity-60" />
                        </button>
                        <Button
                          size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => { setEditTarget(e); setNewEmail(e.email); }}
                          title="Editar email"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {(e.paises || []).map(p => <Badge key={p} variant="secondary">{p}</Badge>)}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(e.operaciones || []).map(o => <Badge key={o} variant="outline" className="text-xs">{o}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {aprs.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Sin aprobadores</span>
                      ) : (
                        <div className="space-y-1 max-w-xs">
                          {aprs.map(a => (
                            <div key={a.id} className="flex items-center gap-1.5 text-xs">
                              <Users className="w-3 h-3 text-primary shrink-0" />
                              <span className="font-medium truncate">{a.nombre}</span>
                              <span className="text-muted-foreground truncate">({a.email})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {revealed[e.id] ? DEFAULT_PASSWORD : '•'.repeat(DEFAULT_PASSWORD.length)}
                        </code>
                        <Button size="sm" variant="ghost" onClick={() => setRevealed(r => ({ ...r, [e.id]: !r[e.id] }))}>
                          {revealed[e.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        {status === 'ok' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                        {status === 'fail' && <XCircle className="w-4 h-4 text-destructive" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => verifyLogin(e)} disabled={verifying === e.id}>
                          {verifying === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                          {verifying === e.id ? '' : 'Verificar'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setResetTarget(e); setNewPwd(genPwd()); }}>
                          <KeyRound className="w-4 h-4 mr-1.5" /> Restablecer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Dialog Edit Email */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar email</DialogTitle>
            <DialogDescription>
              {editTarget && <>Se actualizará el correo de <b>{editTarget.nombre}</b>. Esto cambia el email de inicio de sesión y el registro en la base de datos.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Email actual</label>
            <Input value={editTarget?.email || ''} disabled className="font-mono" />
            <label className="text-sm font-medium">Nuevo email</label>
            <Input type="email" value={newEmail} onChange={(ev) => setNewEmail(ev.target.value)} className="font-mono" placeholder="nuevo@siigo.com" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={submitEditEmail} disabled={busy}>{busy ? 'Aplicando…' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
