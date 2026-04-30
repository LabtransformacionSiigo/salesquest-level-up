import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, AlertTriangle, Loader2, Trash2 } from 'lucide-react';

type Frequency = 'daily' | 'weekly' | 'monthly';
type KpiType = 'acv_plus' | 'upgrades' | 'conversions';
type ThresholdKind = 'cop' | 'count' | 'percent';

interface Challenge {
  id: string;
  name: string;
  description: string | null;
  frequency: Frequency;
  kpi_type: KpiType;
  evaluation_scope: ThresholdKind;
  start_date: string;
  end_date: string;
  status: 'draft' | 'active';
}

interface ThresholdRow { segment: 'nube' | 'legacy' | 'gerente'; threshold_value: number | null; sp_canje_reward: number | null; }

const FREQ_LABEL: Record<Frequency, string> = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' };
const KPI_LABEL: Record<KpiType, string> = { acv_plus: 'ACV+', upgrades: 'Upgrades', conversions: 'Conversiones' };
const SCOPE_LABEL: Record<ThresholdKind, string> = { cop: 'Monto COP', count: 'Cantidad', percent: 'Porcentaje %' };

const emptyForm = {
  id: '' as string,
  name: '',
  description: '',
  frequency: 'daily' as Frequency,
  kpi_type: 'acv_plus' as KpiType,
  evaluation_scope: 'cop' as ThresholdKind,
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10),
  status: 'draft' as 'draft' | 'active',
  nube_value: '' as string,
  nube_sp: '' as string,
  legacy_value: '' as string,
  legacy_sp: '' as string,
  gerente_value: '' as string,
  gerente_sp: '' as string,
};

