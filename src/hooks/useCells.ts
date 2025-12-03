import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Cell {
  id: string;
  name: string;
  segment: 'Empresarios' | 'Aliados' | 'B&M' | 'Despachos';
  country: string;
  goal: string | null;
  created_at: string;
}

export const useCells = () => {
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCells = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cells')
        .select('*')
        .order('name');

      if (error) throw error;
      setCells(data || []);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching cells:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCells();
  }, []);

  const addCell = async (cell: Omit<Cell, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('cells')
      .insert(cell)
      .select()
      .single();

    if (!error && data) {
      setCells(prev => [...prev, data]);
    }

    return { data, error };
  };

  const updateCell = async (id: string, updates: Partial<Cell>) => {
    const { data, error } = await supabase
      .from('cells')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setCells(prev => prev.map(c => c.id === id ? data : c));
    }

    return { data, error };
  };

  const deleteCell = async (id: string) => {
    const { error } = await supabase
      .from('cells')
      .delete()
      .eq('id', id);

    if (!error) {
      setCells(prev => prev.filter(c => c.id !== id));
    }

    return { error };
  };

  return {
    cells,
    loading,
    error,
    fetchCells,
    addCell,
    updateCell,
    deleteCell,
  };
};
