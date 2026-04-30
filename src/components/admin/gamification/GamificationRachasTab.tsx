import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Streak {
  id: string;
  name: string;
  description: string | null;
  active_weekdays: number[];
  evaluation_weekday: number;
  multiplier_reward: number;
  start_date: string;
  end_date: string;
  status: string;
}

const WEEKDAYS = [
  { v: 1, label: 'L' }, { v: 2, label: 'M' }, { v: 3, label: 'X' },
  { v: 4, label: 'J' }, { v: 5, label: 'V' },
];

const emptyForm = {
  id: '',
  name: '',
  description: '',
  active_weekdays: [1, 2, 3] as number[],
  evaluation_weekday: 5,
  multiplier_reward: '2.0',
  nube_threshold: '',
  legacy_threshold: '',
  gerente_threshold: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10),
  status: 'active',
};

export default function GamificationRachasTab() {
  const [rows, setRows] = useState<Streak[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, { segment: string; daily_threshold_cop: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: t }] = await Promise.all([
      supabase.from('gamification_streaks').select('*').order('created_at', { ascending: false }),
      supabase.from('streak_thresholds').select('*'),
    ]);
    setRows((s ?? []) as Streak[]);
    const grouped: Record<string, any[]> = {};
    (t ?? []).forEach((x: any) => {
      grouped[x.streak_id] = grouped[x.streak_id] || [];
      grouped[x.streak_id].push({ segment: x.segment, daily_threshold_cop: x.daily_threshold_cop });
    });
    setThresholds(grouped);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (s: Streak) => {
    const t = thresholds[s.id] || [];
    const nube = t.find(x => x.segment === 'nube');
    const legacy = t.find(x => x.segment === 'legacy');
    const gerente = t.find(x => x.segment === 'gerente');
    setForm({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      active_weekdays: s.active_weekdays,
      evaluation_weekday: s.evaluation_weekday,
      multiplier_reward: String(s.multiplier_reward),
      nube_threshold: nube?.daily_threshold_cop?.toString() ?? '',
      legacy_threshold: legacy?.daily_threshold_cop?.toString() ?? '',
      gerente_threshold: gerente?.daily_threshold_cop?.toString() ?? '',
      start_date: s.start_date,
      end_date: s.end_date,
      status: s.status,
    });
    setOpen(true);
  };

  const toggleDay = (d: number) => {
    setForm(f => ({
      ...f,
      active_weekdays: f.active_weekdays.includes(d) ? f.active_weekdays.filter(x => x !== d) : [...f.active_weekdays, d].sort(),
    }));
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Falta el nombre'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        active_weekdays: form.active_weekdays,
        evaluation_weekday: form.evaluation_weekday,
        multiplier_reward: Number(form.multiplier_reward),
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
      };
      let id = form.id;
      if (id) {
        const { error } = await supabase.from('gamification_streaks').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('gamification_streaks').insert(payload).select('id').single();
        if (error) throw error;
        id = data!.id;
      }
      await supabase.from('streak_thresholds').delete().eq('streak_id', id);
      const inserts: any[] = [];
      if (form.nube_threshold !== '') inserts.push({ streak_id: id, segment: 'nube', daily_threshold_cop: Number(form.nube_threshold) });
      if (form.legacy_threshold !== '') inserts.push({ streak_id: id, segment: 'legacy', daily_threshold_cop: Number(form.legacy_threshold) });
      if (form.gerente_threshold !== '') inserts.push({ streak_id: id, segment: 'gerente', daily_threshold_cop: Number(form.gerente_threshold) });
      if (inserts.length) await supabase.from('streak_thresholds').insert(inserts);
      toast.success('Racha guardada ✅');
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar racha?')) return;
    await supabase.from('streak_thresholds').delete().eq('streak_id', id);
    const { error } = await supabase.from('gamification_streaks').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Eliminada'); load(); }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Rachas</h2>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Crear racha</Button></SheetTrigger>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader><SheetTitle>{form.id ? 'Editar racha' : 'Crear racha'}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Descripción</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>

              <div>
                <Label>Días activos</Label>
                <div className="flex gap-3 mt-2">
                  {WEEKDAYS.map(d => (
                    <label key={d.v} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={form.active_weekdays.includes(d.v)} onCheckedChange={() => toggleDay(d.v)} />
                      <span className="font-mono">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Día de evaluación</Label>
                  <Select value={String(form.evaluation_weekday)} onValueChange={v => setForm({ ...form, evaluation_weekday: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map(d => <SelectItem key={d.v} value={String(d.v)}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Multiplicador</Label>
                  <Input type="number" step="0.1" value={form.multiplier_reward} onChange={e => setForm({ ...form, multiplier_reward: e.target.value })} />
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <h3 className="font-semibold text-sm">Umbral diario por segmento (COP)</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>☁️ Nube</Label>
                    <Input type="number" value={form.nube_threshold} onChange={e => setForm({ ...form, nube_threshold: e.target.value })} />
                  </div>
                  <div>
                    <Label>📦 Legacy</Label>
                    <Input type="number" value={form.legacy_threshold} onChange={e => setForm({ ...form, legacy_threshold: e.target.value })} />
                  </div>
                  <div>
                    <Label>👔 Gerente</Label>
                    <Input type="number" value={form.gerente_threshold} onChange={e => setForm({ ...form, gerente_threshold: e.target.value })} placeholder="Sin definir" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fecha inicio</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>Fecha fin</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
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
            <TableHead>Días activos</TableHead>
            <TableHead>Evaluación</TableHead>
            <TableHead>Multiplicador</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={6} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin rachas.</TableCell></TableRow>}
          {rows.map(s => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="font-mono">{s.active_weekdays.map(d => WEEKDAYS.find(w => w.v === d)?.label).join(' · ')}</TableCell>
              <TableCell>{WEEKDAYS.find(w => w.v === s.evaluation_weekday)?.label}</TableCell>
              <TableCell>{s.multiplier_reward}x</TableCell>
              <TableCell><Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status}</Badge></TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
