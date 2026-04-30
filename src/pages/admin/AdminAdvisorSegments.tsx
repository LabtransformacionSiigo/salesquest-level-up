import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type Segment = 'nube' | 'legacy';

interface Row {
  comercial: string;
  lider: string | null;
  segment: Segment | null;
  segment_id: string | null;
}

const AdminAdvisorSegments = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSegment, setFilterSegment] = useState<'all' | Segment | 'unassigned'>('all');
  const [filterLider, setFilterLider] = useState<string>('all');
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);

    // Asesores VC Colombia desde ventas (último líder visto por asesor)
    const { data: ventas, error: vErr } = await supabase
      .from('ventas')
      .select('comercial, lider, pais, canal')
      .eq('canal', 'VC')
      .not('comercial', 'is', null);
    if (vErr) {
      toast({ title: 'Error cargando ventas', description: vErr.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const advisorMap = new Map<string, string | null>();
    for (const v of ventas || []) {
      const pais = (v as any).pais;
      if (pais && pais !== '') continue; // sólo Colombia
      const c = (v as any).comercial?.trim();
      if (!c) continue;
      if (!advisorMap.has(c)) advisorMap.set(c, (v as any).lider || null);
    }

    const { data: segs, error: sErr } = await supabase
      .from('advisor_segments')
      .select('id, comercial, segment');
    if (sErr) {
      toast({ title: 'Error cargando segmentos', description: sErr.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const segMap = new Map<string, { id: string; segment: Segment }>();
    for (const s of segs || []) segMap.set((s as any).comercial, { id: (s as any).id, segment: (s as any).segment });

    const merged: Row[] = [...advisorMap.entries()]
      .map(([comercial, lider]) => {
        const s = segMap.get(comercial);
        return { comercial, lider, segment: s?.segment ?? null, segment_id: s?.id ?? null };
      })
      .sort((a, b) => (a.lider || '').localeCompare(b.lider || '') || a.comercial.localeCompare(b.comercial));

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const lideres = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.lider) set.add(r.lider); });
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterLider !== 'all' && r.lider !== filterLider) return false;
      if (filterSegment === 'unassigned' && r.segment) return false;
      if (filterSegment === 'nube' && r.segment !== 'nube') return false;
      if (filterSegment === 'legacy' && r.segment !== 'legacy') return false;
      if (q && !r.comercial.toLowerCase().includes(q) && !(r.lider || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, filterSegment, filterLider]);

  const stats = useMemo(() => ({
    total: rows.length,
    nube: rows.filter((r) => r.segment === 'nube').length,
    legacy: rows.filter((r) => r.segment === 'legacy').length,
    sin: rows.filter((r) => !r.segment).length,
  }), [rows]);

  const updateSegment = async (row: Row, newSegment: Segment) => {
    setSavingId(row.comercial);
    const { error } = await supabase
      .from('advisor_segments')
      .upsert({ comercial: row.comercial, segment: newSegment }, { onConflict: 'comercial' });
    setSavingId(null);
    if (error) {
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' });
      return;
    }
    setRows((prev) => prev.map((r) => r.comercial === row.comercial ? { ...r, segment: newSegment } : r));
    toast({ title: 'Segmento actualizado', description: `${row.comercial} → ${newSegment}` });
  };

  const bulkApplyByLider = async (lider: string, segment: Segment) => {
    const targets = rows.filter((r) => r.lider === lider);
    if (!targets.length) return;
    if (!confirm(`Aplicar segmento "${segment}" a ${targets.length} asesores del líder ${lider}?`)) return;

    const payload = targets.map((t) => ({ comercial: t.comercial, segment }));
    const { error } = await supabase.from('advisor_segments').upsert(payload, { onConflict: 'comercial' });
    if (error) {
      toast({ title: 'Error en bulk', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Bulk aplicado', description: `${targets.length} asesores → ${segment}` });
    fetchData();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Segmentos de Asesores VC</h1>
        <p className="text-muted-foreground">Clasifica cada asesor de Venta Cruzada Colombia como <strong>nube</strong> o <strong>legacy</strong> para la gamificación.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4"><div className="text-sm text-muted-foreground">Total asesores</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Nube</div><div className="text-2xl font-bold text-primary">{stats.nube}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Legacy</div><div className="text-2xl font-bold text-accent">{stats.legacy}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted-foreground">Sin asignar</div><div className="text-2xl font-bold text-destructive">{stats.sin}</div></Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="Buscar asesor o líder…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filterSegment} onValueChange={(v) => setFilterSegment(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los segmentos</SelectItem>
              <SelectItem value="nube">Solo nube</SelectItem>
              <SelectItem value="legacy">Solo legacy</SelectItem>
              <SelectItem value="unassigned">Sin asignar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterLider} onValueChange={setFilterLider}>
            <SelectTrigger><SelectValue placeholder="Líder" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los líderes</SelectItem>
              {lideres.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filterLider !== 'all' && (
          <div className="flex gap-2 pt-2 border-t">
            <span className="text-sm text-muted-foreground self-center">Bulk para {filterLider}:</span>
            <Button size="sm" variant="outline" onClick={() => bulkApplyByLider(filterLider, 'nube')}>Marcar todos como Nube</Button>
            <Button size="sm" variant="outline" onClick={() => bulkApplyByLider(filterLider, 'legacy')}>Marcar todos como Legacy</Button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Sin resultados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Asesor</th>
                  <th className="text-left py-2 px-2">Líder</th>
                  <th className="text-left py-2 px-2">Segmento</th>
                  <th className="text-left py-2 px-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.comercial} className="border-b hover:bg-muted/40">
                    <td className="py-2 px-2 font-medium">{r.comercial}</td>
                    <td className="py-2 px-2 text-muted-foreground">{r.lider || '—'}</td>
                    <td className="py-2 px-2">
                      {r.segment ? (
                        <Badge variant={r.segment === 'nube' ? 'default' : 'secondary'}>{r.segment}</Badge>
                      ) : (
                        <Badge variant="destructive">sin asignar</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <Select
                        value={r.segment || ''}
                        onValueChange={(v) => updateSegment(r, v as Segment)}
                        disabled={savingId === r.comercial}
                      >
                        <SelectTrigger className="w-36 h-8"><SelectValue placeholder="Asignar…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nube">Nube</SelectItem>
                          <SelectItem value="legacy">Legacy</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminAdvisorSegments;