export default function GamificationRetosTab() {
  const [rows, setRows] = useState<Challenge[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, ThresholdRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const [{ data: ch }, { data: th }] = await Promise.all([
      supabase.from('gamification_challenges').select('*').order('created_at', { ascending: false }),
      supabase.from('challenge_thresholds').select('*'),
    ]);
    setRows((ch ?? []) as Challenge[]);
    const grouped: Record<string, ThresholdRow[]> = {};
    (th ?? []).forEach((t: any) => {
      grouped[t.challenge_id] = grouped[t.challenge_id] || [];
      grouped[t.challenge_id].push({ segment: t.segment, threshold_value: t.threshold_value, sp_canje_reward: t.sp_canje_reward });
    });
    setThresholds(grouped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setOpen(true); };

  const openEdit = (c: Challenge) => {
    const t = thresholds[c.id] || [];
    const nube = t.find(x => x.segment === 'nube');
    const legacy = t.find(x => x.segment === 'legacy');
    const gerente = t.find(x => x.segment === 'gerente');
    setForm({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      frequency: c.frequency,
      kpi_type: c.kpi_type,
      evaluation_scope: c.evaluation_scope,
      start_date: c.start_date,
      end_date: c.end_date,
      status: c.status,
      nube_value: nube?.threshold_value?.toString() ?? '',
      nube_sp: nube?.sp_canje_reward?.toString() ?? '',
      legacy_value: legacy?.threshold_value?.toString() ?? '',
      legacy_sp: legacy?.sp_canje_reward?.toString() ?? '',
      gerente_value: gerente?.threshold_value?.toString() ?? '',
      gerente_sp: gerente?.sp_canje_reward?.toString() ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Falta el nombre'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        frequency: form.frequency,
        kpi_type: form.kpi_type,
        evaluation_scope: form.evaluation_scope,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
      };
      let challengeId = form.id;
      if (challengeId) {
        const { error } = await supabase.from('gamification_challenges').update(payload).eq('id', challengeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('gamification_challenges').insert(payload).select('id').single();
        if (error) throw error;
        challengeId = data!.id;
      }

      // Upsert thresholds (delete-and-insert pattern for simplicity)
      await supabase.from('challenge_thresholds').delete().eq('challenge_id', challengeId);
      const inserts: any[] = [];
      if (form.nube_value !== '' && form.nube_sp !== '') {
        inserts.push({ challenge_id: challengeId, segment: 'nube', threshold_value: Number(form.nube_value), sp_canje_reward: Number(form.nube_sp) });
      }
      if (form.legacy_value !== '' && form.legacy_sp !== '') {
        inserts.push({ challenge_id: challengeId, segment: 'legacy', threshold_value: Number(form.legacy_value), sp_canje_reward: Number(form.legacy_sp) });
      }
      if (form.gerente_value !== '' && form.gerente_sp !== '') {
        inserts.push({ challenge_id: challengeId, segment: 'gerente', threshold_value: Number(form.gerente_value), sp_canje_reward: Number(form.gerente_sp) });
      }
      if (inserts.length) {
        const { error } = await supabase.from('challenge_thresholds').insert(inserts);
        if (error) throw error;
      }
      toast.success('Reto guardado ✅');
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error('Error al guardar: ' + e.message);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este reto?')) return;
    await supabase.from('challenge_thresholds').delete().eq('challenge_id', id);
    const { error } = await supabase.from('gamification_challenges').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Reto eliminado'); load(); }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Retos</h2>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Crear reto</Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader><SheetTitle>{form.id ? 'Editar reto' : 'Crear reto'}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Nombre</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Frecuencia</Label>
                  <Select value={form.frequency} onValueChange={(v: Frequency) => setForm({ ...form, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>KPI</Label>
                  <Select value={form.kpi_type} onValueChange={(v: KpiType) => setForm({ ...form, kpi_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acv_plus">ACV+</SelectItem>
                      <SelectItem value="upgrades">Upgrades</SelectItem>
                      <SelectItem value="conversions">Conversiones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de umbral</Label>
                  <Select value={form.evaluation_scope} onValueChange={(v: ThresholdKind) => setForm({ ...form, evaluation_scope: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cop">Monto COP</SelectItem>
                      <SelectItem value="count">Cantidad</SelectItem>
                      <SelectItem value="percent">Porcentaje %</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.status === 'active'} onCheckedChange={v => setForm({ ...form, status: v ? 'active' : 'draft' })} />
                    <Label>{form.status === 'active' ? 'Activo' : 'Borrador'}</Label>
                  </div>
                </div>
                <div>
                  <Label>Fecha inicio</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>Fecha fin</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <h3 className="font-semibold text-sm">Umbrales por segmento</h3>
                <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center">
                  <Badge variant="outline" className="justify-center">☁️ Nube</Badge>
                  <Input placeholder="Umbral" type="number" value={form.nube_value} onChange={e => setForm({ ...form, nube_value: e.target.value })} />
                  <Input placeholder="SP Canje" type="number" value={form.nube_sp} onChange={e => setForm({ ...form, nube_sp: e.target.value })} />
                  {(form.nube_value === '' || form.nube_sp === '') && (
                    <div className="col-span-3"><Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> Sin definir — reto no visible para Nube</Badge></div>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center">
                  <Badge variant="outline" className="justify-center">📦 Legacy</Badge>
                  <Input placeholder="Umbral" type="number" value={form.legacy_value} onChange={e => setForm({ ...form, legacy_value: e.target.value })} />
                  <Input placeholder="SP Canje" type="number" value={form.legacy_sp} onChange={e => setForm({ ...form, legacy_sp: e.target.value })} />
                  {(form.legacy_value === '' || form.legacy_sp === '') && (
                    <div className="col-span-3"><Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> Sin definir — reto no visible para Legacy</Badge></div>
                  )}
                </div>
              </div>
            </div>
            <SheetFooter className="mt-6">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Frecuencia</TableHead>
            <TableHead>KPI</TableHead>
            <TableHead>Umbral</TableHead>
            <TableHead>Segmentos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No hay retos creados.</TableCell></TableRow>}
          {rows.map(c => {
            const t = thresholds[c.id] || [];
            const hasNube = t.some(x => x.segment === 'nube');
            const hasLegacy = t.some(x => x.segment === 'legacy');
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{FREQ_LABEL[c.frequency]}</TableCell>
                <TableCell>{KPI_LABEL[c.kpi_type]}</TableCell>
                <TableCell>{SCOPE_LABEL[c.evaluation_scope]}</TableCell>
                <TableCell className="space-x-1">
                  {hasNube ? <Badge>Nube</Badge> : <Badge variant="outline">Nube</Badge>}
                  {hasLegacy ? <Badge>Legacy</Badge> : <Badge variant="outline">Legacy</Badge>}
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                    {c.status === 'active' ? 'Activo' : 'Borrador'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
