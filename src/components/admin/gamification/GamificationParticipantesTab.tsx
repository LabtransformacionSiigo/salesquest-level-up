import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Search, Coins } from 'lucide-react';

type Role = 'asesor' | 'gerente';
type Segment = 'nube' | 'legacy' | 'gerente';

interface Participant {
  id: string;
  comercial: string;
  display_name: string | null;
  role: Role;
  segment: Segment;
  gerente_id: string | null;
}

interface Gerente {
  id: string;
  nombre: string;
  email: string | null;
  celula: string | null;
}

interface FormState {
  id?: string;
  comercial: string;
  display_name: string;
  role: Role;
  segment: Segment;
  gerente_id: string | null;
}

const emptyForm: FormState = {
  comercial: '',
  display_name: '',
  role: 'asesor',
  segment: 'nube',
  gerente_id: null,
};

const roleLabel: Record<Role, string> = { asesor: 'Asesor', gerente: 'Gerente' };
const segmentLabel: Record<Segment, string> = {
  nube: 'Nube',
  legacy: 'Legacy',
  gerente: 'Gerente',
};

export default function GamificationParticipantesTab() {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [gerentes, setGerentes] = useState<Gerente[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [pRes, gRes, wRes] = await Promise.all([
      supabase
        .from('participants_gamification')
        .select('id, comercial, display_name, role, segment, gerente_id')
        .order('role', { ascending: false })
        .order('comercial', { ascending: true }),
      supabase
        .from('gerentes')
        .select('id, nombre, email, celula')
        .eq('activo', true)
        .order('nombre'),
      supabase.from('wallet_sp_canje').select('comercial, current_balance'),
    ]);

    if (pRes.error) toast.error('Error cargando participantes');
    if (gRes.error) toast.error('Error cargando gerentes');

    setParticipants((pRes.data ?? []) as Participant[]);
    setGerentes((gRes.data ?? []) as Gerente[]);

    const balMap: Record<string, number> = {};
    (wRes.data ?? []).forEach((w: any) => {
      balMap[w.comercial] = w.current_balance ?? 0;
    });
    setBalances(balMap);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const gerenteById = useMemo(() => {
    const map = new Map<string, Gerente>();
    gerentes.forEach((g) => map.set(g.id, g));
    return map;
  }, [gerentes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return participants.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (!q) return true;
      return (
        p.comercial.toLowerCase().includes(q) ||
        (p.display_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [participants, roleFilter, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Participant) => {
    setForm({
      id: p.id,
      comercial: p.comercial,
      display_name: p.display_name ?? '',
      role: p.role,
      segment: p.segment,
      gerente_id: p.gerente_id,
    });
    setDialogOpen(true);
  };

  const handleRoleChange = (role: Role) => {
    setForm((f) => ({
      ...f,
      role,
      // Si pasa a gerente, segmento queda 'gerente'. Si pasa a asesor, default 'nube'.
      segment: role === 'gerente' ? 'gerente' : f.segment === 'gerente' ? 'nube' : f.segment,
      // Asesor puede tener gerente_id; gerente no.
      gerente_id: role === 'gerente' ? null : f.gerente_id,
    }));
  };

  const validate = (): string | null => {
    if (!form.comercial.trim()) return 'El nombre/identificador comercial es obligatorio';
    if (form.role === 'asesor' && (form.segment !== 'nube' && form.segment !== 'legacy')) {
      return 'Un asesor debe tener segmento Nube o Legacy';
    }
    if (form.role === 'gerente' && form.segment !== 'gerente') {
      return 'Un gerente debe tener segmento Gerente';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const payload = {
      comercial: form.comercial.trim(),
      display_name: form.display_name.trim() || null,
      role: form.role,
      segment: form.segment,
      gerente_id: form.role === 'asesor' ? form.gerente_id : null,
    };

    let res;
    if (form.id) {
      res = await supabase
        .from('participants_gamification')
        .update(payload)
        .eq('id', form.id);
    } else {
      res = await supabase.from('participants_gamification').insert(payload);
    }

    if (res.error) {
      toast.error(res.error.message);
    } else {
      toast.success(form.id ? 'Participante actualizado' : 'Participante creado');
      setDialogOpen(false);
      await loadData();
    }
    setSaving(false);
  };

  const updateSegmentInline = async (p: Participant, segment: Segment) => {
    if (p.role === 'gerente' && segment !== 'gerente') {
      toast.error('Un gerente solo puede tener segmento Gerente');
      return;
    }
    if (p.role === 'asesor' && segment === 'gerente') {
      toast.error('Un asesor no puede tener segmento Gerente');
      return;
    }
    const { error } = await supabase
      .from('participants_gamification')
      .update({ segment })
      .eq('id', p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setParticipants((arr) =>
      arr.map((x) => (x.id === p.id ? { ...x, segment } : x)),
    );
    toast.success('Segmento actualizado');
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="asesor">Asesores</SelectItem>
              <SelectItem value="gerente">Gerentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Agregar participante
        </Button>
      </Card>

      <Card>
        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Gerente asignado</TableHead>
                <TableHead className="text-right">SP Canje</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay participantes que coincidan.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => {
                const ger = p.gerente_id ? gerenteById.get(p.gerente_id) : null;
                const balance = balances[p.comercial] ?? 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.display_name || p.comercial}</div>
                      {p.display_name && (
                        <div className="text-xs text-muted-foreground">{p.comercial}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.role === 'gerente' ? 'default' : 'secondary'}>
                        {roleLabel[p.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.segment}
                        onValueChange={(v) => updateSegmentInline(p, v as Segment)}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {p.role === 'asesor' ? (
                            <>
                              <SelectItem value="nube">Nube</SelectItem>
                              <SelectItem value="legacy">Legacy</SelectItem>
                            </>
                          ) : (
                            <SelectItem value="gerente">Gerente</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {ger ? (
                        <span className="text-sm">
                          {ger.nombre}
                          {ger.celula && (
                            <span className="text-muted-foreground"> · {ger.celula}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="gap-1">
                        <Coins className="h-3 w-3" />
                        {balance}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? 'Editar participante' : 'Agregar participante'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Identificador comercial *</Label>
              <Input
                value={form.comercial}
                onChange={(e) => setForm({ ...form, comercial: e.target.value })}
                placeholder="Nombre tal como aparece en ventas.comercial"
                disabled={!!form.id}
              />
              {!form.id && (
                <p className="text-xs text-muted-foreground">
                  Debe coincidir exactamente con el campo <code>comercial</code> en la tabla de ventas.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Nombre para mostrar</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Rol *</Label>
                <Select value={form.role} onValueChange={(v) => handleRoleChange(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asesor">Asesor</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Segmento *</Label>
                <Select
                  value={form.segment}
                  onValueChange={(v) => setForm({ ...form, segment: v as Segment })}
                  disabled={form.role === 'gerente'}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {form.role === 'asesor' ? (
                      <>
                        <SelectItem value="nube">Nube</SelectItem>
                        <SelectItem value="legacy">Legacy</SelectItem>
                      </>
                    ) : (
                      <SelectItem value="gerente">Gerente</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.role === 'asesor' && (
              <div className="space-y-2">
                <Label>Gerente asignado</Label>
                <Select
                  value={form.gerente_id ?? 'none'}
                  onValueChange={(v) =>
                    setForm({ ...form, gerente_id: v === 'none' ? null : v })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {gerentes.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nombre}
                        {g.celula ? ` · ${g.celula}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {form.id ? 'Guardar cambios' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
