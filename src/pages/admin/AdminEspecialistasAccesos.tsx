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
import { Copy, KeyRound, Eye, EyeOff, ShieldAlert, Pencil, CheckCircle2, XCircle, Loader2, Users, Link2, Settings2, UserPlus, RefreshCw, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const CANALES_DISPONIBLES = ['VC', 'VN_ALIADOS', 'VN_EMPRESARIOS'] as const;
const PAISES_DISPONIBLES = ['COL', 'ECU', 'MEX', 'URY', 'ARG', 'CHL'] as const;
const OPERACIONES_DISPONIBLES = ['Venta Nueva (Empresarios)', 'Venta Nueva (Aliados)', 'Venta Cruzada'] as const;

const askPassword = (label: string): string | null => {
  const p = window.prompt(`Escribe la contraseña a aplicar para ${label} (mínimo 8 caracteres):`, '');
  if (!p || p.trim().length < 8) return null;
  return p.trim();
};

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

type Director = {
  id: string;
  user_id: string | null;
  nombre: string;
  email: string;
  cargo: string | null;
  canales: string[];
  paises: string[];
  activo: boolean;
};

const AdminEspecialistasAccesos = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Esp[]>([]);
  const [aprobadores, setAprobadores] = useState<Apr[]>([]);
  const [directores, setDirectores] = useState<Director[]>([]);
  const [linkingDir, setLinkingDir] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [resetTarget, setResetTarget] = useState<Esp | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [issuedPwd, setIssuedPwd] = useState<{ email: string; pwd: string } | null>(null);

  // Edit email
  const [editTarget, setEditTarget] = useState<Esp | null>(null);
  const [newEmail, setNewEmail] = useState('');

  // Edit director scope (canales/paises)
  const [scopeTarget, setScopeTarget] = useState<Director | null>(null);
  const [scopeCanales, setScopeCanales] = useState<string[]>([]);
  const [scopePaises, setScopePaises] = useState<string[]>([]);
  const [savingScope, setSavingScope] = useState(false);

  // Nuevo / Reemplazar especialista
  const [espForm, setEspForm] = useState<null | {
    mode: 'new' | 'replace';
    revoke_user_id?: string;
    revoke_label?: string;
    nombre: string;
    email: string;
    paises: string[];
    operaciones: string[];
    password: string;
  }>(null);
  const [savingEsp, setSavingEsp] = useState(false);

  // Nuevo director
  const [dirForm, setDirForm] = useState<null | {
    nombre: string;
    email: string;
    cargo: string;
    canales: string[];
    paises: string[];
    password: string;
  }>(null);
  const [savingDir, setSavingDir] = useState(false);

  const openScopeDialog = (d: Director) => {
    setScopeTarget(d);
    setScopeCanales([...(d.canales || [])]);
    setScopePaises([...(d.paises || [])]);
  };

  const toggleInArr = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const saveScope = async () => {
    if (!scopeTarget) return;
    if (scopeCanales.length === 0 || scopePaises.length === 0) {
      toast({ title: 'Selecciona al menos un canal y un país', variant: 'destructive' });
      return;
    }
    setSavingScope(true);
    const { error } = await (supabase as any)
      .from('directores')
      .update({ canales: scopeCanales, paises: scopePaises })
      .eq('id', scopeTarget.id);
    setSavingScope(false);
    if (error) {
      toast({ title: 'Error guardando', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Alcance actualizado', description: `${scopeTarget.nombre} ahora ve ${scopeCanales.join(', ')} en ${scopePaises.join(', ')}.` });
    setScopeTarget(null);
    fetchItems();
  };

  // Dummy reference to keep imports tidy
  void Eye; void EyeOff;

  // Login verification
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, 'ok' | 'fail'>>({});

  const fetchItems = async () => {
    setLoading(true);
    const [esp, apr, dir] = await Promise.all([
      supabase.from('especialista_permisos').select('id,user_id,nombre,email,paises,operaciones').order('nombre'),
      supabase.from('aprobador_permisos').select('id,nombre,email,paises,operaciones').order('nombre'),
      (supabase as any).from('directores').select('id,user_id,nombre,email,cargo,canales,paises,activo').order('nombre'),
    ]);
    if (esp.error) toast({ title: 'Error cargando especialistas', description: esp.error.message, variant: 'destructive' });
    if (apr.error) toast({ title: 'Error cargando aprobadores', description: apr.error.message, variant: 'destructive' });
    if (dir.error) toast({ title: 'Error cargando directores', description: dir.error.message, variant: 'destructive' });
    setItems((esp.data || []) as Esp[]);
    setAprobadores((apr.data || []) as Apr[]);
    setDirectores((dir.data || []) as Director[]);
    setLoading(false);
  };

  const vincularDirector = async (d: Director) => {
    const pwd = askPassword(d.nombre || d.email);
    if (!pwd) {
      toast({ title: 'Contraseña requerida', description: 'Mínimo 8 caracteres', variant: 'destructive' });
      return;
    }
    setLinkingDir(d.id);
    try {
      const { data, error } = await supabase.functions.invoke('link-director-user', {
        body: { director_id: d.id, email: d.email, nombre: d.nombre, default_password: pwd },
      });
      if (error || (data as any)?.error) {
        toast({ title: 'Error vinculando', description: error?.message || (data as any)?.error, variant: 'destructive' });
        return;
      }
      toast({ title: '✅ Director vinculado', description: `${d.email} ahora puede iniciar sesión con la contraseña que escribiste.` });
      fetchItems();
    } finally {
      setLinkingDir(null);
    }
  };

  const toggleDirectorActivo = async (d: Director) => {
    const { error } = await (supabase as any).from('directores').update({ activo: !d.activo }).eq('id', d.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: d.activo ? 'Director desactivado' : 'Director activado' });
    fetchItems();
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
    const pwd = askPassword(`probar login de ${e.email}`);
    if (!pwd) return;
    setVerifying(e.id);
    try {
      const url = (import.meta as any).env.VITE_SUPABASE_URL;
      const key = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify({ email: e.email, password: pwd }),
      });
      const ok = res.ok;
      setVerifyResult(prev => ({ ...prev, [e.id]: ok ? 'ok' : 'fail' }));
      toast({
        title: ok ? '✅ Login válido' : '❌ Login falló',
        description: ok ? `${e.email} puede entrar con la contraseña que escribiste.` : `La contraseña NO funciona para ${e.email}. Restablécela.`,
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

  const submitEspForm = async () => {
    if (!espForm) return;
    const email = espForm.email.trim().toLowerCase();
    if (!espForm.nombre.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Nombre y email válido requeridos', variant: 'destructive' });
      return;
    }
    if (espForm.paises.length === 0 || espForm.operaciones.length === 0) {
      toast({ title: 'Selecciona país y frente', variant: 'destructive' });
      return;
    }
    if (!espForm.password || espForm.password.length < 8) {
      toast({ title: 'Contraseña mínimo 8 caracteres', variant: 'destructive' });
      return;
    }
    setSavingEsp(true);
    const { data, error } = await supabase.functions.invoke('admin-upsert-especialista', {
      body: {
        email,
        nombre: espForm.nombre.trim(),
        paises: espForm.paises,
        operaciones: espForm.operaciones,
        password: espForm.password,
        revoke_user_id: espForm.mode === 'replace' ? espForm.revoke_user_id : undefined,
      },
    });
    setSavingEsp(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: error?.message || (data as any)?.error, variant: 'destructive' });
      return;
    }
    setIssuedPwd({ email, pwd: espForm.password });
    setEspForm(null);
    toast({ title: espForm.mode === 'replace' ? '✅ Especialista reemplazado' : '✅ Especialista creado' });
    fetchItems();
  };

  const submitDirForm = async () => {
    if (!dirForm) return;
    const email = dirForm.email.trim().toLowerCase();
    if (!dirForm.nombre.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Nombre y email válido requeridos', variant: 'destructive' });
      return;
    }
    if (dirForm.canales.length === 0 || dirForm.paises.length === 0) {
      toast({ title: 'Selecciona canal y país', variant: 'destructive' });
      return;
    }
    if (!dirForm.password || dirForm.password.length < 8) {
      toast({ title: 'Contraseña mínimo 8 caracteres', variant: 'destructive' });
      return;
    }
    setSavingDir(true);
    const { data, error } = await supabase.functions.invoke('link-director-user', {
      body: {
        email,
        nombre: dirForm.nombre.trim(),
        cargo: dirForm.cargo.trim() || null,
        canales: dirForm.canales,
        paises: dirForm.paises,
        default_password: dirForm.password,
      },
    });
    setSavingDir(false);
    if (error || (data as any)?.error) {
      toast({ title: 'Error', description: error?.message || (data as any)?.error, variant: 'destructive' });
      return;
    }
    setIssuedPwd({ email, pwd: dirForm.password });
    setDirForm(null);
    toast({ title: '✅ Director creado y vinculado' });
    fetchItems();
  };

  return (
    <Layout title="Accesos de Especialistas">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Accesos de Especialistas</h1>
            <p className="text-muted-foreground mt-1">Gestiona credenciales, edita correos y revisa aprobadores asignados.</p>
          </div>
          <Button
            onClick={() => setEspForm({ mode: 'new', nombre: '', email: '', paises: [], operaciones: [], password: genPwd() })}
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> Nuevo especialista
          </Button>
        </div>

        <Card className="p-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex gap-3">
            <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Sobre las contraseñas</p>
              <p className="text-amber-800/90 dark:text-amber-200/90">
                Por seguridad, las contraseñas se almacenan cifradas y <b>no se pueden recuperar</b>.
                Cada acción (vincular, verificar, restablecer) te pedirá una contraseña nueva en el momento — no se conservan valores por defecto en el código.
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
                        <span className="text-xs text-muted-foreground">No almacenada en cliente</span>
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEspForm({
                            mode: 'replace',
                            revoke_user_id: e.user_id,
                            revoke_label: `${e.nombre} (${e.email})`,
                            nombre: '',
                            email: '',
                            paises: [...(e.paises || [])],
                            operaciones: [...(e.operaciones || [])],
                            password: genPwd(),
                          })}
                          title="Reemplazar por otra persona"
                        >
                          <RefreshCw className="w-4 h-4 mr-1.5" /> Reemplazar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Directores */}
        <div className="flex items-start justify-between gap-4 pt-4">
          <div>
            <h2 className="text-2xl font-bold">Directores</h2>
            <p className="text-muted-foreground mt-1">
              Vincula a los directores con su usuario de autenticación para que accedan al Panel Director.
              Cada uno solo verá los gerentes/asesores de los canales y países asignados.
            </p>
          </div>
          <Button
            onClick={() => setDirForm({ nombre: '', email: '', cargo: '', canales: [], paises: [], password: genPwd() })}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo director
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Director</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Canales</TableHead>
                <TableHead>Países</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
              ) : directores.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay directores registrados.</TableCell></TableRow>
              ) : directores.map((d) => (
                <TableRow key={d.id} className="align-top">
                  <TableCell className="font-medium">{d.nombre}</TableCell>
                  <TableCell>
                    <button onClick={() => copy(d.email, 'Email copiado')} className="hover:underline inline-flex items-center gap-1.5 font-mono text-sm">
                      {d.email} <Copy className="w-3 h-3 opacity-60" />
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.cargo || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(d.canales || []).map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(d.paises || []).map(p => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {d.user_id ? (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Vinculado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
                        Sin vincular
                      </Badge>
                    )}
                    {!d.activo && <Badge variant="destructive" className="ml-1 text-xs">Inactivo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => openScopeDialog(d)} title="Editar canales y países">
                        <Settings2 className="w-4 h-4 mr-1.5" /> Editar alcance
                      </Button>
                      <Button
                        size="sm"
                        variant={d.user_id ? 'outline' : 'default'}
                        onClick={() => vincularDirector(d)}
                        disabled={linkingDir === d.id}
                      >
                        {linkingDir === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4 mr-1.5" />}
                        {d.user_id ? 'Re-vincular' : 'Vincular usuario'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleDirectorActivo(d)}>
                        {d.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>



      {/* Dialog Editar alcance (canales/países del director) */}
      <Dialog open={!!scopeTarget} onOpenChange={(o) => !o && setScopeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar canales y países</DialogTitle>
            <DialogDescription>
              {scopeTarget && (
                <>Cambia el alcance de <b>{scopeTarget.nombre}</b>. El Panel Director filtra automáticamente los gerentes/asesores con base en esta configuración — la lógica de visualización se mantiene.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium mb-2">Canales (frente)</p>
              <div className="grid grid-cols-2 gap-2">
                {CANALES_DISPONIBLES.map(c => (
                  <label key={c} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={scopeCanales.includes(c)}
                      onCheckedChange={() => setScopeCanales(prev => toggleInArr(prev, c))}
                    />
                    <span className="text-sm font-medium">{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Países</p>
              <div className="grid grid-cols-3 gap-2">
                {PAISES_DISPONIBLES.map(p => (
                  <label key={p} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={scopePaises.includes(p)}
                      onCheckedChange={() => setScopePaises(prev => toggleInArr(prev, p))}
                    />
                    <span className="text-sm font-medium">{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Marca todos los canales y países que el director debe ver. Debe haber al menos uno de cada.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScopeTarget(null)} disabled={savingScope}>Cancelar</Button>
            <Button onClick={saveScope} disabled={savingScope}>
              {savingScope ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Guardando…</> : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Dialog Nuevo / Reemplazar especialista */}
      <Dialog open={!!espForm} onOpenChange={(o) => !o && setEspForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{espForm?.mode === 'replace' ? 'Reemplazar especialista' : 'Nuevo especialista'}</DialogTitle>
            <DialogDescription>
              {espForm?.mode === 'replace'
                ? <>Se creará el nuevo especialista y se revocará el acceso a <b>{espForm.revoke_label}</b>. Se conservan los mismos países y frentes.</>
                : <>Crea la cuenta, asigna el rol y define su alcance. Se enviará una contraseña temporal.</>}
            </DialogDescription>
          </DialogHeader>
          {espForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Nombre</label>
                  <Input value={espForm.nombre} onChange={(e) => setEspForm({ ...espForm, nombre: e.target.value })} placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="text-xs font-medium">Email</label>
                  <Input type="email" value={espForm.email} onChange={(e) => setEspForm({ ...espForm, email: e.target.value })} placeholder="nombre@siigo.com" className="font-mono" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Países</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAISES_DISPONIBLES.map(p => (
                    <label key={p} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={espForm.paises.includes(p)} onCheckedChange={() => setEspForm({ ...espForm, paises: toggleInArr(espForm.paises, p) })} />
                      <span className="text-sm font-medium">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Frentes / Operaciones</p>
                <div className="space-y-1">
                  {OPERACIONES_DISPONIBLES.map(op => (
                    <label key={op} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={espForm.operaciones.includes(op)} onCheckedChange={() => setEspForm({ ...espForm, operaciones: toggleInArr(espForm.operaciones, op) })} />
                      <span className="text-sm font-medium">{op}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Contraseña temporal</label>
                <div className="flex gap-2">
                  <Input value={espForm.password} onChange={(e) => setEspForm({ ...espForm, password: e.target.value })} className="font-mono" />
                  <Button type="button" variant="outline" onClick={() => setEspForm({ ...espForm, password: genPwd() })}>Generar</Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEspForm(null)} disabled={savingEsp}>Cancelar</Button>
            <Button onClick={submitEspForm} disabled={savingEsp}>
              {savingEsp ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Aplicando…</> : (espForm?.mode === 'replace' ? 'Reemplazar' : 'Crear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuevo director */}
      <Dialog open={!!dirForm} onOpenChange={(o) => !o && setDirForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo director</DialogTitle>
            <DialogDescription>
              Crea la cuenta, asigna el rol director y define su alcance de canales y países.
            </DialogDescription>
          </DialogHeader>
          {dirForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Nombre</label>
                  <Input value={dirForm.nombre} onChange={(e) => setDirForm({ ...dirForm, nombre: e.target.value })} placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="text-xs font-medium">Email</label>
                  <Input type="email" value={dirForm.email} onChange={(e) => setDirForm({ ...dirForm, email: e.target.value })} placeholder="nombre@siigo.com" className="font-mono" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Cargo (opcional)</label>
                <Input value={dirForm.cargo} onChange={(e) => setDirForm({ ...dirForm, cargo: e.target.value })} placeholder="Director Comercial LATAM" />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Canales</p>
                <div className="grid grid-cols-2 gap-2">
                  {CANALES_DISPONIBLES.map(c => (
                    <label key={c} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={dirForm.canales.includes(c)} onCheckedChange={() => setDirForm({ ...dirForm, canales: toggleInArr(dirForm.canales, c) })} />
                      <span className="text-sm font-medium">{c}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Países</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAISES_DISPONIBLES.map(p => (
                    <label key={p} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={dirForm.paises.includes(p)} onCheckedChange={() => setDirForm({ ...dirForm, paises: toggleInArr(dirForm.paises, p) })} />
                      <span className="text-sm font-medium">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Contraseña temporal</label>
                <div className="flex gap-2">
                  <Input value={dirForm.password} onChange={(e) => setDirForm({ ...dirForm, password: e.target.value })} className="font-mono" />
                  <Button type="button" variant="outline" onClick={() => setDirForm({ ...dirForm, password: genPwd() })}>Generar</Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDirForm(null)} disabled={savingDir}>Cancelar</Button>
            <Button onClick={submitDirForm} disabled={savingDir}>
              {savingDir ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Creando…</> : 'Crear director'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminEspecialistasAccesos;
