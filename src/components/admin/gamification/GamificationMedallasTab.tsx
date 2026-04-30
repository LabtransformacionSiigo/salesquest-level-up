import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Award, Star, Target, Crown, Flame, Trophy, Medal, Zap } from 'lucide-react';

const ICONS: Record<string, any> = { Award, Star, Target, Crown, Flame, Trophy, Medal, Zap };

interface Badge {
  id: string;
  name: string;
  description: string | null;
  lucide_icon_name: string | null;
  condition_type: string;
  condition_target: number;
  sp_canje_reward: number;
}

const CONDITION_TYPES = [
  { v: 'first_sale', label: 'Primera venta del producto' },
  { v: 'total_acv', label: 'ACV+ acumulado' },
  { v: 'total_upgrades', label: 'Total de upgrades' },
  { v: 'streak_count', label: 'Rachas completadas' },
  { v: 'challenges_completed', label: 'Retos completados' },
];

const emptyForm = { id: '', name: '', description: '', lucide_icon_name: 'Award', condition_type: 'first_sale', condition_target: '1', sp_canje_reward: '50' };

export default function GamificationMedallasTab() {
  const [rows, setRows] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('gamification_badges').select('*').order('created_at', { ascending: false });
    setRows((data ?? []) as Badge[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (b: Badge) => setForm({
    id: b.id, name: b.name, description: b.description ?? '',
    lucide_icon_name: b.lucide_icon_name ?? 'Award',
    condition_type: b.condition_type,
    condition_target: String(b.condition_target),
    sp_canje_reward: String(b.sp_canje_reward),
  });

  const save = async () => {
    if (!form.name.trim()) { toast.error('Falta el nombre'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        lucide_icon_name: form.lucide_icon_name,
        condition_type: form.condition_type,
        condition_target: Number(form.condition_target),
        sp_canje_reward: Number(form.sp_canje_reward),
      };
      const { error } = form.id
        ? await supabase.from('gamification_badges').update(payload).eq('id', form.id)
        : await supabase.from('gamification_badges').insert(payload);
      if (error) throw error;
      toast.success('Medalla guardada ✅');
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar medalla?')) return;
    const { error } = await supabase.from('gamification_badges').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Eliminada'); load(); }
  };

  useEffect(() => { if (open) {/* refresh form when opening */} }, [open]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Medallas</h2>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Crear medalla</Button></SheetTrigger>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader><SheetTitle>{form.id ? 'Editar medalla' : 'Crear medalla'}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Descripción</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div>
                <Label>Ícono</Label>
                <Select value={form.lucide_icon_name} onValueChange={v => setForm({ ...form, lucide_icon_name: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(ICONS).map(name => (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2">{(() => { const I = ICONS[name]; return <I className="h-4 w-4" />; })()}{name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de condición</Label>
                <Select value={form.condition_type} onValueChange={v => setForm({ ...form, condition_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITION_TYPES.map(c => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor meta</Label><Input type="number" value={form.condition_target} onChange={e => setForm({ ...form, condition_target: e.target.value })} /></div>
                <div><Label>SP Canje</Label><Input type="number" value={form.sp_canje_reward} onChange={e => setForm({ ...form, sp_canje_reward: e.target.value })} /></div>
              </div>

              <div className="rounded-lg border p-4 flex items-center gap-3 bg-muted/30">
                {(() => { const I = ICONS[form.lucide_icon_name] ?? Award; return <I className="h-10 w-10 text-primary" />; })()}
                <div>
                  <p className="font-semibold">{form.name || 'Vista previa'}</p>
                  <p className="text-xs text-muted-foreground">{form.description || 'Descripción de la medalla'}</p>
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

      {loading ? <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin inline" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">Sin medallas.</p>}
          {rows.map(b => {
            const I = ICONS[b.lucide_icon_name ?? 'Award'] ?? Award;
            return (
              <Card key={b.id} className="p-4 flex items-center gap-3">
                <I className="h-10 w-10 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.description}</p>
                  <p className="text-xs mt-1">🎯 {b.condition_target} · 🪙 {b.sp_canje_reward} SP</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { openEdit(b); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}
