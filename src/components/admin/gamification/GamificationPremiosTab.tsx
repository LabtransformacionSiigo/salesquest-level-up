import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface Reward {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sp_cost: number;
  stock: number;
  is_active: boolean;
}

const emptyForm = { id: '', name: '', description: '', image_url: '', sp_cost: '100', stock: '-1', is_active: true };

export default function GamificationPremiosTab() {
  const [rows, setRows] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('rewards_catalog').select('*').order('created_at', { ascending: false });
    setRows((data ?? []) as Reward[]); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (r: Reward) => { setForm({ id: r.id, name: r.name, description: r.description ?? '', image_url: r.image_url ?? '', sp_cost: String(r.sp_cost), stock: String(r.stock), is_active: r.is_active }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Falta el nombre'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        image_url: form.image_url || null,
        sp_cost: Number(form.sp_cost),
        stock: Number(form.stock),
        is_active: form.is_active,
      };
      const { error } = form.id
        ? await supabase.from('rewards_catalog').update(payload).eq('id', form.id)
        : await supabase.from('rewards_catalog').insert(payload);
      if (error) throw error;
      toast.success('Premio guardado ✅');
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar premio?')) return;
    const { error } = await supabase.from('rewards_catalog').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Eliminado'); load(); }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Catálogo de premios</h2>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Crear premio</Button></SheetTrigger>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader><SheetTitle>{form.id ? 'Editar premio' : 'Crear premio'}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Descripción</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Imagen URL</Label><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Costo (SP)</Label><Input type="number" value={form.sp_cost} onChange={e => setForm({ ...form, sp_cost: e.target.value })} /></div>
                <div><Label>Stock (-1 ilimitado)</Label><Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>{form.is_active ? 'Activo' : 'Inactivo'}</Label></div>

              {form.image_url && (
                <div className="rounded-lg overflow-hidden border max-h-40">
                  <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                </div>
              )}
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
            <TableHead></TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>SP</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={6} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin premios.</TableCell></TableRow>}
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>{r.image_url ? <img src={r.image_url} className="h-10 w-10 object-cover rounded" alt={r.name} /> : <div className="h-10 w-10 bg-muted rounded" />}</TableCell>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>🪙 {r.sp_cost}</TableCell>
              <TableCell>{r.stock < 0 ? '∞' : r.stock}</TableCell>
              <TableCell><Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
