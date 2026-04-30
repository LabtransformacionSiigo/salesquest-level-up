import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface Redemption {
  id: string;
  comercial: string;
  reward_id: string;
  sp_spent: number;
  status: 'pending' | 'delivered' | 'cancelled';
  notes: string | null;
  redeemed_at: string;
  delivered_at: string | null;
  reward_name?: string;
}

export default function GamificationCanjesTab() {
  const [rows, setRows] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('pending');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('reward_redemptions').select('*').order('redeemed_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data: red } = await q;
    const ids = Array.from(new Set((red ?? []).map(r => r.reward_id).filter(Boolean)));
    const { data: rewards } = ids.length
      ? await supabase.from('rewards_catalog').select('id,name').in('id', ids)
      : { data: [] as any[] };
    const nameById = new Map((rewards ?? []).map((r: any) => [r.id, r.name]));
    setRows((red ?? []).map((r: any) => ({ ...r, reward_name: nameById.get(r.reward_id) ?? '—' })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const markDelivered = async (id: string) => {
    const { error } = await supabase.from('reward_redemptions').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Marcado como entregado'); load(); }
  };

  const cancel = async (id: string) => {
    if (!confirm('¿Cancelar canje? Esto NO devuelve los SP automáticamente.')) return;
    const { error } = await supabase.from('reward_redemptions').update({ status: 'cancelled' }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Cancelado'); load(); }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Canjes</h2>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="delivered">Entregados</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asesor</TableHead>
            <TableHead>Premio</TableHead>
            <TableHead>SP gastados</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={6} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No hay canjes.</TableCell></TableRow>}
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.comercial}</TableCell>
              <TableCell>{r.reward_name}</TableCell>
              <TableCell>🪙 {r.sp_spent}</TableCell>
              <TableCell>
                <Badge variant={r.status === 'delivered' ? 'default' : r.status === 'cancelled' ? 'destructive' : 'secondary'}>
                  {r.status === 'pending' ? 'Pendiente' : r.status === 'delivered' ? 'Entregado' : 'Cancelado'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {new Date(r.redeemed_at).toLocaleDateString()}
                {r.delivered_at && <div className="text-muted-foreground">Entregado: {new Date(r.delivered_at).toLocaleDateString()}</div>}
              </TableCell>
              <TableCell className="text-right space-x-1">
                {r.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => markDelivered(r.id)}><CheckCircle2 className="h-4 w-4 mr-1" /> Entregar</Button>
                    <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}><XCircle className="h-4 w-4" /></Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
